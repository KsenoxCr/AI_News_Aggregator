import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { zodToJsonSchema } from "zod-to-json-schema";
import Parser from "rss-parser";
import { v5 as uuidv5 } from "uuid";
import type { DateFormat } from "~/config/business";
import { MAX, DIGEST } from "~/config/business";
import { formatDate } from "~/lib/utils";
import {
  ClassificationSchema,
  DigestRevisionSchema,
  DigestsIntermediarySchema,
} from "~/lib/validators/news";
import {
  createTRPCRouter,
  protectedTranslatedProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db/db";
import type { AgentAdapter, SendRequestResult } from "~/lib/adapters/agent";
import { AgentAdapterFactory, AgentInputFactory } from "~/lib/factories/agent";
import z from "zod";
import type { AgentProvider } from "~/config/business";
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

// TODO: API Error Handling Mechanism for continuing generation where left of

// TODO: Extract fns into semantically appropriate, discrete files

// TODO: Swap "id" as "fetch_id" for semantical clarity or use retrieve distilled sources and fetches as discrete arrays

// TODO: Frontend needs to swap old digests with their updated revisions if they were updated

async function NormalizeFeed(xmlFeed: string, source: Source) {
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
    const id = uuidv5(`${item.guid}:${source.id}`, NAMESPACE);

    // TODO: Placeholder date incase pubDate missing

    feed.push({
      id: id,
      fetch_id: source.id,
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
    feed.every((a) => a.fetch_id === source.id),
    "[NormalizeFeed] every article fetch_id must equal source.id",
  );

  return {
    status: "success",
    feed,
  };
}

async function FetchFeed(source: Source, date: Date) {
  const url =
    source.date_filter_param && source.date_format
      ? `${source.url}?${source.date_filter_param}=${formatDate(date, source.date_format as DateFormat)}`
      : source.url;

  assert(
    URL.canParse(url),
    `[FetchFeed] constructed URL is not valid: "${url}"`,
  );

  const response: Response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/rss+xml, application/atom+xml, text/xml, */*",
      ...(source.previous_etag && { "If-None-Match": source.previous_etag }),
    },
  });

  // TODO: Intricate response status handling

  assert(
    response.status === 304 || response.ok,
    `[FetchFeed] unexpected HTTP status ${response.status} for URL: ${url}`,
  );

  if (response.status === 304) return null; // unchanged feed

  // TODO: updating etag must be atomic with fetched insertion. if etag inserted && fetched insertion fails -> subsequent calls: wont fetch resource with identical etag and cache is empty = no articles to generate digests from

  await db
    .updateTable("fetches")
    .set("previous_etag", response.headers.get("ETag"))
    .where("id", "=", source.id)
    .execute();

  const xml = await response.text();
  assert(xml.length > 0, "[FetchFeed] response body is empty");

  return await NormalizeFeed(xml, source);
}

async function ClassifyArticles(
  agentAdapter: AgentAdapter,
  _translator: Translator,
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

  // TODO: responseFormat logic for models with builtin schema coherence

  // const responseFormat = isOAIAdapter(agentAdapter)
  //   ? `
  //
  // `
  //   : null;

  const input = AgentInputFactory(
    agentAdapter,
    CLASSIFICATION.prompt(serializedArticles, categories, schemaString),
    CLASSIFICATION.systemPrompt,
  );

  // TODO: Maybe use zod schema for validation and on schema mismatch, append the error to the next attempts prompt so the model apprehends which fields mismatched

  const result = await agentAdapter.sendRequest(input, outputSchema);

  if (result.status === "failure") return result;

  const classified = result.data;

  assert(
    Array.isArray(classified),
    `[ClassifyArticles] LLM output must be a JSON array, got: ${typeof classified}`,
  );

  console.log(
    `${classified.length} articles classified out of ${articles.length} input articles`,
  );

  return { status: "success", classified };
}

function UnflattedCached(cached: ArticleWithCategory[]) {
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
    `[UnflattedCached] unflattened length (${unflattened.length}) must be ≤ input row count (${cached.length})`,
  );
  const unflattenedIds = new Set(unflattened.map((a) => a.id));
  assert(
    unflattenedIds.size === unflattened.length,
    "[UnflattedCached] duplicate article ids found in unflattened output",
  );

  return unflattened;
}

function ExtractUnusedArticles(
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

function StripCategories(articles: ArticleWithCategories[]) {
  return articles.map((article) => {
    const { categories, ...rest } = article;
    return { ...rest };
  });
}

// maxInputTokens: MAX(input_tokens) from digest_revisions, or DIGEST.bootstrapMaxTokens on first run
// rateLimits must be non-null (populated by a prior sendRequest call) before either function is invoked

function Chunk<T>(
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

async function* ProcessItems(
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

async function RouteArticlesToDigests(
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

  // TODO: Strip down articles by omitting fields: fetch_id, used + id as article_id

  const input = AgentInputFactory(
    agentAdapter,
    DIGEST_ROUTING.prompt(
      JSON.stringify(articles),
      JSON.stringify(prevDigests),
      schemaString,
    ),
    DIGEST_ROUTING.systemPrompt,
  );

  const result = await agentAdapter.sendRequest(input, outputSchema);

  if (result.status === "failure") return result;

  const routed = result.data;

  assert(
    Array.isArray(routed),
    `[RouteArticlesToDigests] LLM output must be a JSON array, got: ${typeof routed}`,
  );

  console.log(
    `[RouteArticlesToDigests] ${routed.length} articles routed out of ${articles.length} input articles`,
  );

  return { status: "success", routed };
}

// TODO: Routing: digest <-> article should be cardinality of 1 to M -> hence GenererateDigests DigestRequest.article should be articles

async function* GenerateDigests(
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

  console.log(
    `[GenerateDigests] phase 1 complete — ${routingResult.routed.length} articles routed`,
  );

  const maxRow = await db
    .selectFrom("digest_revisions")
    .select(({ fn }) => fn.max("input_tokens").as("max_input_tokens"))
    .executeTakeFirst();

  const maxInputTokens = maxRow?.max_input_tokens ?? DIGEST.bootstrapMaxTokens;

  console.log(`[GenerateDigests] maxInputTokens: ${maxInputTokens}`);

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

  console.log(`[GenerateDigests] phase 2: ${routed.length} digest requests`);

  let count = 0;
  for await (const { item, result } of ProcessItems(
    routed,
    maxInputTokens,
    agentAdapter,
  )) {
    if (result.status === "failure") {
      yield { status: "failure", error: result.error };
      return;
    }
    yield { status: "success", item, data: result.data };
    count++;
  }

  console.log(`[GenerateDigests] phase 2 complete — ${count} results`);
}

// TODO: SoC

// TODO: Translate error message

// TODO: Wrap in tnx appropriately

export const newsRouter = createTRPCRouter({
  generateFeed: protectedTranslatedProcedure
    .input(z.date())
    .subscription(async function* ({ input, ctx }) {
      console.log("[generateFeed] phase 0: start");

      const cached_digests = await db
        .selectFrom("news_digests")
        .where("news_digests.user_id", "=", ctx.session.user.id)
        .where("news_digests.updated_at", ">=", input)
        .innerJoin(
          "digest_revisions",
          "digest_revisions.digest_id",
          "news_digests.id",
        )
        .where(({ eb, selectFrom }) =>
          eb(
            "digest_revisions.revision",
            "=",
            selectFrom("digest_revisions as dr_max")
              .select(({ fn }) => fn.max("dr_max.revision").as("max_rev"))
              .whereRef("dr_max.digest_id", "=", "news_digests.id"),
          ),
        )
        .selectAll()
        .execute();

      console.log(
        `[generateFeed] phase 1: cached digests found: ${cached_digests.length}`,
      );

      for (const digest of cached_digests) {
        yield { status: "success", type: "cached", article: digest };
      }

      console.log("[generateFeed] phase 2: fetching sources");

      const sources = (await db
        .selectFrom("sources")
        .where("user_id", "=", ctx.session.user.id)
        .where("enabled", "=", 1)
        .innerJoin("fetches", "fetches.source_id", "sources.id")
        .select([
          "sources.slug",
          "sources.url",
          "sources.date_filter_param",
          "sources.date_format",
          "fetches.id",
          "fetches.previous_etag",
        ])
        .execute()) as Source[];

      console.log(
        `[generateFeed] phase 3: sources resolved: ${sources.length}`,
      );

      if (sources.length === 0) {
        return yield {
          status: "failure",
          error: {
            code: "NOT_FOUND",
            message: "No sources found",
          },
        };
      }

      let fetchedArray = [] as ArticleWithCategories[];

      console.log("[generateFeed] phase 4: fetching feeds");

      for (const source of sources) {
        const fetchResult = await FetchFeed(source, input);

        if (fetchResult?.error) {
          console.log(
            `[generateFeed] phase 4: fetch failed for source "${source.slug}": ${fetchResult.error.message}`,
          );
          yield {
            status: "error",
            error: {
              code: "FETCH_FAILED",
              message: fetchResult.error.message,
            },
          };
        } else {
          const count = fetchResult?.feed.length ?? 0;
          console.log(
            `[generateFeed] phase 4: fetched ${count} articles from source "${source.slug}"`,
          );
          fetchResult?.feed.forEach((item) => {
            fetchedArray.push({
              ...item,
              categories: null,
            });
          });
        }
      }

      console.log(
        `[generateFeed] phase 5: total fetched articles: ${fetchedArray.length}; querying cache`,
      );

      const cached = await db
        .selectFrom("cached_articles")
        .where("published_at", ">=", input)
        .leftJoin(
          "article_categories",
          "article_categories.article_id",
          "cached_articles.id",
        )
        .select([
          "id",
          "fetch_id",
          "title",
          "link",
          "author",
          "published_at",
          "used",
          "category",
        ])
        .execute();

      console.log(
        `[generateFeed] phase 6: cached article rows from DB: ${cached.length}`,
      );

      const agent = await db
        .selectFrom("agents")
        .where("user_id", "=", ctx.session.user.id)
        .where("enabled", "=", 1)
        .select(["id", "provider", "model", "api_key"])
        .executeTakeFirstOrThrow();

      const classified = [] as ArticleWithCategories[];
      let unclassified: ArticleWithCategories[];

      console.log(
        `[generateFeed] phase 7: agent resolved — model: "${agent.model}", provider: "${agent.provider}"`,
      );

      if (cached.length === 0) {
        console.log(
          "[generateFeed] phase 9a: cache empty — inserting all fetched articles",
        );
        if (fetchedArray.length === 0) {
          console.log(
            "[generateFeed] phase 9a: no fetched articles either — returning early",
          );
          return;
        }

        await db
          .insertInto("cached_articles")
          .values(StripCategories(fetchedArray))
          .execute();

        console.log(
          `[generateFeed] phase 9a: inserted ${fetchedArray.length} articles into cache`,
        );

        unclassified = fetchedArray;
      } else {
        console.log(
          `[generateFeed] phase 9b: unflattening ${cached.length} cached rows`,
        );
        const cachedUnflattened = UnflattedCached(cached);
        console.log(
          `[generateFeed] phase 9b: unflattened to ${cachedUnflattened.length} articles`,
        );

        const [cacheMisses, cachedCatz, cachedUncatz] = ExtractUnusedArticles(
          fetchedArray,
          cachedUnflattened,
        ); // FIX: Why tuple's arrays are possibly undefined

        console.log(
          `[generateFeed] phase 9b: cache misses: ${cacheMisses!.length}, cached+categorised: ${cachedCatz!.length}, cached+uncategorised: ${cachedUncatz!.length}`,
        );

        if (cacheMisses!.length > 0)
          await db
            .insertInto("cached_articles")
            .values(StripCategories(cacheMisses!))
            .execute();

        console.log(
          `[generateFeed] phase 9b: inserted ${cacheMisses!.length} cache misses into DB`,
        );

        unclassified = cacheMisses!;
        cachedUncatz!.forEach((article) => unclassified.push(article));

        console.log(
          `[generateFeed] phase 9b: total unclassified (misses + uncategorised cache): ${unclassified.length}`,
        );

        cachedCatz?.forEach((article) => classified.push(article));
        console.log(
          `[generateFeed] phase 9b: pre-classified from cache: ${classified.length}`,
        );
      }

      console.log(
        `[generateFeed] phase 10: calling ClassifyArticles on ${unclassified.length} articles`,
      );

      const agentAdapter = AgentAdapterFactory(agent.provider as AgentProvider);
      const configured = await agentAdapter.configure(
        agent.api_key,
        agent.model,
      );
      if (configured.status === "failure") {
        return yield {
          status: "failure" as const,
          error: {
            code: configured.error.code,
            message: ctx.t(configured.error.message),
          },
        };
      }

      const result = await ClassifyArticles(agentAdapter, ctx.t, unclassified);

      if (result.status === "failure") {
        console.log(
          `[generateFeed] phase 10: classification failed — code: "${result.error.code}", message: "${result.error.message}"`,
        );
        return yield {
          status: result.status,
          error: {
            code: result.error.code,
            message: ctx.t(result.error.message),
          },
        };
      }

      console.log(
        `[generateFeed] phase 11: classification succeeded — ${result.classified.length} articles classified`,
      );

      if (result.classified.length > 0) {
        const categories = result.classified.flatMap(
          (article) =>
            article.categories?.map((category) => ({
              article_id: article.article_id,
              category,
            })) ?? [],
        );

        unclassified.forEach((article) => {
          const classifiedArticle = result.classified.find(
            (a) => a.article_id === article.id,
          );
          if (classifiedArticle?.categories) {
            classified.push({
              ...article,
              categories: classifiedArticle.categories,
            });
          }
        });

        const expectedCategoryCount = result.classified.reduce(
          (sum, a) => sum + (a.categories?.length ?? 0),
          0,
        );
        assert(
          categories.length === expectedCategoryCount,
          `[generateFeed] categories array length (${categories.length}) does not match sum of cArticle.categories lengths (${expectedCategoryCount})`,
        );
        assert(
          categories.every(
            (c) =>
              typeof c.article_id === "string" &&
              typeof c.category === "string",
          ),
          "[generateFeed] malformed entry in categories array before DB insert",
        );

        console.log(
          `[generateFeed] phase 12: inserting ${categories.length} article_categories rows`,
        );

        await db
          .insertInto("article_categories")
          .ignore()
          .values(categories)
          .execute();

        console.log("[generateFeed] phase 13: done — all DB writes complete");
      }

      const prevDigests = (await db
        .selectFrom("news_digests")
        .where("news_digests.user_id", "=", ctx.session.user.id)
        .innerJoin(
          "digest_revisions",
          "digest_revisions.digest_id",
          "news_digests.id",
        )
        .where(({ eb, selectFrom }) =>
          eb(
            "digest_revisions.revision",
            "=",
            selectFrom("digest_revisions as dr_max")
              .select(({ fn }) => fn.max("dr_max.revision").as("max_rev"))
              .whereRef("dr_max.digest_id", "=", "news_digests.id"),
          ),
        )
        .select([
          "news_digests.id",
          "digest_revisions.title",
          "digest_revisions.digest",
          "digest_revisions.revision",
        ])
        .execute()) as PrevDigest[];

      console.log(
        `[generateFeed] phase 14: retrieved ${prevDigests.length} existing digest headers`,
      );

      // TODO: GenerateDigests: routing prompt instructing to reconcile with categories in mind + return obj (schema change) augmented with "additional_categories" field (string array, empty or populated)

      type NewDigest = {
        id: string;
        user_id: string;
        expires_at: Date;
        updated_at: Date;
      };

      type NewRevision = {
        id: string;
        digest_id: string;
        article_id: string;
        revision: number;
        agent_id: string;
        title: string;
        digest: string;
        input_tokens: number;
      };

      type DigestCategory = { digest_id: string; category: string };

      const newDigestAggregates: NewDigest[] = [];
      const newDigestCategories: DigestCategory[] = [];
      const newRevisions: NewRevision[] = [];
      const updateRevisions = new Map<string, NewRevision[]>();

      for await (const result of GenerateDigests(
        agentAdapter,
        ctx.t,
        classified,
        prevDigests,
      )) {
        if (result.status === "failure") return yield result;

        const { item, data, meta } = result;
        const isNew = item.digest === "new";
        const digestId = isNew ? randomUUID() : (item.digest as PrevDigest).id;
        const revisionNumber = isNew
          ? 1
          : (item.digest as PrevDigest).revision + 1;

        const revision: NewRevision = {
          id: randomUUID(),
          digest_id: digestId,
          article_id: item.article.id,
          revision: revisionNumber,
          agent_id: agent.id,
          title: data.title,
          digest: data.digest,
          input_tokens: meta.inputTokens,
        };

        if (isNew) {
          newDigestAggregates.push({
            id: digestId,
            user_id: ctx.session.user.id,
            expires_at: new Date(Date.now() + MAX.timeframe),
            updated_at: new Date(),
          });
        } else {
          const bucket = updateRevisions.get(digestId) ?? [];
          bucket.push(revision);
          updateRevisions.set(digestId, bucket);
        }

        item.article.categories?.forEach((category) =>
          newDigestCategories.push({ digest_id: digestId, category }),
        );

        newRevisions.push(revision);
      }

      // Filter missing digest categories - strip categories already present on updated digests
      if (updateRevisions.size > 0) {
        const updateDigestIds = [...updateRevisions.keys()];
        const prevDigestCategories = await db
          .selectFrom("digest_categories")
          .where("digest_id", "in", updateDigestIds)
          .select(["digest_id", "category"])
          .execute();

        const prevCatSet = new Set(
          prevDigestCategories.map((c) => `${c.digest_id}:${c.category}`),
        );

        const filtered = newDigestCategories.filter(
          (c) =>
            !updateDigestIds.includes(c.digest_id) ||
            !prevCatSet.has(`${c.digest_id}:${c.category}`),
        );
        newDigestCategories.splice(0, newDigestCategories.length, ...filtered);
      }

      if (newRevisions.length > 0) {
        await db.transaction().execute(async (trx) => {
          if (newDigestAggregates.length > 0)
            await trx
              .insertInto("news_digests")
              .values(newDigestAggregates)
              .execute();

          if (newDigestCategories.length > 0)
            await trx
              .insertInto("digest_categories")
              .values(newDigestCategories)
              .execute();

          await trx
            .insertInto("digest_revisions")
            .values(newRevisions)
            .execute();

          await trx
            .updateTable("cached_articles")
            .set("used", 1)
            .where(
              "id",
              "in",
              newRevisions.map((result) => result.article_id),
            )
            .execute();

          for (const digestId of updateRevisions.keys()) {
            await trx
              .updateTable("news_digests")
              .set("updated_at", new Date())
              .where("id", "=", digestId)
              .execute();
          }
        });
      }

      return yield { status: "success" };
    }),
  // viewDigest: protectedProcedure
});
