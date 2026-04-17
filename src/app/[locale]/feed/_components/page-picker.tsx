"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination";

export function PagePicker({
  pageCount,
  page,
  setPage,
}: {
  pageCount: number;
  page: number;
  setPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;

  const goToPage = (e: React.MouseEvent, p: number) => {
    e.preventDefault();
    setPage(p);
  };

  const pages = buildPages(page, pageCount);

  return (
    <footer className="bg-background border-border fixed bottom-0 left-0 z-40 flex h-16 w-full items-center justify-center border-t">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text=""
              onClick={(e) => goToPage(e, Math.max(1, page - 1))}
              aria-disabled={page === 1}
              className={page === 1 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>

          {pages.map((entry, i) =>
            entry === "ellipsis" ? (
              <PaginationItem key={`e-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={entry}>
                <PaginationLink
                  href="#"
                  isActive={entry === page}
                  onClick={(e) => goToPage(e, entry)}
                >
                  {entry}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              href="#"
              text=""
              onClick={(e) => goToPage(e, Math.min(pageCount, page + 1))}
              aria-disabled={page === pageCount}
              className={
                page === pageCount ? "pointer-events-none opacity-50" : ""
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </footer>
  );
}

function buildPages(page: number, pageCount: number): (number | "ellipsis")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);

  const result: (number | "ellipsis")[] = [1];

  if (page > 3) result.push("ellipsis");

  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  for (let i = start; i <= end; i++) result.push(i);

  if (page < pageCount - 2) result.push("ellipsis");

  result.push(pageCount);
  return result;
}
