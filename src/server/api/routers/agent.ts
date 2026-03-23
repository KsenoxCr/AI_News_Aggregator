import { z } from "zod";
import { createTRPCRouter, protectedProcedure, protectedTranslatedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db/db";
import { IsDuplicateEntry, TestOAIAPI } from "~/server/lib/util";
import { MAX } from '~/config/business'
import { AddAgentSchemaFactory, ModifyAgentSchemaFactory } from "~/lib/validators/agent";

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
    addAgent: protectedTranslatedProcedure
        .input(z.unknown())
        .mutation(async ({ ctx, input }) => {
            const schema = AddAgentSchemaFactory(ctx.t)
            const validated = schema.parse(input)

            const existingAgents = await db
                .selectFrom('agents')
                .select(db.fn.count('id').as('count'))
                .where('user_id', '=', ctx.session!.user.id)
                .executeTakeFirst();

            if (Number((existingAgents!.count ?? 0)) >= MAX.agents) {
                return { status: "failure", errorCode: "OUT_OF_BOUNDS", error: "Maximum agent limit reached" };
            }

            const agentId = crypto.randomUUID()

            const res = await TestOAIAPI(validated.url, validated.api_key)

            if (res.error) {
                let errorCode: string | number = res.status;
                let error = res.error;

                switch (res.status) {
                    case 401:
                        errorCode = "UNAUTHORIZED";
                        error = ctx.t('errors.api.invalidApiKey');
                        break;
                    case 403:
                        errorCode = "FORBIDDEN";
                        error = ctx.t('errors.api.insufficientPermissions');
                        break;
                    case 500:
                        errorCode = "SERVER_ERROR";
                        error = ctx.t('errors.api.serverError');
                        break;
                    case 503:
                        errorCode = "SERVICE_UNAVAILABLE";
                        error = ctx.t('errors.api.serviceUnavailable');
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
                        slug: validated.slug,
                        url: validated.url,
                        api_key: validated.api_key,
                        user_id: ctx.session!.user.id,
                    })
                    .execute();
            } catch (err: any) {
                let errorCode, error = null

                if (IsDuplicateEntry(err, "slug")) {
                    errorCode = "CONFLICT"
                    error = ctx.t('errors.conflicts.agentNameExists')
                }

                if (IsDuplicateEntry(err, "url")) {
                    errorCode = "CONFLICT"
                    error = ctx.t('errors.conflicts.agentUrlExists')
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
                .where('user_id', '=', ctx.session!.user.id)
                .execute();

            if (result[0]!.numDeletedRows === 0n) {
                return { status: "failure", error: "NOT_FOUND" };
            }

            return { status: "success" };
        }),
    modifyAgent: protectedTranslatedProcedure
        .input(z.unknown())
        .mutation(async ({ ctx, input }) => {
            const schema = ModifyAgentSchemaFactory(ctx.t)
            const validated = schema.parse(input)

            const { id, ...updates } = validated;

            let result = []

            try {
                result = await db
                    .updateTable('agents')
                    .set(updates)
                    .where('id', '=', id)
                    .where('user_id', '=', ctx.session!.user.id)
                    .execute();
            } catch (err: any) {
                let errorCode, error = null

                if (IsDuplicateEntry(err, "slug")) {
                    errorCode = "CONFLICT"
                    error = ctx.t('errors.conflicts.agentNameExists')
                }

                if (IsDuplicateEntry(err, "url")) {
                    errorCode = "CONFLICT"
                    error = ctx.t('errors.conflicts.agentUrlExists')
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
