import { KeysRecord } from "~/lib/utils";

export const BRAND = {
  appName: "AI News",
  developer: "Ksenox",
  publishmentYear: "2026",
} as const;

export const AUTH = {
  magicLinkExpiresIn: 60 * 5, // 5min
  sessionExpiresIn: 60 * 60 * 24 * 7, // 7d
  sessionUpdateAge: 60 * 60 * 24, // 1d
  sessionCacheMaxAge: 60 * 5, // 5min
} as const;

export const ROLE = {
  user: "user",
  admin: "admin",
} as const;

export const FEED_FORMAT = {
  RSS: "RSS",
  ATOM: "ATOM",
} as const;

export const DATE_FORMAT = {
  ISO_8601: "ISO_8601",
  ISO_DATE: "ISO_DATE",
  UNIX: "UNIX",
  RFC_1123: "RFC_1123",
  RFC_822: "RFC_822",
} as const;

export type DateFormat = (typeof DATE_FORMAT)[keyof typeof DATE_FORMAT];

export const MAX = {
  sources: 10,
  categories: 10,
  preferences_chars: 2000,
} as const;

const _AGENT_ENDPOINTS = {
  OpenAI: "https://api.openai.com/v1/chat/completions",
  // OpenRouter: "https://openrouter.ai/api/v1/chat/completions",
  Anthropic: "https://api.anthropic.com/v1/messages",
} as const;

export const AGENT = {
  ENDPOINTS: _AGENT_ENDPOINTS,
  PROVIDERS: KeysRecord(_AGENT_ENDPOINTS),
  RATE_LIMITS: {
    freeTier: {},
  },
} as const;

export type AgentProvider =
  (typeof AGENT.PROVIDERS)[keyof typeof AGENT.PROVIDERS];
export type AgentEndpoint =
  (typeof AGENT.ENDPOINTS)[keyof typeof AGENT.ENDPOINTS];
