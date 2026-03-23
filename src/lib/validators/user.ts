import { z } from "zod";
import { MAX } from "~/config/business";
import { SUPPORTED_LOCALES } from "../il8n";
import type { TFn } from "./types";

export const EditPreferencesSchemaFactory = (t: TFn) =>
    z.string()
        .min(0, t("validation.user.preferencesEmpty"))
        .max(MAX.preferences_chars, t("validation.user.preferencesTooLong", { max: MAX.preferences_chars }));

export const changeLanguageSchema = z.enum(SUPPORTED_LOCALES);
