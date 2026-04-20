import assert from "node:assert/strict";
import { zodToJsonSchema } from "zod-to-json-schema";
import Parser from "rss-parser";
import { v5 as uuidv5 } from "uuid";
import type { DateFormat } from "~/config/business";
import { DIGEST } from "~/config/business";
import { formatDate } from "~/lib/utils";
import {
  ClassificationSchema,
  DigestRevisionSchema,
  DigestsIntermediarySchema,
} from "~/lib/validators/news";
import { db } from "~/server/db/db";
import type { AgentAdapter, SendRequestResult } from "~/lib/adapters/agent";
import { AgentInputFactory } from "~/lib/factories/agent";
import { fetchFeedXml } from "~/lib/utils/feed";
import z from "zod";
import {
  CLASSIFICATION,
  DIGEST_GENERATION,
  DIGEST_ROUTING,
} from "~/lib/prompts";
import type {
  Article,
  ArticleWithCategories,
  ArticleWithCategory,
  ClassifyArticlesResult,
  DigestRequest,
  DigestRoutingResult,
  PrevDigest,
  PrevDigestHeader,
  Source,
  Translator,
} from "~/server/db/types";

export async function NormalizeFeed(xmlFeed: string, source: Source) {
  const parser = new Parser({
    defaultRSS: 2.0,
  });

  // TODO: More granular error handling if feasable

  let rawFeed;

  try {
    rawFeed = await parser.parseString(xmlFeed);
  } catch (err) {
    return {
      status: "failure",
      error: {
        code: "NORMALIZATION_ERROR",
        message: (err as Error).message,
        source: source.slug,
      },
    };
  }

  assert(
    Array.isArray(rawFeed.items),
    `[NormalizeFeed] rawFeed.items must be an array, got ${typeof rawFeed.items}`,
  );

  const feed = [] as Article[];
  const NAMESPACE = uuidv5.URL;

  rawFeed.items.forEach((item) => {
    const nonce = item.guid ?? `${item.title}:${item.link}`;
    const id = uuidv5(`${nonce}:${source.id}`, NAMESPACE);

    feed.push({
      id: id,
      source_id: source.id,
      title: item.title ?? "",
      link: item.link ?? "",
      author: item.creator ?? "",
      published_at: new Date(item.pubDate ?? ""),
      used: 0,
    });
  });

  assert(
    feed.length === rawFeed.items.length,
    `[NormalizeFeed] feed length (${feed.length}) must equal rawFeed.items length (${rawFeed.items.length})`,
  );
  assert(
    feed.every((a) => typeof a.id === "string" && a.id.length === 36),
    "[NormalizeFeed] every article must have a valid UUID id",
  );
  assert(
    feed.every((a) => a.source_id === source.id),
    "[NormalizeFeed] every article source_id must equal source.id",
  );

  return {
    status: "success",
    feed,
  };
}

export async function FetchFeed(source: Source, date: Date) {
  const url =
    source.date_filter_param && source.date_format
      ? `${source.url}?${source.date_filter_param}=${formatDate(date, source.date_format as DateFormat)}`
      : source.url;

  assert(
    URL.canParse(url),
    `[FetchFeed] constructed URL is not valid: "${url}"`,
  );

  // TODO: second-class error handling derived from fetchFeedXml result obj

  const fetched = await fetchFeedXml(url, source.previous_etag);

  if (fetched.statusCode === 304) return null; // unchanged feed

  // TODO: updating etag must be atomic with fetched insertion. if etag inserted && fetched insertion fails -> subsequent calls: wont fetch resource with identical etag and cache is empty = no articles to generate digests from

  await db
    .updateTable("sources")
    .set("previous_etag", fetched.etag)
    .where("id", "=", source.id)
    .execute();

  return await NormalizeFeed(fetched.xml, source);
}

export async function ClassifyArticles(
  agentAdapter: AgentAdapter,
  translator: Translator,
  articles: ArticleWithCategories[],
): Promise<ClassifyArticlesResult> {
  assert(
    articles.length > 0,
    "[ClassifyArticles] articles array must be non-empty",
  );

  const serializedArticles = JSON.stringify(articles);

  const outputSchema = ClassificationSchema;
  const schemaString = JSON.stringify(zodToJsonSchema(outputSchema));

  const categories = (
    await db.selectFrom("user_categories").select("category").execute()
  ).map((uc) => uc.category);

  const input = AgentInputFactory(
    agentAdapter,
    CLASSIFICATION.prompt(serializedArticles, categories, schemaString),
    CLASSIFICATION.systemPrompt,
  );

  const result = await agentAdapter.sendRequest(input, outputSchema);

  if (result.status === "failure")
    return {
      status: "failure",
      error: { ...result.error, message: translator(result.error.message) },
    };

  const classified = result.data.classifications;

  assert(
    Array.isArray(classified),
    `[ClassifyArticles] LLM output must be a JSON array, got: ${typeof classified}`,
  );

  return { status: "success", classified };
}

export function UnflattenCached(cached: ArticleWithCategory[]) {
  const unflattened = [] as ArticleWithCategories[];
  let prevItem: ArticleWithCategories | undefined;

  cached.forEach((article) => {
    const { category, ...fields } = article;

    // Not previous | categories null
    if (article.id !== prevItem?.id || !prevItem.categories) {
      unflattened.push({
        ...fields,
        categories: article.category ? [article.category] : null,
      });

      prevItem = unflattened[unflattened.length - 1];
    } else {
      prevItem.categories.push(article.category!);
    }
  });

  assert(
    unflattened.length <= cached.length,
    `[UnflattenCached] unflattened length (${unflattened.length}) must be ≤ input row count (${cached.length})`,
  );
  const unflattenedIds = new Set(unflattened.map((a) => a.id));
  assert(
    unflattenedIds.size === unflattened.length,
    "[UnflattenCached] duplicate article ids found in unflattened output",
  );

  return unflattened;
}

export function ExtractUnusedArticles(
  fetched: Article[],
  cached: ArticleWithCategories[],
) {
  // TODO: Add threshold logic: cartesian product (fetched (N) x cached (M)) > threshold ? hashmap O(N): origin array O(NM)

  const fetchedMap = new Map<string, Article>();

  fetched.forEach((item) => fetchedMap.set(item.id, item));

  const cachedCatz = [] as ArticleWithCategories[];
  const cachedUncatz = [] as ArticleWithCategories[];

  for (const cArticle of cached) {
    const fArticle = fetchedMap.get(cArticle.id);

    // Cached but not yet used
    if (!fArticle || !cArticle.used) {
      cArticle.categories
        ? cachedCatz.push(cArticle)
        : cachedUncatz.push(cArticle);
    }

    fetchedMap.delete(cArticle.id);
  }

  const cacheMisses = [] as ArticleWithCategories[];

  // Cache misses
  fetchedMap.forEach((article) => {
    cacheMisses.push({
      ...article,
      categories: null,
    });
  });

  // Assert buckets are disjoint
  const missIds = new Set(cacheMisses.map((a) => a.id));
  const catzIds = new Set(cachedCatz.map((a) => a.id));
  const uncatzIds = new Set(cachedUncatz.map((a) => a.id));
  assert(
    [...missIds].every((id) => !catzIds.has(id) && !uncatzIds.has(id)),
    "[ExtractUnusedArticles] cacheMisses overlaps with cachedCatz or cachedUncatz",
  );
  assert(
    [...catzIds].every((id) => !uncatzIds.has(id)),
    "[ExtractUnusedArticles] cachedCatz overlaps with cachedUncatz",
  );
  // Assert total conservation: every fetched id ends up in exactly one bucket or was a used cache hit (deleted from map)
  assert(
    cacheMisses.length + cachedCatz.length + cachedUncatz.length <=
      fetched.length + cached.length,
    "[ExtractUnusedArticles] total bucket size exceeds sum of inputs — article duplication detected",
  );

  return [cacheMisses, cachedCatz, cachedUncatz];
}

export function Chunk<T>(
  items: T[],
  maxInputTokens: number,
  agentAdapter: AgentAdapter,
): T[][] {
  assert(
    agentAdapter.rateLimits !== null,
    "[Chunk] rateLimits not yet populated",
  );
  const { TPI, RPI } = agentAdapter.rateLimits;
  const maxItems = Math.min(Math.floor(TPI / maxInputTokens), RPI);

  // TODO: cleaner error message and handling (user-facing)

  if (maxItems === 0) throw new Error("input doesn't fit within TPI");

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += maxItems) {
    batches.push(items.slice(i, i + maxItems));
  }
  return batches;
}

export async function* ProcessItems(
  items: DigestRequest[],
  maxInputTokens: number,
  agentAdapter: AgentAdapter,
): AsyncGenerator<{
  item: DigestRequest;
  result: SendRequestResult<z.infer<typeof DigestRevisionSchema>>;
}> {
  assert(
    agentAdapter.rateLimits !== null,
    "[ProcessItems] rateLimits not yet populated",
  );
  const batches = Chunk(items, maxInputTokens, agentAdapter);
  const schemaString = JSON.stringify(zodToJsonSchema(DigestRevisionSchema));

  for (let i = 0; i < batches.length; i++) {
    if (i > 0) {
      const { RR, TR } = agentAdapter.rateLimits!;
      await new Promise<void>((resolve) =>
        setTimeout(resolve, Math.max(RR, TR) + 10),
      );
    }

    for (const item of batches[i]!) {
      const result = await agentAdapter.sendRequest(
        AgentInputFactory(
          agentAdapter,
          DIGEST_GENERATION.prompt(
            JSON.stringify(item.article),
            item.digest === "new" ? "new" : JSON.stringify(item.digest),
            schemaString,
          ),
          DIGEST_GENERATION.systemPrompt,
        ),
        DigestRevisionSchema,
      );
      yield { item, result };
    }
  }
}

export async function RouteArticlesToDigests(
  agentAdapter: AgentAdapter,
  articles: ArticleWithCategories[],
  prevDigests: PrevDigestHeader[],
): Promise<DigestRoutingResult> {
  assert(
    articles.length > 0,
    "[RouteArticlesToDigests] articles array must be non-empty",
  );

  const outputSchema = DigestsIntermediarySchema;
  const schemaString = JSON.stringify(zodToJsonSchema(outputSchema));

  const stripped = articles.map(
    ({ id, title, link, author, published_at, categories }) => ({
      article_id: id,
      title,
      link,
      author,
      published_at,
      categories,
    }),
  );

  const input = AgentInputFactory(
    agentAdapter,
    DIGEST_ROUTING.prompt(
      JSON.stringify(stripped),
      JSON.stringify(prevDigests),
      schemaString,
    ),
    DIGEST_ROUTING.systemPrompt,
  );

  const result = await agentAdapter.sendRequest(input, outputSchema);

  if (result.status === "failure") return result;

  const routed = result.data.routings;

  assert(
    Array.isArray(routed),
    `[RouteArticlesToDigests] LLM output must be a JSON array, got: ${typeof routed}`,
  );

  return { status: "success", routed };
}

// TODO: Routing: digest <-> article should be cardinality of 1 to M -> hence GenerateDigests DigestRequest.article should be articles

export async function* GenerateDigests(
  agentAdapter: AgentAdapter,
  _translator: Translator,
  articles: ArticleWithCategories[],
  prevDigests: PrevDigest[],
): AsyncGenerator<
  | { status: "failure"; error: { code: string; message: string } }
  | {
      status: "success";
      item: DigestRequest;
      data: z.infer<typeof DigestRevisionSchema>;
      meta: { inputTokens: number };
    }
> {
  assert(
    articles.length > 0,
    "[GenerateDigests] articles array must be non-empty",
  );

  // Strip to { id, title } — avoid sending digest content into the routing prompt
  const prevDigestHeaders: PrevDigestHeader[] = prevDigests.map(
    ({ id, title }) => ({ id, title }),
  );

  // Phase 1: route articles to existing digests or flag as new
  const routingResult = await RouteArticlesToDigests(
    agentAdapter,
    articles,
    prevDigestHeaders,
  );

  if (routingResult.status === "failure") {
    yield { status: "failure", error: routingResult.error };
    return;
  }

  const maxRow = await db
    .selectFrom("digest_revisions")
    .select(({ fn }) => fn.max("input_tokens").as("max_input_tokens"))
    .executeTakeFirst();

  const maxRowInputTokens = maxRow?.max_input_tokens;

  const maxInputTokens =
    maxRowInputTokens && maxRowInputTokens > 0
      ? maxRowInputTokens
      : DIGEST.bootstrapMaxTokens;

  const prevDigestsMap = new Map<string, PrevDigest>(
    prevDigests.map((d) => [d.id, d]),
  );

  const articlesMap = new Map(articles.map((a) => [a.id, a]));

  const routed: DigestRequest[] = routingResult.routed.flatMap((entry) => {
    const article = articlesMap.get(entry.article_id);
    if (!article) return [];
    return entry.digests
      .map((d) => (d === "new" ? "new" : prevDigestsMap.get(d)))
      .filter((d): d is PrevDigest | "new" => d !== undefined)
      .map((digest) => ({ article, digest }));
  });

  for await (const { item, result } of ProcessItems(
    routed,
    maxInputTokens,
    agentAdapter,
  )) {
    if (result.status === "failure") {
      yield { status: "failure", error: result.error };
      return;
    }
    yield { status: "success", item, data: result.data, meta: result.meta };
  }
}
