"use client";

import { cn } from "~/lib/utils";

export function CategoryChip({
  label,
  active,
  ghost,
  onClick,
}: {
  label?: string;
  active?: boolean;
  ghost?: boolean;
  onClick?: () => void;
}) {
  if (ghost) {
    return (
      <span className="bg-muted/50 animate-pulse inline-block w-16 shrink-0 rounded-full px-3 py-1 text-xs font-medium opacity-50 select-none">&nbsp;</span>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
    >
      {label}
    </button>
  );
}
