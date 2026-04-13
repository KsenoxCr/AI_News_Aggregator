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
import { AgentAdapterFactory } from "~/lib/factories/agent";

export const settingsRouter = createTRPCRouter({
  // TODO: Feature: separate agents for classification & digest generation
  // TODO: coalesh all schema, validated lines to just validated by method chaining
  load: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [sources, agents, allCategories, userCategories, user] =
      await Promise.all([
        db
          .selectFrom("sources")
          .selectAll()
          .where("user_id", "=", userId)
          .execute(),
        db
          .selectFrom("agents")
          .select(["id", "provider", "api_key as key", "model", "enabled"])
          .where("user_id", "=", userId)
          .execute(),
        db.selectFrom("categories").select("slug").execute(),
        db
          .selectFrom("user_categories")
          .select("category")
          .where("user_id", "=", userId)
          .execute(),
        db
          .selectFrom("users")
          .select(["preferences", "locale"])
          .where("id", "=", userId)
          .executeTakeFirstOrThrow(),
      ]);

    const userCategorySet = new Set(userCategories.map((uc) => uc.category));

    const agentsWithModels = await Promise.all(
      agents.map(async (a) => {
        const { adapter } = await AgentAdapterFactory(a.provider as AgentProvider, a.key, a.model);
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
  save: protectedTranslatedProcedure
    .input(z.unknown())
    .mutation(async ({ input, ctx }) => {
      const validated = SaveSettingsSchemaFactory(ctx.t).parse(input);
      const userId = ctx.session.user.id;

      await Promise.all(
        validated.sources.map((s) =>
          db
            .updateTable("sources")
            .set("enabled", s.enabled ? 1 : 0)
            .where("id", "=", s.source_id)
            .where("user_id", "=", userId)
            .execute(),
        ),
      );

      if (validated.agents.add.length > 0)
        await db
          .insertInto("agents")
          .values(
            validated.agents.add.map((a) => ({
              id: crypto.randomUUID(),
              user_id: userId,
              provider: a.provider,
              model: a.model,
              api_key: a.key,
              slug: a.provider,
              enabled: 1,
            })),
          )
          .execute();

      if (validated.agents.remove.length > 0)
        await db
          .deleteFrom("agents")
          .where("id", "in", validated.agents.remove)
          .where("user_id", "=", userId)
          .execute();

      if (validated.agents.enable.length > 0)
        await Promise.all(
          validated.agents.enable.map((id) =>
            db
              .updateTable("agents")
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
              .updateTable("agents")
              .set("enabled", 0)
              .where("id", "=", id)
              .where("user_id", "=", userId)
              .execute(),
          ),
        );

      if (validated.preferences.categories.add.length > 0)
        await db
          .insertInto("user_categories")
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
          .deleteFrom("user_categories")
          .where("user_id", "=", userId)
          .where("category", "in", validated.preferences.categories.remove)
          .execute();

      await db
        .updateTable("users")
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
      const result = await AgentAdapterFactory(input.provider as AgentProvider, input.key);

      return result.status === "failure"
        ? { status: "failure" as const, error: ctx.t(result.error.message) }
        : result;
    }),
  addSource: protectedTranslatedProcedure
    .input(z.unknown())
    .mutation(async ({ ctx, input }) => {
      const schema = AddSourceSchemaFactory(ctx.t);
      const validated = schema.parse(input);

      // TODO: Fetch-based feed format validation
      // TODO: translate err msgs

      const sourceId = crypto.randomUUID();

      try {
        await db
          .insertInto("sources")
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
            error: "Name already in use",
          };

        if (IsDuplicateEntry(err, "url"))
          return {
            status: "failure",
            errorCode: "CONFLICT",
            error: "URL already in use",
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
        .deleteFrom("sources")
        .where("id", "=", validated)
        .where("user_id", "=", ctx.session.user.id)
        .execute();

      // TODO: add translated err msg

      if (result[0]!.numDeletedRows === 0n)
        return { status: "failure", error: "NOT_FOUND" };

      return { status: "success" };
    }),
});
