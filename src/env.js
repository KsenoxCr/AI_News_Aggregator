import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DB_HOST: z.string(),
    DB_NAME: z.string(),
    DB_PORT: z.string(),
    DB_USERNAME: z.string(),
    DB_PASSWORD: z.string(),
    BETTER_AUTH_SECRET: z.string(),
    CRYPTO_SECRET: z.string(),
    COMPANY_EMAIL: z.string().email(),
    RESEND_API_KEY: z.string(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("production"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    CRYPTO_SECRET: process.env.CRYPTO_SECRET,
    COMPANY_EMAIL: process.env.COMPANY_EMAIL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
