import { z } from "zod";
import type { TFn } from "./types";

export const AddSourceSchemaFactory = (t: TFn) =>
    z.object({
        slug: z.string()
            .min(1, t("validation.source.nameRequired"))
            .max(30, t("validation.source.nameTooLong", { max: 30 })),
        url: z.string()
            .url(t("validation.source.urlInvalid"))
            .max(100, t("validation.source.urlTooLong", { max: 100 })),
    });

export const RemoveSourceSchemaFactory = (t: TFn) =>
    z.string()
        .length(36, t("validation.source.idInvalid"));
