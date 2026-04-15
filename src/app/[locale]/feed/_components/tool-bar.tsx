"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { BookOpen, CalendarIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { type Locale } from "~/lib/i18n/routing";
import { slugToLabel, formatLocaleDate } from "~/lib/utils/ui";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { FEED, MAX } from "~/config/business";

function DatePicker({
  calendarDate,
  setCalendarDate,
}: {
  calendarDate: Date | undefined;
  setCalendarDate: (d: Date | undefined) => void;
}) {
  const locale = useLocale() as Locale;
  const [timezone, setTimezone] = useState("");
  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const today = new Date();
  const fmt = (d: Date) => formatLocaleDate(d, locale, timezone || undefined);
  const isSameDay =
    !calendarDate || calendarDate.toDateString() === today.toDateString();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-2 self-start md:self-auto"
        >
          {isSameDay ? fmt(today) : `${fmt(calendarDate!)}\u2013${fmt(today)}`}
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
  );
}

function Dropdown({
  pageSize,
  setPageSize,
  close,
}: {
  pageSize: number;
  setPageSize: Dispatch<SetStateAction<number>>;
  close: () => void;
}) {
  const options = FEED.paging.filter((n) => n !== pageSize);
  return (
    <div className="border-border bg-background absolute top-full right-0 z-50 overflow-hidden rounded-b-lg border border-t-0 shadow-md">
      {options.map((n, i) => (
        <button
          key={n}
          onClick={() => {
            setPageSize(n);
            close();
          }}
          className={cn(
            "text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors",
            i < options.length - 1 && "border-border border-b",
          )}
        >
          {n}
          <BookOpen className="invisible size-4" />
        </button>
      ))}
    </div>
  );
}

function PageSizePicker({
  pageSize,
  setPageSize,
}: {
  pageSize: number;
  setPageSize: Dispatch<SetStateAction<number>>;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  return (
    <div className="relative shrink-0">
      <Button
        variant="outline"
        size="sm"
        className={cn("gap-2", showDropdown && "rounded-b-none")}
        onClick={() => setShowDropdown((v) => !v)}
      >
        {pageSize}
        <BookOpen className="size-4" />
      </Button>
      {showDropdown && (
        <Dropdown
          pageSize={pageSize}
          setPageSize={setPageSize}
          close={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}

export function ToolBar({
  categories,
  activeCategories,
  setActiveCategories,
  pageSize,
  setPageSize,
  calendarDate,
  setCalendarDate,
}: {
  categories: Set<string>;
  activeCategories: Set<string>;
  setActiveCategories: Dispatch<SetStateAction<Set<string>>>;
  pageSize: number;
  setPageSize: Dispatch<SetStateAction<number>>;
  calendarDate: Date | undefined;
  setCalendarDate: (d: Date | undefined) => void;
}) {
  return (
    <div className="border-border bg-background/80 sticky top-0 z-10 border-b px-4 py-3 backdrop-blur-sm md:sticky md:top-14.25 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {categories.size ? (
            [...categories].map((slug) => (
              <button
                key={slug}
                onClick={() => {
                  const next = new Set(activeCategories);
                  if (next.has(slug)) next.delete(slug);
                  else next.add(slug);
                  setActiveCategories(next);
                }}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  activeCategories.has(slug)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {slugToLabel(slug)}
              </button>
            ))
          ) : (
            <div className="flex w-screen items-center justify-center">
              <Spinner className="size-4" />
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <PageSizePicker pageSize={pageSize} setPageSize={setPageSize} />
          <DatePicker
            calendarDate={calendarDate}
            setCalendarDate={setCalendarDate}
          />
        </div>
      </div>
    </div>
  );
}
