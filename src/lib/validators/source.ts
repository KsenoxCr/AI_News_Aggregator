import { z } from "zod";
import type { TFn } from "./types";

export const AddSourceSchemaFactory = (t: TFn) =>
  z.object({
    slug: z
      .string()
      .min(1, t("validation.source.nameRequired"))
      .max(30, t("validation.source.nameTooLong", { max: 30 })),
    url: z
      .string()
      .url(t("validation.source.urlInvalid"))
      .max(100, t("validation.source.urlTooLong", { max: 100 })),
    auth_type: z
      .enum(["none", "basic", "bearer", "api_key", "cookie"])
      .default("none"),
    auth_credential: z.string().max(256).optional(),
    date_filter_param: z.string().max(255).optional(),
    date_format: z
      .enum(["ISO_8601", "ISO_DATE", "UNIX", "RFC_1123", "RFC_822"])
      .optional(),
  });

export const RemoveSourceSchemaFactory = (t: TFn) =>
  z.string().length(36, t("validation.source.idInvalid"));
