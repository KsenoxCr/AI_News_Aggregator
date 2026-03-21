import { z } from "zod";
import { useTranslation } from "react-i18next";

const { t } = useTranslation();

export const addAgentInput = z.object({
    slug: z.string()
        .min(1, t("validation.agent.nameRequired"))
        .max(30, t("validation.agent.nameTooLong", { max: 30 })),
    url: z.string()
        .url(t("validation.agent.urlInvalid"))
        .max(100, t("validation.agent.urlTooLong", { max: 100 })),
    api_key: z.string()
        .min(1, t("validation.agent.apiKeyRequired"))
        .max(100, t("validation.agent.apiKeyTooLong", { max: 100 })),
});

export const modifyAgentInput = z.object({
    id: z.string()
        .length(36, t("validation.agent.idInvalid")),
    slug: z.string()
        .min(1, t("validation.agent.nameRequired"))
        .max(30, t("validation.agent.nameTooLong", { max: 30 }))
        .optional(),
    url: z.string()
        .url(t("validation.agent.urlInvalid"))
        .max(100, t("validation.agent.urlTooLong", { max: 100 }))
        .optional(),
    api_key: z.string()
        .min(1, t("validation.agent.apiKeyRequired"))
        .max(100, t("validation.agent.apiKeyTooLong", { max: 100 }))
        .optional(),
});
