import { z } from "zod";
import { useTranslation } from "react-i18next";

const { t } = useTranslation();

export const addSourceInput = z.object({
    slug: z.string()
        .min(1, t("validation.source.nameRequired"))
        .max(30, t("validation.source.nameTooLong", { max: 30 })),
    url: z.string()
        .url(t("validation.source.urlInvalid"))
        .max(100, t("validation.source.urlTooLong", { max: 100 })),
});

export const removeSourceInput = z.string()
    .length(36, t("validation.source.idInvalid"));
