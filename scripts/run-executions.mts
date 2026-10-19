import { createClient } from "@supabase/supabase-js";
import { drainExecutions } from "../src/lib/execution/runner";

// Explicit loopback guard prevents accidentally enabling a hosted worker in 2B.
const url = process.env.FLOWFORGE_RUNNER_URL;
const key = process.env.FLOWFORGE_RUNNER_SERVICE_KEY;
if (!url || !key || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) || process.env.NODE_ENV === "production") throw new Error("Runner requires a local Supabase URL and service credential; hosted/production execution is disabled");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
try {
  const count = await drainExecutions(async (name, args) => {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(10000));
    if (error) throw new Error("Execution RPC failed; restart the local runner after inspecting the local database");
    return data;
  });
  console.log(`Local execution drain finished: ${count} runs`);
} catch {
  console.error("Local execution drain stopped; durable checkpoints are preserved");
  process.exitCode = 1;
}
