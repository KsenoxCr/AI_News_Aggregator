"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Typography } from "../../_components/typography";
import { api } from "~/trpc/react";
import { authClient } from "~/server/better-auth/client";
import { Unauthorized } from "../../_components/unauthorized";
import { AgentTag } from "../../feed/@modal/(..)digests/[id]/_components/agent-tag";
import { SourceMap } from "../../feed/@modal/(..)digests/[id]/_components/source-map";
import { CategoryBadge } from "../../feed/_components/category-badge";
import type { AgentProvider } from "~/config/business";
import { Spinner } from "~/components/ui/spinner";
import { ArrowLeft } from "lucide-react";

export default function DigestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = useTranslations("feed");
  const { id } = use(params);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const router = useRouter();

  const { data: revisionsData } = api.news.getRevisions.useQuery(id, {
    enabled: !sessionPending && !!session,
  });

  const revision = revisionsData?.revisions[0];

  if (sessionPending) return <div className="flex min-h-svh items-center justify-center"><Spinner /></div>;
  if (!session) return <Unauthorized />;

  return (
    <main className="mx-auto flex w-screen max-w-2xl justify-center px-4 py-8 md:px-6">
      <div className="bg-card border-border relative flex w-[90%] flex-col gap-4 rounded-xl border p-5 sm:w-[60%] md:w-[70%] xl:w-[80%]">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground absolute top-4 right-4 cursor-pointer transition-colors"
        >
          <ArrowLeft className="size-8" />
        </button>
        <Typography as="h2" variant="heading-2" className="px-10 text-center">
          {revision?.title}
        </Typography>
        <div className="flex flex-wrap gap-1">
          {revisionsData?.categories.map((c) => (
            <CategoryBadge key={c} category={c} />
          ))}
        </div>

        <div className="bg-secondary rounded-lg p-4">
          <Typography variant="body-sm">{revision?.digest}</Typography>
        </div>

        {revision ? (
          <AgentTag
            provider={revision.agent.provider as AgentProvider}
            model={revision.agent.model}
          />
        ) : (
          <Spinner className="size-4" />
        )}

        <Typography as="h3" variant="heading-3">
          {t("sources")}
        </Typography>

        <SourceMap
          revisions={revisionsData?.revisions}
          selectedDigest={
            revisionsData
              ? {
                  title: revision?.title ?? "",
                  digest: revision?.digest ?? "",
                  categories: revisionsData.categories,
                  article_id: revision?.article.id ?? "",
                  digest_id: id,
                  updated_at: revision?.created_at ?? new Date(),
                }
              : null
          }
        />
      </div>
    </main>
  );
}
