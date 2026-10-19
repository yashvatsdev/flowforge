export const runStates = ["queued", "running", "cancellation_requested", "succeeded", "failed", "cancelled", "timed_out"] as const;
export type RunState = typeof runStates[number];
export type RunSummary = { id: string; workflow_id: string; workspace_revision: number; state: RunState; created_at: string; started_at: string | null; finished_at: string | null; error_code: string | null };
export type RunDetails = RunSummary & { manual_input: unknown; snapshot: { id: string; name: string; nodes: { id: string; data: { label: string; kind: string } }[] } };
export type RunStep = { node_id: string; ordinal: number; attempt: number; state: string; output: unknown; error_code: string | null; started_at: string; finished_at: string | null };
export type RunPage = { runs: RunSummary[]; nextCursor: string | null };
export const terminalRun = (state: string) => ["succeeded", "failed", "cancelled", "timed_out"].includes(state);
export const runLabel = (state: string) => ({ succeeded: "Completed", cancellation_requested: "Cancellation requested", timed_out: "Timed out", abandoned: "Interrupted" }[state] ?? state.replaceAll("_", " ").replace(/^./, x => x.toUpperCase()));
export function duration(run: { started_at: string | null; finished_at: string | null }) {
  if (!run.started_at) return "Not started";
  if (!run.finished_at) return "In progress";
  const ms = Date.parse(run.finished_at) - Date.parse(run.started_at);
  return Number.isFinite(ms) && ms >= 0 ? ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s` : "Unavailable";
}
export function failureExplanation(code: string | null) {
  return ({ invalid_numeric_input: "A condition requires a numeric amount.", output_limit: "An output exceeded the execution limits.",
    deadline: "The queue wait or execution deadline was reached.", attempts_exhausted: "The node could not finish within its retry limit.",
    delivery_exhausted: "Background delivery exhausted its retry limit.", lease_expired: "This attempt was interrupted when its worker lease expired.",
    cancelled: "Execution was cancelled." } as Record<string, string>)[code || ""] ?? (code ? "Execution could not complete. Contact your workspace operator." : "");
}
/** Defense in depth, not a general secret detector. Never render raw snapshots/config. */
export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[Truncated]";
  if (typeof value === "string") return /(?:bearer\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.|(?:postgres(?:ql)?|https?):\/\/[^\s/]+:[^\s/]+@)/i.test(value) ? "[Redacted]" : value.length > 2048 ? `${value.slice(0, 2048)}… [Truncated]` : value;
  if (Array.isArray(value)) return value.slice(0, 50).map(v => redactValue(v, depth + 1));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, v]) => [key,
    /password|passwd|secret|token|authorization|cookie|credential|api.?key|private.?key|service.?role|signing.?key/i.test(key) ? "[Redacted]" : redactValue(v, depth + 1)]));
  return value;
}
export function displayDetails(value: RunDetails): RunDetails {
  const { id, workflow_id, workspace_revision, state, created_at, started_at, finished_at, error_code } = value;
  return { id, workflow_id, workspace_revision, state, created_at, started_at, finished_at, error_code,
    manual_input: redactValue(value.manual_input), snapshot: { id: value.snapshot.id, name: value.snapshot.name,
      nodes: value.snapshot.nodes.map(n => ({ id: n.id, data: { label: n.data.label, kind: n.data.kind } })) } };
}
export function displaySteps(value: RunStep[]): RunStep[] {
  return value.map(({ node_id, ordinal, attempt, state, output, error_code, started_at, finished_at }) =>
    ({ node_id, ordinal, attempt, state, output: redactValue(output), error_code, started_at, finished_at }));
}
