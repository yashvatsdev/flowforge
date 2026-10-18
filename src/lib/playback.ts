import type { Edge } from "@xyflow/react";
import type { Step } from "./engine";

export type EdgePhase = "idle" | "pending" | "running" | "complete" | "skipped" | "failed";

export function edgePhase(edge: Pick<Edge, "source" | "target">, steps: Step[] | undefined, completed: number): EdgePhase {
  if (!steps) return "idle";
  const source = steps.findIndex((step) => step.nodeId === edge.source);
  const target = steps.findIndex((step) => step.nodeId === edge.target);
  if (source < 0 || target < 0) return "pending";
  if (target < completed) {
    if (steps[target].status === "skipped" || steps[source].status === "skipped") return "skipped";
    if (steps[target].status === "failed") return "failed";
    return source < completed && steps[source].status === "success" ? "complete" : "pending";
  }
  if (target === completed && source < completed && steps[source].status === "success" && steps[target].status !== "skipped") return "running";
  return "pending";
}

export function payloadRows(steps: Step[], index: number) {
  const input = index > 0 ? steps[index - 1]?.output || {} : {};
  const output = steps[index]?.output || {};
  return [...new Set([...Object.keys(input), ...Object.keys(output)])].map((key) => ({
    key,
    input: input[key],
    output: output[key],
    changed: JSON.stringify(input[key]) !== JSON.stringify(output[key]),
  }));
}
