"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { type Locale } from "~/lib/i18n/routing";
import { formatLocaleDate } from "~/lib/utils/ui";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { MAX } from "~/config/business";
import { type Digest } from "~/lib/types/feed";

export function DatePicker({
  calendarDate,
  setCalendarDate,
  setDigestPages,
}: {
  calendarDate: Date | undefined;
  setCalendarDate: (d: Date | undefined) => void;
  setDigestPages: Dispatch<SetStateAction<Digest[][]>>;
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
          onSelect={(d: Date | undefined) => {
            setCalendarDate(d);
            if (d)
              setDigestPages((prev) =>
                prev
                  .map((page) =>
                    page.filter((digest) => digest.updated_at >= d),
                  )
                  .filter((page) => page.length > 0),
              );
          }}
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
