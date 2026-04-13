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
import { routing, SUPPORTED_LOCALES, type Locale } from "~/lib/i18n/routing";
import { AddSourceSchemaFactory } from "~/lib/validators/source";
import {
  AddAPIKeySchemaFactory,
  SaveSettingsSchemaFactory,
} from "~/lib/validators/settings";
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

// TODO: Extract sections into discrete child components

export default function SettingsPage() {
  const t = useTranslations();
  const utils = api.useUtils();
  const { data: dbSettings } = api.settings.fetch.useQuery();

  const [selectedLocale, setSelectedLocale] = useState<Locale>(
    routing.defaultLocale,
  );
  const [settingsSources, setSettingsSources] = useState<Set<string>>(
    new Set(),
  );
  const [settingsCategories, setSettingsCategories] = useState<
    Map<string, boolean>
  >(new Map());

  const [newSlug, setNewSlug] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [agents, setAgents] = useState<
    {
      id: string | null;
      provider: AgentProvider;
      model: string;
      enabled: boolean;
      key: string;
      models: string[];
    }[]
  >([]);
  const [apiKeyInputs, setApiKeyInputs] = useState<Map<AgentProvider, string>>(
    new Map(),
  );
  const [prevEnabledAgent, setPrevEnabledAgent] =
    useState<AgentProvider | null>(null);
  const [freeform, setFreeform] = useState("");

  useEffect(() => {
    if (!dbSettings) return;
    setSettingsSources(
      new Set(dbSettings.sources.filter((s) => s.enabled).map((s) => s.id)),
    );
    setSelectedLocale(dbSettings.preferences.locale as Locale);
    setSettingsCategories(
      new Map(
        dbSettings.preferences.categories.map((c) => [c.category, c.enabled]),
      ),
    );
    setFreeform(dbSettings.preferences.freeform);
    setAgents(
      dbSettings.agents.map((a) => ({
        id: a.id,
        provider: a.provider as AgentProvider,
        model: a.model,
        enabled: !!a.enabled,
        key: a.key ? a.key.slice(0, 5) : "",
        models: a.models,
      })),
    );
    const enabledAgent = dbSettings.agents.find((a) => a.enabled);
    setPrevEnabledAgent(
      enabledAgent ? (enabledAgent.provider as AgentProvider) : null,
    );
  }, [dbSettings]);

  const addSourceMutation = api.settings.addSource.useMutation({
    onSuccess: (result) => {
      if (result.status === "failure") {
        toast.error(result.error, TOAST_POS);
        return;
      }
      setSettingsSources((prev) => new Set(prev).add(result.source!.id));
      void utils.settings.fetch.invalidate();
      setNewSlug("");
      setNewUrl("");
      toast.success(t("success.source.added"), TOAST_POS);
    },
    onError: (err) => toast.error(err.message, TOAST_POS),
  });

  const validateAPIKeyMutation = api.settings.validateAPIKey.useMutation({
    onError: (err) => toast.error(err.message, TOAST_POS),
  });

  const saveMutation = api.settings.save.useMutation({
    onSuccess: async () => {
      await utils.settings.fetch.invalidate();
      toast.success(t("success.settings.saved"), TOAST_POS);
    },
    onError: (err) => toast.error(err.message, TOAST_POS),
  });

  const handleAPI = async (provider: AgentProvider): Promise<boolean> => {
    const schema = AddAPIKeySchemaFactory(t);
    const parsed = schema.safeParse({ key: apiKeyInputs.get(provider) ?? "" });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message, TOAST_POS);
      return false;
    }
    try {
      const result = await validateAPIKeyMutation.mutateAsync({
        provider,
        key: parsed.data.key,
      });
      if (result.status === "failure") {
        toast.error(result.error, TOAST_POS);
        return false;
      }
      setAgents((prev) => [
        ...prev,
        {
          id: null,
          provider,
          model: "",
          enabled: false,
          key: parsed.data.key.slice(0, 5),
          models: result.models,
        },
      ]);
      return true;
    } catch {
      return false;
    }
  };

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

  const toggleSource = (id: string) =>
    setSettingsSources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleCategory = (cat: string) =>
    setSettingsCategories((prev) => new Map(prev).set(cat, !prev.get(cat)));

  const handleSave = () => {
    const categoriesDelta = {
      add: categories
        .filter((c) => settingsCategories.get(c.category) && !c.enabled)
        .map((c) => c.category),
      remove: categories
        .filter((c) => !settingsCategories.get(c.category) && c.enabled)
        .map((c) => c.category),
    };
    const sourcesDelta = (dbSettings?.sources ?? [])
      .filter((s) => settingsSources.has(s.id) !== !!s.enabled)
      .map((s) => ({ source_id: s.id, enabled: settingsSources.has(s.id) }));
    const agentsDelta = {
      add: agents
        .filter((a) => !a.id)
        .map((a) => ({ provider: a.provider, model: a.model, key: a.key })),
      remove: (dbSettings?.agents ?? [])
        .filter((da) => !agents.some((a) => a.id === da.id))
        .map((da) => da.id),
      enable: agents
        .filter(
          (a) =>
            a.id &&
            a.enabled &&
            !dbSettings?.agents.find((da) => da.id === a.id)?.enabled,
        )
        .map((a) => a.id!),
      disable: agents
        .filter(
          (a) =>
            a.id &&
            !a.enabled &&
            dbSettings?.agents.find((da) => da.id === a.id)?.enabled,
        )
        .map((a) => a.id!),
    };
    const schema = SaveSettingsSchemaFactory(t);
    const parsed = schema.safeParse({
      sources: sourcesDelta,
      agents: agentsDelta,
      preferences: {
        categories: categoriesDelta,
        preferences: freeform,
        locale: selectedLocale,
      },
    });

    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message, TOAST_POS);
      return;
    }
    saveMutation.mutate(parsed.data);
  };

  const categories = dbSettings?.preferences.categories ?? [];
  const primaryCategories = categories.slice(0, 4);
  const moreCategories = categories.slice(4);
  const sourceCount = dbSettings?.sources.length ?? 0;
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
        {/* TODO: remove button*/}

        {/* News Sources */}
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
                <div
                  key={source.id}
                  className="flex items-center justify-between"
                >
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

        {/* AI Model */}
        <section className="border-border bg-card rounded-xl border p-5">
          <Typography as="h2" variant="heading-2" className="mb-4">
            {t("settings.aiModel.title")}
          </Typography>
          <div className="-ml-1 flex gap-1">
            {AGENT_PROVIDERS.map((provider) => {
              const agent = agents.find((a) => a.provider === provider);
              return (
                <Popover key={provider}>
                  <PopoverTrigger asChild>
                    <ProviderButton
                      provider={provider}
                      enabled={
                        agent?.provider === provider &&
                        (agent?.enabled ?? false)
                      }
                      handleClick={() => {}}
                    />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="max-h-110 w-64">
                    <Typography
                      variant="body-sm"
                      weight="semibold"
                      className="mb-3 block"
                    >
                      {provider}
                    </Typography>
                    <form
                      className="flex gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (agent) {
                          setAgents((prev) =>
                            prev.filter((a) => a.provider !== provider),
                          );
                        } else {
                          await handleAPI(provider);
                        }
                      }}
                    >
                      <Input
                        placeholder={t("settings.aiModel.apiKeyPlaceholder")}
                        className="flex-1 text-xs"
                        disabled={!!agent}
                        value={
                          agent
                            ? agent.key + "*".repeat(32)
                            : (apiKeyInputs.get(provider) ?? "")
                        }
                        onChange={(e) =>
                          setApiKeyInputs((prev) =>
                            new Map(prev).set(provider, e.target.value),
                          )
                        }
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="shrink-0"
                        disabled={validateAPIKeyMutation.isPending}
                      >
                        {/* TODO: Swap with spinner during handleAPI resolution*/}
                        {/* TODO: Confirmation w/warning for removal*/}
                        {agent
                          ? t("settings.aiModel.remove")
                          : t("settings.aiModel.add")}
                      </Button>
                    </form>
                    <Typography
                      variant="body-sm"
                      weight="semibold"
                      className="mt-2 block"
                    >
                      {t("settings.aiModel.models")}
                    </Typography>
                    <div className="overflow-y-auto">
                      {!agent?.models.length ? (
                        <Typography
                          variant="body-sm"
                          className="text-muted-foreground"
                        >
                          {t("settings.aiModel.waitingForKey")}
                        </Typography>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {[
                            agent.model,
                            ...agent.models.filter((m) => m !== agent.model),
                          ].map((model) => (
                            <Typography
                              key={model}
                              as="button"
                              variant="body-sm"
                              onClick={() => {
                                setAgents((prev) =>
                                  prev.map((a) => {
                                    if (a.provider === provider)
                                      return { ...a, model, enabled: true };
                                    if (a.provider === prevEnabledAgent)
                                      return { ...a, enabled: false };
                                    return a;
                                  }),
                                );
                                setPrevEnabledAgent(provider);
                              }}
                              className={cn(
                                "rounded px-2 py-1 text-left transition-colors",
                                agent?.model === model
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
              );
            })}
          </div>
        </section>

        {/* Preferences */}
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

        {/* Save */}
        <Button
          className="h-12 w-full rounded-xl text-base"
          onClick={handleSave}
        >
          {t("settings.save")}
        </Button>
      </main>
    </div>
  );
}
