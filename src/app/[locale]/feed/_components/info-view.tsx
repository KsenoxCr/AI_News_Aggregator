"use client";

import Link from "next/link";
import { Typography } from "../../_components/typography";
import { Spinner } from "~/components/ui/spinner";
import { Button } from "~/components/ui/button";

export function InfoView({
  message,
  isError,
  anyDigests,
}: {
  message: string;
  isError: boolean;
  anyDigests?: boolean;
}) {
  if (anyDigests) {
    return (
      <div className="bg-card/75 border-border fixed bottom-16 left-1/2 z-30 mb-4 -translate-x-1/2 rounded-xl border p-5 shadow-md backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Typography variant="body-sm" color="muted">
            {message}
          </Typography>
          {!isError && <Spinner className="size-4" />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <div className="flex items-center gap-2">
        <Typography variant="body-sm" color="muted" className="text-center">
          {message}
        </Typography>
        {!isError && <Spinner className="size-4" />}
      </div>
      {isError && (
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings">Settings</Link>
        </Button>
      )}
    </div>
  );
}
