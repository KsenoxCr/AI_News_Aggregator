import { z } from "zod";
import { MAX } from "~/config/business";
import { SUPPORTED_LOCALES } from "~/lib/i18n/routing";

export const SaveSettingsSchema = z.object({
  sources: z.array(
    z.object({
      source_id: z.string().uuid(),
      enabled: z.boolean(),
    }),
  ),
  agents: z.object({
    enable: z.string().uuid().nullable(),
    disable: z.string().uuid().nullable(),
  }),
  preferences: z.object({
    categories: z.object({
      add: z.array(z.string().max(100)),
      remove: z.array(z.string().max(100)),
    }),
    preferences: z.string().max(MAX.preferences_chars),
    locale: z.enum(SUPPORTED_LOCALES as unknown as [string, ...string[]]),
  }),
});
