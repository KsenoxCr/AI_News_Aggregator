"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { api, type RouterOutputs } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Typography } from "../_components/typography";
import { ToolBar } from "./_components/tool-bar";
import { Header } from "./_components/header";
import { FEED } from "~/config/business";

// TODO: Pagination
// TODO: ToolBar: CollationOrderPicker + collation logic
// TODO: extract rc's to _components
// TODO: fzf search

function ScrollArrow({ scrollTop }: { scrollTop: boolean }) {
  return (
    <button
      onClick={() =>
        scrollTop
          ? window.scrollTo({ top: 0, behavior: "smooth" })
          : window.scrollTo({
              top: document.body.scrollHeight,
              behavior: "smooth",
            })
      }
      className="bg-background border-border text-muted-foreground hover:text-foreground fixed right-6 bottom-6 z-50 rounded-full border p-2.5 shadow-md transition-colors"
    >
      {scrollTop ? (
        <ArrowUp className="size-6" />
      ) : (
        <ArrowDown className="size-6" />
      )}
    </button>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={"inline-block rounded-full px-3 py-0.5 text-xs font-semibold"}
    >
      {category}
    </span>
  );
}

type Digest = { title: string; digest: string; categories: string[] };

// TODO: articleAge: "2 hours ago", generatedAge: "1 hour ago",

function DigestCard({ article }: { article: Digest }) {
  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          {article.categories.map((c) => (
            <CategoryBadge key={c} category={c} />
          ))}
        </div>
        <Typography as="h3" variant="heading-3">
          {article.title}
        </Typography>
        <Typography variant="body-sm" color="muted">
          {article.digest}
        </Typography>
      </div>
    </div>
  );
}

function FeedView({
  digests,
  activeCategories,
}: {
  digests: Digest[];
  activeCategories: Set<string>;
}) {
  return (
    <main className="mx-auto max-w-3xl space-y-3 px-4 py-5 md:px-6">
      {digests
        .filter((d) => d.categories.some((c) => activeCategories.has(c)))
        .map((d, i) => (
          <DigestCard key={i} article={d} />
        ))}
    </main>
  );
}

function InfoView({
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
      <div className="mx-auto max-w-3xl px-4 py-6 pb-12 md:px-6">
        <div className="flex items-center justify-center gap-2">
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

// TODO: pagination, separate state: pages [][]

export default function FeedPage() {
  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(),
  );
  const [pageSize, setPageSize] = useState<number>(FEED.paging[0]);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>();
  const [settingsConfirmed, setSettingsConfirmed] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string>("");
  type FeedItem =
    RouterOutputs["news"]["generateFeed"] extends AsyncIterable<infer T>
      ? T
      : never;
  const [feedData, setFeedData] = useState<FeedItem | null>(null);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [today] = useState<Date>(() => new Date());
  const [scrollTop, setScrollTop] = useState(false);

  const { data: categoriesData } = api.settings.getCategories.useQuery();
  const { data: confirmData } = api.settings.confirmRequired.useQuery();
  api.news.generateFeed.useSubscription(calendarDate ?? today, {
    enabled: settingsConfirmed,
    onData: (data) => setFeedData(data),
  });

  useEffect(() => {
    const onScroll = () => setScrollTop(window.scrollY > 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!categoriesData) return;
    setCategories(new Set(categoriesData));
    setActiveCategories(new Set(categoriesData));
  }, [categoriesData]);

  useEffect(() => {
    if (!confirmData) return;
    if (confirmData.status === "success") {
      setSettingsConfirmed(true);
    } else {
      setInfoMessage(confirmData.error);
    }
  }, [confirmData]);

  useEffect(() => {
    if (feedData?.status === "success") {
      if (feedData.info) setInfoMessage(feedData.info);
      else if (feedData.digestRevisions)
        setDigests((prev) => [...prev, ...feedData.digestRevisions!]);
      else if (feedData.digestRevision)
        setDigests((prev) => [...prev, feedData.digestRevision!]);
      else if (
        !feedData.info &&
        !feedData.digestRevision &&
        !feedData.digestRevisions
      )
        setInfoMessage("");
    } else if (feedData?.status === "failure" && feedData.error) {
      toast.error(feedData.error.message, { position: "top-center" });
    }
  }, [feedData]);

  const showFeed = () => {
    const anyDigests = digests.length > 0;
    if (anyDigests && !infoMessage)
      return <FeedView digests={digests} activeCategories={activeCategories} />;
    if (anyDigests && infoMessage)
      return (
        <>
          <FeedView digests={digests} activeCategories={activeCategories} />
          <InfoView
            message={infoMessage}
            isError={!settingsConfirmed}
            anyDigests={anyDigests}
          />
        </>
      );
    if (infoMessage)
      return <InfoView message={infoMessage} isError={!settingsConfirmed} />;
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  };

  return (
    <div className="bg-background min-h-screen">
      <Header />

      <ToolBar
        categories={categories}
        activeCategories={activeCategories}
        setActiveCategories={setActiveCategories}
        pageSize={pageSize}
        setPageSize={setPageSize}
        calendarDate={calendarDate}
        setCalendarDate={setCalendarDate}
      />

      {showFeed()}
      <ScrollArrow scrollTop={scrollTop} />
    </div>
  );
}
