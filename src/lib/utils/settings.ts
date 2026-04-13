import type { RouterOutputs } from "~/trpc/react";

type DbCategory = RouterOutputs["settings"]["fetch"]["preferences"]["categories"][number];
type DbSource = RouterOutputs["settings"]["fetch"]["sources"][number];
type DbAgent = RouterOutputs["settings"]["fetch"]["agents"][number];

type AgentState = {
  id: string | null;
  provider: string;
  model: string;
  enabled: boolean;
  key: string;
};

export function categoriesDelta(
  categories: DbCategory[],
  settingsCategories: Map<string, boolean>,
) {
  return {
    add: categories
      .filter((c) => settingsCategories.get(c.category) && !c.enabled)
      .map((c) => c.category),
    remove: categories
      .filter((c) => !settingsCategories.get(c.category) && c.enabled)
      .map((c) => c.category),
  };
}

export function sourcesDelta(
  dbSources: DbSource[],
  settingsSources: Set<string>,
) {
  return dbSources
    .filter((s) => settingsSources.has(s.id) !== !!s.enabled)
    .map((s) => ({ source_id: s.id, enabled: settingsSources.has(s.id) }));
}

export function agentsDelta(
  agents: AgentState[],
  dbAgents: DbAgent[],
) {
  return {
    add: agents
      .filter((a) => !a.id)
      .map((a) => ({ provider: a.provider, model: a.model, key: a.key })),
    remove: dbAgents
      .filter((da) => !agents.some((a) => a.id === da.id))
      .map((da) => da.id),
    enable: agents
      .filter(
        (a) =>
          a.id &&
          a.enabled &&
          !dbAgents.find((da) => da.id === a.id)?.enabled,
      )
      .map((a) => a.id!),
    disable: agents
      .filter(
        (a) =>
          a.id &&
          !a.enabled &&
          dbAgents.find((da) => da.id === a.id)?.enabled,
      )
      .map((a) => a.id!),
  };
}
