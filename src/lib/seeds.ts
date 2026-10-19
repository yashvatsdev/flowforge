import { defaults, type Workflow, type FlowNode } from "./engine";
export function starter(
  id = "order-intake",
  name = "Order intake → team handoff",
): Workflow {
  const spec = [
    ["trigger", "Order received", 40, 180],
    ["transform", "Normalize payload", 310, 180],
    ["condition", "High-value order?", 580, 180],
    ["http", "Create CRM record", 850, 80],
    ["notification", "Notify operations", 1120, 80],
    ["notification", "Standard queue", 850, 300],
  ] as const;
  const nodes: FlowNode[] = spec.map(([kind, label, x, y], i) => ({
    id: `n${i}`,
    type: "forge",
    position: { x, y },
    data: {
      kind,
      label,
      config: {
        ...defaults[kind],
        ...(i === 5 ? { channel: "#standard-orders" } : {}),
      },
    },
  }));
  const edges = [
    { id: "e01", source: "n0", target: "n1" },
    { id: "e12", source: "n1", target: "n2" },
    {
      id: "e23",
      source: "n2",
      target: "n3",
      sourceHandle: "true",
      label: "Yes",
    },
    { id: "e34", source: "n3", target: "n4" },
    {
      id: "e25",
      source: "n2",
      target: "n5",
      sourceHandle: "false",
      label: "No",
    },
  ];
  return {
    id,
    name,
    description: "Route every order to the right people. Automatically.",
    active: true,
    nodes,
    edges,
    updatedAt: "2026-10-18T08:00:00.000Z",
  };
}
export function seeds(): Workflow[] {
  return [
    starter(),
    {
      ...starter("lead-enrichment", "Inbound lead enrichment"),
      description: "Enrich inbound leads and prepare a sales handoff.",
      active: false,
    },
    {
      ...starter("daily-digest", "Daily operations digest"),
      description: "Collect, summarize, and share the daily numbers.",
      active: false,
    },
  ];
}
