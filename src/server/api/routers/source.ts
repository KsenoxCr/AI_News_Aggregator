import { z } from "zod";
import { MAX } from "~/config/business";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db/db";
import type { Source } from "~/server/db/types";

export const sourceRouter = createTRPCRouter({
    addSource: protectedProcedure
        .input(z.object({ name: z.string(), url: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return await db.transaction().execute(async (trx) => {
                const prefs = await trx
                    .selectFrom('user_preferences')
                    .select('sources')
                    .where('user_id', '=', ctx.session.user.id)
                    .executeTakeFirst();

                const sources = (prefs?.sources ? JSON.parse(prefs?.sources.toString()) : []) as Source[];

                if (sources.length === MAX.sources)
                    return {
                        status: "failure",
                        error: "OUT_OF_BOUNDS"
                    }

                if (sources.find(src => src.name === input.name))
                    return {
                        status: "failure",
                        error: "DUPLICATE"
                    }

                sources.push(input);

                await trx
                    .updateTable('user_preferences')
                    .set({ sources: JSON.stringify(sources) })
                    .where('user_id', '=', ctx.session.user.id)
                    .execute();

                return {
                    status: "success",
                    error: null
                }
            })
        }),
    removeSource: protectedProcedure
        .input(z.string())
        .mutation(async ({ ctx, input }) => {
            return await db.transaction().execute(async (trx) => {
                const prefs = await trx
                    .selectFrom('user_preferences')
                    .select('sources')
                    .where('user_id', '=', ctx.session.user.id)
                    .executeTakeFirst();

                const sources = (prefs?.sources ? JSON.parse(prefs?.sources.toString()) : []) as Source[];

                const filteredSources = sources.filter(src => src.name !== input);

                if (sources.length === filteredSources.length)
                    return {
                        status: "failure",
                        error: "NOT_FOUND"
                    }

                await trx
                    .updateTable('user_preferences')
                    .set({ sources: JSON.stringify(filteredSources) })
                    .where('user_id', '=', ctx.session.user.id)
                    .execute();

                return {
                    status: "success",
                    error: null
                }
            })
        }),
});
