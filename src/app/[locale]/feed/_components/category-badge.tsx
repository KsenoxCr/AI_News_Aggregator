"use client";

import { useTranslations } from "next-intl";

export function CategoryBadge({ category }: { category: string }) {
  const t = useTranslations("categories");
  return (
    <span className="bg-secondary shadow-accent inline-block rounded-full px-3 py-0.5 text-xs font-semibold">
      {t(category)}
    </span>
  );
}
