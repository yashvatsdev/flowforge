"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type NodeProps,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Play,
  Pause,
  SkipForward,
  Focus,
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  X,
  Check,
  ChevronRight,
  Info,
  RotateCcw,
  Square,
  ArrowUpRight,
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  simulate,
  graphError,
  kinds,
  defaults,
  type FlowNode,
  type Workflow,
  type Kind,
  type Execution,
} from "@/lib/engine";
import { NodeIcon, Status, Empty } from "./shared";
import { nodeColors } from "@/lib/node-colors";
import { selectNode, selectedNodeId, validConnection as canConnect } from "@/lib/editor-state";
import { edgePhase } from "@/lib/playback";
import { ExecutionPlayback } from "./execution-playback";

function nodeSummary(data: FlowNode["data"]): [string, string][] {
  const config = data.config;
  switch (data.kind) {
    case "trigger": return [["amount", config.amount], ["email", config.email]];
    case "transform": return [["set field", config.field], ["to value", config.value]];
    case "condition": return [["Yes", `amount ≥ ${config.threshold}`], ["No", `amount < ${config.threshold}`]];
    case "http": {
      let destination = config.url;
      try { const url = new URL(config.url); destination = url.host + url.pathname; } catch { /* Invalid URLs remain editable and are validated before a run. */ }
      return [[config.method, destination], ["response", config.fail === "true" ? "503 · failure rehearsal" : "200 · simulated"]];
    }
    case "notification": return [["to", config.channel], ["message", config.message]];
  }
}

function ForgeNode({ data, selected }: NodeProps<FlowNode>) {
  return (
    <div
      data-node-kind={data.kind}
      className={`forge-node ${selected ? "selected" : ""} ${data.status || ""}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={data.kind !== "trigger"}
        style={data.kind === "trigger" ? { visibility: "hidden" } : {}}
      />
      <div className="forge-node-kind">
        <span>
          <NodeIcon kind={data.kind} size={16} />
          {data.kind === "http" ? "HTTP REQUEST" : data.kind.toUpperCase()}
        </span>
        {data.status === "success" ? (
          <Check size={13} />
        ) : data.status === "running" ? (
          <span className="live-dot" />
        ) : (
          <span className="node-port-dot" />
        )}
      </div>
      <strong>{data.label}</strong>
      <dl className="node-config-preview">
        {nodeSummary(data).map(([label, value]) => <div key={label}><dt>{label}</dt><dd title={value}>{value || "Not configured"}</dd></div>)}
      </dl>
      <div className="node-run-state" data-state={data.status || "idle"}>
        <span>{data.status === "running" ? "Processing sample" : data.status === "success" ? "Completed" : data.status === "failed" ? "Failed" : data.status === "skipped" ? "Skipped" : "Local simulation"}</span>
        {data.status === "success" ? <Check size={10} /> : data.status === "failed" ? <X size={10} /> : null}
      </div>
      {data.kind === "condition" ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            style={{ top: "35%" }}
          />
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            style={{ top: "76%" }}
          />
          <span className="handle-label yes">YES</span>
          <span className="handle-label no">NO</span>
        </>
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}
const nodeTypes = { forge: ForgeNode };
export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const { workflows } = useStore();
  const workflow = workflows.find((w) => w.id === id);
  return workflow ? (
    <ReactFlowProvider>
      <Canvas key={id} workflow={workflow} />
    </ReactFlowProvider>
  ) : (
    <Empty
      title="This workflow isn’t here."
      body="It may have been deleted or belongs to another browser."
      href="/workflows"
      label="Back to workflows"
    />
  );
}
function Canvas({ workflow }: { workflow: Workflow }) {
  const { saveWorkflow, record, settings } = useStore();
  const [nodes, setNodes] = useState<FlowNode[]>(() =>
    structuredClone(workflow.nodes),
  );
  const [edges, setEdges] = useState<Edge[]>(() =>
    structuredClone(workflow.edges),
  );
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description);
  const selected = selectedNodeId(nodes);
  const setSelected = (id: string | null) => setNodes(ns => selectNode(ns, id));
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [savedRecently, setSavedRecently] = useState(false);
  const [plan, setPlan] = useState<Omit<Execution, "id" | "time"> | null>(null);
  const [step, setStep] = useState(0);
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackSession, setPlaybackSession] = useState(0);
  const [followActive, setFollowActive] = useState(true);
  const [lastRun, setLastRun] = useState<Execution | null>(null);
  const [showLog, setShowLog] = useState(true);
  const [inspector, setInspector] = useState(true);
  const [connectionTarget, setConnectionTarget] = useState("");
  const [branch, setBranch] = useState("true");
  useEffect(() => {
    setConnectionTarget("");
  }, [selected]);
  const systemReduced = useReducedMotion();
  const quiet = !!systemReduced || settings.reduceMotion;
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow<FlowNode>();
  const wrapper = useRef<HTMLDivElement>(null);
  const running = plan !== null;
  const runView = plan || lastRun;
  const completedCount = plan ? step : lastRun?.steps.length || 0;
  const activeStep = plan?.steps[step];
  const activeNode = nodes.find((node) => node.id === activeStep?.nodeId);
  const node = nodes.find((n) => n.id === selected);
  const snapshot = useCallback(
    () => ({
      ...workflow,
      name: name.trim() || "Untitled workflow",
      description,
      nodes: nodes.map((n) => ({
        ...n,
        selected: false,
        data: { ...n.data, status: undefined },
      })),
      edges,
    }),
    [workflow, name, description, nodes, edges],
  );
  const save = useCallback(() => {
    saveWorkflow(snapshot());
    setDirty(false);
    setSavedRecently(true);
    setMessage("All changes saved to this browser.");
  }, [saveWorkflow, snapshot]);
  useEffect(() => {
    if (!savedRecently) return;
    const timer = setTimeout(() => setSavedRecently(false), 1800);
    return () => clearTimeout(timer);
  }, [savedRecently]);
  const clearPlayback = useCallback(() => {
    setLastRun(null);
    setNodes((current) => current.map((node) => ({ ...node, data: { ...node.data, status: undefined } })));
  }, []);
  const advance = useCallback(() => {
    const current = plan?.steps[step];
    if (!current) return;
    setNodes((currentNodes) => currentNodes.map((node) => ({ ...node, data: {
      ...node.data, status: node.id === current.nodeId ? current.status : node.data.status,
    } })));
    setStep(step + 1);
  }, [plan, step]);
  const activeNodeX = activeNode?.position.x;
  const activeNodeY = activeNode?.position.y;
  const activeStepId = activeStep?.nodeId;
  useEffect(() => {
    if (!followActive || !activeStepId || activeNodeX === undefined || activeNodeY === undefined) return;
    void setCenter(activeNodeX + 102, activeNodeY + 80, { zoom: 0.95, duration: quiet ? 0 : 400 });
  }, [activeStepId, activeNodeX, activeNodeY, followActive, quiet, setCenter]);
  useEffect(() => {
    if (window.matchMedia("(max-width:1100px)").matches) setInspector(false);
  }, []);
  useEffect(() => {
    const flush = (e: MouseEvent) => {
      const anchor = (e.target as Element)?.closest("a");
      if (anchor && dirty) save();
    };
    document.addEventListener("click", flush, true);
    return () => document.removeEventListener("click", flush, true);
  }, [dirty, save]);
  useEffect(() => {
    if (!dirty || running) return;
    const timer = setTimeout(save, 800);
    return () => clearTimeout(timer);
  }, [dirty, running, save]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!plan) return;
    if (step >= plan.steps.length) {
      const execution = record(plan);
      setLastRun(execution);
      setPlan(null);
      setPlaybackPaused(false);
      setMessage(
        plan.status === "success"
          ? "Simulation complete. View the step outputs below."
          : "Simulation failed. Inspect the error below.",
      );
      return;
    }
    if (playbackPaused) return;
    const current = plan.steps[step];
    setNodes((ns) =>
      ns.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: n.id === current.nodeId ? current.status === "skipped" ? "skipped" : "running" : n.data.status,
        },
      })),
    );
    const timer = setTimeout(advance, (current.status === "skipped" ? 350 : 1200) / playbackSpeed);
    return () => clearTimeout(timer);
  }, [plan, step, record, playbackPaused, playbackSpeed, advance]);
  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    const allowed = running ? changes.filter((change) => change.type === "select" || change.type === "dimensions") : changes;
    setNodes((ns) => applyNodeChanges(allowed, ns));
    if (allowed.some((c) => c.type !== "select" && c.type !== "dimensions")) {
      setDirty(true);
      clearPlayback();
    }
  }, [clearPlayback, running]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes, es));
    if (changes.some((c) => c.type !== "select")) { setDirty(true); clearPlayback(); }
  }, [clearPlayback]);
  const validConnection = (c: Connection | Edge) => canConnect(nodes, edges, c);
  const onConnect = (c: Connection) => {
    if (!validConnection(c)) {
      setMessage("That connection would create a cycle.");
      return;
    }
    setEdges((es) =>
      addEdge(
        {
          ...c,
          label:
            c.sourceHandle === "true"
              ? "Yes"
              : c.sourceHandle === "false"
                ? "No"
                : undefined,
        },
        es,
      ),
    );
    setDirty(true);
    clearPlayback();
  };
  const addNode = (kind: Kind, position?: { x: number; y: number }) => {
    if (running) return;
    if (kind === "trigger" && nodes.some((n) => n.data.kind === "trigger")) {
      setMessage("Each workflow uses one webhook trigger.");
      return;
    }
    const bounds = wrapper.current?.getBoundingClientRect();
    const center = screenToFlowPosition({
      x: (bounds?.left || 0) + (bounds?.width || 700) / 2,
      y: (bounds?.top || 0) + (bounds?.height || 400) / 2,
    });
    if (!position) {
      while (
        nodes.some(
          (n) =>
            Math.abs(n.position.x - center.x) < 225 &&
            Math.abs(n.position.y - center.y) < 120,
        )
      )
        center.x += 260;
    }
    const next: FlowNode = {
      id: crypto.randomUUID(),
      type: "forge",
      selected: true,
      position: position || center,
      data: {
        kind,
        label: kinds.find((k) => k.kind === kind)!.label,
        config: { ...defaults[kind] },
      },
    };
    setNodes((ns) => [...ns.map(n=>({...n,selected:false})), next]);
    setSelected(next.id);
    setInspector(true);
    setDirty(true);
    clearPlayback();
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        fitView({ padding: 0.25, duration: quiet ? 0 : 250 }),
      ),
    );
  };
  const update = (key: string, value: string) => {
    clearPlayback();
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selected
          ? {
              ...n,
              data:
                key === "label"
                  ? { ...n.data, label: value }
                  : { ...n.data, config: { ...n.data.config, [key]: value } },
            }
          : n,
      ),
    );
    setDirty(true);
  };
  const run = () => {
    try {
      const w = snapshot();
      const result = simulate(w);
      saveWorkflow(w);
      setDirty(false);
      setNodes((ns) =>
        ns.map((n) => ({ ...n, data: { ...n.data, status: undefined } })),
      );
      setLastRun(null);
      setShowLog(true);
      setStep(0);
      setPlaybackPaused(false);
      setPlaybackSession((value) => value + 1);
      setPlan(result);
      setMessage("Running locally. No external services will be contacted.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  return (
    <div className="editor" data-playback-paused={running && playbackPaused}>
      <div className="editor-heading">
        <Link
          href="/workflows"
          className="icon-btn"
          aria-label="Back to workflows"
          onClick={() => {
            if (dirty) save();
          }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="editor-name">
          <input
            aria-label="Workflow name"
            value={name}
            maxLength={80}
            disabled={running}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />
          <span>
            <Status status={workflow.active ? "active" : "draft"} />
            <span className={`micro ${savedRecently && !dirty ? "saved-feedback" : ""}`}>
              {dirty ? "Unsaved changes" : savedRecently ? "Saved just now" : "Saved locally"}
            </span>
          </span>
        </div>
        <div className="editor-buttons">
          <button className="btn" onClick={save} disabled={running}>
            <Save size={15} />
            Save
          </button>
          <button className="btn primary" onClick={run} disabled={running}>
            <Play size={15} />
            {running ? playbackPaused ? "Paused" : "Running…" : "Run simulation"}
          </button>
        </div>
      </div>
      <div className="editor-notice">
        <Info size={14} />
        <span role="status">
          {running && playbackPaused ? "Playback paused. Step forward or resume when ready." : message ||
            "Drag a node onto the canvas, or click + to add. Connect ports to build your flow."}
        </span>
        <button className="text-btn" aria-expanded={inspector} aria-controls="workflow-inspector" onClick={() => setInspector(!inspector)}>
          {inspector ? "Hide" : "Show"} inspector
        </button>
      </div>
      {runView && <div className="playback-toolbar" role="group" aria-label="Execution playback controls">
        <div className="playback-now"><span className={`status ${running ? "running" : runView.status}`}><span />{running ? playbackPaused ? "Paused" : "Playing" : runView.status === "success" ? "Completed" : "Failed"}</span>
          <strong>{activeStep?.label || "Simulation finished"}</strong><span>{completedCount}/{runView.steps.length}</span>
        </div>
        <progress value={completedCount} max={runView.steps.length} aria-label="Execution progress" />
        <div className="playback-controls">
          {running && <><button className="btn" aria-label={playbackPaused ? "Resume execution" : "Pause execution"} onClick={() => setPlaybackPaused((value) => !value)}>{playbackPaused ? <Play size={14} /> : <Pause size={14} />}{playbackPaused ? "Resume" : "Pause"}</button>
            <button className="btn" onClick={() => { setPlaybackPaused(true); advance(); }}><SkipForward size={14} />Next step</button>
            <label className="playback-speed"><span className="sr-only">Playback speed</span><select aria-label="Playback speed" value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
          </>}
          <button className="btn playback-follow" aria-pressed={followActive} onClick={() => setFollowActive((value) => !value)}><Focus size={14} />Follow node</button>
        </div>
      </div>}
      <div className={`editor-workarea ${inspector ? "with-inspector" : ""}`}>
        <aside className="node-palette">
          <div className="palette-heading">
            <span className="eyebrow">NODE LIBRARY</span>
            <span className="micro">Drag or click to add</span>
          </div>
          {kinds.map((k) => (
            <button
              key={k.kind}
              draggable={!running}
              disabled={running}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/flowforge", k.kind);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => addNode(k.kind)}
              className="palette-node"
              data-node-kind={k.kind}
            >
              <span className="node-icon">
                <NodeIcon kind={k.kind} />
              </span>
              <span>
                <strong>{k.label}</strong>
                <small>{k.description}</small>
              </span>
              <Plus size={13} />
            </button>
          ))}
          <div className="palette-help">
            <span>CANVAS NOTES</span>
            <p>
              Drag nodes to arrange.
              <br />
              Connect an output to an input.
              <br />
              Select a connection and press Backspace to remove it.
            </p>
            <p>
              Conditions have Yes and No outputs. Branches are evaluated from
              the sample order amount.
            </p>
            <p>Active is an organizational label. All runs are manual.</p>
          </div>
        </aside>
        <div
          ref={wrapper}
          className="flow-canvas"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const kind = e.dataTransfer.getData(
              "application/flowforge",
            ) as Kind;
            if (kinds.some((k) => k.kind === kind))
              addNode(
                kind,
                screenToFlowPosition({ x: e.clientX, y: e.clientY }),
              );
          }}
        >
          <ReactFlow<FlowNode>
            nodes={nodes}
            edges={edges.map((edge) => {
              const phase = edgePhase(edge, runView?.steps, completedCount);
              return {
                ...edge,
                className: [edge.className, `playback-edge-${phase}`].filter(Boolean).join(" "),
                animated: phase === "running" && running && !playbackPaused && !quiet,
                style: { ...edge.style, stroke: phase === "failed" ? "#E39999" : nodeColors[nodes.find((node) => node.id === edge.source)?.data.kind || "transform"], strokeWidth: phase === "running" ? 2.5 : 1.5 },
              };
            })}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={validConnection}
            onNodeClick={(_, n) => {
              if (running) setFollowActive(false);
              setSelected(n.id);
              setInspector(true);
            }}
            nodesDraggable={!running}
            nodesConnectable={!running}
            elementsSelectable
            onMoveStart={(event) => { if (event && running) setFollowActive(false); }}
            deleteKeyCode={running ? null : ["Backspace", "Delete"]}
            onInit={(instance) => {
              if (window.matchMedia("(max-width:1100px)").matches) {
                void instance.setViewport({ x: 12, y: -75, zoom: 0.9 });
              } else {
                void instance.fitView({ padding: 0.2, minZoom: 0.65 });
              }
            }}
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.2}
            maxZoom={1.8}
            colorMode="dark"
            defaultEdgeOptions={{
              type: "smoothstep",
              style: { stroke: "#A8C7E6", strokeWidth: 1.5 },
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="var(--line)"
            />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) => nodeColors[node.data.kind as Kind] || nodeColors.transform}
              maskColor="rgba(8,9,11,.85)"
              pannable
              zoomable
            />
            <div className="canvas-badge">
              <span className="live-dot" />
              LOCAL CANVAS{" "}
              <span className="canvas-pan-hint">Drag background to pan</span>
              <span>
                {nodes.length} nodes / {edges.length} connections
              </span>
            </div>
          </ReactFlow>
        </div>
        {inspector && (
          <aside className="config-panel" id="workflow-inspector" aria-label="Workflow inspector" data-node-kind={node?.data.kind}>
            <div className="config-top">
              <span className="eyebrow">
                {node ? "NODE CONFIGURATION" : "WORKFLOW DETAILS"}
              </span>
              <button
                className="icon-btn"
                onClick={() => setInspector(false)}
                aria-label="Close inspector"
              >
                <X size={15} />
              </button>
            </div>
            <label className="field">
              Inspect node
              <select
                value={selected || ""}
                onChange={(e) => setSelected(e.target.value || null)}
              >
                <option value="">Workflow details</option>
                {nodes.map((n) => (
                  <option value={n.id} key={n.id}>
                    {n.data.label}
                  </option>
                ))}
              </select>
            </label>
            {node ? (
              <>
                <div className="config-title">
                  <span className="node-icon">
                    <NodeIcon kind={node.data.kind} />
                  </span>
                  <h2>{kinds.find((k) => k.kind === node.data.kind)?.label}</h2>
                </div>
                <fieldset disabled={running}>
                  <label className="field">
                    Node name
                    <input
                      value={node.data.label}
                      maxLength={80}
                      onChange={(e) => update("label", e.target.value)}
                    />
                  </label>
                  {Object.entries(node.data.config).map(([key, value]) => (
                    <label className="field" key={key}>
                      {(
                        {
                          amount: "Sample order amount",
                          email: "Sample email",
                          field: "Output field",
                          value: "Output value",
                          threshold: "Minimum order amount",
                          url: "Request URL (simulated)",
                          method: "Method",
                          fail: "Simulate a failure",
                          channel: "Destination channel",
                          message: "Message",
                        } as Record<string, string>
                      )[key] || key}
                      {key === "fail" ? (
                        <select
                          value={value}
                          onChange={(e) => update(key, e.target.value)}
                        >
                          <option value="false">No · return 200</option>
                          <option value="true">Yes · return 503</option>
                        </select>
                      ) : key === "method" ? (
                        <select
                          value={value}
                          onChange={(e) => update(key, e.target.value)}
                        >
                          {["GET", "POST", "PUT", "PATCH", "DELETE"].map(
                            (m) => (
                              <option key={m}>{m}</option>
                            ),
                          )}
                        </select>
                      ) : key === "message" ? (
                        <textarea
                          value={value}
                          onChange={(e) => update(key, e.target.value)}
                          rows={3}
                        />
                      ) : (
                        <input
                          type={
                            ["amount", "threshold"].includes(key)
                              ? "number"
                              : "text"
                          }
                          value={value}
                          onChange={(e) => update(key, e.target.value)}
                          maxLength={300}
                        />
                      )}
                    </label>
                  ))}
                  <label className="field">
                    Connect to
                    <select
                      value={connectionTarget}
                      onChange={(e) => setConnectionTarget(e.target.value)}
                    >
                      <option value="">Choose a destination</option>
                      {nodes
                        .filter(
                          (n) => n.id !== node.id && n.data.kind !== "trigger",
                        )
                        .map((n) => (
                          <option value={n.id} key={n.id}>
                            {n.data.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  {node.data.kind === "condition" && (
                    <label className="field">
                      Branch output
                      <select
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </label>
                  )}
                  <button
                    className="btn data-btn"
                    disabled={!connectionTarget}
                    onClick={() => {
                      onConnect({
                        source: node.id,
                        target: connectionTarget,
                        sourceHandle:
                          node.data.kind === "condition" ? branch : null,
                        targetHandle: null,
                      });
                      setConnectionTarget("");
                    }}
                  >
                    Connect nodes <Plus size={13} />
                  </button>
                  {edges
                    .filter((e) => e.source === node.id)
                    .map((e) => (
                      <div className="connection-row" key={e.id}>
                        <span>
                          {e.label || "Next"} →{" "}
                          {nodes.find((n) => n.id === e.target)?.data.label}
                        </span>
                        <button
                          className="icon-btn"
                          aria-label={`Remove connection to ${nodes.find((n) => n.id === e.target)?.data.label}`}
                          onClick={() => {
                            setEdges((es) => es.filter((x) => x.id !== e.id));
                            setDirty(true);
                            clearPlayback();
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                </fieldset>
                {node.data.kind === "condition" && (
                  <p className="config-hint">
                    Yes: amount ≥ threshold.
                    <br />
                    No: amount &lt; threshold.
                    <br />
                    Only the selected branch runs.
                  </p>
                )}
                <div className="config-hint">
                  <Info size={14} />
                  This node runs in a local simulation. No data leaves your
                  browser.
                </div>
                <button
                  className="btn danger delete-node"
                  disabled={running}
                  onClick={() => {
                    setNodes((ns) => ns.filter((n) => n.id !== selected));
                    setEdges((es) =>
                      es.filter(
                        (e) => e.source !== selected && e.target !== selected,
                      ),
                    );
                    setSelected(null);
                    setDirty(true);
                    clearPlayback();
                  }}
                >
                  <Trash2 size={14} />
                  Remove node
                </button>
                <button className="text-btn" onClick={() => setSelected(null)}>
                  Show workflow details <ChevronRight size={13} />
                </button>
              </>
            ) : (
              <>
                <h2 className="config-workflow-title">Make it your own.</h2>
                <p className="muted small">
                  Select a node to change its configuration.
                </p>
                <label className="field">
                  Description
                  <textarea
                    disabled={running}
                    value={description}
                    rows={3}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setDirty(true);
                    }}
                    maxLength={200}
                  />
                </label>
                <div className="config-hint">
                  <Check size={14} />
                  {graphError(nodes, edges) ||
                    "Your graph is ready for a simulation."}
                </div>
                <button
                  className="btn"
                  onClick={() =>
                    fitView({ padding: 0.25, duration: quiet ? 0 : 350 })
                  }
                >
                  <RotateCcw size={14} />
                  Fit canvas
                </button>
              </>
            )}
          </aside>
        )}
      </div>
      <section className={`execution-console ${runView ? "has-playback" : ""} ${showLog ? "" : "collapsed"}`}>
        <div className="console-heading">
          <span>
            <Square size={13} /> EXECUTION OUTPUT{" "}
            <span className="micro">
              {running
                ? `${step} / ${plan.steps.length} steps`
                : lastRun
                  ? `${lastRun.duration}ms · ${lastRun.status}`
                  : "Ready when you are"}
            </span>
          </span>
          <button className="text-btn" onClick={() => setShowLog(!showLog)}>
            {showLog ? "Collapse" : "Expand"}
          </button>
        </div>
        {showLog && (
          <div className="console-body">
            {runView ? (
              <ExecutionPlayback key={playbackSession} steps={runView.steps} completed={completedCount} running={running} paused={playbackPaused} />
            ) : (
              <p className="console-empty">Run your workflow to inspect the result of every step. Conditions, response codes, and durations are simulated.</p>
            )}
            {lastRun && (
              <Link
                href={`/executions?run=${lastRun.id}`}
                className="text-link console-link"
              >
                Open full execution <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
