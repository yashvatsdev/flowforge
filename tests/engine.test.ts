import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate, graphError } from "../src/lib/engine";
import { starter, validState } from "../src/lib/store";
test("same graph and input produce identical results; high value goes to CRM", () => {
  const w = starter();
  const a = simulate(w);
  assert.deepEqual(a, simulate(w));
  assert.equal(a.status, "success");
  assert.equal(a.steps.find((s) => s.nodeId === "n3")?.status, "success");
  assert.equal(a.steps.find((s) => s.nodeId === "n5")?.status, "skipped");
  assert.equal(a.steps.find((s) => s.nodeId === "n4")?.output.response, 200);
});
test("low value selects the alternative branch", () => {
  const w = starter();
  w.nodes[0].data.config.amount = "20";
  const e = simulate(w);
  assert.equal(e.steps.find((s) => s.nodeId === "n3")?.status, "skipped");
  assert.equal(e.steps.find((s) => s.nodeId === "n5")?.status, "success");
  assert.equal(e.steps.find((s) => s.nodeId === "n4")?.status, "skipped");
});
test("simulated service failure stops downstream execution", () => {
  const w = starter();
  w.nodes[3].data.config.fail = "true";
  const e = simulate(w);
  assert.equal(e.status, "failed");
  assert.equal(e.steps.find((s) => s.nodeId === "n3")?.status, "failed");
  assert.equal(e.steps.find((s) => s.nodeId === "n4")?.status, "skipped");
});
test("cycles, disconnected nodes and invalid numbers fail validation", () => {
  let w = starter();
  w.edges.push({ id: "cycle", source: "n4", target: "n1" });
  assert.match(graphError(w.nodes, w.edges)!, /Cycles/);
  w = starter();
  w.edges = w.edges.filter((e) => e.target !== "n5");
  assert.match(graphError(w.nodes, w.edges)!, /Connect every/);
  w = starter();
  w.nodes[0].data.config.amount = "invalid";
  assert.throws(() => simulate(w), /number/);
});
test("import validation rejects malformed local backups", () => {
  assert.equal(
    validState({
      version: 1,
      workflows: [{ id: "broken" }],
      executions: [],
      settings: {},
    }),
    false,
  );
  assert.equal(validState(null), false);
  assert.equal(
    validState({
      version: 1,
      workflows: [starter()],
      executions: [],
      settings: {
        name: "Alex",
        email: "alex@example.com",
        workspace: "Test",
        reduceMotion: false,
      },
    }),
    true,
  );
});
