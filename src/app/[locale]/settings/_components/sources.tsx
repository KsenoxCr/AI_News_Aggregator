"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { Typography } from "../../_components/typography";
import { MAX } from "~/config/business";
import { AddSourceSchemaFactory } from "~/lib/validators/source";
import { api, type RouterOutputs } from "~/trpc/react";

const TOAST_POS = { position: "top-center" } as const;

interface Props {
  dbSettings: RouterOutputs["settings"]["load"] | undefined;
  settingsSources: Set<string>;
  setSettingsSources: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function SourcesSettings({
  dbSettings,
  settingsSources,
  setSettingsSources,
}: Props) {
  const t = useTranslations();
  const utils = api.useUtils();
  const [newSlug, setNewSlug] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const sourceCount = dbSettings?.sources.length ?? 0;
  const atSourceLimit = sourceCount >= MAX.sources;

  const addSourceMutation = api.settings.addSource.useMutation({
    onSuccess: (result) => {
      if (result.status === "failure") {
        toast.error(result.error, TOAST_POS);
        return;
      }
      setSettingsSources((prev) => new Set(prev).add(result.source!.id));
      void utils.settings.load.invalidate();
      setNewSlug("");
      setNewUrl("");
      toast.success(t("success.source.added"), TOAST_POS);
    },
    onError: (err) => toast.error(err.message, TOAST_POS),
  });

  const toggleSource = (id: string) =>
    setSettingsSources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleAddSource = () => {
    const schema = AddSourceSchemaFactory(t);
    const parsed = schema.safeParse({ slug: newSlug, url: newUrl });

    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message, TOAST_POS);
      return;
    }

    if (dbSettings?.sources.some((s) => s.slug === parsed.data.slug)) {
      toast.error(t("validation.source.duplicateSlug"), TOAST_POS);
      return;
    }

    if (dbSettings?.sources.some((s) => s.url === parsed.data.url)) {
      toast.error(t("validation.source.duplicateUrl"), TOAST_POS);
      return;
    }

    addSourceMutation.mutate(parsed.data);
  };

  return (
    <section className="border-border bg-card rounded-xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <Typography as="h2" variant="heading-2">
          {t("settings.sources.title")}
        </Typography>
        {dbSettings?.sources && (
          <Typography variant="body-sm" className="text-muted-foreground">
            ({sourceCount}/{MAX.sources})
          </Typography>
        )}
      </div>

      {/* Source list */}
      <div className="flex flex-col gap-3">
        {/* TODO: hover: show source.url */}
        {dbSettings?.sources ? (
          dbSettings.sources.map((source) => (
            <div key={source.id} className="flex items-center justify-between">
              <Typography variant="body-sm">{source.slug}</Typography>
              <Switch
                checked={settingsSources.has(source.id)}
                onCheckedChange={() => toggleSource(source.id)}
              />
            </div>
          ))
        ) : (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        )}
      </div>

      {/* Add Custom Source */}
      {!atSourceLimit && (
        <div className="mt-8">
          <Typography variant="body-sm" weight="semibold" className="my-2">
            {t("settings.sources.addCustom")}
          </Typography>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Input
                placeholder={t("settings.sources.namePlaceholder")}
                className="text-xs"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
              />
              <Input
                placeholder={t("settings.sources.urlPlaceholder")}
                className="text-xs"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              className="shrink-0"
              onClick={handleAddSource}
              disabled={addSourceMutation.isPending}
            >
              {t("settings.sources.add")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
