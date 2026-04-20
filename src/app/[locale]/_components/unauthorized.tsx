"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "~/lib/i18n/routing";
import { Button } from "~/components/ui/button";
import { Typography } from "./typography";

export function Unauthorized() {
  const t = useTranslations();
  const router = useRouter();

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-8">
      <Typography variant="body">{t("errors.unauthorized")}</Typography>
      <Button onClick={() => router.push("/")}>
        {t("landing.login.submitButton")}
      </Button>
    </div>
  );
}
