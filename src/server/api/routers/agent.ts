import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  protectedTranslatedProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db/db";
import type { AgentProvider } from "~/config/business";
import { AgentAdapterFactory } from "~/lib/factories/agent";
import {
  AddAgentSchemaFactory,
  ModifyAgentSchemaFactory,
} from "~/lib/validators/agent";

// TODO: Feature: separate agents for classification & digest generation

export const agentRouter = createTRPCRouter({
  getAgents: protectedProcedure.query(async ({ ctx }) => {
    const agents = await db
      .selectFrom("agents")
      .where("user_id", "=", ctx.session.user.id)
      .execute();

    return {
      status: "success",
      agents,
    };
  }),
  addAgent: protectedTranslatedProcedure
    .input(z.unknown())
    .mutation(async ({ ctx, input }) => {
      const schema = AddAgentSchemaFactory(ctx.t);
      const validated = schema.parse(input);

      const agentId = crypto.randomUUID();

      // TODO: Adapter into ctx for persistence and interoperability across procedures

      // model to AddAgentSchemaFactory

      const agentAdapter = AgentAdapterFactory(
        validated.provider as AgentProvider,
      );
      const validation = await agentAdapter.configure(
        validated.api_key,
        validated.model,
      );

      // TODO: Move validation to AgentAdapterFactory + translation to "validation.agent.config.invalidAPIKey"

      if (validation.status === "failure") {
        return {
          status: "failure",
          errorCode: validation.error.code,
          error: ctx.t(validation.error.message),
        };
      }

      const model = validation.models[0]!;

      await db
        .insertInto("agents")
        .values({
          id: agentId,
          slug: `${validated.provider}: ${model}`,
          provider: validated.provider,
          model,
          api_key: validated.api_key,
          user_id: ctx.session!.user.id,
        })
        .execute();

      return { status: "success", id: agentId, models: validation.models };
    }),
  removeAgent: protectedProcedure
    .input(z.string().length(36))
    .mutation(async ({ ctx, input }) => {
      const result = await db
        .deleteFrom("agents")
        .where("id", "=", input)
        .where("user_id", "=", ctx.session!.user.id)
        .execute();

      if (result[0]!.numDeletedRows === 0n) {
        return { status: "failure", error: "NOT_FOUND" };
      }

      return { status: "success" };
    }),
  modifyAgent: protectedTranslatedProcedure
    .input(z.unknown())
    .mutation(async ({ ctx, input }) => {
      const schema = ModifyAgentSchemaFactory(ctx.t);
      const validated = schema.parse(input);

      const { id, ...updates } = validated;

      const result = await db
        .updateTable("agents")
        .set(updates)
        .where("id", "=", id)
        .where("user_id", "=", ctx.session!.user.id)
        .execute();

      if (result[0]!.numUpdatedRows === 0n) {
        return { status: "failure", error: "NOT_FOUND" };
      }

      return { status: "success" };
    }),
  selectAgent: protectedProcedure
    .input(z.string().length(36))
    .query(async ({ ctx, input }) => {
      await db
        .updateTable("users")
        .set({ selected_agent: input })
        .where("id", "=", ctx.session.user.id)
        .execute();

      return {
        status: "success",
      };
    }),
});
