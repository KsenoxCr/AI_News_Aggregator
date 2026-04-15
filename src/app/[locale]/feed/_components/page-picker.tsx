"use client";

import { useRef } from "react";
import { Typography } from "../../_components/typography";
import { scrollToCenter } from "~/lib/utils/feed";
import { cn } from "~/lib/utils";

// TODO: Unhide scrollbar and modify aesthetic with pseudo-element selectors

export function PagePicker({
  pageCount,
  page,
  setPage,
}: {
  pageCount: number;
  page: number;
  setPage: (p: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const pages = [];
  for (let i = 0; i < pageCount; i++) pages.push(i + 1);

  const btnClass = (p: number) =>
    cn(
      "px-3 py-1.5 text-white transition-colors",
      p === page ? "text-base font-bold" : "opacity-70",
    );

  return (
    <footer className="bg-background border-border fixed bottom-0 left-0 z-40 flex h-16 w-full items-center justify-center border-t">
      {pageCount > 1 && (
        <>
          {/* <button */}
          {/*   onClick={() => setPage(Math.max(1, page - 1))} */}
          {/*   className="text-muted-foreground hover:text-foreground mr-2 transition-colors md:hidden" */}
          {/*   disabled={page === 1} */}
          {/* > */}
          {/*   <ChevronLeft className="size-5" /> */}
          {/* </button> */}
          <div className="relative flex max-w-[calc(4*2.75rem)] justify-center md:max-w-[calc(8*2.75rem)]">
            <Typography
              as="button"
              variant="body-sm"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                setPage(1);
                scrollToCenter(containerRef.current, e.currentTarget);
              }}
              className={cn(
                btnClass(1),
                "absolute top-1/2 left-0 z-10 -translate-y-1/2",
              )}
            >
              1
            </Typography>
            <div
              ref={containerRef}
              className="flex w-3/5 overflow-auto [scrollbar-width:none] md:w-[80%] [&::-webkit-scrollbar]:hidden"
            >
              {pages.slice(1, pages.length - 1).map((p) => (
                <Typography
                  key={p}
                  as="button"
                  variant="body-sm"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    setPage(p);
                    scrollToCenter(containerRef.current, e.currentTarget);
                  }}
                  className={btnClass(p)}
                >
                  {p}
                </Typography>
              ))}
            </div>
            <Typography
              as="button"
              variant="body-sm"
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                setPage(pageCount);
                scrollToCenter(containerRef.current, e.currentTarget);
              }}
              className={cn(
                btnClass(pageCount),
                "absolute top-1/2 right-0 z-10 -translate-y-1/2",
              )}
            >
              {pageCount}
            </Typography>
          </div>
          {/* <button */}
          {/*   onClick={() => setPage(Math.min(pageCount, page + 1))} */}
          {/*   className="text-muted-foreground hover:text-foreground ml-2 transition-colors md:hidden" */}
          {/*   disabled={page === pageCount} */}
          {/* > */}
          {/*   <ChevronRight className="size-5" /> */}
          {/* </button> */}
        </>
      )}
    </footer>
  );
}
