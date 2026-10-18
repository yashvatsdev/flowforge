import { test } from "node:test";
import assert from "node:assert/strict";
import { simulate } from "../src/lib/engine";
import { starter } from "../src/lib/store";
import { edgePhase, payloadRows } from "../src/lib/playback";

test("playback only highlights the active route and never animates an unused branch", () => {
  const workflow = starter();
  const { steps } = simulate(workflow);
  const index = steps.findIndex((step) => step.nodeId === "n3");
  const crm = workflow.edges.find((edge) => edge.target === "n3")!;
  const standard = workflow.edges.find((edge) => edge.target === "n5")!;
  assert.equal(edgePhase(crm, steps, index), "running");
  assert.notEqual(edgePhase(standard, steps, steps.findIndex((step) => step.nodeId === "n5")), "running");
  assert.equal(edgePhase(crm, steps, steps.length), "complete");
  assert.equal(edgePhase(standard, steps, steps.length), "skipped");
});

test("playback marks a failed request and dims its skipped downstream connector", () => {
  const workflow = starter();
  workflow.nodes[3].data.config.fail = "true";
  const { steps } = simulate(workflow);
  assert.equal(edgePhase(workflow.edges.find((edge) => edge.target === "n3")!, steps, steps.length), "failed");
  assert.equal(edgePhase(workflow.edges.find((edge) => edge.target === "n4")!, steps, steps.length), "skipped");
});

test("payload inspection distinguishes additions, overwrites, and unchanged fields", () => {
  const workflow = starter();
  workflow.nodes[1].data.config.field = "amount";
  workflow.nodes[1].data.config.value = "200";
  const { steps } = simulate(workflow);
  const trigger = payloadRows(steps, 0);
  assert.equal(trigger.find((row) => row.key === "amount")?.input, undefined);
  const transform = payloadRows(steps, 1);
  assert.deepEqual(transform.find((row) => row.key === "amount"), { key: "amount", input: 149, output: "200", changed: true });
  assert.equal(transform.find((row) => row.key === "email")?.changed, false);
  const skipped = steps.findIndex((step) => step.status === "skipped");
  assert.equal(payloadRows(steps, skipped).some((row) => row.changed), false);
});
