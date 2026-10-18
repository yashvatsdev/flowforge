import type { Node, Edge } from "@xyflow/react";
export type Kind =
  "trigger" | "transform" | "condition" | "http" | "notification";
export type FlowData = {
  label: string;
  kind: Kind;
  config: Record<string, string>;
  status?: "running" | "success" | "failed" | "skipped";
  [key: string]: unknown;
};
export type FlowNode = Node<FlowData>;
export type Workflow = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  nodes: FlowNode[];
  edges: Edge[];
  updatedAt: string;
};
export type Step = {
  nodeId: string;
  label: string;
  status: "success" | "failed" | "skipped";
  duration: number;
  message: string;
  output: Record<string, unknown>;
};
export type Execution = {
  id: string;
  workflowId: string;
  name: string;
  time: string;
  status: "success" | "failed";
  duration: number;
  steps: Step[];
  sample?: boolean;
};
export const kinds: { kind: Kind; label: string; description: string }[] = [
  {
    kind: "trigger",
    label: "Webhook",
    description: "Start with a sample payload",
  },
  {
    kind: "transform",
    label: "Transform",
    description: "Map a field into your payload",
  },
  {
    kind: "condition",
    label: "Condition",
    description: "Branch by order amount",
  },
  {
    kind: "http",
    label: "HTTP request",
    description: "Simulate an API response",
  },
  {
    kind: "notification",
    label: "Notification",
    description: "Simulate a team message",
  },
];
export const defaults: Record<Kind, Record<string, string>> = {
  trigger: { amount: "149", email: "hello@example.com" },
  transform: { field: "source", value: "FlowForge" },
  condition: { threshold: "100" },
  http: {
    url: "https://api.example.com/orders",
    method: "POST",
    fail: "false",
  },
  notification: { channel: "#operations", message: "New order is ready." },
};
/** Draft documents may contain disconnected nodes; execution requires a connected graph. */
export function graphError(nodes: FlowNode[], edges: Edge[], draft = false): string | null {
  if (!nodes.length) return "Add a webhook to start your workflow.";
  const ids = new Set(nodes.map(n => n.id));
  if (ids.size !== nodes.length || nodes.some(n => !n.id.trim())) return "Node identifiers must be unique and nonempty.";
  if (new Set(edges.map(e => e.id)).size !== edges.length || edges.some(e => !e.id.trim())) return "Connection identifiers must be unique and nonempty.";
  for (const node of nodes) {
    const { kind, config: c } = node.data;
    if (!Object.hasOwn(defaults, kind)) return "Unsupported node type.";
    if (!c || Object.keys(defaults[kind]).some(key => typeof c[key] !== "string")) return "Every node needs its required configuration.";
    if (!node.data.label.trim()) return "Every node needs a name.";
    if (kind === "trigger" && (!c.amount.trim() || !Number.isFinite(Number(c.amount)))) return "Webhook amount must be a number.";
    if (kind === "condition" && (!c.threshold.trim() || !Number.isFinite(Number(c.threshold)))) return "Condition threshold must be a number.";
    if (kind === "transform" && !c.field.trim()) return "Choose a field name for the transform.";
    if (kind === "http") {
      try {
        if (!["http:", "https:"].includes(new URL(c.url).protocol)) return "Use an HTTP or HTTPS request URL.";
      } catch { return "Enter a valid request URL."; }
      if (!["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(c.method) || !["true", "false"].includes(c.fail)) return "Invalid HTTP request configuration.";
    }
  }
  const triggers = nodes.filter(n => n.data.kind === "trigger");
  if (triggers.length !== 1) return "Use exactly one webhook trigger.";
  const byId = new Map(nodes.map(n => [n.id, n]));
  const outgoing = new Map(nodes.map(n => [n.id, [] as string[]]));
  const incoming = new Map(nodes.map(n => [n.id, 0]));
  const connections = new Set<string>();
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) return "A connection points to a missing node.";
    if (e.target === triggers[0].id) return "The webhook cannot have incoming connections.";
    const condition = byId.get(e.source)!.data.kind === "condition";
    if (condition ? !["true", "false"].includes(e.sourceHandle || "") : e.sourceHandle != null && e.sourceHandle !== "") return "Invalid source port.";
    if (e.targetHandle != null && e.targetHandle !== "") return "Invalid target port.";
    const key = JSON.stringify([e.source, e.target, e.sourceHandle || ""]);
    if (connections.has(key)) return "Duplicate connections are not supported.";
    connections.add(key);
    outgoing.get(e.source)!.push(e.target);
    incoming.set(e.target, incoming.get(e.target)! + 1);
  }
  const queue = nodes.filter(n => incoming.get(n.id) === 0).map(n => n.id);
  let cursor = 0;
  while (cursor < queue.length) {
    for (const target of outgoing.get(queue[cursor++])!) {
      incoming.set(target, incoming.get(target)! - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
  }
  if (queue.length !== nodes.length) return "Cycles are not supported. Remove a connection to make a directed acyclic graph.";
  const reached = new Set([triggers[0].id]);
  const pending = [triggers[0].id];
  for (let i = 0; i < pending.length; i++) {
    for (const target of outgoing.get(pending[i])!) {
      if (!reached.has(target)) { reached.add(target); pending.push(target); }
    }
  }
  if (!draft && reached.size !== nodes.length) return "Connect every node to the webhook trigger.";
  return null;
}
/** Pure, deterministic graph evaluation. No network or external service calls. */
export function simulate(workflow: Workflow): Omit<Execution, "id" | "time"> {
  const error = graphError(workflow.nodes, workflow.edges);
  if (error) throw new Error(error);
  const nodes = workflow.nodes;
  const edges = workflow.edges;
  const indegree = new Map(
    nodes.map((n) => [n.id, edges.filter((e) => e.target === n.id).length]),
  );
  const queue = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const enabled = new Set([nodes.find((n) => n.data.kind === "trigger")!.id]);
  const steps: Step[] = [];
  let payload: Record<string, unknown> = {};
  let failed = false;
  while (queue.length) {
    const id = queue.shift()!;
    const node = nodes.find((n) => n.id === id)!;
    const { kind, config: c, label } = node.data;
    let message = "";
    let branch = true;
    const skipped = !enabled.has(id) || failed;
    let status: Step["status"] = skipped ? "skipped" : "success";
    if (skipped)
      message = failed ? "Skipped after failure" : "Branch not selected";
    else if (kind === "trigger") {
      payload = { amount: Number(c.amount), email: c.email };
      message = "Sample webhook received";
    } else if (kind === "transform") {
      payload = { ...payload, [c.field]: c.value };
      message = `Mapped ${c.field} → ${c.value}`;
    } else if (kind === "condition") {
      branch = Number(payload.amount) >= Number(c.threshold);
      message = `${payload.amount} ≥ ${c.threshold}: ${branch}`;
    } else if (kind === "http") {
      if (c.fail === "true") {
        status = "failed";
        failed = true;
        message = "Simulated 503 · service unavailable";
      } else {
        payload = { ...payload, response: 200 };
        message = `Simulated 200 · ${c.method} ${c.url}`;
      }
    } else message = `Simulated delivery to ${c.channel}: ${c.message}`;
    const duration = skipped
      ? 0
      : 80 + ([...(id + kind)].reduce((a, c) => a + c.charCodeAt(0), 0) % 220);
    steps.push({
      nodeId: id,
      label,
      status,
      duration,
      message,
      output: { ...payload },
    });
    edges
      .filter((e) => e.source === id)
      .forEach((e) => {
        if (
          !skipped &&
          !failed &&
          (kind !== "condition" ||
            !e.sourceHandle ||
            e.sourceHandle === (branch ? "true" : "false"))
        )
          enabled.add(e.target);
        indegree.set(e.target, indegree.get(e.target)! - 1);
        if (indegree.get(e.target) === 0) queue.push(e.target);
      });
  }
  return {
    workflowId: workflow.id,
    name: workflow.name,
    status: failed ? "failed" : "success",
    duration: steps.reduce((s, n) => s + n.duration, 0),
    steps,
  };
}
