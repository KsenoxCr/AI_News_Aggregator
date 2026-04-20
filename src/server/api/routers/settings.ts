import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  protectedTranslatedProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db/db";
import { SaveSettingsSchemaFactory } from "~/lib/validators/settings";
import {
  AddSourceSchemaFactory,
  RemoveSourceSchemaFactory,
} from "~/lib/validators/source";
import { IsDuplicateEntry } from "~/server/lib/util";
import type { AgentProvider } from "~/config/business";
import { FEED_FORMAT } from "~/config/business";
import { AgentAdapterFactory } from "~/lib/factories/agent";
import { encrypt, decrypt } from "~/lib/utils/crypto";
import { fetchFeedXml } from "~/lib/utils/feed";
import { validateFeed } from "~/lib/utils/settings";

export const settingsRouter = createTRPCRouter({
  // TODO: coalesh all schema, validated lines to just validated by method chaining
  load: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [sources, agents, allCategories, userCategories, user] =
      await Promise.all([
        db
          .selectFrom("source")
          .selectAll()
          .where("user_id", "=", userId)
          .execute(),
        db
          .selectFrom("agent")
          .select(["id", "provider", "api_key as key", "model", "enabled"])
          .where("user_id", "=", userId)
          .execute(),
        db.selectFrom("category").select("slug").execute(),
        db
          .selectFrom("user_category")
          .select("category")
          .where("user_id", "=", userId)
          .execute(),
        db
          .selectFrom("user")
          .select(["preferences", "locale"])
          .where("id", "=", userId)
          .executeTakeFirstOrThrow(),
      ]);

    const userCategorySet = new Set(userCategories.map((uc) => uc.category));

    const agentsWithModels = await Promise.all(
      agents.map(async (a) => {
        a.key = a.provider === "Groq" ? "" : decrypt(ctx.mk, a.key);

        const { adapter } = await AgentAdapterFactory(
          a.provider as AgentProvider,
          a.key,
          a.model,
        );
        const result = await adapter.listModels();
        return {
          ...a,
          models: result.status === "success" ? result.models : [],
        };
      }),
    );

    return {
      status: "success" as const,
      sources,
      agents: agentsWithModels,
      preferences: {
        categories: allCategories.map((c) => ({
          category: c.slug,
          enabled: userCategorySet.has(c.slug),
        })),
        freeform: user.preferences ?? "",
        locale: user.locale,
      },
    };
  }),
  confirmRequired: protectedTranslatedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const missing: string[] = [];

    const [sources, agents] = await Promise.all([
      db
        .selectFrom("source")
        .where("user_id", "=", userId)
        .where("enabled", "=", 1)
        .select(({ fn }) => fn.count("id").as("count"))
        .executeTakeFirst(),
      db
        .selectFrom("agent")
        .where("user_id", "=", userId)
        .where("enabled", "=", 1)
        .select(({ fn }) => fn.count("id").as("count"))
        .executeTakeFirst(),
    ]);

    if (Number(sources?.count ?? 0) === 0)
      missing.push(ctx.t("errors.settings.missing.source"));
    if (Number(agents?.count ?? 0) === 0)
      missing.push(ctx.t("errors.settings.missing.agent"));

    if (missing.length > 0)
      return {
        status: "failure" as const,
        error: ctx.t("errors.settings.missing.required", {
          missing: missing.join(", "),
        }),
      };
    return { status: "success" as const };
  }),
  getCategories: protectedProcedure.query(async ({ ctx }) => {
    const userCategories = await db
      .selectFrom("user_category")
      .select("category")
      .where("user_id", "=", ctx.session.user.id)
      .execute();

    return userCategories.map((uc) => uc.category);
  }),
  save: protectedTranslatedProcedure
    .input(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const validated = SaveSettingsSchemaFactory(ctx.t).parse(input);
      const userId = ctx.session.user.id;

      await Promise.all(
        validated.sources.map((s) =>
          db
            .updateTable("source")
            .set("enabled", s.enabled ? 1 : 0)
            .where("id", "=", s.source_id)
            .where("user_id", "=", userId)
            .execute(),
        ),
      );

      if (validated.agents.add.length > 0)
        await db
          .insertInto("agent")
          .values(
            validated.agents.add.map((a) => ({
              id: crypto.randomUUID(),
              user_id: userId,
              provider: a.provider,
              model: a.model,
              api_key: encrypt(ctx.mk, a.key),
              slug: a.provider,
              enabled: 1,
            })),
          )
          .execute();

      if (validated.agents.remove.length > 0)
        await db
          .deleteFrom("agent")
          .where("id", "in", validated.agents.remove)
          .where("user_id", "=", userId)
          .execute();

      if (validated.agents.enable.length > 0)
        await Promise.all(
          validated.agents.enable.map((id) =>
            db
              .updateTable("agent")
              .set("enabled", 1)
              .where("id", "=", id)
              .where("user_id", "=", userId)
              .execute(),
          ),
        );

      if (validated.agents.disable.length > 0)
        await Promise.all(
          validated.agents.disable.map((id) =>
            db
              .updateTable("agent")
              .set("enabled", 0)
              .where("id", "=", id)
              .where("user_id", "=", userId)
              .execute(),
          ),
        );

      if (validated.preferences.categories.add.length > 0)
        await db
          .insertInto("user_category")
          .ignore()
          .values(
            validated.preferences.categories.add.map((category) => ({
              user_id: userId,
              category,
            })),
          )
          .execute();

      if (validated.preferences.categories.remove.length > 0)
        await db
          .deleteFrom("user_category")
          .where("user_id", "=", userId)
          .where("category", "in", validated.preferences.categories.remove)
          .execute();

      await db
        .updateTable("user")
        .set({
          preferences: validated.preferences.preferences,
          locale: validated.preferences.locale,
        })
        .where("id", "=", userId)
        .execute();

      return { status: "success" as const };
    }),
  validateAPIKey: protectedTranslatedProcedure
    .input(z.object({ provider: z.string(), key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await AgentAdapterFactory(
        input.provider as AgentProvider,
        input.key,
      );

      return result.status === "failure"
        ? { status: "failure" as const, error: ctx.t(result.error.message) }
        : result;
    }),
  addSource: protectedTranslatedProcedure
    .input(z.unknown())
    .mutation(async ({ ctx, input }) => {
      const schema = AddSourceSchemaFactory(ctx.t);
      const validated = schema.parse(input);

      let fetched;
      try {
        fetched = await fetchFeedXml(validated.url);
      } catch (err: any) {
        return { status: "failure", error: err.message };
      }

      const formats = Object.values(FEED_FORMAT);
      const formatErrors: string[] = [];

      for (const format of formats) {
        const result = validateFeed(fetched.xml, format);
        if (result.status === "failure") formatErrors.push(result.error);
      }

      if (formatErrors.length === formats.length)
        return { status: "failure", error: ctx.t(formatErrors[0]!) };

      const sourceId = crypto.randomUUID();

      try {
        await db
          .insertInto("source")
          .values({
            id: sourceId,
            slug: validated.slug,
            url: validated.url,
            user_id: ctx.session.user.id,
          })
          .executeTakeFirst();
      } catch (err: any) {
        if (IsDuplicateEntry(err, "slug"))
          return {
            status: "failure",
            errorCode: "CONFLICT",
            error: ctx.t("errors.conflicts.sourceNameExists"),
          };

        if (IsDuplicateEntry(err, "url"))
          return {
            status: "failure",
            errorCode: "CONFLICT",
            error: ctx.t("errors.conflicts.sourceUrlExists"),
          };

        return { status: "failure", errorCode: err.code, error: err.message };
      }

      return {
        status: "success",
        source: { id: sourceId, slug: validated.slug, url: validated.url },
      };
    }),
  removeSource: protectedTranslatedProcedure
    .input(z.unknown())
    .mutation(async ({ ctx, input }) => {
      const schema = RemoveSourceSchemaFactory(ctx.t);
      const validated = schema.parse(input);

      const result = await db
        .deleteFrom("source")
        .where("id", "=", validated)
        .where("user_id", "=", ctx.session.user.id)
        .execute();

      if (result[0]!.numDeletedRows === 0n)
        return { status: "failure", error: ctx.t("errors.source.notFound") };

      return { status: "success" };
    }),
});
