"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Dialog } from "../components/dialog";
import { readWorkspace, persistWorkspace, preserveRecovery, STORAGE_KEY, type State, type Settings, type WorkspaceDocument } from "./workspace";
export { validState } from "./workspace";
import {
  defaults,
  simulate,
  type Workflow,
  type Execution,
  type FlowNode,
} from "./engine";
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
const initial: State = {
  version: 1,
  workflows: seeds(),
  executions: [],
  settings: {
    name: "Alex Morgan",
    email: "alex@example.com",
    workspace: "Personal workspace",
    reduceMotion: false,
  },
};
function download(raw: string, filename: string) {
  const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type Store = State & {
  ready: boolean;
  notice: string;
  saveWorkflow: (w: Workflow) => void;
  deleteWorkflow: (id: string) => void;
  duplicateWorkflow: (id: string) => string;
  addWorkflow: (name: string) => string;
  record: (e: Omit<Execution, "id" | "time">) => Execution;
  saveSettings: (s: Settings) => void;
  reset: () => void;
  exportData: () => void;
  importData: (text: string) => boolean;
  clearExecutions: () => void;
};
const Context = createContext<Store | null>(null);
export function Provider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [recovery, setRecovery] = useState<WorkspaceDocument | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [confirmRecoveryReset, setConfirmRecoveryReset] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const document = readWorkspace(raw);
      if (document.status === "valid") setState(document.state);
      else if (document.status === "recovery") setRecovery(document);
    } catch {
      // A failed read must never authorize a later write over unread data.
      setStorageBlocked(true);
      setNotice("Browser storage could not be read. Changes will last for this session; export them before leaving.");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !storageBlocked) {
      try {
        persistWorkspace(localStorage, state, recovery);
      } catch {
        setNotice(
          "Storage is full or unavailable. Export your workspace to keep changes.",
        );
      }
    }
  }, [state, ready, recovery, storageBlocked]);
  const saveWorkflow = useCallback(
    (w: Workflow) =>
      setState((s) => ({
        ...s,
        workflows: s.workflows.some((x) => x.id === w.id)
          ? s.workflows.map((x) =>
              x.id === w.id ? { ...w, updatedAt: new Date().toISOString() } : x,
            )
          : [...s.workflows, w],
      })),
    [],
  );
  const record = useCallback((e: Omit<Execution, "id" | "time">) => {
    const entry = {
      ...e,
      id: crypto.randomUUID(),
      time: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      executions: [entry, ...s.executions].slice(0, 200),
    }));
    return entry;
  }, []);
  const addWorkflow = (name: string) => {
    const id = crypto.randomUUID();
    saveWorkflow({
      ...starter(id, name),
      active: false,
      nodes: [
        {
          id: "n0",
          type: "forge",
          position: { x: 80, y: 150 },
          data: {
            kind: "trigger",
            label: "Webhook received",
            config: { ...defaults.trigger },
          },
        },
      ],
      edges: [],
      description: "Your next useful automation starts here.",
    });
    return id;
  };
  const duplicateWorkflow = (id: string) => {
    const copy = state.workflows.find((w) => w.id === id)!;
    const newId = crypto.randomUUID();
    saveWorkflow({
      ...structuredClone(copy),
      id: newId,
      name: `${copy.name} (copy)`,
      active: false,
    });
    return newId;
  };
  const value: Store = {
    ...state,
    ready,
    notice,
    saveWorkflow,
    record,
    addWorkflow,
    duplicateWorkflow,
    deleteWorkflow: (id) =>
      setState((s) => ({
        ...s,
        workflows: s.workflows.filter((w) => w.id !== id),
      })),
    saveSettings: (settings) => setState((s) => ({ ...s, settings })),
    reset: () => setState(structuredClone(initial)),
    clearExecutions: () => setState((s) => ({ ...s, executions: [] })),
    exportData: () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "flowforge-workspace.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    importData: (text) => {
      try {
        const document = readWorkspace(text);
        if (document.status !== "valid") return false;
        setState(document.state);
        return true;
      } catch {
        return false;
      }
    },
  };
  const recoveryScreen = recovery?.status === "recovery" ? (
    <main id="main" className="workspace-main">
      <section className="panel settings-panel" aria-labelledby="recovery-title">
        <h1 id="recovery-title" tabIndex={-1}>Your workspace needs recovery</h1>
        <p role="alert">{recovery.reason}</p>
        <p className="muted">Your original saved document is preserved. Editing is paused to prevent it from being overwritten. Export it before resetting or opening it with a compatible version.</p>
        <button className="btn primary" onClick={() => download(recovery.raw, "flowforge-recovery.json")}>Export preserved data</button>
        <button className="btn danger" onClick={() => setConfirmRecoveryReset(true)}>Reset workspace</button>
        {notice && <p role="alert">{notice}</p>}
        {confirmRecoveryReset && <Dialog title="Reset the preserved workspace?" onClose={() => setConfirmRecoveryReset(false)}>
          <p className="muted">This replaces the saved workspace with starters. Export your preserved data first. A recovery copy will also be kept in this browser.</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirmRecoveryReset(false)}>Cancel</button>
            <button className="btn danger" onClick={() => {
              try {
                preserveRecovery(localStorage, recovery.raw);
                setState(structuredClone(initial));
                setRecovery(null);
                setNotice("Starter workspace restored. The original document remains in browser storage under flowforge:recovery.");
                setConfirmRecoveryReset(false);
              } catch { setNotice("The recovery copy could not be saved. Export your data and free browser storage before resetting."); }
            }}>Confirm reset</button>
          </div>
        </Dialog>}
      </section>
    </main>
  ) : children;
  return <Context.Provider value={value}>{recoveryScreen}</Context.Provider>;
}
export function useStore() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Missing workspace provider");
  return ctx;
}
export { simulate };
