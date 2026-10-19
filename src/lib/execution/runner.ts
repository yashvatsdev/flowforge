import { randomUUID } from "node:crypto";

export type Rpc = (name: string, args: Record<string, unknown>) => Promise<unknown>;
export type Progress = { runId: string; state: string; generation: number; checkpoint: number };
/** Shared two-transaction protocol. Budgeted background invocations yield with
 * their lease intact; a retry after expiry resumes committed checkpoints. */
export async function runClaimedExecution(rpc: Rpc, claim: Progress, worker: string, milliseconds = 10000) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 15000) throw new Error("Invalid worker budget");
  const deadline = Date.now() + milliseconds;
  let progress = claim;
  for (let operations = 0; progress.state === "running" && operations < 100 && Date.now() < deadline; operations++) {
    const args = { rid: claim.runId, worker, fence: claim.generation, checkpoint: progress.checkpoint };
    progress = await rpc("ff_exec_advance", { ...args, complete: false }) as Progress;
    if (progress.state !== "running" || Date.now() >= deadline) break;
    progress = await rpc("ff_exec_advance", { ...args, checkpoint: progress.checkpoint, complete: true }) as Progress;
  }
  return progress;
}
/** One bounded drain. No server endpoint, network handlers, or client-supplied results. */
export async function drainExecutions(rpc: Rpc, maximumRuns = 10, worker = randomUUID()) {
  if (!Number.isInteger(maximumRuns) || maximumRuns < 1 || maximumRuns > 100) throw new Error("Invalid drain limit");
  let count = 0;
  for (; count < maximumRuns; count++) {
    const claim = await rpc("ff_exec_claim", { worker }) as Progress | null;
    if (!claim) break;
    // 100 nodes, each with a begin and completion transaction. A lost lease or
    // transport error aborts this drain; a later process resumes via PostgreSQL.
    const progress = await runClaimedExecution(rpc, claim, worker, 15000);
    if (progress.state === "running") throw new Error("Runner operation bound exceeded");
  }
  return count;
}
