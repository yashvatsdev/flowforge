import type { NextConfig } from "next";
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  distDir: process.env.FLOWFORGE_TEST_DIST || ".next",
  // OAuth authorization codes must not appear in Next development request logs.
  logging: { incomingRequests: { ignore: [/\/auth\/callback/] } },
  devIndicators: false,
};
export default config;
