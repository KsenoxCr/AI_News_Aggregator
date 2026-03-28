export const BRAND = {
  appName: "AI News",
  developer: "Ksenox",
  publishYear: "2026",
};

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

export const MAX = {
  sources: 10,
  categories: 10,
  agents: 5,
  preferences_chars: 2000,
} as const;

export type DateFormat = (typeof DATE_FORMAT)[keyof typeof DATE_FORMAT];
