import { z } from "zod";
import type { TFn } from "./types";

export const AddAgentSchemaFactory = (t: TFn) =>
  z.object({
    slug: z
      .string()
      .min(1, t("validation.agent.nameRequired"))
      .max(30, t("validation.agent.nameTooLong", { max: 30 })),
    url: z
      .string()
      .url(t("validation.agent.urlInvalid"))
      .max(100, t("validation.agent.urlTooLong", { max: 100 })),
    api_key: z
      .string()
      .min(1, t("validation.agent.apiKeyRequired"))
      .max(100, t("validation.agent.apiKeyTooLong", { max: 100 })),
  });

export const ModifyAgentSchemaFactory = (t: TFn) =>
  z.object({
    id: z.string().length(36, t("validation.agent.idInvalid")),
    slug: z
      .string()
      .min(1, t("validation.agent.nameRequired"))
      .max(30, t("validation.agent.nameTooLong", { max: 30 }))
      .optional(),
    url: z
      .string()
      .url(t("validation.agent.urlInvalid"))
      .max(100, t("validation.agent.urlTooLong", { max: 100 }))
      .optional(),
    api_key: z
      .string()
      .min(1, t("validation.agent.apiKeyRequired"))
      .max(100, t("validation.agent.apiKeyTooLong", { max: 100 }))
      .optional(),
  });

export const OAIResponseSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion"),
  model: z.string(),
  choices: z
    .array(
      z
        .object({
          index: z.number(),
          finish_reason: z.string(),
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
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
    })
    .passthrough(),
});

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
