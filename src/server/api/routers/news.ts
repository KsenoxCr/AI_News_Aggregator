import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createTRPCRouter,
  protectedTranslatedProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db/db";
import { AgentAdapterFactory } from "~/lib/factories/agent";
import { decrypt } from "~/lib/utils/crypto";
import { StripCategories } from "~/lib/utils/feed";
import z from "zod";
import type { AgentProvider } from "~/config/business";
import { MAX } from "~/config/business";
import {
  FetchFeed,
  ClassifyArticles,
  UnflattenCached,
  ExtractUnusedArticles,
  GenerateDigests,
} from "~/lib/feed";
import type { ArticleWithCategories, Source } from "~/server/db/types";
import type { PrevDigest } from "~/lib/types/pipeline";

// FIX: OOM (need drastic reducement of space Big-O)
// TODO: Wrap in tnx appropriately

export const newsRouter = createTRPCRouter({
  generateFeed: protectedTranslatedProcedure
    .input(z.date())
    .subscription(async function* ({ input: rawInput, ctx, signal }) {
      const input = new Date(rawInput);
      input.setUTCHours(0, 0, 0, 0);

      const cachedDigests = (await db
        .selectFrom("news_digest")
        .where("news_digest.user_id", "=", ctx.session.user.id)
        .innerJoin(
          "digest_revision",
          "digest_revision.digest_id",
          "news_digest.id",
        )
        .where(({ eb, selectFrom }) =>
          eb(
            "digest_revision.revision",
            "=",
            selectFrom("digest_revision as dr_max")
              .select(({ fn }) => fn.max("dr_max.revision").as("max_rev"))
              .whereRef("dr_max.digest_id", "=", "news_digest.id"),
          ),
        )
        .select([
          "news_digest.id",
          "news_digest.updated_at",
          "digest_revision.article_id",
          "digest_revision.title",
          "digest_revision.digest",
          "digest_revision.revision",
        ])
        .execute()) as (PrevDigest & {
        article_id: string;
        updated_at: Date;
      })[];

      const prevDigestCategoryRows = cachedDigests.length
        ? await db
            .selectFrom("digest_category")
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

      const cachedToYield = cachedDigests
        .filter((d) => d.updated_at >= input)
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

      const sources = (await db
        .selectFrom("source")
        .where("user_id", "=", ctx.session.user.id)
        .where("enabled", "=", 1)
        .select([
          "source.id",
          "source.slug",
          "source.url",
          "source.date_filter_param",
          "source.date_format",
          "source.previous_etag",
        ])
        .execute()) as Source[];

      if (sources.length === 0) {
        return yield {
          status: "failure",
          error: {
            code: "NOT_FOUND",
            message: ctx.t("errors.feed.noSources"),
          },
        };
      }

      let fetchedArray = [] as ArticleWithCategories[];

      yield {
        status: "success" as const,
        info: ctx.t("success.feed.fetchingSources"),
      };

      for (const source of sources) {
        if (signal?.aborted) return;
        let fetchResult;
        try {
          fetchResult = await FetchFeed(source, input);
        } catch (err) {
          console.error(`[generateFeed] source ${source.slug} threw:`, err);
          yield {
            status: "error" as const,
            error: {
              code: "FETCH_FAILED",
              message: (err as Error).message,
            },
          };
          continue;
        }
        console.log(`[generateFeed] source ${source.slug}: fetchResult status=${fetchResult ? (fetchResult.error ? "error" : "ok") : "304"}`);

        if (!fetchResult) continue;

        if (fetchResult?.error) {
          yield {
            status: "error" as const,
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
      console.log(`[generateFeed] fetchedArray.length=${fetchedArray.length}`);

      const cached = await db
        .selectFrom("cached_article")
        .where("published_at", ">=", input)
        .leftJoin(
          "article_category",
          "article_category.article_id",
          "cached_article.id",
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
        .orderBy("cached_article.id")
        .execute();
      console.log(`[generateFeed] cached rows=${cached.length}`);

      const agent = await db
        .selectFrom("agent")
        .where("user_id", "=", ctx.session.user.id)
        .where("enabled", "=", 1)
        .select(["id", "provider", "model", "api_key"])
        .executeTakeFirst();
      if (!agent)
        return yield {
          status: "failure" as const,
          error: {
            code: "NOT_FOUND",
            message: ctx.t("errors.feed.noAgent"),
          },
        };
      console.log(`[generateFeed] agent found: provider=${agent.provider} model=${agent.model}`);

      try {
      const classified = [] as ArticleWithCategories[];
      let unclassified: ArticleWithCategories[];

      if (cached.length === 0) {
        console.log(`[generateFeed] branch: no cache, fetchedArray=${fetchedArray.length}`);
        if (fetchedArray.length === 0)
          return yield {
            status: "success" as const,
            info: ctx.t("success.feed.noNewArticles"),
          };

        await db
          .insertInto("cached_article")
          .values(StripCategories(fetchedArray))
          .ignore()
          .execute();

        unclassified = fetchedArray;
      } else {
        const cachedUnflattened = UnflattenCached(cached);
        console.log(`[generateFeed] cachedUnflattened=${cachedUnflattened.length}`);

        const [cacheMisses, cachedCatz, cachedUncatz] = ExtractUnusedArticles(
          fetchedArray,
          cachedUnflattened,
        );
        console.log(`[generateFeed] cacheMisses=${cacheMisses!.length} cachedCatz=${cachedCatz!.length} cachedUncatz=${cachedUncatz!.length}`);

        if (cacheMisses!.length > 0)
          await db
            .insertInto("cached_article")
            .values(StripCategories(cacheMisses!))
            .ignore()
            .execute();

        unclassified = cacheMisses!;
        cachedUncatz!.forEach((article) => unclassified.push(article));

        cachedCatz?.forEach((article) => classified.push(article));
      }
      console.log(`[generateFeed] unclassified=${unclassified.length} classified=${classified.length}`);

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

      if (unclassified.length > 0) {
        console.log(`[generateFeed] → ClassifyArticles (${unclassified.length} articles)`);
        yield {
          status: "success" as const,
          info: ctx.t("success.feed.classifyingArticles"),
        };

        const result = await ClassifyArticles(
          agentAdapter,
          ctx.t,
          unclassified,
        );

        if (result.status === "failure") {
          return yield { status: result.status, error: result.error };
        }

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

          await db
            .insertInto("article_category")
            .ignore()
            .values(categories)
            .execute();
        }
      }

      console.log(`[generateFeed] post-classification: classified=${classified.length}`);
      if (classified.length === 0) {
        return yield {
          status: "success" as const,
          info: ctx.t("success.feed.noNewArticles"),
        };
      }

      console.log(`[generateFeed] → GenerateDigests (${classified.length} articles)`);
      yield {
        status: "success" as const,
        info: ctx.t("success.feed.generatingDigests"),
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

      for await (const result of GenerateDigests(
        agentAdapter,
        ctx.t,
        classified,
        cachedDigests,
      )) {
        if (signal?.aborted) return;
        if (result.status === "failure") return yield result;

        const { item, data, meta } = result;
        const isNew = item.digest === "new";
        const digestId = isNew ? randomUUID() : (item.digest as PrevDigest).id;
        const categories = isNew
          ? (item.article.categories ?? [])
          : (prevCategoriesMap.get(digestId) ?? []);

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
              .insertInto("news_digest")
              .values({
                id: digestId,
                user_id: ctx.session.user.id,
                expires_at: new Date(Date.now() + MAX.timeframe),
                updated_at: new Date(),
              })
              .execute();

            if (categories.length > 0)
              await trx
                .insertInto("digest_category")
                .values(
                  categories.map((category) => ({
                    digest_id: digestId,
                    category,
                  })),
                )
                .execute();
          } else {
            const prevCats = await trx
              .selectFrom("digest_category")
              .where("digest_id", "=", digestId)
              .select("category")
              .execute();

            const prevCatSet = new Set(prevCats.map((c) => c.category));
            const newCats = categories.filter((c) => !prevCatSet.has(c));

            if (newCats.length > 0)
              await trx
                .insertInto("digest_category")
                .values(
                  newCats.map((category) => ({
                    digest_id: digestId,
                    category,
                  })),
                )
                .execute();

            await trx
              .updateTable("news_digest")
              .set("updated_at", new Date())
              .where("id", "=", digestId)
              .execute();
          }

          await trx.insertInto("digest_revision").values(revision).execute();

          await trx
            .updateTable("cached_article")
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
      }

      return yield { status: "success" };
      } catch (err) {
        console.error("[generateFeed] unhandled error:", err);
        return yield {
          status: "failure" as const,
          error: {
            code: "INTERNAL_ERROR",
            message: ctx.t("errors.feed.internalError", {
              message: (err as Error).message,
            }),
          },
        };
      }
    }),
  getRevisions: protectedTranslatedProcedure
    .input(z.string())
    .query(async ({ input: digestId }) => {
      const [rows, categoryRows] = await Promise.all([
        db
          .selectFrom("digest_revision")
          .where("digest_revision.digest_id", "=", digestId)
          .innerJoin(
            "cached_article",
            "cached_article.id",
            "digest_revision.article_id",
          )
          .innerJoin("agent", "agent.id", "digest_revision.agent_id")
          .innerJoin("source", "source.id", "cached_article.source_id")
          .select([
            "digest_revision.title",
            "digest_revision.digest",
            "digest_revision.created_at",
            "digest_revision.article_id",
            "agent.provider",
            "agent.model",
            "source.slug as source_slug",
            "source.url as source_url",
            "cached_article.title as article_title",
            "cached_article.author",
            "cached_article.link",
            "cached_article.published_at",
          ])
          .execute(),
        db
          .selectFrom("digest_category")
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
