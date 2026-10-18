import { test } from "node:test";
import assert from "node:assert/strict";
import { starter } from "../src/lib/store";
import { selectNode, selectedNodeId, validConnection } from "../src/lib/editor-state";
import { applyNodeChanges, addEdge } from "@xyflow/react";
test("inspector selection replaces canvas selection after adding a node", () => {
  const nodes = starter().nodes;
  nodes[1].selected = true;
  const selected = selectNode(nodes, "n0");
  assert.equal(selectedNodeId(selected), "n0");
  assert.deepEqual(selected.filter(n => n.selected).map(n => n.id), ["n0"]);
  assert.deepEqual(selectNode(selected, "n0"), selected);
  assert.equal(selectedNodeId(selectNode(selected, null)), null);
});
test("canvas selection and deletion update the same source used by the inspector", () => {
  let nodes = selectNode(starter().nodes, "n0");
  nodes = applyNodeChanges([{ type: "select", id: "n0", selected: false }, { type: "select", id: "n1", selected: true }], nodes);
  assert.equal(selectedNodeId(nodes), "n1");
  nodes = applyNodeChanges([{ type: "remove", id: "n1" }], nodes);
  assert.equal(selectedNodeId(nodes), null);
});
test("connections work after inspector or canvas selection and reject cycles", () => {
  for (const nodes of [selectNode(starter().nodes, "n0"), applyNodeChanges([{ type: "select", id: "n0", selected: true }], starter().nodes)]) {
    const c = { source: selectedNodeId(nodes)!, target: "n1", sourceHandle: null, targetHandle: null };
    assert.equal(validConnection(nodes, [], c), true);
    const edges = addEdge(c, []);
    assert.equal(edges.length, 1);
    assert.equal(validConnection(nodes, edges, { ...c, source: "n1", target: "n0" }), false);
    assert.equal(validConnection(nodes, edges, { ...c, target: "missing" }), false);
  }
});
