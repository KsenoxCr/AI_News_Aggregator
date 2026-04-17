"use client";

import { slugToLabel } from "~/lib/utils/ui";

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="bg-secondary shadow-accent inline-block rounded-full px-3 py-0.5 text-xs font-semibold">
      {slugToLabel(category)}
    </span>
  );
}
