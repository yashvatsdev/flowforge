import { validState, type State, LIMITS } from "./workspace";
export type WorkspaceEnvelope = { workspaceId: string; revision: number; onboarding: string[]; state: State };
export function workspaceEnvelope(value: unknown): value is WorkspaceEnvelope {
  if (!value || typeof value !== "object") return false;
  const v = value as WorkspaceEnvelope;
  return typeof v.workspaceId === "string" && Number.isSafeInteger(v.revision) && v.revision >= 0 && Array.isArray(v.onboarding) && v.onboarding.every(x => typeof x === "string") && validState(v.state);
}
export function mergeImport(current: State, incoming: State, uuid: () => string): State {
  const ids = new Map(incoming.workflows.map(w => [w.id, uuid()]));
  for (const execution of incoming.executions) if (!ids.has(execution.workflowId)) ids.set(execution.workflowId, uuid());
  const next = { ...current, workflows: [...current.workflows, ...incoming.workflows.map(w => ({ ...w, id: ids.get(w.id)!, active: false }))], executions: [...current.executions, ...incoming.executions.map(e => ({ ...e, id: uuid(), workflowId: ids.get(e.workflowId) || e.workflowId }))] };
  if (!validState(next)) throw new Error("The combined workspace exceeds backup limits or contains invalid data. Export and reduce the import before retrying.");
  return next;
}
export async function boundedJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new Error("Expected JSON");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing JSON body");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > LIMITS.bytes) { await reader.cancel(); throw new Error("Body exceeds 5 MB"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
