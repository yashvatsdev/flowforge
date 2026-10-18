import type { Workflow, Execution, FlowNode } from "./engine";
import { defaults, graphError } from "./engine";
export type Settings = { name: string; email: string; workspace: string; reduceMotion: boolean };
export type State = { version: 1; workflows: Workflow[]; executions: Execution[]; settings: Settings };
export const STORAGE_KEY = "flowforge:v1";
export const RECOVERY_KEY = "flowforge:recovery";
export const LIMITS = { bytes: 5_000_000, workflows: 1000, nodes: 1000, edges: 5000, executions: 200, text: 10_000, jsonValues: 100_000 } as const;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string" && v.length <= LIMITS.text;
const id = (v: unknown): v is string => str(v) && v.trim().length > 0 && v.length <= 200;
const date = (v: unknown) => str(v) && Number.isFinite(Date.parse(v));
const number = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const unique = (items: { id: string }[]) => new Set(items.map(v => v.id)).size === items.length;
/** Bounded, iterative JSON validation also protects execution outputs from excessive nesting. */
function jsonObject(value: unknown): boolean {
  if (!obj(value)) return false;
  const queue: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
  const seen = new Set<object>();
  for (let i = 0; i < queue.length; i++) {
    if (queue.length > LIMITS.jsonValues) return false;
    const { value: v, depth } = queue[i];
    if (depth > 30) return false;
    if (v === null || typeof v === "boolean" || str(v) || (typeof v === "number" && Number.isFinite(v))) continue;
    if (typeof v !== "object" || seen.has(v)) return false;
    seen.add(v);
    for (const child of Object.values(v)) queue.push({ value: child, depth: depth + 1 });
  }
  return true;
}
export function validState(value: unknown): value is State {
  if (!obj(value) || value.version !== 1) return false;
  const { workflows, executions, settings } = value;
  if (!Array.isArray(workflows) || workflows.length > LIMITS.workflows || !Array.isArray(executions) || executions.length > LIMITS.executions || !obj(settings)) return false;
  if (![settings.name, settings.email, settings.workspace].every(str) || typeof settings.reduceMotion !== "boolean") return false;
  for (const w of workflows) {
    if (!obj(w) || !id(w.id) || !str(w.name) || !w.name.trim() || !str(w.description) || typeof w.active !== "boolean" || !date(w.updatedAt)) return false;
    if (!Array.isArray(w.nodes) || !w.nodes.length || w.nodes.length > LIMITS.nodes || !Array.isArray(w.edges) || w.edges.length > LIMITS.edges) return false;
    for (const n of w.nodes) {
      if (!obj(n) || !id(n.id) || n.type !== "forge" || !obj(n.position) || !Number.isFinite(n.position.x) || !Number.isFinite(n.position.y) || !obj(n.data)) return false;
      const d = n.data;
      if (!str(d.kind) || !Object.hasOwn(defaults, d.kind) || !str(d.label) || !obj(d.config) || !Object.values(d.config).every(str)) return false;
      if (Object.keys(defaults[d.kind as keyof typeof defaults]).some(key => !str((d.config as Record<string, unknown>)[key]))) return false;
    }
    for (const e of w.edges) {
      if (!obj(e) || !id(e.id) || !id(e.source) || !id(e.target) || (e.label !== undefined && !str(e.label)) || (e.sourceHandle != null && !str(e.sourceHandle)) || (e.targetHandle != null && !str(e.targetHandle))) return false;
    }
    // Disconnected nodes are legitimate editor drafts; run validation still requires reachability.
    if (graphError(w.nodes as FlowNode[], w.edges as Workflow["edges"], true)) return false;
  }
  if (!unique(workflows as Workflow[])) return false;
  // History is a snapshot: deleted workflows/nodes may legitimately no longer exist.
  for (const e of executions) {
    if (!obj(e) || !id(e.id) || !id(e.workflowId) || !str(e.name) || !date(e.time) || !number(e.duration) || !["success", "failed"].includes(e.status as string) || (e.sample !== undefined && typeof e.sample !== "boolean")) return false;
    if (!Array.isArray(e.steps) || !e.steps.length || e.steps.length > LIMITS.nodes) return false;
    const stepIds = new Set<string>();
    for (const step of e.steps) {
      if (!obj(step) || !id(step.nodeId) || stepIds.has(step.nodeId) || !str(step.label) || !str(step.message) || !number(step.duration) || !["success", "failed", "skipped"].includes(step.status as string) || !jsonObject(step.output)) return false;
      stepIds.add(step.nodeId);
    }
    if (e.duration !== e.steps.reduce((sum, s) => sum + s.duration, 0) || (e.status === "failed") !== e.steps.some(s => s.status === "failed")) return false;
  }
  return unique(executions as Execution[]);
}
export type WorkspaceDocument = { status: "missing" } | { status: "valid"; state: State } | { status: "recovery"; raw: string; reason: string };
/** Version 1 is the only released schema; never guess a migration for unknown versions. */
export function readWorkspace(raw: string | null): WorkspaceDocument {
  if (raw === null) return { status: "missing" };
  const recover = (reason: string): WorkspaceDocument => ({ status: "recovery", raw, reason });
  if (new TextEncoder().encode(raw).length > LIMITS.bytes) return recover("The saved workspace exceeds the supported size limit.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return recover("The saved workspace contains invalid JSON."); }
  if (obj(parsed) && parsed.version !== 1) return recover("This workspace version is unsupported. Open it with a compatible FlowForge version.");
  return validState(parsed) ? { status: "valid", state: parsed } : recover("The saved workspace does not match the supported document schema.");
}
/** All persistence goes through this guard. Recovery documents retain their exact original bytes. */
export function persistWorkspace(storage: Pick<Storage, "setItem">, state: State, recovery: WorkspaceDocument | null) {
  if (recovery?.status === "recovery") return false;
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  return true;
}
/** Preserve a second copy before an explicitly confirmed reset; failure must abort the reset. */
export function preserveRecovery(storage: Pick<Storage, "setItem">, raw: string) {
  storage.setItem(RECOVERY_KEY, raw);
}
