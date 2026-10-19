import { defineConfig } from "@playwright/test";
const env={NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:18181",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"fixture-publishable",APP_ORIGIN:"http://localhost:43821",FLOWFORGE_TEST_DIST:".next-phase1",FLOWFORGE_EXECUTION_UI_ENABLED:"local"};
export default defineConfig({
  testDir:"./tests/browser",testMatch:"phase1.spec.ts",workers:1,timeout:40_000,
  use:{baseURL:"http://localhost:43821",channel:process.env.PLAYWRIGHT_CHANNEL||"chrome",viewport:{width:1440,height:1000},reducedMotion:"reduce",trace:"retain-on-failure"},
  webServer:[
    {command:"node --import tsx scripts/test-supabase.mts",url:"http://127.0.0.1:18181/health",reuseExistingServer:false,timeout:60_000},
    {command:"node node_modules/next/dist/bin/next dev --hostname localhost --port 43821",url:"http://localhost:43821/login",env,reuseExistingServer:false,timeout:60_000},
  ],
});
