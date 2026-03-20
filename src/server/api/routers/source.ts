import { z } from "zod";
import { MAX } from "~/config/business";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db/db";
import { IsDuplicateEntry } from "~/server/lib/util";

const addSourceInput = z.object({
    slug: z.string().min(1).max(30),
    url: z.string().url().max(100),
});

const removeSourceInput = z.string().length(36);

export const sourceRouter = createTRPCRouter({
    getSources: protectedProcedure
        .query(async ({ ctx }) => {
            const sources = await db
                .selectFrom('sources')
                .where('user_id', '=', ctx.session.user.id)
                .execute()

            return {
                status: "success",
                sources
            }
        }),
    addSource: protectedProcedure
        .input(addSourceInput)
        .mutation(async ({ ctx, input }) => {
            const existingSources = await db
                .selectFrom('sources')
                .select(db.fn.count('id').as('count'))
                .where('user_id', '=', ctx.session.user.id)
                .executeTakeFirst();

            if ((Number(existingSources?.count ?? 0)) >= MAX.sources) {
                return {
                    status: "failure",
                    errorCode: "OUT_OF_BOUNDS",
                    error: "Maximum source limit reached"
                };
            }

            const sourceId = crypto.randomUUID();

            try {
                await db
                    .insertInto('sources')
                    .values({
                        id: sourceId,
                        slug: input.slug,
                        url: input.url,
                        user_id: ctx.session.user.id,
                    })
                    .execute();
            } catch (err: any) {
                let errorCode, error = null;

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
                    error: error ?? err.message
                };
            }

            return { status: "success", id: sourceId };
        }),
    removeSource: protectedProcedure
        .input(removeSourceInput)
        .mutation(async ({ ctx, input }) => {
            const result = await db
                .deleteFrom('sources')
                .where('id', '=', input)
                .where('user_id', '=', ctx.session.user.id)
                .execute();

            if (result[0]!.numDeletedRows === 0n) {
                return {
                    status: "failure",
                    error: "NOT_FOUND"
                };
            }

            return { status: "success" };
        }),
});
