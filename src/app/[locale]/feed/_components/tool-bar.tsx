"use client";

import { type Dispatch, type SetStateAction } from "react";
import { slugToLabel } from "~/lib/utils/ui";
import { cn } from "~/lib/utils";
import { type Digest } from "~/lib/types/feed";
import { CategoryChip } from "../../_components/category-chip";
import { DatePicker } from "./date-picker";
import { PageSizePicker } from "./page-size-picker";

export function ToolBar({
  categories,
  activeCategories,
  setActiveCategories,
  pageSize,
  setPageSize,
  calendarDate,
  setCalendarDate,
  setDigestPages,
}: {
  categories: Set<string>;
  activeCategories: Set<string>;
  setActiveCategories: Dispatch<SetStateAction<Set<string>>>;
  pageSize: number;
  setPageSize: Dispatch<SetStateAction<number>>;
  calendarDate: Date | undefined;
  setCalendarDate: (d: Date | undefined) => void;
  setDigestPages: Dispatch<SetStateAction<Digest[][]>>;
}) {
  return (
    <div className="border-border bg-background/80 sticky top-0 z-10 border-b px-4 py-3 backdrop-blur-sm md:sticky md:top-14.25 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
          {categories.size ? (
            [...categories].map((slug) => (
              <CategoryChip
                key={slug}
                label={slugToLabel(slug)}
                active={activeCategories.has(slug)}
                onClick={() => {
                  const next = new Set(activeCategories);
                  if (next.has(slug)) next.delete(slug);
                  else next.add(slug);
                  setActiveCategories(next);
                }}
              />
            ))
          ) : (
            Array.from({ length: 5 }).map((_, i) => (
              <CategoryChip key={i} ghost />
            ))
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <PageSizePicker pageSize={pageSize} setPageSize={setPageSize} />
          <DatePicker
            calendarDate={calendarDate}
            setCalendarDate={setCalendarDate}
            setDigestPages={setDigestPages}
          />
        </div>
      </div>
    </div>
  );
}
