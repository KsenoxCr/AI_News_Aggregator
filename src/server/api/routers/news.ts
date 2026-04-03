import { zodToJsonSchema } from "zod-to-json-schema";
import Parser from "rss-parser";
import { v5 as uuidv5 } from "uuid";
import type { AgentEndpoint, DateFormat } from "~/config/business";
import { formatDate } from "~/lib/utils";
import { ClassificationSchema } from "~/lib/validators/news";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db/db";
import type {
  Agents,
  CachedArticles,
  Fetches,
  Sources,
} from "~/server/db/gen_types";
import type { AgentAdapter, AgentInput } from "~/lib/adapters/agent";
import { AgentAdapterFactory, AgentInputFactory } from "~/lib/factories/agent";

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

// TODO: extract unused cached articles

// TODO: generate using them

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

  const response: Response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/rss+xml, application/atom+xml, text/xml, */*",
      ...(source.previous_etag && { "If-None-Match": source.previous_etag }),
    },
  });

  // TODO: Intricate response status handling

  if (response.status === 304) return null; // unchanged feed

  await db
    .updateTable("fetches")
    .set("previous_etag", response.headers.get("ETag"))
    .where("id", "=", source.id)
    .execute();

  const xml = await response.text();

  return await NormalizeFeed(xml, source);
}

// Override: array

async function ClassifyArticles(
  agent: Agent,
  agentAdapter: AgentAdapter,
  articles: ArticleWithCategories[],
) {
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

  // TODO: response handling logic + retry

  const res = CallAgent(input, agentAdapter, agent.api_key);

  // TODO: Add article_categories to db

  return;
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

  return unflattened;
}

function ExtractUnusedArticles(
  fetched: Article[],
  cached: ArticleWithCategories[],
) {
  // TODO: Add threshold logic: cartesian product (fetched (N) x cached (M)) > threshold ? hashmap O(N): origin array O(NM)

  const fetchedMap = new Map<string, Article>();

  fetched.forEach((item) => fetchedMap.set(item.id, item));

  const cachedCatz = [] as Article[];
  const cachedUncatz = [] as Article[];

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

  const cacheMisses = [] as Article[];

  // Cache misses
  fetchedMap.forEach((article) => {
    cacheMisses.push(article);
  });

  return [cacheMisses, cachedCatz, cachedUncatz];
}

async function CallAgent(
  input: AgentInput,
  adapter: AgentAdapter,
  apiKey: string,
) {
  // Rate limiting logic

  const response: Response = await fetch(input.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...adapter.authHeaders(apiKey),
    },
    ...adapter.buildRequest(input),
  });

  // TODO: schema unconformance handling

  return adapter.parseResponse(await response.text());
}

function GenerateDigests(articles: ArticleWithCategories[]) {}

// TODO: SoC

// TODO: Translate error message

// TODO: Wrap in tnx appropriately

export const newsRouter = createTRPCRouter({
  generateFeed: protectedProcedure
    .input(z.date())
    .subscription(async function* ({ input, ctx }) {
      console.log("phase -1");

      const cached_digests = await db
        .selectFrom("news_digests")
        .selectAll()
        .where("user_id", "=", ctx.session.user.id)
        .where("updated_at", ">=", input)
        .execute();

      for (const digest of cached_digests) {
        yield { status: "success", type: "cached", article: digest };
      }

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

      if (sources.length === 0)
        yield {
          status: "failure",
          error: {
            code: "NOT_FOUND",
            message: "No sources found",
          },
        };

      let fetchedArray = [] as ArticleWithCategories[];

      for (const source of sources) {
        const fetchResult = await FetchFeed(source, input);

        if (fetchResult?.error) {
          yield {
            status: "error",
            error: {
              code: "FETCH_FAILED",
              message: fetchResult.error.message,
            },
          };
        } else {
          fetchResult?.feed.forEach((item) => {
            fetchedArray.push({
              ...item,
              categories: null,
            });
          });
        }
      }

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

      const agent = await db
        .selectFrom("agents")
        .where("user_id", "=", ctx.session.user.id)
        .where("enabled", "=", 1)
        .select(["url", "model", "api_key"])
        .executeTakeFirstOrThrow();
      let classified = [] as ArticleWithCategories[];

      const endpoint = agent.url.match(
        /(?<=https?:\/\/.*\/).*/,
      )![0] as AgentEndpoint;

      const agentAdapter = AgentAdapterFactory(endpoint);

      if (cached.length === 0) {
        if (fetchedArray.length === 0) return;

        await db.insertInto("cached_articles").values(fetchedArray!).execute();

        classified = await ClassifyArticles(agent, agentAdapter, fetchedArray);
      } else {
        const cachedUnflattened = UnflattedCached(cached);

        const [cacheMisses, cachedCatz, cachedUncatz] = ExtractUnusedArticles(
          fetchedArray,
          cachedUnflattened,
        ); // FIX: Why tuple's arrays are possibly undefined

        // Then use agentic classification for cacheMisses & cachedUncatz (union)
        // then unify newly_cassificied & cashedCatz for digest gen

        await db.insertInto("cached_articles").values(cacheMisses!).execute();

        const uncatz = cacheMisses!;

        cachedUncatz!.forEach((article) => uncatz.push(article));

        // generate from Cache misses + unused caches

        // INFO: Rate limiting

        classified = await ClassifyArticles(uncatz);

        cachedCatz?.forEach((article) => classified.push(article));
      }

      // TODO: batching logic + yield return

      GenerateDigests(classified);

      // TODO: Digests Generation

      // TODO: Update "used" field for articles

      yield {
        status: "success",
      };
    }),
  testProcedure: publicProcedure.query(async () => {
    console.log("test");
  }),
  // viewDigest: protectedProcedure
});
