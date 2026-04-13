"use client";

import { useTranslations } from "next-intl";
import { Typography } from "../../_components/typography";
import { FlagButton } from "./flag";
import { SUPPORTED_LOCALES, type Locale } from "~/lib/i18n/routing";

interface Props {
  selectedLocale: Locale;
  setSelectedLocale: (locale: Locale) => void;
}

export function LanguageSettings({ selectedLocale, setSelectedLocale }: Props) {
  const t = useTranslations();

  return (
    <section className="border-border bg-card rounded-xl border p-5">
      <Typography as="h2" variant="heading-2" className="mb-4">
        {t("settings.language.title")}
      </Typography>
      <div className="-ml-1 flex gap-1">
        {SUPPORTED_LOCALES.map((locale) => (
          <FlagButton
            key={locale}
            locale={locale}
            enabled={selectedLocale === locale}
            handleClick={() => setSelectedLocale(locale)}
          />
        ))}
      </div>
    </section>
  );
}
