import { test } from "node:test";
import assert from "node:assert/strict";
import { stagingProblems } from "../src/lib/staging-policy";
const valid = () => ({ FLOWFORGE_ENVIRONMENT: "staging", FLOWFORGE_STAGING_PROJECT_REF: "abcdefghijklmnopqrst",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_fixture",
  APP_ORIGIN: "https://staging.example.test" });
test("gate A accepts isolated disabled configuration without contacting providers", () => assert.deepEqual(stagingProblems(valid()), []));
test("gate A rejects production identity, mismatched target and insecure origins", () => {
  for (const patch of [{FLOWFORGE_STAGING_PROJECT_REF:"kixwwrmedqazurvdnfhi"},{NEXT_PUBLIC_SUPABASE_URL:"https://other.supabase.co"},{APP_ORIGIN:"http://staging.example.test"},{APP_ORIGIN:"https://staging.example.test/path"},{APP_ORIGIN:"https://user:password@staging.example.test"},{FLOWFORGE_ENVIRONMENT:"production"}]) assert.ok(stagingProblems({...valid(),...patch}).length);
});
test("gate A rejects privileged public keys and operational credentials without printing values", () => {
  for (const name of ["QSTASH_TOKEN","FLOWFORGE_DELIVERY_MODE","FLOWFORGE_EXECUTION_UI_ENABLED","FLOWFORGE_MAINTENANCE_TOKEN","SUPABASE_SERVICE_ROLE_KEY","DATABASE_URL","NEXT_PUBLIC_SIGNING_KEY"]) {
    const errors=stagingProblems({...valid(),[name]:"sensitive-test-value"});assert.ok(errors.length);assert.ok(!JSON.stringify(errors).includes("sensitive-test-value"));
  }
  assert.ok(stagingProblems({...valid(),NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_secret_synthetic"}).length);
});
