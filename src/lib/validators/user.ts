import { z } from "zod";
import { MAX } from "~/config/business";
import type { TFn } from "./types";
import { SUPPORTED_LOCALES } from "../i18n/routing";

export const EditPreferencesSchemaFactory = (t: TFn) =>
    z.string()
        .min(0, t("validation.user.preferencesEmpty"))
        .max(MAX.preferences_chars, t("validation.user.preferencesTooLong", { max: MAX.preferences_chars }));

export const changeLanguageSchema = z.enum(SUPPORTED_LOCALES);
