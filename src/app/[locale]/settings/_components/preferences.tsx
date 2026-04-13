"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Spinner } from "~/components/ui/spinner";
import { Typography } from "../../_components/typography";
import { cn } from "~/lib/utils";
import { MAX } from "~/config/business";
import type { RouterOutputs } from "~/trpc/react";

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
    >
      {label}
    </button>
  );
}

interface Props {
  dbSettings: RouterOutputs["settings"]["fetch"] | undefined;
  settingsCategories: Map<string, boolean>;
  setSettingsCategories: React.Dispatch<
    React.SetStateAction<Map<string, boolean>>
  >;
  freeform: string;
  setFreeform: (v: string) => void;
}

export function PreferencesSettings({
  dbSettings,
  settingsCategories,
  setSettingsCategories,
  freeform,
  setFreeform,
}: Props) {
  const t = useTranslations();

  const categories = dbSettings?.preferences.categories ?? [];
  const primaryCategories = categories.slice(0, 4);
  const moreCategories = categories.slice(4);

  const toggleCategory = (cat: string) =>
    setSettingsCategories((prev) => new Map(prev).set(cat, !prev.get(cat)));

  return (
    <section className="border-border bg-card rounded-xl border p-5">
      <Typography as="h2" variant="heading-2" className="mb-4">
        {t("settings.preferences.title")}
      </Typography>

      {dbSettings?.preferences ? (
        <>
          {/* Categories */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {primaryCategories.map((c) => (
                <CategoryChip
                  key={c.category}
                  label={c.category}
                  active={settingsCategories.get(c.category) ?? false}
                  onClick={() => toggleCategory(c.category)}
                />
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="bg-primary text-primary-foreground hover:bg-primary/80 flex size-6 items-center justify-center rounded-full transition-colors">
                    <Plus className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56">
                  <Typography
                    variant="body-sm"
                    weight="semibold"
                    className="mb-3 block"
                  >
                    {t("settings.preferences.moreCategories")}
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {moreCategories.map((c) => (
                      <CategoryChip
                        key={c.category}
                        label={c.category}
                        active={settingsCategories.get(c.category) ?? false}
                        onClick={() => toggleCategory(c.category)}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Typography variant="body-sm" className="text-muted-foreground">
              ({[...settingsCategories.values()].filter(Boolean).length}/
              {categories.length})
            </Typography>
          </div>

          {/* Freeform preferences */}
          <div className="relative">
            <textarea
              value={freeform}
              onChange={(e) => setFreeform(e.target.value)}
              placeholder={t("settings.preferences.freeformPlaceholder")}
              className="border-input bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-24 w-full resize-none rounded-xl border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-[3px]"
            />
            <Typography
              variant="body-sm"
              className="text-muted-foreground absolute right-2.5 bottom-4 text-xs"
            >
              {freeform.length}/{MAX.preferences_chars}
            </Typography>
          </div>
        </>
      ) : (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      )}
    </section>
  );
}
