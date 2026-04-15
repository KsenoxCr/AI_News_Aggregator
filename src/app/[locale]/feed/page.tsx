"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, type RouterOutputs } from "~/trpc/react";
import { Spinner } from "~/components/ui/spinner";
import { ToolBar } from "./_components/tool-bar";
import { Header } from "./_components/header";
import { ScrollArrow } from "./_components/scroll-arrow";
import { PagePicker } from "./_components/page-picker";
import { FeedView } from "./_components/feed-view";
import { InfoView } from "./_components/info-view";
import { FEED } from "~/config/business";
import { PushToPages } from "~/lib/utils/feed";
import { type Digest } from "~/lib/types/feed";

// Out of scope for now:
// TODO: ToolBar: CollationOrderPicker + collation logic
// TODO: fzf search

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
  const [digestPages, setDigestPages] = useState<Digest[][]>([]);
  const [page, setPage] = useState(1);
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
      else if (feedData.digestRevisions || feedData.digestRevision) {
        const newDigestRevisions = feedData.digestRevisions
          ? feedData.digestRevisions
          : [feedData.digestRevision!];
        const newPages = PushToPages(digestPages, newDigestRevisions, pageSize);
        setDigestPages(newPages);
      } else if (
        !feedData.info &&
        !feedData.digestRevision &&
        !feedData.digestRevisions
      )
        setInfoMessage("");
    } else if (feedData?.status === "failure" && feedData.error) {
      toast.error(feedData.error.message, { position: "top-center" });
    }
  }, [feedData]);

  useEffect(() => {
    setDigestPages((prev) => PushToPages([], prev.flat(), pageSize));
  }, [pageSize]);

  const showFeed = () => {
    const anyDigests = digestPages.length > 0;
    if (anyDigests && !infoMessage)
      return (
        <FeedView
          digestPages={digestPages}
          page={page}
          activeCategories={activeCategories}
        />
      );
    if (anyDigests && infoMessage)
      return (
        <>
          <FeedView
            digestPages={digestPages}
            page={page}
            activeCategories={activeCategories}
          />
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
      <PagePicker
        pageCount={digestPages.length}
        page={page}
        setPage={setPage}
      />
      <ScrollArrow scrollTop={scrollTop} />
    </div>
  );
}
