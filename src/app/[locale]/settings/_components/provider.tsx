"use client";

import { Button } from "~/components/ui/button";
import type { AgentProvider } from "~/config/business";
import { PROVIDER_SVG_MAP } from "../../_components/provider-svgs";

const DISABLED_COLOR = "#9ca3af";
const ENABLED_COLORS: Record<AgentProvider, string> = {
  OpenAI: "#ffffff",
  Anthropic: "#d97757",
  Groq: "#f55036",
};

interface ProviderButtonProps extends React.ComponentProps<typeof Button> {
  provider: AgentProvider;
  enabled: boolean;
  handleClick: () => void;
}

export function ProviderButton({
  provider,
  enabled,
  handleClick,
  ...props
}: ProviderButtonProps) {
  const ProviderSvg = PROVIDER_SVG_MAP[provider];
  const fill = enabled ? ENABLED_COLORS[provider] : DISABLED_COLOR;
  return (
    <Button
      variant="ghost"
      size="default"
      onClick={handleClick}
      className="p-1"
      {...props}
    >
      <ProviderSvg fill={fill} className="size-auto h-8 w-8 rounded-sm" />
    </Button>
  );
}
