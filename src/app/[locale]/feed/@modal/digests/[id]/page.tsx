"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Typography } from "../../../../_components/typography";
import { useDigestContext } from "../../../_components/digest-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { api } from "~/trpc/react";
import { AgentTag } from "./_components/agent-tag";
import type { AgentProvider } from "~/config/business";

// TODO: replace scaffolding with real sources data from router
// FIX: navigation (url)

const SCAFFOLD_SOURCES = [
  {
    slug: "ars-technica",
    articles: [
      {
        id: "a1b2c3",
        title: "AI models are getting cheaper by the month",
        publishDate: "2026-04-15",
        link: "https://arstechnica.com/a1",
      },
      {
        id: "d4e5f6",
        title: "OpenAI launches new reasoning model",
        publishDate: "2026-04-14",
        link: "https://arstechnica.com/a2",
      },
    ],
  },
  {
    slug: "the-verge",
    articles: [
      {
        id: "g7h8i9",
        title: "Google DeepMind announces Gemini Ultra 2",
        publishDate: "2026-04-15",
        link: "https://theverge.com/a3",
      },
      {
        id: "j1k2l3",
        title: "Meta releases open-source LLM weights",
        publishDate: "2026-04-13",
        link: "https://theverge.com/a4",
      },
    ],
  },
];

export default function DigestModal() {
  const router = useRouter();
  const { selectedDigest, setLoadingDigest } = useDigestContext();

  const { data: revisionsData } = api.news.getRevisions.useQuery(
    selectedDigest?.digest_id ?? "",
    { enabled: !!selectedDigest?.digest_id },
  );

  useEffect(() => {
    console.log("[DigestModal] revisionsData", revisionsData);
  }, [revisionsData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border-border relative flex w-[90%] flex-col gap-4 rounded-xl border p-5 sm:w-[60%] md:w-[50%] xl:w-[30%]">
        <button
          onClick={() => {
            setLoadingDigest(null);
            router.back();
          }}
          className="text-muted-foreground hover:text-foreground absolute top-4 right-4 transition-colors"
        >
          <X className="size-8" />
        </button>
        <Typography as="h2" variant="heading-2" className="px-10 text-center">
          {selectedDigest?.title}
        </Typography>

        <div className="flex flex-wrap gap-1">
          {selectedDigest?.categories.map((c) => (
            <span
              key={c}
              className="bg-secondary shadow-accent inline-block rounded-full px-3 py-0.5 text-xs font-semibold"
            >
              {c}
            </span>
          ))}
        </div>

        <div className="bg-secondary rounded-lg p-4">
          <Typography variant="body-sm">{selectedDigest?.digest}</Typography>
        </div>

        {revisionsData?.[0] && (
          <AgentTag
            provider={revisionsData[0].agent.provider as AgentProvider}
            model={revisionsData[0].agent.model}
          />
        )}

        <Typography as="h3" variant="heading-3" color="muted">
          Sources
        </Typography>

        <div className="flex flex-col gap-3">
          {SCAFFOLD_SOURCES.map((source) => (
            <div key={source.slug} className="flex flex-col gap-1">
              <Typography
                variant="body-sm"
                color="muted"
                className="font-semibold"
              >
                {source.slug}
              </Typography>
              <ul className="flex flex-col gap-0.5 pl-4">
                {source.articles.map((article) => {
                  const isMatch = article.id === selectedDigest?.article_id;
                  return (
                    <li key={article.id} className="list-disc">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Typography
                            variant="body-sm"
                            color="muted"
                            className={isMatch ? undefined : "opacity-30"}
                          >
                            {article.title}
                          </Typography>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start">
                          {article.link}
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
