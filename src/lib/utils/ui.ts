import { type Locale } from "~/lib/i18n/routing";

export function slugToLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function formatLocaleDate(
  date: Date,
  locale: Locale,
  timezone?: string,
): string {
  let intlLocale: Intl.LocalesArgument;

  switch (locale) {
    case "en":
      intlLocale = "en-US";
      break;
    case "fi":
      intlLocale = "fi-FI";
      break;
    default:
      throw new Error(`Unhandled locale: ${locale satisfies never}`);
  }

  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(timezone && { timeZone: timezone }),
  };

  return date.toLocaleDateString(intlLocale, opts);
}
