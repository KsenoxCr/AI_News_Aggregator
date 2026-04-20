import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { logMem } from "~/lib/utils/debug";
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
import { decrypt } from "~/lib/utils/crypto";
import { fetchFeedXml } from "~/lib/utils/feed";
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

// TODO: Total refactor

// TODO: Extract fns into semantically appropriate, discrete files

// TODO: fetcher used for new source validation

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
    const nonce = item.guid ?? `${item.title}:${item.link}`;
    const id = uuidv5(`${nonce}:${source.id}`, NAMESPACE);

    // TODO: Placeholder date incase pubDate missing

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

async function FetchFeed(source: Source, date: Date) {
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

async function ClassifyArticles(
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

  // console.log(`${classified.length} articles classified out of ${articles.length} input articles`);

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

  // console.log(
  //   `[RouteArticlesToDigests] input articles (${stripped.length}):`,
  //   JSON.stringify(stripped, null, 2),
  // );
  // console.log(
  //   `[RouteArticlesToDigests] prevDigests (${prevDigests.length}):`,
  //   JSON.stringify(prevDigests, null, 2),
  // );

  const input = AgentInputFactory(
    agentAdapter,
    DIGEST_ROUTING.prompt(
      JSON.stringify(stripped),
      JSON.stringify(prevDigests),
      schemaString,
    ),
    DIGEST_ROUTING.systemPrompt,
  );

  // console.log("####################");
  // console.log(input);

  const result = await agentAdapter.sendRequest(input, outputSchema);

  // console.log(
  //   `[RouteArticlesToDigests] raw result:`,
  //   JSON.stringify(result, null, 2),
  // );

  if (result.status === "failure") return result;

  const routed = result.data.routings;

  assert(
    Array.isArray(routed),
    `[RouteArticlesToDigests] LLM output must be a JSON array, got: ${typeof routed}`,
  );

  // console.log(
  //   `[RouteArticlesToDigests] ${routed.length} routings out of ${articles.length} input articles:`,
  //   JSON.stringify(routed, null, 2),
  // );

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

  console.log(
    `[GenerateDigests] phase 1 complete — ${routingResult.routed.length} articles routed`,
  );

  const maxRow = await db
    .selectFrom("digest_revisions")
    .select(({ fn }) => fn.max("input_tokens").as("max_input_tokens"))
    .executeTakeFirst();

  const maxRowInputTokens = maxRow?.max_input_tokens;

  const maxInputTokens =
    maxRowInputTokens && maxRowInputTokens > 0
      ? maxRowInputTokens
      : DIGEST.bootstrapMaxTokens;

  // console.log(`[GenerateDigests] maxInputTokens: ${maxInputTokens}`);

  const prevDigestsMap = new Map<string, PrevDigest>(
    prevDigests.map((d) => [d.id, d]),
  );

  const articlesMap = new Map(articles.map((a) => [a.id, a]));

  // console.log("############################");
  // console.log(routingResult.routed);

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
    yield { status: "success", item, data: result.data, meta: result.meta };
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
    .subscription(async function* ({ input: rawInput, ctx, signal }) {
      const input = new Date(rawInput);
      input.setUTCHours(0, 0, 0, 0);

      // console.log(input);

      console.log("[generateFeed] phase 0: start");

      const cachedDigests = (await db
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
          "news_digests.updated_at",
          "digest_revisions.article_id",
          "digest_revisions.title",
          "digest_revisions.digest",
          "digest_revisions.revision",
        ])
        .execute()) as (PrevDigest & {
        article_id: string;
        updated_at: Date;
      })[];

      const prevDigestCategoryRows = cachedDigests.length
        ? await db
            .selectFrom("digest_categories")
            .where(
              "digest_id",
              "in",
              cachedDigests.map((d) => d.id),
            )
            .select(["digest_id", "category"])
            .execute()
        : [];

      const prevCategoriesMap = new Map<string, string[]>();
      for (const row of prevDigestCategoryRows) {
        const bucket = prevCategoriesMap.get(row.digest_id) ?? [];
        bucket.push(row.category);
        prevCategoriesMap.set(row.digest_id, bucket);
      }

      console.log(
        `[generateFeed] phase 1: cached digests found: ${cachedDigests.length}`,
      );

      const cachedToYield = cachedDigests
        .filter((d) => {
          const pass = d.updated_at >= input;
          // console.log(`[cachedDigests filter] updated_at=${d.updated_at.toISOString()} input=${input.toISOString()} pass=${pass}`);
          return pass;
        })
        .map((digest) => ({
          title: digest.title,
          digest: digest.digest,
          article_id: digest.article_id,
          digest_id: digest.id,
          categories: prevCategoriesMap.get(digest.id) ?? [],
          updated_at: digest.updated_at,
        }));

      if (cachedToYield.length > 0)
        yield { status: "success" as const, digestRevisions: cachedToYield };

      if (signal?.aborted) return;
      console.log("[generateFeed] phase 2: fetching sources");

      const sources = (await db
        .selectFrom("sources")
        .where("user_id", "=", ctx.session.user.id)
        .where("enabled", "=", 1)
        .select([
          "sources.id",
          "sources.slug",
          "sources.url",
          "sources.date_filter_param",
          "sources.date_format",
          "sources.previous_etag",
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
      logMem("pre-fetch-loop");

      yield {
        status: "success" as const,
        info: ctx.t("success.feed.fetchingSources"),
      };

      for (const source of sources) {
        if (signal?.aborted) return;
        logMem(`FetchFeed:${source.slug}`);
        const fetchResult = await FetchFeed(source, input);

        if (!fetchResult) continue;

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
      logMem("pre-cache-query");

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
          "source_id",
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
          .ignore()
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
            .ignore()
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
      logMem("pre-classify");

      const configured = await AgentAdapterFactory(
        agent.provider as AgentProvider,
        decrypt(ctx.mk, agent.api_key),
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
      const agentAdapter = configured.adapter;

      if (signal?.aborted) return;
      yield {
        status: "success" as const,
        info: ctx.t("success.feed.classifyingArticles"),
      };

      // console.log("---------- unclassified ----------");
      // console.log(unclassified);

      const result = await ClassifyArticles(agentAdapter, ctx.t, unclassified);

      if (result.status === "failure") {
        console.log(
          `[generateFeed] phase 10: classification failed — code: "${result.error.code}", message: "${result.error.message}"`,
        );
        return yield { status: result.status, error: result.error };
      }

      console.log(
        `[generateFeed] phase 11: classification succeeded — ${result.classified.length} articles classified`,
      );

      // TODO: if classified.length = 0 -> early exit, no articles to generate digests from

      if (result.classified.length > 0) {
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

        // console.log("---------- classified ----------");
        // console.log(classified);

        const categories = result.classified.flatMap(
          (article) =>
            article.categories?.map((category) => ({
              article_id: article.article_id,
              category,
            })) ?? [],
        );

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

      console.log(
        `[generateFeed] phase 14: using ${cachedDigests.length} existing digest headers`,
      );

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

      let count = 1;

      yield {
        status: "success" as const,
        info: ctx.t("success.feed.generatingDigests"),
      };

      logMem("pre-generate-loop");

      for await (const result of GenerateDigests(
        agentAdapter,
        ctx.t,
        classified,
        cachedDigests,
      )) {
        if (signal?.aborted) return;
        if (result.status === "failure") return yield result;

        logMem(`GenerateDigests:#${count}`);
        const { item, data, meta } = result;
        const isNew = item.digest === "new";
        const digestId = isNew ? randomUUID() : (item.digest as PrevDigest).id;
        const categories = isNew
          ? (item.article.categories ?? [])
          : (prevCategoriesMap.get(digestId) ?? []);

        // console.log(`digest #${count} out of ${classified.length} yielded`);
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

        await db.transaction().execute(async (trx) => {
          if (isNew) {
            await trx
              .insertInto("news_digests")
              .values({
                id: digestId,
                user_id: ctx.session.user.id,
                expires_at: new Date(Date.now() + MAX.timeframe),
                updated_at: new Date(),
              })
              .execute();

            if (categories.length > 0)
              await trx
                .insertInto("digest_categories")
                .values(
                  categories.map((category) => ({
                    digest_id: digestId,
                    category,
                  })),
                )
                .execute();
          } else {
            const prevCats = await trx
              .selectFrom("digest_categories")
              .where("digest_id", "=", digestId)
              .select("category")
              .execute();

            const prevCatSet = new Set(prevCats.map((c) => c.category));
            const newCats = categories.filter((c) => !prevCatSet.has(c));

            if (newCats.length > 0)
              await trx
                .insertInto("digest_categories")
                .values(
                  newCats.map((category) => ({
                    digest_id: digestId,
                    category,
                  })),
                )
                .execute();

            await trx
              .updateTable("news_digests")
              .set("updated_at", new Date())
              .where("id", "=", digestId)
              .execute();
          }

          await trx.insertInto("digest_revisions").values(revision).execute();

          await trx
            .updateTable("cached_articles")
            .set("used", 1)
            .where("id", "=", item.article.id)
            .execute();
        });

        yield {
          status: result.status,
          digestRevision: {
            title: data.title,
            digest: data.digest,
            article_id: item.article.id,
            digest_id: digestId,
            categories,
            updated_at: new Date(),
          },
        };

        count++;
      }

      return yield { status: "success" };
    }),
  getRevisions: protectedTranslatedProcedure
    .input(z.string())
    .query(async ({ input: digestId }) => {
      const [rows, categoryRows] = await Promise.all([
        db
          .selectFrom("digest_revisions")
          .where("digest_revisions.digest_id", "=", digestId)
          .innerJoin(
            "cached_articles",
            "cached_articles.id",
            "digest_revisions.article_id",
          )
          .innerJoin("agents", "agents.id", "digest_revisions.agent_id")
          .innerJoin("sources", "sources.id", "cached_articles.source_id")
          .select([
            "digest_revisions.title",
            "digest_revisions.digest",
            "digest_revisions.created_at",
            "digest_revisions.article_id",
            "agents.provider",
            "agents.model",
            "sources.slug as source_slug",
            "sources.url as source_url",
            "cached_articles.title as article_title",
            "cached_articles.author",
            "cached_articles.link",
            "cached_articles.published_at",
          ])
          .execute(),
        db
          .selectFrom("digest_categories")
          .where("digest_id", "=", digestId)
          .select("category")
          .execute(),
      ]);

      return {
        categories: categoryRows.map((r) => r.category),
        revisions: rows.map((r) => ({
          title: r.title,
          digest: r.digest,
          created_at: r.created_at,
          agent: { provider: r.provider, model: r.model },
          article: {
            id: r.article_id,
            source: { slug: r.source_slug, url: r.source_url },
            title: r.article_title,
            author: r.author,
            link: r.link,
            published_at: r.published_at,
          },
        })),
      };
    }),
});
