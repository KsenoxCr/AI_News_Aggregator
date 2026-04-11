"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { Typography } from "../_components/typography";
import {
  AGENT_PROVIDERS,
  BRAND,
  MAX,
  type AgentProvider,
} from "~/config/business";
import { SUPPORTED_LOCALES, type Locale } from "~/lib/i18n/routing";
import { AddSourceSchemaFactory } from "~/lib/validators/source";
import { AddAPIKeySchemaFactory } from "~/lib/validators/settings";
import { FlagButton } from "./_components/flag";
import { ProviderButton } from "./_components/provider";
import { api } from "~/trpc/react";

const TOAST_POS = { position: "top-center" } as const;

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

// TODO: Segregate PopOver per provider
// TODO: handleSave

export default function SettingsPage() {
  const t = useTranslations();
  const utils = api.useUtils();
  const { data } = api.settings.fetch.useQuery();

  const [selectedLocale, setSelectedLocale] = useState<Locale | null>(null);
  const [enabledSources, setEnabledSources] = useState<Set<string>>(new Set());
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [newSlug, setNewSlug] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [activeModel, setActiveModel] = useState<{
    provider: AgentProvider;
    model: string;
  } | null>(null);

  useEffect(() => {
    if (!data) return;
    setEnabledSources(
      new Set(data.sources.filter((s) => s.enabled).map((s) => s.id)),
    );
    setSelectedLocale(data.preferences.locale as Locale);
  }, [data]);

  const addSourceMutation = api.settings.addSource.useMutation({
    onSuccess: (result) => {
      if (result.status === "failure") {
        toast.error(result.error, TOAST_POS);
        return;
      }
      setEnabledSources((prev) => new Set(prev).add(result.source!.id));
      void utils.settings.fetch.invalidate();
      setNewSlug("");
      setNewUrl("");
      toast.success(t("success.source.added"), TOAST_POS);
    },
    onError: (err) => toast.error(err.message, TOAST_POS),
  });

  const validateAPIKeyMutation = api.settings.validateAPIKey.useMutation({
    onSuccess: (result) => {
      if (result.status === "failure") {
        toast.error(result.error, TOAST_POS);
        return;
      }
      setModels(result.models);
    },
    onError: (err) => toast.error(err.message, TOAST_POS),
  });

  const handleAddAPIKey = (provider: AgentProvider) => {
    const schema = AddAPIKeySchemaFactory(t);
    const parsed = schema.safeParse({ key: apiKey });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message, TOAST_POS);
      return;
    }
    validateAPIKeyMutation.mutate({ provider, key: parsed.data.key });
  };

  const handleAddSource = () => {
    const schema = AddSourceSchemaFactory(t);
    const parsed = schema.safeParse({ slug: newSlug, url: newUrl });

    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message, TOAST_POS);
      return;
    }

    if (data?.sources.some((s) => s.slug === parsed.data.slug)) {
      toast.error(t("validation.source.duplicateSlug"), TOAST_POS);
      return;
    }

    if (data?.sources.some((s) => s.url === parsed.data.url)) {
      toast.error(t("validation.source.duplicateUrl"), TOAST_POS);
      return;
    }

    addSourceMutation.mutate(parsed.data);
  };

  const toggleSource = (id: string) =>
    setEnabledSources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleCategory = (cat: string) =>
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );

  const primaryCategories = data?.preferences.categories.slice(0, 4) ?? [];
  const moreCategories = data?.preferences.categories.slice(4) ?? [];
  const sourceCount = data?.sources.length ?? 0;
  const atSourceLimit = sourceCount >= MAX.sources;

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="border-border flex items-center border-b px-6 py-4">
        {/* Mobile */}
        <div className="relative flex w-full items-center md:hidden">
          <Link
            href="/feed"
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <Typography
            as="h1"
            variant="heading-2"
            className="absolute left-1/2 -translate-x-1/2"
          >
            {t("settings.title")}
          </Typography>
        </div>
        {/* Desktop */}
        <Typography
          as="h1"
          variant="heading-2"
          className="hidden flex-1 md:block"
        >
          {BRAND.appName}
        </Typography>
        <Link
          href="/feed"
          className="text-muted-foreground hover:text-foreground hidden text-sm md:block"
        >
          {t("settings.backToNews")}
        </Link>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        {/* Language */}
        <section className="border-border bg-card rounded-xl border p-5">
          <Typography as="h2" variant="heading-2" className="mb-4">
            {t("settings.language.title")}
          </Typography>
          <div className="-ml-1 flex gap-1">
            {SUPPORTED_LOCALES.map((locale) => (
              <FlagButton
                key={locale}
                locale={locale}
                enabled={selectedLocale === locale}
                handleClick={() => setSelectedLocale(locale)}
              />
            ))}
          </div>
        </section>

        {/* News Sources */}
        <section className="border-border bg-card rounded-xl border p-5">
          <div className="mb-4 flex items-center justify-between">
            <Typography as="h2" variant="heading-2">
              {t("settings.sources.title")}
            </Typography>
            {data?.sources && (
              <Typography variant="body-sm" className="text-muted-foreground">
                ({sourceCount}/{MAX.sources})
              </Typography>
            )}
          </div>

          {/* Source list */}
          <div className="flex flex-col gap-3">
            {/* TODO: hover: show source.url */}
            {data?.sources ? (
              data.sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between"
                >
                  <Typography variant="body-sm">{source.slug}</Typography>
                  <Switch
                    checked={enabledSources.has(source.id)}
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

        {/* AI Model */}
        <section className="border-border bg-card rounded-xl border p-5">
          <Typography as="h2" variant="heading-2" className="mb-4">
            {t("settings.aiModel.title")}
          </Typography>
          <div className="-ml-1 flex gap-1">
            {AGENT_PROVIDERS.map((provider) => (
              <Popover key={provider}>
                <PopoverTrigger asChild>
                  <ProviderButton
                    provider={provider}
                    enabled={activeModel?.provider === provider}
                    handleClick={() => {}}
                  />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64">
                  <Typography
                    variant="body-sm"
                    weight="semibold"
                    className="mb-3 block"
                  >
                    {provider}
                  </Typography>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("settings.aiModel.apiKeyPlaceholder")}
                      className="flex-1 text-xs"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleAddAPIKey(provider)}
                      disabled={validateAPIKeyMutation.isPending}
                    >
                      {t("settings.aiModel.add")}
                    </Button>
                  </div>
                  <div className="mt-4">
                    <Typography
                      variant="body-sm"
                      weight="semibold"
                      className="mb-2 block"
                    >
                      {t("settings.aiModel.models")}
                    </Typography>
                    {models.length === 0 ? (
                      <Typography
                        variant="body-sm"
                        className="text-muted-foreground"
                      >
                        {t("settings.aiModel.waitingForKey")}
                      </Typography>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {models.map((model) => (
                          <Typography
                            key={model}
                            as="button"
                            variant="body-sm"
                            onClick={() => setActiveModel({ provider, model })}
                            className={cn(
                              "rounded px-2 py-1 text-left transition-colors",
                              activeModel?.provider === provider &&
                                activeModel.model === model
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {model}
                          </Typography>
                        ))}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </section>

        {/* Preferences */}
        <section className="border-border bg-card rounded-xl border p-5">
          <Typography as="h2" variant="heading-2" className="mb-4">
            {t("settings.preferences.title")}
          </Typography>

          {data?.preferences ? (
            <>
              {/* Categories */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {primaryCategories.map((c) => (
                  <CategoryChip
                    key={c.category}
                    label={c.category}
                    active={activeCategories.includes(c.category)}
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
                          active={activeCategories.includes(c.category)}
                          onClick={() => toggleCategory(c.category)}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Freeform preferences */}
              <textarea
                defaultValue={data.preferences.freeform}
                placeholder={t("settings.preferences.freeformPlaceholder")}
                className="border-input bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-24 w-full resize-none rounded-xl border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-[3px]"
              />
            </>
          ) : (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          )}
        </section>

        {/* Save */}
        <Button className="h-12 w-full rounded-xl text-base">
          {t("settings.save")}
        </Button>
      </main>
    </div>
  );
}
