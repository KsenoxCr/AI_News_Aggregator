import { z } from "zod";
import type { TFn } from "./types";

export const CategorySchemaFactory = (t: TFn) =>
    z.string()
        .min(1, t("validation.category.slugRequired"))
        .max(50, t("validation.category.slugTooLong", { max: 50 }));
