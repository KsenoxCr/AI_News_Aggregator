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
  agents: 5,
  preferences_chars: 2000,
} as const;

export const AGENT = {
  SUPPORTED_ENDPOINTS: {
    OpenAI: "v1/chat/completions",
    OpenRouter: "api/v1/chat/completions",
    Anthropic: "v1/messages",
  },
  RATE_LIMITS: {
    freeTier: {},
  },
} as const;

export type AgentEndpoint =
  (typeof AGENT.SUPPORTED_ENDPOINTS)[keyof typeof AGENT.SUPPORTED_ENDPOINTS];
