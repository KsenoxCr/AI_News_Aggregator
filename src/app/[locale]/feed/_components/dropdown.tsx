"use client";

import { type Dispatch, type SetStateAction } from "react";
import { BookOpen } from "lucide-react";
import { cn } from "~/lib/utils";
import { FEED } from "~/config/business";

export function Dropdown({
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
