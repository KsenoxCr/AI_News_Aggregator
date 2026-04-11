import { getTranslations } from "next-intl/server";
import { LoginForm } from "./_components/login-form";
import { Typography } from "./_components/typography";
import { BRAND } from "~/config/business";

// TODO: Add Guard clause: already logged in -> redirect to feed

export default async function LandingPage() {
  const t = await getTranslations();
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-xs flex-col gap-12 md:max-w-md">
        <div className="flex flex-col gap-2">
          <Typography
            as="h1"
            variant="heading-1"
            className="text-center text-5xl leading-tight font-bold md:text-6xl"
          >
            {BRAND.appName}
          </Typography>
          <Typography variant="body-sm" color="muted" className="text-center">
            {t("landing.tagline")}
          </Typography>
        </div>
        <LoginForm />
      </div>
      <Typography className="absolute bottom-5 left-5">
        {BRAND.developer}, {BRAND.publishmentYear}
      </Typography>
    </main>
  );
}
