import createNextIntlPlugin from "next-intl/plugin";

/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

/** @type {import("next").NextConfig} */
const config = {};

export default withNextIntl(config);
