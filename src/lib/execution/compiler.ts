import type { Workflow } from "../engine";
import { validState, type State } from "../workspace";

export const EXECUTION_LIMITS = { nodes: 100, edges: 500, snapshot: 262144, input: 65536, output: 65536, aggregate: 1048576 } as const;
export type Payload = Record<string, unknown>;
export type CompiledNode = { id: string; kind: "trigger" | "transform" | "condition"; config: Record<string, string>; parent: string | null; port: string };
export function jsonBytes(value: unknown) { return Buffer.byteLength(JSON.stringify(value), "utf8"); }

/** Real-run admission is stricter than the existing editor/simulation contract. */
export function compileWorkflow(workflow: Workflow): readonly CompiledNode[] {
  const fixture: State = { version: 1, workflows: [workflow], executions: [], settings: { name: "", email: "", workspace: "", reduceMotion: false } };
  if (!validState(fixture) || workflow.nodes.length > EXECUTION_LIMITS.nodes || workflow.edges.length > EXECUTION_LIMITS.edges || jsonBytes(workflow) > EXECUTION_LIMITS.snapshot) throw new Error("Unsupported or malformed execution graph");
  const incoming = new Map<string, Workflow["edges"][number]>();
  for (const edge of workflow.edges) {
    if (incoming.has(edge.target)) throw new Error("Joins are not supported");
    incoming.set(edge.target, edge);
  }
  const roots = workflow.nodes.filter(n => !incoming.has(n.id));
  if (roots.length !== 1 || roots[0].data.kind !== "trigger") throw new Error("Connect every node to the manual trigger");
  const pending = [roots[0].id], compiled: CompiledNode[] = [];
  for (let index = 0; index < pending.length; index++) {
    const n = workflow.nodes.find(n => n.id === pending[index])!;
    const { kind, config } = n.data;
    if (kind !== "trigger" && kind !== "transform" && kind !== "condition") throw new Error("Handler is disabled for real execution");
    if (kind === "transform" && (["__proto__", "constructor", "prototype"].includes(config.field) || config.field.length > 200)) throw new Error("Invalid literal field");
    if (kind === "condition" && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(config.threshold.trim()) || !Number.isFinite(Number(config.threshold)))) throw new Error("Invalid numeric threshold");
    const edge = incoming.get(n.id);
    compiled.push({ id: n.id, kind, config: { ...config }, parent: edge?.source ?? null, port: edge?.sourceHandle ?? "" });
    pending.push(...workflow.edges.filter(e => e.source === n.id).map(e => e.target).sort());
  }
  if (compiled.length !== workflow.nodes.length) throw new Error("Disconnected nodes are not executable");
  return compiled;
}

/** Reference evaluator for isolated handler tests. PostgreSQL commits real results. */
export function evaluateNode(node: CompiledNode, input: Payload): { output: Payload; branch?: boolean } {
  const output = structuredClone(input);
  if (node.kind === "transform") Object.defineProperty(output, node.config.field, { value: node.config.value, enumerable: true, writable: true, configurable: true });
  let branch: boolean | undefined;
  if (node.kind === "condition") {
    if (typeof output.amount !== "number" || !Number.isFinite(output.amount)) throw new Error("invalid_numeric_input");
    branch = output.amount >= Number(node.config.threshold);
  }
  if (jsonBytes(output) > EXECUTION_LIMITS.output) throw new Error("output_limit");
  return { output, branch };
}
