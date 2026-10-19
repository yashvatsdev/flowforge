// Explicit local-only maintenance entry point. No scheduler or secret output.
import { backgroundRuntime } from "../src/lib/execution/background-runtime";
import { dispatchOutbox } from "../src/lib/execution/delivery";
try {
  const runtime = backgroundRuntime();
  const action = process.argv[2];
  if (action === "dispatch") { await dispatchOutbox(runtime.rpc, runtime.transport, undefined, runtime.batch); await runtime.flush(); }
  else if (action === "recover") await runtime.rpc("ff_delivery_recover", { batch: 25 });
  else if (action === "status") console.info(JSON.stringify(await runtime.rpc("ff_delivery_status", {})));
  else throw new Error();
} catch { console.error("Local delivery operation failed or is disabled; inspect protected database metadata."); process.exitCode = 1; }
