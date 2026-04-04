import assert from "node:assert/strict";
import { zodToJsonSchema } from "zod-to-json-schema";
import Parser from "rss-parser";
import { v5 as uuidv5 } from "uuid";
import type { AgentEndpoint, DateFormat } from "~/config/business";
import { formatDate } from "~/lib/utils";
import { ClassificationSchema } from "~/lib/validators/news";
import {
  createTRPCRouter,
  protectedTranslatedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db/db";
import type {
  Agents,
  ArticleCategories,
  CachedArticles,
  Fetches,
  Sources,
} from "~/server/db/gen_types";
import type { AgentAdapter, AgentInput } from "~/lib/adapters/agent";
import { AgentAdapterFactory, AgentInputFactory } from "~/lib/factories/agent";
import z from "zod";

// TODO: API Error Handling Mechanism for continuing generation where left of

// TODO: Swap "id" as "fetch_id" for semantical clarity or use retrieve distilled sources and fetches as discrete arrays
type Source = Pick<
  Sources,
  "slug" | "url" | "date_filter_param" | "date_format"
> &
  Pick<Fetches, "id" | "previous_etag">;

type Article = Omit<CachedArticles, "used"> & {
  used: number;
};

type ArticleWithCategories = Article & {
  categories: string[] | null;
};

type ArticleWithCategory = Article & {
  category: string | null;
};

type Agent = Pick<Agents, "url" | "model" | "api_key">;

type ClassifyArticlesResult =
  | {
      status: "success";
      classified: ArticleWithCategories[];
    }
  | {
      status: "failure";
      error: {
        code: string;
        message: string;
      };
    };

// TODO: update used field for cache items + fetch digest_generated = true

// TODO: Add misses to cache

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
      used: 1,
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
  agent: Agent,
  agentAdapter: AgentAdapter,
  articles: ArticleWithCategories[],
): Promise<ClassifyArticlesResult> {
  assert(
    articles.length > 0,
    "[ClassifyArticles] articles array must be non-empty",
  );

  const serializedArticles = JSON.stringify(articles);

  const outputSchema = ClassificationSchema;
  const schemaString = JSON.stringify(zodToJsonSchema(outputSchema));

  // TODO: LLM instructions

  const systemPrompt = `

  `;

  const prompt = `


    \`\`\`(input)
    ${serializedArticles}
    \`\`\`

    \`\`\`(output format)
    ${schemaString}
    \`\`\`
  `;

  // TODO: responseFormat logic for models with builtin schema coherence

  // const responseFormat = isOAIAdapter(agentAdapter)
  //   ? `
  //
  // `
  //   : null;

  const input = AgentInputFactory(
    agentAdapter.endpoint,
    agent.model,
    prompt,
    systemPrompt,
  );

  // TODO: extract retry logic into helper fn if DRY applicable

  let classified: ArticleWithCategories[] | undefined;

  const maxRetries = 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await CallAgent(input, agentAdapter, agent.api_key);

    if (res.status === "failure") return res;

    // TODO: Maybe use zod schema for validation and on schema mismatch, append the error to the next attempts prompt so the model apprehends which fields mismatched

    try {
      const parsed: unknown = JSON.parse(res.response.content);
      assert(
        Array.isArray(parsed),
        `[ClassifyArticles] LLM output must be a JSON array, got: ${typeof parsed}`,
      );
      assert(
        parsed.length === articles.length,
        `[ClassifyArticles] classified count (${parsed.length}) must equal input count (${articles.length})`,
      );
      classified = parsed as ArticleWithCategories[];
    } catch (err) {
      if (err instanceof assert.AssertionError) throw err;
      // JSON.parse failure — retry will handle it
    }
  }

  return classified
    ? {
        status: "success",
        classified,
      }
    : {
        status: "failure",
        error: {
          code: "SCHEMA_MISMATCH",
          message: "validation.output.schemaMismatch",
        },
      };
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

async function CallAgent(
  input: AgentInput,
  adapter: AgentAdapter,
  apiKey: string,
) {
  // TODO: Rate limiting logic (use Anthropic headers for rate-limit discovery)

  const response: Response = await fetch(input.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...adapter.authHeaders(apiKey),
    },
    ...adapter.buildRequest(input),
  });

  assert(
    response.ok,
    `[CallAgent] agent HTTP error ${response.status} ${response.statusText} for endpoint: ${input.endpoint}`,
  );

  // TODO: Status code based response handling

  const raw = await response.text();
  assert(raw.length > 0, "[CallAgent] agent returned an empty response body");

  return adapter.parseResponse(raw);
}

function GenerateDigests(articles: ArticleWithCategories[]) {}

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
        .selectAll()
        .where("user_id", "=", ctx.session.user.id)
        .where("updated_at", ">=", input)
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
        .select(["url", "model", "api_key"])
        .executeTakeFirstOrThrow();

      const classified = [] as ArticleWithCategories[];
      let unclassified: ArticleWithCategories[];

      console.log(
        `[generateFeed] phase 7: agent resolved — model: "${agent.model}", url: "${agent.url}"`,
      );

      const endpointMatch = agent.url.match(/(?<=https?:\/\/.*\/).*/);
      assert(
        endpointMatch !== null,
        `[generateFeed] could not extract endpoint path from agent URL: "${agent.url}"`,
      );
      const endpoint = endpointMatch[0] as AgentEndpoint;

      const agentAdapter = AgentAdapterFactory(endpoint);

      console.log(
        `[generateFeed] phase 8: endpoint extracted: "${endpointMatch?.[0]}"`,
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

        await db.insertInto("cached_articles").values(fetchedArray!).execute();
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

        // Then use agentic classification for cacheMisses & cachedUncatz (union)
        // then unify newly_cassificied & cashedCatz for digest gen

        await db.insertInto("cached_articles").values(cacheMisses!).execute();
        console.log(
          `[generateFeed] phase 9b: inserted ${cacheMisses!.length} cache misses into DB`,
        );

        unclassified = cacheMisses!;
        cachedUncatz!.forEach((article) => unclassified.push(article));

        console.log(
          `[generateFeed] phase 9b: total unclassified (misses + uncategorised cache): ${unclassified.length}`,
        );

        // generate from Cache misses + unused caches

        // INFO: Rate limiting

        cachedCatz?.forEach((article) => classified.push(article));
        console.log(
          `[generateFeed] phase 9b: pre-classified from cache: ${classified.length}`,
        );
      }

      console.log(
        `[generateFeed] phase 10: calling ClassifyArticles on ${unclassified.length} articles`,
      );

      const result = await ClassifyArticles(agent, agentAdapter, unclassified);

      if (result.status === "failure") {
        console.log(
          `[generateFeed] phase 10: classification failed — code: "${result.error.code}", message: "${result.error.message}"`,
        );
        return yield {
          status: result.status,
          error: {
            code: result.error.code,
            message: ctx.t(result.error.code),
          },
        };
      }

      console.log(
        `[generateFeed] phase 11: classification succeeded — ${result.classified.length} articles classified`,
      );

      const categories = [] as ArticleCategories[];

      result.classified.forEach((article) => {
        // aggregate classified articles
        classified.push(article);

        // aggregate categories for db insert
        article.categories?.forEach((category) =>
          categories.push({
            article_id: article.id,
            category: category,
          }),
        );
      });

      const expectedCategoryCount = result.classified.reduce(
        (sum, a) => sum + (a.categories?.length ?? 0),
        0,
      );
      assert(
        categories.length === expectedCategoryCount,
        `[generateFeed] categories array length (${categories.length}) does not match sum of article.categories lengths (${expectedCategoryCount})`,
      );
      assert(
        categories.every(
          (c) =>
            typeof c.article_id === "string" && typeof c.category === "string",
        ),
        "[generateFeed] malformed entry in categories array before DB insert",
      );

      console.log(
        `[generateFeed] phase 12: inserting ${categories.length} article_categories rows`,
      );

      await db.insertInto("article_categories").values(categories).execute();

      console.log("[generateFeed] phase 13: done — all DB writes complete");

      return;

      // TODO: batching logic + yield return
      GenerateDigests(classified);

      // TODO: Digests Generation

      // TODO: Update "used" field for articles

      return yield {
        status: "success",
      };
    }),
  testProcedure: publicProcedure.query(async () => {
    console.log("test");
  }),
  // viewDigest: protectedProcedure
});
