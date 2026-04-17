"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleHelp, ExternalLink } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export function InfoPopover({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [open, setOpen] = useState(false);
  const isFinePointer = () => window.matchMedia("(pointer: fine)").matches;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors"
          onMouseEnter={() => {
            if (isFinePointer()) setOpen(true);
          }}
          onMouseLeave={() => {
            if (isFinePointer()) setOpen(false);
          }}
          onClick={() => {
            if (!isFinePointer()) setOpen((o) => !o);
          }}
        >
          <CircleHelp className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 space-y-3 text-sm"
        align="end"
        onMouseEnter={() => {
          if (isFinePointer()) setOpen(true);
        }}
        onMouseLeave={() => {
          if (isFinePointer()) setOpen(false);
        }}
      >
        <p className="text-foreground font-medium">
          {t("settings.aiModel.infoTitle")}
        </p>
        <p className="text-muted-foreground">{t("settings.aiModel.infoBody")}</p>
        <div className="space-y-2">
          {[
            { name: "OpenAI", href: "https://platform.openai.com/api-keys" },
            {
              name: "Anthropic",
              href: "https://console.anthropic.com/account/keys",
            },
          ].map(({ name, href }) => (
            <div key={name}>
              <p className="text-foreground text-xs font-semibold">{name}</p>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs transition-colors"
              >
                {t("settings.aiModel.infoGetApiKey")}
                <ExternalLink className="size-3" />
              </a>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
