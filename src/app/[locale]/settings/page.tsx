"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "~/lib/i18n/routing";
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
import { authClient } from "~/server/better-auth/client";
import { Unauthorized } from "../_components/unauthorized";
import { Spinner } from "~/components/ui/spinner";

const TOAST_POS = { position: "top-center" } as const;

export default function SettingsPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const t = useTranslations();
  const router = useRouter();
  const utils = api.useUtils();
  const { data: dbSettings } = api.settings.load.useQuery(undefined, {
    enabled: !sessionPending && !!session,
  });

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
        key: a.key ?? "",
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
      if (selectedLocale !== dbSettings?.preferences.locale) {
        setTimeout(() => {
          router.replace("/settings", { locale: selectedLocale });
        }, 1000);
      }
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

    console.log({
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

    console.log("test2");

    saveMutation.mutate(parsed.data);
  };

  const categories = dbSettings?.preferences.categories ?? [];

  if (sessionPending)
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    );
  if (!session) return <Unauthorized />;

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
