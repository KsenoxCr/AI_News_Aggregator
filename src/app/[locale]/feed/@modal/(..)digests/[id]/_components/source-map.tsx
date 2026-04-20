"use client";

import { Typography } from "~/app/[locale]/_components/typography";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Spinner } from "~/components/ui/spinner";
import type { RouterOutputs } from "~/trpc/react";
import type { Digest } from "~/lib/types/feed";
import { type Locale } from "~/lib/i18n/routing";
import { useLocale } from "next-intl";
import { useState, useEffect } from "react";
import { formatLocaleDate } from "~/lib/utils/ui";

type Revision = RouterOutputs["news"]["getRevisions"]["revisions"][number];

export function SourceMap({
  revisions,
  selectedDigest,
}: {
  revisions: Revision[] | undefined;
  selectedDigest: Digest | null;
}) {
  const locale = useLocale() as Locale;
  const [timezone, setTimezone] = useState("");
  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  if (!revisions || !selectedDigest)
    return (
      <div className="flex w-full justify-center">
        <Spinner className="size-4" />
      </div>
    );

  const uniqueSources = revisions.reduce<{ slug: string; url: string }[]>(
    (acc, r) => {
      if (!acc.some((s) => s.slug === r.article.source.slug))
        acc.push(r.article.source);
      return acc;
    },
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      {uniqueSources.map((source) => {
        const isSourceMatch =
          source.slug ===
          revisions.find((r) => r.article.id === selectedDigest.article_id)
            ?.article.source.slug;

        return (
          <div key={source.slug} className="flex flex-col gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Typography
                  color="muted"
                  className={
                    isSourceMatch ? "font-semibold" : "font-semibold opacity-30"
                  }
                >
                  {source.slug}
                </Typography>
              </TooltipTrigger>
              <TooltipContent side="top" align="start">
                {source.url}
              </TooltipContent>
            </Tooltip>
            <ul className="flex flex-col gap-0.5 pl-4">
              {revisions
                .filter((r) => r.article.source.slug === source.slug)
                .map((r) => {
                  const isArticleMatch =
                    r.article.id === selectedDigest.article_id;

                  return (
                    <li key={r.article.link} className="list-disc">
                      <a
                        href={r.article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={isArticleMatch ? "hover:underline" : "opacity-30 hover:underline"}
                      >
                        <Typography variant="body-sm" color="muted">
                          {`${r.article.title} (${r.article.author ? r.article.author + ", " : ""}${formatLocaleDate(new Date(r.article.published_at), locale, timezone || undefined)})`}
                        </Typography>
                      </a>
                    </li>
                  );
                })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
