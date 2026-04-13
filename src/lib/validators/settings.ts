import { z } from "zod";
import { MAX } from "~/config/business";
import { SUPPORTED_LOCALES } from "~/lib/i18n/routing";
import type { TFn } from "./types";

export const AddAPIKeySchemaFactory = (t: TFn) =>
  z.object({
    key: z
      .string()
      .min(1, t("validation.agent.config.apiKeyRequired"))
      .max(512, t("validation.agent.config.apiKeyTooLong", { max: 512 })),
  });

export const SaveSettingsSchemaFactory = (t: TFn) =>
  z.object({
    sources: z.array(
      z.object({
        source_id: z.string().uuid(),
        enabled: z.boolean(),
      }),
    ),
    agents: z.object({
      add: z.array(z.object({ provider: z.string(), model: z.string(), key: z.string() })),
      remove: z.array(z.string().uuid()),
      enable: z.array(z.string().uuid()),
      disable: z.array(z.string().uuid()),
    }),
    preferences: z.object({
      categories: z.object({
        add: z.array(z.string().max(100)),
        remove: z.array(z.string().max(100)),
      }),
      preferences: z.string().max(
        MAX.preferences_chars,
        t("validation.user.preferencesTooLong", {
          max: MAX.preferences_chars,
        }),
      ),
      locale: z.enum(SUPPORTED_LOCALES as unknown as [string, ...string[]]),
    }),
  });
