"use client";

import { useEffect, useState } from "react";
import { CalendarIcon } from "lucide-react";
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
import { MAX } from "~/config/business";

type Category = { slug: string; active: boolean };

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

export function ToolBar({
  categories,
  calendarDate,
  setCalendarDate,
}: {
  categories: Category[];
  calendarDate: Date | undefined;
  setCalendarDate: (d: Date | undefined) => void;
}) {
  return (
    <div className="border-border bg-background/80 sticky top-0 z-10 border-b px-4 py-3 backdrop-blur-sm md:sticky md:top-14.25 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {categories.length ? (
            categories.map((cat) => (
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
            ))
          ) : (
            <div className="flex w-screen items-center justify-center">
              <Spinner className="size-4" />
            </div>
          )}
        </div>
        <DatePicker calendarDate={calendarDate} setCalendarDate={setCalendarDate} />
      </div>
    </div>
  );
}
