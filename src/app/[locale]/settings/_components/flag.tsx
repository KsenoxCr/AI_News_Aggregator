"use client";

import { Button } from "~/components/ui/button";
import type { Locale } from "~/lib/i18n/routing";

interface FlagProps extends React.SVGProps<SVGSVGElement> {
  enabled: boolean;
}

function FlagEN({ enabled, ...props }: FlagProps) {
  const blue = enabled ? "#012169" : "#9ca3af";
  const red = enabled ? "#C8102E" : "#d1d5db";
  return (
    <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="60" height="40" fill={blue} />
      <line x1="0" y1="0" x2="60" y2="40" stroke="white" strokeWidth="8" />
      <line x1="60" y1="0" x2="0" y2="40" stroke="white" strokeWidth="8" />
      <line x1="0" y1="0" x2="30" y2="20" stroke={red} strokeWidth="4" />
      <line x1="60" y1="0" x2="30" y2="20" stroke={red} strokeWidth="4" />
      <line x1="0" y1="40" x2="30" y2="20" stroke={red} strokeWidth="4" />
      <line x1="60" y1="40" x2="30" y2="20" stroke={red} strokeWidth="4" />
      <rect x="24" y="0" width="12" height="40" fill="white" />
      <rect x="0" y="14" width="60" height="12" fill="white" />
      <rect x="26" y="0" width="8" height="40" fill={red} />
      <rect x="0" y="16" width="60" height="8" fill={red} />
    </svg>
  );
}

function FlagFI({ enabled, ...props }: FlagProps) {
  const cross = enabled ? "#003580" : "#9ca3af";
  const bg = enabled ? "white" : "#e5e7eb";
  return (
    <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="60" height="40" fill={bg} />
      <rect x="0" y="15" width="60" height="10" fill={cross} />
      <rect x="15" y="0" width="10" height="40" fill={cross} />
    </svg>
  );
}

const FLAG_MAP: Record<Locale, React.FC<FlagProps>> = {
  en: FlagEN,
  fi: FlagFI,
};

interface FlagButtonProps extends React.ComponentProps<typeof Button> {
  locale: Locale;
  enabled: boolean;
  handleClick: () => void;
}

export function FlagButton({
  locale,
  enabled,
  handleClick,
  ...props
}: FlagButtonProps) {
  const FlagSvg = FLAG_MAP[locale];
  return (
    <Button
      variant="ghost"
      size="default"
      onClick={handleClick}
      className="p-1"
      {...props}
    >
      <FlagSvg
        enabled={enabled}
        className="size-auto h-8 w-12 rounded-sm shadow-sm"
      />
    </Button>
  );
}
