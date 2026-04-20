"use client";

import { use, useEffect } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Typography } from "../../../../_components/typography";
import { useDigestContext } from "../../../_components/digest-context";
import { api } from "~/trpc/react";
import { AgentTag } from "./_components/agent-tag";
import { SourceMap } from "./_components/source-map";
import type { AgentProvider } from "~/config/business";
import { Spinner } from "~/components/ui/spinner";
import type { Digest } from "~/lib/types/feed";

// TODO: HistoryRoadmap (interactive roadmap of digest revisions)

export default function DigestModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations("feed");
  const { id } = use(params);
  const router = useRouter();
  const { selectedDigest, setLoadingDigest } = useDigestContext();

  const digestId = selectedDigest?.digest_id ?? id;

  const { data: revisionsData } = api.news.getRevisions.useQuery(digestId, {
    enabled: !!digestId,
  });

  useEffect(() => {
    console.log("[DigestModal] revisionsData", revisionsData);
  }, [revisionsData]);

  const effectiveDigest: Digest | null =
    selectedDigest ??
    (revisionsData
      ? {
          title: revisionsData.revisions[0]?.title ?? "",
          digest: revisionsData.revisions[0]?.digest ?? "",
          categories: revisionsData.categories,
          article_id: revisionsData.revisions[0]?.article.id ?? "",
          digest_id: id,
          updated_at: revisionsData.revisions[0]?.created_at ?? new Date(),
        }
      : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border-border relative flex w-[90%] flex-col gap-4 rounded-xl border p-5 sm:w-[60%] md:w-[50%] xl:w-[30%]">
        <button
          onClick={() => {
            setLoadingDigest(null);
            router.back();
          }}
          className="text-muted-foreground hover:text-foreground absolute top-4 right-4 cursor-pointer transition-colors"
        >
          <X className="size-8" />
        </button>
        <Typography as="h2" variant="heading-2" className="px-10 text-center">
          {effectiveDigest?.title}
        </Typography>

        <div className="flex flex-wrap gap-1">
          {effectiveDigest?.categories.map((c) => (
            <span
              key={c}
              className="bg-secondary shadow-accent inline-block rounded-full px-3 py-0.5 text-xs font-semibold"
            >
              {c}
            </span>
          ))}
        </div>

        <div className="bg-secondary rounded-lg p-4">
          <Typography variant="body-sm">{effectiveDigest?.digest}</Typography>
        </div>

        {revisionsData?.revisions[0] ? (
          <AgentTag
            provider={revisionsData.revisions[0].agent.provider as AgentProvider}
            model={revisionsData.revisions[0].agent.model}
          />
        ) : (
          <Spinner className="size-4" />
        )}

        <Typography as="h3" variant="heading-3">
          {t("sources")}
        </Typography>

        <SourceMap
          revisions={revisionsData?.revisions}
          selectedDigest={effectiveDigest}
        />
      </div>
    </div>
  );
}
