"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CalendarIcon, Menu } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";

import { toast } from "sonner";
import { useRouter, type Locale } from "~/lib/i18n/routing";
import { api, type RouterOutputs } from "~/trpc/react";
import { slugToLabel, formatLocaleDate } from "~/lib/utils/ui";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Calendar } from "~/components/ui/calendar";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from "~/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Typography } from "../_components/typography";
import { cn } from "~/lib/utils";
import { BRAND, MAX } from "~/config/business";
import { authClient } from "~/server/better-auth/client";

// TODO: "Missing settings" toast if settings load query missing any critical setting

// ---------------------------------------------------------------------------
// Static scaffold data
// ---------------------------------------------------------------------------

const ARTICLES = [
  {
    id: "1",
    category: "Technology",
    title: "New AI Model Achieves 98% Accuracy in Medical Diagnosis Tasks",
    source: "TechCrunch",
    articleAge: "2 hours ago",
    generatedAge: "1 hour ago",
  },
  {
    id: "2",
    category: "Finance",
    title: "Global Markets Rally as Inflation Data Shows Cooling Trend",
    source: "Reuters",
    articleAge: "5 hours ago",
    generatedAge: "4 hours ago",
  },
  {
    id: "3",
    category: "Technology",
    title: "Major Tech Company Announces Breakthrough in Quantum Computing",
    source: "Hacker News",
    articleAge: "6 hours ago",
    generatedAge: "5 hours ago",
  },
  {
    id: "4",
    category: "Science",
    title:
      "Researchers Discover New Species of Deep-Sea Creature in Pacific Ocean",
    source: "The Guardian",
    articleAge: "8 hours ago",
    generatedAge: "7 hours ago",
  },
  {
    id: "5",
    category: "Climate",
    title: "Arctic Ice Extent Reaches Record Low for Third Consecutive Year",
    source: "BBC News",
    articleAge: "10 hours ago",
    generatedAge: "9 hours ago",
  },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Technology: "bg-violet-600 text-white",
  Politics: "bg-slate-500 text-white",
  Finance: "bg-violet-400 text-white",
  Science: "bg-blue-500 text-white",
  Climate: "bg-emerald-600 text-white",
};

// ---------------------------------------------------------------------------

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-3 py-0.5 text-xs font-semibold",
        CATEGORY_COLORS[category] ?? "bg-muted text-muted-foreground",
      )}
    >
      {category}
    </span>
  );
}

function ArticleCard({ article }: { article: (typeof ARTICLES)[number] }) {
  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <CategoryBadge category={article.category} />
          <Typography as="h3" variant="heading-3">
            {article.title}
          </Typography>
          <Typography variant="body-sm" color="muted">
            {article.source}&nbsp;·&nbsp;article:&nbsp;{article.articleAge}
            &nbsp;·&nbsp;generated:&nbsp;{article.generatedAge}
          </Typography>
        </div>
      </div>
    </div>
  );
}

function FeedView() {
  return (
    <main className="mx-auto max-w-3xl space-y-3 px-4 py-5 md:px-6">
      {/* {ARTICLES.map((article) => ( */}
      {/*   <ArticleCard key={article.id} article={article} /> */}
      {/* ))} */}
    </main>
  );
}

function MissingView({ message }: { message: string }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <Typography variant="body-sm" color="muted" className="text-center">
        {message}
      </Typography>
      <Button variant="outline" size="sm" asChild>
        <Link href="/settings">Settings</Link>
      </Button>
    </div>
  );
}

type Category = { slug: string; active: boolean };

export default function FeedPage() {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const { data: session } = authClient.useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>();
  const [timezone, setTimezone] = useState<string>("");
  const [settingsConfirmed, setSettingsConfirmed] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string>("");
  type FeedItem =
    RouterOutputs["news"]["generateFeed"] extends AsyncIterable<infer T>
      ? T
      : never;
  const [feedData, setFeedData] = useState<FeedItem | null>(null);

  const { data: categoriesData } = api.settings.getCategories.useQuery();
  const { data: confirmData } = api.settings.confirmRequired.useQuery();
  api.news.generateFeed.useSubscription(calendarDate ?? new Date(), {
    enabled: settingsConfirmed,
    onData: (data) => setFeedData(data),
  });

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    if (!categoriesData) return;
    setCategories(categoriesData.map((slug) => ({ slug, active: false })));
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
    } else if (feedData?.status === "failure" && feedData.error) {
      toast.error(feedData.error.message, { position: "top-center" });
    }
  }, [feedData]);

  const handleLogout = async () => {
    await authClient.signOut();
    router.replace("/");
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="md:bg-background/80 md:sticky md:top-0 md:z-10 md:backdrop-blur-sm">
        {/* Header */}
        <header className="border-border relative border-b px-4 py-3">
          <div className="relative flex items-center">
            <Drawer direction="left">
              <DrawerTrigger asChild>
                <button className="text-muted-foreground">
                  <Menu className="size-8" />
                </button>
              </DrawerTrigger>
              <DrawerContent className="w-1/4 p-0 before:inset-0 before:rounded-none">
                <div className="bg-popover flex h-screen flex-col gap-1 p-4">
                  <DrawerClose asChild>
                    <button className="text-muted-foreground mb-2 self-start">
                      <ArrowLeft className="size-8" />
                    </button>
                  </DrawerClose>
                  <DrawerClose asChild>
                    <Link
                      href="/settings"
                      className="text-foreground hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
                    >
                      Settings
                    </Link>
                  </DrawerClose>
                  <button
                    onClick={handleLogout}
                    className="text-foreground hover:bg-muted flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium"
                  >
                    Log out
                  </button>
                </div>
              </DrawerContent>
            </Drawer>
            <Typography
              as="h1"
              variant="heading-1"
              size="2xl"
              className="absolute left-1/2 -translate-x-1/2"
            >
              {BRAND.appName}
            </Typography>
            <Typography
              variant="body-sm"
              color="muted"
              className="absolute right-0 hidden md:block"
            >
              {session?.user.email}
            </Typography>
          </div>
        </header>

        {/* Toolbar */}
        <div className="border-border border-b px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Category chips */}
            <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    cat.active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {slugToLabel(cat.slug)}
                </button>
              ))}
            </div>

            {/* Timeframe */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2 self-start md:self-auto"
                >
                  {(() => {
                    const today = new Date();
                    const fmt = (d: Date) =>
                      formatLocaleDate(d, locale, timezone || undefined);
                    const isSameDay =
                      !calendarDate ||
                      calendarDate.toDateString() === today.toDateString();
                    return isSameDay
                      ? fmt(today)
                      : `${fmt(calendarDate!)}\u2013${fmt(today)}`;
                  })()}
                  <CalendarIcon className="size-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={calendarDate}
                  onSelect={(d: Date | undefined) => setCalendarDate(d)}
                  timeZone={timezone}
                  disabled={{
                    before: new Date(Date.now() - MAX.timeframe),
                    after: new Date(),
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {settingsConfirmed && !infoMessage ? (
        <FeedView />
      ) : !settingsConfirmed && infoMessage ? (
        <MissingView message={infoMessage} />
      ) : (
        <div className="flex h-[60vh] items-center justify-center">
          <Spinner />
        </div>
      )}
    </div>
  );
}
