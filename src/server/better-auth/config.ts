import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { MagicLinkEmail } from "~/emails/magic-link"
import { db } from "../db/db";
import { AUTH } from "~/config/business";

const resend = new Resend(process.env.RESEND_API_KEY)

export const auth = betterAuth({
    user: {
        fields: {
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "user",
                input: false
            }
        }
    },
    session: {
        expiresIn: AUTH.sessionExpiresIn,
        updateAge: AUTH.sessionUpdateAge,
        cookieCache: {
            enabled: true,
            maxAge: AUTH.sessionCacheMaxAge,
            strategy: "compact"
        },
        fields: {
            userId: "user_id",
            expiresAt: "expires_at",
            createdAt: "created_at",
            sessionType: "session_type",
            lastActiveAt: "last_active_at"
        },
        additionalFields: {
            sessionType: {
                type: "string",
                defaultValue: "user",
                input: false
            },
            lastActiveAt: {
                type: "date",
                input: false
            }
        }
    },
    verification: {
        modelName: "magic_link_tokens",
        fields: {
            identifier: "email",
            value: "token_hash",
            expiresAt: "expires_at",
            createdAt: "created_at",
            usedAt: "used_at",
            ipAddress: "ip_address",
        },
        additionalFields: {
            used: {
                type: "boolean",
                defaultValue: false,
                input: false,
            },
            usedAt: {
                type: "date",
                input: false,
            },
            ipAddress: {
                type: "string",
                input: false,
            },
        },
    },
    plugins: [
        magicLink({
            sendMagicLink: async ({ email, url }) => {
                await resend.emails.send({
                    from: process.env.COMPANY_EMAIL!,
                    to: email,
                    subject: "Sign in",
                    react: MagicLinkEmail({ url }),
                })
            },
            expiresIn: AUTH.magicLinkExpiresIn
        }),
    ],
    databaseHooks: {
        session: {
            create: {
                before: async (session) => {
                    const user = await db
                        .selectFrom("users")
                        .select("role")
                        .where("id", "=", session.userId)
                        .executeTakeFirst()

                    return {
                        data: {
                            ...session,
                            sessionType: user!.role
                        }
                    }
                },
            },
        },
    }
});

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
