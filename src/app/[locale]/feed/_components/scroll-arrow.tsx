"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

export function ScrollArrow({ scrollTop }: { scrollTop: boolean }) {
  return (
    <button
      onClick={() =>
        scrollTop
          ? window.scrollTo({ top: 0, behavior: "smooth" })
          : window.scrollTo({
              top: document.body.scrollHeight,
              behavior: "smooth",
            })
      }
      className="bg-background border-border text-muted-foreground hover:text-foreground fixed right-6 bottom-20 z-50 rounded-full border p-2.5 shadow-md transition-colors"
    >
      {scrollTop ? (
        <ArrowUp className="size-6" />
      ) : (
        <ArrowDown className="size-6" />
      )}
    </button>
  );
}
