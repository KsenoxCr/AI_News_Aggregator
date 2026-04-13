import { defineRouting } from "next-intl/routing"
import { createNavigation } from "next-intl/navigation"

export const routing = defineRouting({
    locales: ["en", "fi"],
    defaultLocale: "en",
})

export const SUPPORTED_LOCALES = routing.locales
export type Locale = (typeof routing.locales)[number]

export const { useRouter, usePathname, redirect, permanentRedirect, Link } = createNavigation(routing)
