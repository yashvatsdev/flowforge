import type { FlowNode } from "./engine";
import type { Connection, Edge } from "@xyflow/react";
export function selectNode(nodes: FlowNode[], id: string | null): FlowNode[] {
  return nodes.map(n => !!n.selected === (n.id === id) ? n : { ...n, selected: n.id === id });
}
export function selectedNodeId(nodes: FlowNode[]): string | null {
  const selected = nodes.filter(n => n.selected);
  return selected.length === 1 ? selected[0].id : null;
}
export function validConnection(nodes: FlowNode[], edges: Edge[], connection: Connection | Edge): boolean {
  const { source, target } = connection;
  if (source === target || !nodes.some(n => n.id === source) || !nodes.some(n => n.id === target) || nodes.find(n => n.id === target)?.data.kind === "trigger") return false;
  const seen = new Set<string>();
  const queue = [target];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === source) return false;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of edges) if (edge.source === id) queue.push(edge.target);
  }
  return true;
}
