import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { getIp } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { MagicLinkEmail } from "~/emails/magic-link";
import { db, dialect } from "../db/db";
import { AGENT, AUTH, BRAND, DEFAULT } from "~/config/business";
import { ChangeEmailEmail } from "~/emails/email-change";
import { NotifyChangeEmail } from "~/emails/notify-change";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  appName: BRAND.appName,
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  database: dialect,
  advanced: {
    cookiePrefix: "ai_news",
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: process.env.COMPANY_EMAIL!,
          to: email,
          subject: "Sign in",
          react: MagicLinkEmail({ url }),
        });
      },
      expiresIn: AUTH.magicLinkExpiresIn,
    }),
  ],
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await resend.emails.send({
          from: process.env.COMPANY_EMAIL!,
          to: newEmail,
          subject: "Confirm email change",
          react: ChangeEmailEmail({ url }),
        });

        await resend.emails.send({
          from: process.env.COMPANY_EMAIL!,
          to: user.email,
          subject: "Your email address was changed",
          react: NotifyChangeEmail({ url }),
        });
      },
    },
    modelName: "user",
    fields: {
      createdAt: "created_at",
      updatedAt: "updated_at",
      emailVerified: "email_verified",
    },
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
      locale: {
        type: "string",
        defaultValue: "en",
        input: false,
      },
    },
  },
  session: {
    expiresIn: AUTH.sessionExpiresIn,
    updateAge: AUTH.sessionUpdateAge,
    cookieCache: {
      enabled: true,
      maxAge: AUTH.sessionCacheMaxAge,
      strategy: "compact",
    },
    modelName: "session",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
    },
    additionalFields: {
      session_type: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
      last_active_at: {
        type: "date",
        input: false,
        defaultValue: () => new Date(),
      },
    },
  },
  verification: {
    modelName: "magic_link_token",
    fields: {
      identifier: "token_hash",
      createdAt: "created_at",
      expiresAt: "expires_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      used: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
      used_at: {
        type: "date",
        input: false,
      },
      ip_address: {
        type: "string",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const sources = DEFAULT.sources.map((s) => ({
            id: randomUUID(),
            slug: s.slug,
            url: s.url,
            user_id: user.id,
          }));

          const allCategories = await db
            .selectFrom("category")
            .select("slug")
            .execute();

          const defaultCategories = allCategories
            .sort(() => Math.random() - 0.5)
            .slice(0, 4)
            .map((c) => ({ user_id: user.id, category: c.slug }));

          await Promise.all([
            db.insertInto("source").values(sources).execute(),
            db
              .insertInto("agent")
              .values({
                id: randomUUID(),
                slug: "groq-free",
                provider: "Groq",
                api_key: process.env.GROQ_FREE_API_KEY!,
                model: AGENT.Groq.supported_models[0],
                enabled: 0,
                user_id: user.id,
              })
              .execute(),
            defaultCategories.length > 0
              ? db
                  .insertInto("user_category")
                  .values(defaultCategories)
                  .execute()
              : Promise.resolve(),
          ]);
        },
      },
    },
    verification: {
      update: {
        after: async (verification, context) => {
          await db
            .updateTable("magic_link_token")
            .set({
              used: 1,
              used_at: new Date(),
              ip_address: context?.request
                ? (getIp(context.request, auth.options) ?? null)
                : null,
            })
            .where("token_hash", "=", verification.identifier)
            .execute();
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await db
            .selectFrom("user")
            .select("role")
            .where("id", "=", session.userId)
            .executeTakeFirst();

          return {
            data: {
              ...session,
              sessionType: user!.role,
            },
          };
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
