import { z } from "zod";
import type { TFn } from "./types";
import { AGENT } from "~/config/business";
import { ObjectKeysEnum } from "../utils";

export const AddAgentSchemaFactory = (t: TFn) =>
  z.object({
    provider: ObjectKeysEnum(AGENT.ENDPOINTS),
    api_key: z
      .string()
      .min(1, t("validation.agent.config.apiKeyRequired"))
      .max(100, t("validation.agent.config.apiKeyTooLong", { max: 100 })),
  });

export const ModifyAgentSchemaFactory = (t: TFn) =>
  z.object({
    id: z.string().length(36),
    model: z.string().max(100),
    api_key: z
      .string()
      .min(1, t("validation.agent.config.apiKeyRequired"))
      .max(100, t("validation.agent.config.apiKeyTooLong", { max: 100 }))
      .optional(),
  });

export const OAIResponseSchema = z
  .object({
    model: z.string(),
    choices: z
      .array(
        z
          .object({
            message: z
              .object({
                role: z.literal("assistant"),
                content: z.string(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

export const AnthropicResponseSchema = z.object({
  id: z.string(),
  type: z.literal("message"),
  role: z.literal("assistant"),
  model: z.string(),
  content: z
    .array(
      z.object({
        type: z.literal("text"),
        text: z.string(),
      }),
    )
    .min(1),
  stop_reason: z.string().nullable(),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
    })
    .passthrough(),
});

export type OAIResponse = z.infer<typeof OAIResponseSchema>;
export type AnthropicResponse = z.infer<typeof AnthropicResponseSchema>;
