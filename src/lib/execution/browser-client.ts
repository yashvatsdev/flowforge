export class ExecutionRequestError extends Error {
  constructor(public status: number) { super(({ 401: "Your session expired. Sign in again.", 403: "Execution access is unavailable in this environment.",
    404: "This run is unavailable or belongs to another workspace.", 409: "The workspace changed. Reload its saved version before starting a new run.",
    422: "Check the input and workflow. Real runs support manual triggers, literal transforms and numeric conditions.",
    429: "Your workspace execution quota is full. Try again later.", 503: "Real execution is disabled or temporarily unavailable. Simulation is still available." } as Record<number, string>)[status] ?? "Connection interrupted. Retry when you are ready."); }
}
export async function executionRequest<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController(), cancel = () => controller.abort();
  const timer = setTimeout(cancel, 8000);
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new ExecutionRequestError(response.status);
    return await response.json() as T;
  } catch (error) { if (error instanceof ExecutionRequestError) throw error; throw new ExecutionRequestError(0); }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
}
export function manualInput(raw: string): Record<string, unknown> {
  if (new TextEncoder().encode(raw).byteLength > 65536) throw new Error("Manual input must be at most 64 KiB.");
  let value: unknown; try { value = JSON.parse(raw); } catch { throw new Error("Enter valid JSON input."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Manual input must be a JSON object.");
  return value as Record<string, unknown>;
}
export class StartIntent {
  readonly key = crypto.randomUUID();
  readonly body: string;
  constructor(expectedRevision: number, input: Record<string, unknown>) { this.body = JSON.stringify({ expectedRevision, input }); }
  send(workflowId: string, signal?: AbortSignal) {
    return executionRequest<{ runId: string; state: string; replayed: boolean }>(`/api/workflows/${encodeURIComponent(workflowId)}/runs`,
      { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": this.key }, body: this.body }, signal);
  }
}
