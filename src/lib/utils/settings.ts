import { parseRssFeed, parseAtomFeed } from "feedsmith";
import { type FeedFormat, FEED_FORMAT } from "~/config/business";
import type { RouterOutputs } from "~/trpc/react";

type DbCategory =
  RouterOutputs["settings"]["load"]["preferences"]["categories"][number];
type DbSource = RouterOutputs["settings"]["load"]["sources"][number];
type DbAgent = RouterOutputs["settings"]["load"]["agents"][number];

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

export function agentsDelta(agents: AgentState[], dbAgents: DbAgent[]) {
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
          a.id && a.enabled && !dbAgents.find((da) => da.id === a.id)?.enabled,
      )
      .map((a) => a.id!),
    disable: agents
      .filter(
        (a) =>
          a.id && !a.enabled && dbAgents.find((da) => da.id === a.id)?.enabled,
      )
      .map((a) => a.id!),
  };
}

export function validateFeed(
  xml: string,
  format: FeedFormat,
): { status: "success" } | { status: "failure"; error: string } {
  try {
    switch (format) {
      case FEED_FORMAT.RSS:
        parseRssFeed(xml);
        break;
      case FEED_FORMAT.ATOM:
        parseAtomFeed(xml);
        break;
      default:
        throw new Error(`Unhandled feed format: ${format satisfies never}`);
    }
    return { status: "success" };
  } catch (err: any) {
    return { status: "failure", error: "errors.feed.invalidFormat" };
  }
}
