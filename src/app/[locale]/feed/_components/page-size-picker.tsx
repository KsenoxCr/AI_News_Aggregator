"use client";

import { type Dispatch, type SetStateAction, useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { Dropdown } from "./dropdown";

export function PageSizePicker({
  pageSize,
  setPageSize,
}: {
  pageSize: number;
  setPageSize: Dispatch<SetStateAction<number>>;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  return (
    <div className="relative shrink-0">
      <Button
        variant="outline"
        size="sm"
        className={cn("gap-2", showDropdown && "rounded-b-none")}
        onClick={() => setShowDropdown((v) => !v)}
      >
        {pageSize}
        <BookOpen className="size-4" />
      </Button>
      {showDropdown && (
        <Dropdown
          pageSize={pageSize}
          setPageSize={setPageSize}
          close={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}
