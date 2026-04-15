"use client";

import { type Digest } from "~/lib/types/feed";
import { DigestCard } from "./digest-card";

export function FeedView({
  digestPages,
  page,
  activeCategories,
}: {
  digestPages: Digest[][];
  page: number;
  activeCategories: Set<string>;
}) {
  return (
    <main className="mx-auto max-w-3xl space-y-3 px-4 pt-5 pb-22 md:px-6">
      {(digestPages[page - 1] ?? [])
        .filter((d) => d.categories.some((c) => activeCategories.has(c)))
        .map((d, i) => (
          <DigestCard key={i} article={d} />
        ))}
    </main>
  );
}
