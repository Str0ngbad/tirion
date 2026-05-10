import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Sentry organization and project slugs — used at build time for source map uploads
  org: "tony-carter",
  project: "tirion",

  // Suppress all Sentry-CLI logs during build unless something errors
  silent: !process.env.CI,

 sourcemaps: {
  disable: false,           // do generate and upload source maps
  deleteSourcemapsAfterUpload: true,  // delete from public output after upload (the "hide" part)
},

  // Disable telemetry from Sentry CLI itself
  telemetry: false,
});
