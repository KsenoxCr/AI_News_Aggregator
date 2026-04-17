"use client";

import { type Dispatch, type SetStateAction } from "react";
import { type Digest } from "~/lib/types/feed";
import { DigestCard } from "./digest-card";

export function FeedView({
  digestPages,
  page,
  activeCategories,
  setSelectedDigest,
}: {
  digestPages: Digest[][];
  page: number;
  activeCategories: Set<string>;
  setSelectedDigest: Dispatch<SetStateAction<Digest | null>>;
}) {
  return (
    <main className="mx-auto max-w-3xl space-y-3 px-4 pt-5 pb-22 md:px-6">
      {(digestPages[page - 1] ?? [])
        .filter((d) => d.categories.some((c) => activeCategories.has(c)))
        .map((d, i) => (
          <DigestCard
            key={i}
            digest={d}
            setSelectedDigest={setSelectedDigest}
          />
        ))}
    </main>
  );
}
