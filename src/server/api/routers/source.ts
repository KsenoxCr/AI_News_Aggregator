import { z } from "zod";
import { MAX } from "~/config/business";
import {
  createTRPCRouter,
  protectedProcedure,
  protectedTranslatedProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db/db";
import { IsDuplicateEntry } from "~/server/lib/util";
import {
  AddSourceSchemaFactory,
  RemoveSourceSchemaFactory,
} from "~/lib/validators/source";

export const sourceRouter = createTRPCRouter({
  getSources: protectedProcedure.query(async ({ ctx }) => {
    const sources = await db
      .selectFrom("sources")
      .where("user_id", "=", ctx.session.user.id)
      .execute();

    return {
      status: "success",
      sources,
    };
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

      // TODO: translate err msg

      if (Number(existingSources?.count ?? 0) >= MAX.sources) {
        return {
          status: "failure",
          errorCode: "OUT_OF_BOUNDS",
          error: "Maximum source limit reached",
        };
      }

      // TODO: Fetch-based feed format detection

      const sourceId = crypto.randomUUID();
      const fetchId = crypto.randomUUID();

      try {
        await db.transaction().execute(async (trx) => {
          await trx
            .insertInto("sources")
            .values({
              id: sourceId,
              slug: validated.slug,
              url: validated.url,
              user_id: ctx.session.user.id,
            })
            .execute();

          await trx
            .insertInto("fetches")
            .values({
              id: fetchId,
              source_id: sourceId,
            })
            .execute();
        });
      } catch (err: any) {
        let errorCode,
          error = null;

        // TODO: translate err msgs

        if (IsDuplicateEntry(err, "slug")) {
          errorCode = "CONFLICT";
          error = "Name already in use";
        }

        if (IsDuplicateEntry(err, "url")) {
          errorCode = "CONFLICT";
          error = "URL already in use";
        }

        return {
          status: "failure",
          errorCode: errorCode ?? err.code,
          error: error ?? err.message,
        };
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

      if (result[0]!.numDeletedRows === 0n) {
        return {
          status: "failure",
          error: "NOT_FOUND",
        };
      }

      return { status: "success" };
    }),
});
