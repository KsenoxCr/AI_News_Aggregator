import Parser from "rss-parser";
import z from "zod";
import type { DateFormat } from "~/config/business";
import { dbPut } from "~/lib/db/indexed-db";
import { formatDate } from "~/lib/utils";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db/db";
import type { Fetches, Sources } from "~/server/db/gen_types";

// TODO: API Error Handling Mechanism for continuing generation where left of

// TODO: Swap "id" as "fetch_id" for semantical clarity or use retrieve distilled sources and fetches as discrete arrays
type Source = Pick<Sources, "url" | "date_filter_param" | "date_format"> &
  Pick<Fetches, "id" | "previous_etag"> & {
    digest_generated: number;
  };

const ArticleSchema = z.object({});

// function DetectCacheMisses(feed: Article[], cached: Article[]) {}

// TODO: extract unused cached articles

// TODO: generate using them

// TODO: update used field for cache items + fetch digest_generated = true

// TODO: Classification & Generation from procedure scope

// TODO: Add misses to cache

async function NormalizeFeed(xmlFeed: string) {
  const parser = new Parser({
    defaultRSS: 2.0,
  });

  // TODO: Toasted Error handling

  return await parser.parseString(xmlFeed);
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
    .set("digest_generated", 0)
    .where("id", "=", source.id)
    .execute();

  const xml = await response.text();

  return await NormalizeFeed(xml);
}

export const newsRouter = createTRPCRouter({
  generateFeed: protectedProcedure
    .input(z.date())
    .query(async ({ ctx, input }) => {
      const sources = (await db
        .selectFrom("sources")
        .where("user_id", "=", ctx.session.user.id)
        .where("enabled", "=", 1)
        .innerJoin("fetches", "fetches.source_id", "sources.id")
        .select([
          "sources.url",
          "sources.date_filter_param",
          "sources.date_format",
          "fetches.id",
          "fetches.previous_etag",
          "fetches.digest_generated",
        ])
        .execute()) as Source[];

      // TODO: Translate error message

      if (sources.length === 0)
        return {
          status: "failure",
          errorCode: "NOT_FOUND",
          error: "No sources found",
        };

      for (const source of sources) {
        const sourceFeed = await FetchFeed(source, input);

        const cached = await db
          .selectFrom("cached_articles")
          .where("cached_articles.fetch_id", "=", source.id)
          .innerJoin(
            "article_categories",
            "article_categories.article_id",
            "cached_articles.id",
          )
          .selectAll()
          .execute();

        // TODO: Why segregate processing by sources? vs processing articles from all sources once?k
      }

      // TODO: Unflatten cached into article 1 <-> M categories

      return {
        status: "success",
      };
    }),
  testProcedure: publicProcedure.query(async () => {
    console.log("test");
  }),
  // viewDigest: protectedProcedure
});
