import { test } from "node:test";
import assert from "node:assert/strict";
import { starter } from "../src/lib/store";
import { simulate, graphError, defaults, type FlowNode } from "../src/lib/engine";
import { validState, readWorkspace, persistWorkspace, preserveRecovery, STORAGE_KEY, RECOVERY_KEY, LIMITS, type State } from "../src/lib/workspace";
function workspace(): State {
  return { version: 1, workflows: [starter()], executions: [], settings: { name: "Alex", email: "alex@example.com", workspace: "Test", reduceMotion: false } };
}
for (const [name, raw] of [
  ["invalid JSON", "{broken"],
  ["empty saved document", ""],
  ["unsupported version", JSON.stringify({ ...workspace(), version: 999 })],
  ["unreleased older version", JSON.stringify({ ...workspace(), version: 0 })],
  ["malformed document", JSON.stringify({ ...workspace(), workflows: [{}] })],
] as const) {
  test(`${name} is preserved and cannot be overwritten by automatic persistence`, () => {
    const data = new Map([[STORAGE_KEY, raw]]);
    const storage = { setItem: (key: string, value: string) => { data.set(key, value); } };
    const document = readWorkspace(raw);
    assert.equal(document.status, "recovery");
    if (document.status !== "recovery") return;
    assert.equal(document.raw, raw);
    assert.equal(persistWorkspace(storage, workspace(), document), false);
    assert.equal(data.get(STORAGE_KEY), raw);
    preserveRecovery(storage, document.raw);
    assert.equal(data.get(RECOVERY_KEY), raw);
    persistWorkspace(storage, workspace(), null);
    assert.equal(data.get(RECOVERY_KEY), raw);
  });
}
test("missing storage is distinct from valid existing workspaces", () => {
  assert.equal(readWorkspace(null).status, "missing");
  const state = workspace(); state.settings.name = "Existing user";
  const doc = readWorkspace(JSON.stringify(state));
  assert.equal(doc.status, "valid");
  if (doc.status === "valid") assert.deepEqual(doc.state, state);
});
test("failed recovery archival aborts without touching the workspace", () => {
  assert.throws(() => preserveRecovery({ setItem() { throw new Error("quota"); } }, "original"), /quota/);
});
test("valid backups retain historical snapshots even after workflow deletion", () => {
  const s = workspace();
  s.executions = [{ ...simulate(s.workflows[0]), id: "run", time: new Date().toISOString() }];
  assert.equal(validState(s), true);
  s.workflows = [];
  assert.equal(validState(s), true);
});
const defects: [string, (s: State) => void][] = [
  ["duplicate workflow ids", s => s.workflows.push(structuredClone(s.workflows[0]))],
  ["empty workflow id", s => { s.workflows[0].id = " "; }],
  ["duplicate node ids", s => { s.workflows[0].nodes[1].id = "n0"; }],
  ["unsupported node types", s => { s.workflows[0].nodes[0].type = "unknown"; }],
  ["unsupported node kinds", s => { s.workflows[0].nodes[0].data.kind = "unknown" as never; }],
  ["missing configuration", s => { s.workflows[0].nodes[0].data.config = {}; }],
  ["invalid amount", s => { s.workflows[0].nodes[0].data.config.amount = ""; }],
  ["non-http URL", s => { s.workflows[0].nodes[3].data.config.url = "file:///test"; }],
  ["invalid HTTP method", s => { s.workflows[0].nodes[3].data.config.method = "INVALID"; }],
  ["duplicate edge ids", s => { s.workflows[0].edges[1].id = "e01"; }],
  ["duplicate connections", s => { s.workflows[0].edges.push({ ...s.workflows[0].edges[0], id: "duplicate" }); }],
  ["missing edge reference", s => { s.workflows[0].edges[0].target = "missing"; }],
  ["invalid condition port", s => { s.workflows[0].edges[2].sourceHandle = "maybe"; }],
  ["missing trigger", s => { s.workflows[0].nodes[0].data = { kind: "transform", label: "Transform", config: { ...defaults.transform } }; }],
  ["cycle", s => { s.workflows[0].edges.push({ id: "cycle", source: "n4", target: "n1" }); }],
  ["incoming trigger", s => { s.workflows[0].edges.push({ id: "back", source: "n1", target: "n0" }); }],
  ["bad timestamp", s => { s.workflows[0].updatedAt = "yesterday"; }],
  ["oversized workflows", s => { s.workflows = Array.from({ length: LIMITS.workflows + 1 }, (_, i) => ({ ...starter(), id: String(i) })); }],
  ["oversized nodes", s => { s.workflows[0].nodes = Array(LIMITS.nodes + 1).fill(s.workflows[0].nodes[0]); }],
  ["oversized edges", s => { s.workflows[0].edges = Array(LIMITS.edges + 1).fill(s.workflows[0].edges[0]); }],
  ["oversized history", s => { s.executions = Array(LIMITS.executions + 1).fill({}); }],
];
for (const [name, mutate] of defects) test(`backup rejects ${name} without changing current state`, () => {
  const current = workspace(); const before = JSON.stringify(current);
  const incoming = structuredClone(current); mutate(incoming);
  assert.equal(readWorkspace(JSON.stringify(incoming)).status, "recovery");
  assert.equal(JSON.stringify(current), before);
});
for (const field of ["workflowId", "nodeId", "duration", "output", "duplicateRun", "duplicateStep", "status"]) test(`history rejects malformed ${field}`, () => {
  const s = workspace(); const e = { ...simulate(s.workflows[0]), id: "run", time: new Date().toISOString() };
  s.executions = [e];
  if (field === "workflowId") e.workflowId = "";
  if (field === "nodeId") e.steps[0].nodeId = "";
  if (field === "duration") e.steps[0].duration = -1;
  if (field === "output") e.steps[0].output = [] as never;
  if (field === "duplicateRun") s.executions.push(structuredClone(e));
  if (field === "duplicateStep") e.steps.push(structuredClone(e.steps[0]));
  if (field === "status") e.status = "failed";
  assert.equal(validState(s), false);
});
test("oversized and deeply nested documents fail safely", () => {
  assert.equal(readWorkspace(" ".repeat(LIMITS.bytes + 1)).status, "recovery");
  const s = workspace(); const e = { ...simulate(s.workflows[0]), id: "run", time: new Date().toISOString() };
  s.executions = [e]; let output = e.steps[0].output;
  for (let i = 0; i < 35; i++) { const child = {}; output.child = child; output = child; }
  assert.equal(validState(s), false);
});
test("disconnected editor drafts round-trip but cannot execute", () => {
  const s = workspace(); s.workflows[0].edges = [];
  assert.equal(validState(s), true);
  assert.throws(() => simulate(s.workflows[0]), /Connect every/);
});
test("large graphs are traversed iteratively without stack overflow", () => {
  const count = 20_000;
  const nodes: FlowNode[] = Array.from({ length: count }, (_, i) => ({ id: String(i), type: "forge", position: { x: i, y: 0 }, data: { kind: i ? "transform" : "trigger", label: "Node", config: { ...defaults[i ? "transform" : "trigger"] } } }));
  const edges = nodes.slice(1).map((n, i) => ({ id: n.id, source: String(i), target: n.id }));
  assert.equal(graphError(nodes, edges), null);
});
