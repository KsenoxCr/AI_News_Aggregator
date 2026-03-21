import { z } from "zod";
import { MAX } from "~/config/business";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES } from "../il8n";

const { t } = useTranslation();

export const editPreferencesInput = z.string()
    .min(0, t("validation.user.preferencesEmpty"))
    .max(MAX.preferences_chars, t("validation.user.preferencesTooLong", { max: MAX.preferences_chars }));

export const changeLanguageInput = z.enum(SUPPORTED_LOCALES)
