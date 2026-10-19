import { createClient } from "@supabase/supabase-js";
import { Receiver } from "@upstash/qstash";
import { consumeDelivery, LocalTransport } from "./delivery";
import { createQStashTransport } from "./qstash";
import type { Rpc } from "./runner";

export function backgroundRuntime(env: Readonly<Record<string, string | undefined>> = process.env) {
  // Phase 2C is authorized locally only. Removing this hard hosted/production
  // barrier requires its own reviewed rollout, independent of flags/DB grants.
  const databaseUrl = new URL(env.FLOWFORGE_DELIVERY_DATABASE_URL || "https://disabled.invalid");
  if (env.FLOWFORGE_DELIVERY_MODE !== "local" || env.NODE_ENV === "production" || databaseUrl.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname) || databaseUrl.username || databaseUrl.password || databaseUrl.search || databaseUrl.hash) throw new Error("Background delivery disabled");
  const service = env.FLOWFORGE_DELIVERY_SERVICE_KEY;
  const current = env.QSTASH_CURRENT_SIGNING_KEY, next = env.QSTASH_NEXT_SIGNING_KEY;
  const url = env.FLOWFORGE_WORKER_URL;
  const token = env.FLOWFORGE_MAINTENANCE_TOKEN;
  if (!service || !current || !next || !url || !token || token.length < 32) throw new Error("Background delivery configuration missing");
  const worker = new URL(url);
  if (!['http:', 'https:'].includes(worker.protocol) || worker.pathname !== "/api/internal/execution-worker" || worker.search || worker.hash || worker.username || worker.password) throw new Error("Invalid worker URL");
  const client = createClient(databaseUrl.href, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const allowed = new Set(["ff_delivery_claim", "ff_delivery_settle", "ff_delivery_run_claim", "ff_delivery_recover", "ff_delivery_status", "ff_exec_advance"]);
  const rpc: Rpc = async (name, args) => {
    if (!allowed.has(name)) throw new Error("Worker RPC denied");
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(2000));
    if (error) throw new Error("Background database operation failed");
    return data;
  };
  const local = new LocalTransport();
  const transport = env.FLOWFORGE_DELIVERY_TRANSPORT === "qstash"
    ? createQStashTransport(env.QSTASH_TOKEN || "", url) : local;
  if (env.FLOWFORGE_DELIVERY_TRANSPORT && !["local", "qstash"].includes(env.FLOWFORGE_DELIVERY_TRANSPORT)) throw new Error("Invalid transport");
  return { rpc, url, token, transport, batch: transport === local ? 1 : 10,
    receiver: new Receiver({ currentSigningKey: current, nextSigningKey: next, devMode: false }),
    flush: async () => { await local.flush(async message => consumeDelivery(rpc, message)); },
  };
}
