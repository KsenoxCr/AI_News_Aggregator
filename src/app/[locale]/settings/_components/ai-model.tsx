"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Typography } from "../../_components/typography";
import { ProviderButton } from "./provider";
import { cn } from "~/lib/utils";
import { AGENT_PROVIDERS, type AgentProvider } from "~/config/business";
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
  setPrevEnabledAgent: React.Dispatch<React.SetStateAction<AgentProvider | null>>;
}

export function AIModelSettings({
  agents,
  setAgents,
  prevEnabledAgent,
  setPrevEnabledAgent,
}: Props) {
  const t = useTranslations();
  const [apiKeyInputs, setApiKeyInputs] = useState<Map<AgentProvider, string>>(
    new Map(),
  );

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
          key: parsed.data.key.slice(0, 5),
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
                    agent?.provider === provider && (agent?.enabled ?? false)
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
  );
}
