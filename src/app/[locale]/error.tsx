"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "~/components/ui/button";
import { Typography } from "./_components/typography";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const searchParams = useSearchParams();
  const search = searchParams.get("search");

  // TODO: Translate

  const err = search?.match(/^error=.*$/)
    ? search.substring(search.indexOf("=") + 1)
    : "Something went wrong";

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-xs flex-col gap-6 text-center">
        <div className="flex flex-col gap-2">
          <Typography as="h1" variant="heading-2">
            {err}
          </Typography>
          {error.message && (
            <Typography variant="body-sm" color="muted">
              {error.message}
            </Typography>
          )}
        </div>
        <Button onClick={reset} className="w-full">
          Try again
        </Button>
      </div>
    </main>
  );
}
