import type { useTranslations } from "next-intl"
import type { getTranslations } from "next-intl/server"

export type TFn =
    ReturnType<typeof useTranslations>
    | Awaited<ReturnType<typeof getTranslations>>
