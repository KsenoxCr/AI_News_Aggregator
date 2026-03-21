import { z } from "zod";
import { useTranslation } from "react-i18next";

const { t } = useTranslation();

export const categoryInput = z.string()
    .min(1, t("validation.category.slugRequired"))
    .max(50, t("validation.category.slugTooLong", { max: 50 }));
