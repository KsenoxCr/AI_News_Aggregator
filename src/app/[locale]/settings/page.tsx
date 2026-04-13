"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Typography } from "../_components/typography";
import { BRAND, type AgentProvider } from "~/config/business";
import { routing, type Locale } from "~/lib/i18n/routing";
import { SaveSettingsSchemaFactory } from "~/lib/validators/settings";
import {
  categoriesDelta,
  sourcesDelta,
  agentsDelta,
} from "~/lib/utils/settings";
import { LanguageSettings } from "./_components/language";
import { SourcesSettings } from "./_components/sources";
import { AIModelSettings, type AgentState } from "./_components/ai-model";
import { PreferencesSettings } from "./_components/preferences";
import { api } from "~/trpc/react";

const TOAST_POS = { position: "top-center" } as const;

export default function SettingsPage() {
  const t = useTranslations();
  const utils = api.useUtils();
  const { data: dbSettings } = api.settings.load.useQuery();

  const [selectedLocale, setSelectedLocale] = useState<Locale>(
    routing.defaultLocale,
  );
  const [settingsSources, setSettingsSources] = useState<Set<string>>(
    new Set(),
  );
  const [settingsCategories, setSettingsCategories] = useState<
    Map<string, boolean>
  >(new Map());
  const [agents, setAgents] = useState<AgentState[]>([]);
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

  const saveMutation = api.settings.save.useMutation({
    onSuccess: async () => {
      await utils.settings.load.invalidate();
      toast.success(t("success.settings.saved"), TOAST_POS);
    },
    onError: (err) => toast.error(err.message, TOAST_POS),
  });

  const handleSave = () => {
    const schema = SaveSettingsSchemaFactory(t);
    const parsed = schema.safeParse({
      sources: sourcesDelta(dbSettings?.sources ?? [], settingsSources),
      agents: agentsDelta(agents, dbSettings?.agents ?? []),
      preferences: {
        categories: categoriesDelta(categories, settingsCategories),
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
        <LanguageSettings
          selectedLocale={selectedLocale}
          setSelectedLocale={setSelectedLocale}
        />

        <SourcesSettings
          dbSettings={dbSettings}
          settingsSources={settingsSources}
          setSettingsSources={setSettingsSources}
        />

        <AIModelSettings
          agents={agents}
          setAgents={setAgents}
          prevEnabledAgent={prevEnabledAgent}
          setPrevEnabledAgent={setPrevEnabledAgent}
        />

        <PreferencesSettings
          dbSettings={dbSettings}
          settingsCategories={settingsCategories}
          setSettingsCategories={setSettingsCategories}
          freeform={freeform}
          setFreeform={setFreeform}
        />

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
