"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Typography } from "../../_components/typography";
import { ProviderButton } from "./provider";
import { InfoPopover } from "./info-popover";
import { cn } from "~/lib/utils";
import { AGENT, AGENT_PROVIDERS, type AgentProvider } from "~/config/business";
import { AddAPIKeySchemaFactory } from "~/lib/validators/settings";
import { api } from "~/trpc/react";

const TOAST_POS = { position: "top-center" } as const;

export interface AgentState {
  id: string | null;
  provider: AgentProvider;
  model: string;
  enabled: boolean;
  key: string;
  models: string[];
}

interface Props {
  agents: AgentState[];
  setAgents: React.Dispatch<React.SetStateAction<AgentState[]>>;
  prevEnabledAgent: AgentProvider | null;
  setPrevEnabledAgent: React.Dispatch<
    React.SetStateAction<AgentProvider | null>
  >;
  isPending: boolean;
}

export function AIModelSettings({
  agents,
  setAgents,
  prevEnabledAgent,
  setPrevEnabledAgent,
  isPending,
}: Props) {
  const t = useTranslations();
  const [apiKeyInputs, setApiKeyInputs] = useState<Map<AgentProvider, string>>(
    new Map(),
  );

  const handleAgentStatus = (
    provider: AgentProvider,
    enable: boolean,
    model: string,
  ) => {
    if (enable) {
      if (!model) {
        toast.error(t("settings.aiModel.modelRequired"), TOAST_POS);
        return;
      }
      setAgents((prev) =>
        prev.map((a) => {
          if (a.provider === provider) return { ...a, enabled: true };
          if (a.provider === prevEnabledAgent) return { ...a, enabled: false };
          return a;
        }),
      );
      setPrevEnabledAgent(provider);
    } else {
      setAgents((prev) =>
        prev.map((a) =>
          a.provider === provider ? { ...a, enabled: false } : a,
        ),
      );
    }
  };

  const showModels = (
    agent: AgentState | undefined,
    provider: AgentProvider,
  ) => {
    if (!agent || provider !== "Groq") {
      if (isPending) return <Spinner className="size-4" />;
      return (
        <Typography variant="body-sm" className="text-muted-foreground">
          {t("settings.aiModel.waitingForApiKey")}
        </Typography>
      );
    }

    const models = agent.models.filter((m) =>
      (AGENT[provider].supported_models as readonly string[]).includes(m),
    );
    if (!models.length)
      return (
        <Typography variant="body-sm" className="text-muted-foreground">
          {t("settings.aiModel.noModelsAvailable")}
        </Typography>
      );

    const ordered = agent.model
      ? [agent.model, ...models.filter((m) => m !== agent.model)]
      : models;

    return (
      <div className="flex flex-col gap-1">
        {ordered.map((model) => (
          <Typography
            key={model}
            as="button"
            variant="body-sm"
            onClick={() => {
              setAgents((prev) =>
                prev.map((a) =>
                  a.provider === provider
                    ? { ...a, model: a.model === model ? "" : model }
                    : a,
                ),
              );
            }}
            className={cn(
              "rounded px-2 py-1 text-left transition-colors",
              agent.model === model
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {model.replace(/-\d{8}$/, "")}
          </Typography>
        ))}
      </div>
    );
  };

  const validateAPIKeyMutation = api.settings.validateAPIKey.useMutation({
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
          key: parsed.data.key,
          models: result.models,
        },
      ]);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <section className="border-border bg-card rounded-xl border p-5">
      <div className="mb-4 flex items-center gap-3">
        <Typography as="h2" variant="heading-2">
          {t("settings.aiModel.title")}
        </Typography>
        <InfoPopover t={t} />
      </div>
      <div className="-ml-1 flex gap-1">
        {AGENT_PROVIDERS.map((provider) => {
          const agent = agents.find((a) => a.provider === provider);
          return (
            <Popover key={provider}>
              <PopoverTrigger asChild>
                <ProviderButton
                  provider={provider}
                  enabled={
                    agent?.provider === provider && (agent?.enabled ?? false)
                  }
                  handleClick={() => {}}
                />
              </PopoverTrigger>
              <PopoverContent align="start" className="max-h-110 w-64">
                <div className="mb-3 flex items-center justify-between">
                  <Typography variant="body-sm" weight="semibold">
                    {provider}
                  </Typography>
                  {agent && (
                    <Button
                      size="sm"
                      variant={agent.enabled ? "outline" : "default"}
                      onClick={() =>
                        handleAgentStatus(provider, !agent.enabled, agent.model)
                      }
                    >
                      {agent.enabled
                        ? t("settings.aiModel.disable")
                        : t("settings.aiModel.enable")}
                    </Button>
                  )}
                </div>
                {provider !== "Groq" && (
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
                          ? agent.key.slice(0, 6) + "*".repeat(32)
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
                      variant={agent ? "destructive" : "default"}
                      className="shrink-0"
                      disabled={validateAPIKeyMutation.isPending}
                    >
                      {/* TODO: Swap with spinner during handleAPI resolution*/}
                      {/* TODO: Confirmation w/warning for removal*/}
                      {/* FIX: after removal, "waiting for api key", not spinner like now */}
                      {agent
                        ? t("settings.aiModel.remove")
                        : t("settings.aiModel.add")}
                    </Button>
                  </form>
                )}
                <Typography
                  variant="body-sm"
                  weight="semibold"
                  className="mt-2 block"
                >
                  {t("settings.aiModel.models")}
                </Typography>
                <div className="overflow-y-auto">
                  {showModels(agent, provider)}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </section>
  );
}
