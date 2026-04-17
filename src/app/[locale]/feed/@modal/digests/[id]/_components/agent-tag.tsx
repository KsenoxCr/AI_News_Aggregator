import { PROVIDER_SVG_MAP } from "~/app/[locale]/_components/provider-svgs";
import type { AgentProvider } from "~/config/business";

const PROVIDER_FILL: Record<AgentProvider, string> = {
  OpenAI: "#ffffff",
  Anthropic: "#d97757",
};

export function AgentTag({
  provider,
  model,
}: {
  provider: AgentProvider;
  model: string;
}) {
  let ProviderSvg: React.FC<React.SVGProps<SVGSVGElement>>;

  switch (provider) {
    case "OpenAI":
      ProviderSvg = PROVIDER_SVG_MAP.OpenAI;
      break;
    case "Anthropic":
      ProviderSvg = PROVIDER_SVG_MAP.Anthropic;
      break;
    default:
      provider satisfies never;
      return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      <ProviderSvg fill={PROVIDER_FILL[provider]} className="size-4 shrink-0" />
      <span className="text-muted-foreground text-xs">{model}</span>
    </div>
  );
}
