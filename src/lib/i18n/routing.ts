import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
    locales: ["en", "fi"],
    defaultLocale: "en",
})

export const SUPPORTED_LOCALES = routing.locales
export type Locale = (typeof routing.locales)[number]
