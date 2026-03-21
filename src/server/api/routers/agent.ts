import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db/db";
import { IsDuplicateEntry, TestOAIAPI } from "~/server/lib/util";
import { MAX } from '~/config/business'
import { addAgentInput, modifyAgentInput } from "~/lib/validators/agent";

export const agentRouter = createTRPCRouter({
    getAgents: protectedProcedure
        .query(async ({ ctx }) => {
            const agents = await db
                .selectFrom('agents')
                .where('user_id', '=', ctx.session.user.id)
                .execute()

            return {
                status: "success",
                agents
            }
        }),
    addAgent: protectedProcedure
        .input(addAgentInput)
        .mutation(async ({ ctx, input }) => {
            const existingAgents = await db
                .selectFrom('agents')
                .select(db.fn.count('id').as('count'))
                .where('user_id', '=', ctx.session.user.id)
                .executeTakeFirst();

            if (Number((existingAgents!.count ?? 0)) >= MAX.agents) {
                return { status: "failure", errorCode: "OUT_OF_BOUNDS", error: "Maximum agent limit reached" };
            }

            const agentId = crypto.randomUUID()

            const res = await TestOAIAPI(input.url, input.api_key)

            if (res.error) {
                let errorCode: string | number = res.status;
                let error = res.error;

                switch (res.status) {
                    case 401:
                        errorCode = "UNAUTHORIZED";
                        error = "Invalid API key";
                        break;
                    case 403:
                        errorCode = "FORBIDDEN";
                        error = "API key does not have required permissions";
                        break;
                    case 500:
                        errorCode = "SERVER_ERROR";
                        error = "OpenAI service error";
                        break;
                    case 503:
                        errorCode = "SERVICE_UNAVAILABLE";
                        error = "OpenAI service unavailable";
                        break;
                    default:
                        errorCode = res.status;
                        error = res.error;
                }

                return { status: "failure", errorCode, error };
            }

            try {
                await db
                    .insertInto('agents')
                    .values({
                        id: agentId,
                        slug: input.slug,
                        url: input.url,
                        api_key: input.api_key,
                        user_id: ctx.session.user.id,
                    })
                    .execute();
            } catch (err: any) {
                let errorCode, error = null

                if (IsDuplicateEntry(err, "slug")) {
                    errorCode = "CONFLICT"
                    error = "Name already in use"
                }

                if (IsDuplicateEntry(err, "url")) {
                    errorCode = "CONFLICT"
                    error = "URL already in use"
                }

                return {
                    status: "failure",
                    errorCode: errorCode ?? err.code,
                    error: error ?? err.message
                }
            }

            return { status: "success", id: agentId };
        }),
    removeAgent: protectedProcedure
        .input(z.string().length(36))
        .mutation(async ({ ctx, input }) => {
            const result = await db
                .deleteFrom('agents')
                .where('id', '=', input)
                .where('user_id', '=', ctx.session.user.id)
                .execute();

            if (result[0]!.numDeletedRows === 0n) {
                return { status: "failure", error: "NOT_FOUND" };
            }

            return { status: "success" };
        }),

    modifyAgent: protectedProcedure
        .input(modifyAgentInput)
        .mutation(async ({ ctx, input }) => {
            const { id, ...updates } = input;

            let result = []

            try {
                result = await db
                    .updateTable('agents')
                    .set(updates)
                    .where('id', '=', id)
                    .where('user_id', '=', ctx.session.user.id)
                    .execute();
            } catch (err: any) {
                let errorCode, error = null

                if (IsDuplicateEntry(err, "slug")) {
                    errorCode = "CONFLICT"
                    error = "Name already in use"
                }

                if (IsDuplicateEntry(err, "url")) {
                    errorCode = "CONFLICT"
                    error = "URL already in use"
                }

                return {
                    status: "failure",
                    errorCode: errorCode ?? err.code,
                    error: error ?? err.message
                }
            }

            if (result[0]!.numUpdatedRows === 0n) {
                return { status: "failure", error: "NOT_FOUND" };
            }

            return { status: "success" };
        }),

    selectAgent: protectedProcedure
        .input(z.string().length(36))
        .query(async ({ ctx, input }) => {
            await db
                .updateTable('users')
                .set({ selected_agent: input })
                .where('id', '=', ctx.session.user.id)
                .execute()

            return {
                status: "success"
            }
        }),
});
