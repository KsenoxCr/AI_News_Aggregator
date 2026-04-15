"use client";

import { Typography } from "../../_components/typography";
import { type Digest } from "~/lib/types/feed";

// TODO: articleAge: "2 hours ago", generatedAge: "1 hour ago",

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className={
        "bg-secondary shadow-accent inline-block rounded-full px-3 py-0.5 text-xs font-semibold"
      }
    >
      {category}
    </span>
  );
}

export function DigestCard({ article }: { article: Digest }) {
  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          {article.categories.map((c) => (
            <CategoryBadge key={c} category={c} />
          ))}{" "}
        </div>
        <Typography as="h3" variant="heading-3">
          {article.title}
        </Typography>
        {/* <Typography variant="body-sm" color="muted"> */}
        {/*   {article.digest} */}
        {/* </Typography> */}
        <Typography variant="body-sm" color="muted">
          Generated at {article.updated_at.toLocaleString()}
        </Typography>
      </div>
    </div>
  );
}
