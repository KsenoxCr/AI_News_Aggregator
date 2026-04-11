import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  protectedTranslatedProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db/db";
import { DEFAULT, MAX } from "~/config/business";
import { SaveSettingsSchema } from "~/lib/validators/settings";
import {
  AddSourceSchemaFactory,
  RemoveSourceSchemaFactory,
} from "~/lib/validators/source";
import { IsDuplicateEntry } from "~/server/lib/util";

export const settingsRouter = createTRPCRouter({
  // TODO: Feature: separate agents for classification & digest generation
  fetch: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [sources, allCategories, userCategories, user] = await Promise.all([
      db.selectFrom("sources").selectAll().where("user_id", "=", userId).execute(),
      db.selectFrom("categories").select("slug").execute(),
      db.selectFrom("user_categories").select("category").where("user_id", "=", userId).execute(),
      db
        .selectFrom("users")
        .select(["preferences", "locale"])
        .where("id", "=", userId)
        .executeTakeFirstOrThrow(),
    ]);

    const userCategorySet = new Set(userCategories.map((uc) => uc.category));

    return {
      status: "success" as const,
      sources,
      agent: null,
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
  save: protectedProcedure
    .input(SaveSettingsSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      await Promise.all(
        input.sources.map((s) =>
          db
            .updateTable("sources")
            .set("enabled", s.enabled ? 1 : 0)
            .where("id", "=", s.source_id)
            .where("user_id", "=", userId)
            .execute(),
        ),
      );

      if (input.agents.enable)
        await db
          .updateTable("agents")
          .set("enabled", 1)
          .where("id", "=", input.agents.enable)
          .where("user_id", "=", userId)
          .execute();

      if (input.agents.disable)
        await db
          .updateTable("agents")
          .set("enabled", 0)
          .where("id", "=", input.agents.disable)
          .where("user_id", "=", userId)
          .execute();

      if (input.preferences.categories.add.length > 0)
        await db
          .insertInto("user_categories")
          .ignore()
          .values(
            input.preferences.categories.add.map((category) => ({
              user_id: userId,
              category,
            })),
          )
          .execute();

      if (input.preferences.categories.remove.length > 0)
        await db
          .deleteFrom("user_categories")
          .where("user_id", "=", userId)
          .where("category", "in", input.preferences.categories.remove)
          .execute();

      await db
        .updateTable("users")
        .set({
          preferences: input.preferences.preferences,
          locale: input.preferences.locale,
        })
        .where("id", "=", userId)
        .execute();

      return { status: "success" as const };
    }),
  addSource: protectedTranslatedProcedure
    .input(z.unknown())
    .mutation(async ({ ctx, input }) => {
      const schema = AddSourceSchemaFactory(ctx.t);
      const validated = schema.parse(input);

      const existingSources = await db
        .selectFrom("sources")
        .select(db.fn.count("id").as("count"))
        .where("user_id", "=", ctx.session.user.id)
        .executeTakeFirst();

      if (Number(existingSources?.count ?? 0) >= MAX.sources) {
        return {
          status: "failure",
          errorCode: "OUT_OF_BOUNDS",
          error: "Maximum source limit reached",
        };
      }

      // TODO: Fetch-based feed format detection
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
          .execute();
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

      return { status: "success", id: sourceId };
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
