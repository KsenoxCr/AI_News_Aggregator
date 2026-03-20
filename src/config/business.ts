export const AUTH = {
    magicLinkExpiresIn: 60 * 5,       // 5min
    sessionExpiresIn: 60 * 60 * 24 * 7, // 7d
    sessionUpdateAge: 60 * 60 * 24, // 1d
    sessionCacheMaxAge: 60 * 5,         // 5min
} as const

export const ROLES = {
    user: "user",
    admin: "admin",
} as const

export const MAX = {
    sources: 10,
    categories: 10,
    agents: 5
} as const
