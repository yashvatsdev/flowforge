"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Context, type Store } from "@/lib/store";
import { starter, seeds } from "@/lib/seeds";
import { defaults, type Workflow, type Execution } from "@/lib/engine";
import { readWorkspace, validState, STORAGE_KEY, type State } from "@/lib/workspace";
import { workspaceEnvelope } from "@/lib/persistence";
import { RevisionWriter, SaveError, type SyncStatus } from "@/lib/revision-writer";
import { Dialog } from "./dialog";
export type Account = { id: string; name: string; email: string; avatar: string };
function download(raw: string, name = "flowforge-workspace.json") {
  const url = URL.createObjectURL(new Blob([raw], { type: "application/json" })); const a = document.createElement("a"); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function jsonRequest(url: string, data?: unknown) {
  const response = await fetch(url, { method: data ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(30000), headers: data ? { "Content-Type":"application/json" } : undefined, body: data ? JSON.stringify(data) : undefined });
  const value = await response.json();
  if (!response.ok) throw new SaveError(value.error || "Workspace unavailable.",response.status);
  return value;
}
export function CloudProvider({ user, children, executionEnabled = false }: { user: Account; children: React.ReactNode; executionEnabled?: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const current = useRef<State | null>(null);
  const [onboarding, setOnboarding] = useState<string[]>([]);
  const [status,setStatus] = useState<SyncStatus>("saved");
  const [notice,setNotice] = useState("");
  const [loadError,setLoadError] = useState("");
  const [localRaw,setLocalRaw] = useState<string | null>(null);
  const [draftRaw,setDraftRaw] = useState<string | null>(null);
  const actions = useRef(new Set<string>());
  const [confirmRestore,setConfirmRestore] = useState(false);
  const [confirmImport,setConfirmImport] = useState(false);
  const draftKey = `flowforge:draft:${user.id}`;
  const [writer] = useState(() => new RevisionWriter(async (value, revision, action) => {
    const response = await fetch("/api/workspace", { method:"PUT", signal: AbortSignal.timeout(30000), headers:{"Content-Type":"application/json"}, body: JSON.stringify({state:value,revision,action}) });
    const result = await response.json();
    if (!response.ok) throw new SaveError(result.error || "Save failed",response.status);
    if (!Number.isSafeInteger(result.revision)) throw new SaveError("Invalid save acknowledgement.");
    return result.revision;
  }));
  const accept = useCallback((value: unknown) => {
    if (!workspaceEnvelope(value)) throw new SaveError("Server workspace failed validation.");
    writer.initialize(value.revision); current.current=value.state; setState(value.state); setOnboarding(value.onboarding); setLoadError("");
  },[writer]);
  const load = useCallback(async () => {
    try { accept(await jsonRequest("/api/workspace")); } catch(e) { setLoadError((e as Error).message); }
  },[accept]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the authenticated external workspace on mount.
  useEffect(() => { void load(); },[load]);
  useEffect(() => {
    return writer.subscribe((next,message) => {
      setStatus(next); setNotice(message);
      if (next === "saved") { const acknowledged=[...actions.current]; actions.current.clear(); setOnboarding(old=>[...new Set([...old,...acknowledged])]); try { localStorage.removeItem(draftKey); } catch {} }
    });
  },[writer,draftKey]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only recovery data after hydration.
    try { setLocalRaw(localStorage.getItem(STORAGE_KEY)); setDraftRaw(localStorage.getItem(draftKey)); } catch { setNotice("Browser recovery storage is unavailable. Export unsaved work before leaving."); }
  },[draftKey]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if(writer.tasks.length) e.preventDefault(); };
    window.addEventListener("beforeunload",warn); return ()=>window.removeEventListener("beforeunload",warn);
  },[writer]);
  const update = useCallback((change: (s: State)=>State, action?: string) => {
    if (!current.current) return Promise.reject(new SaveError("Workspace is not ready."));
    const next = change(current.current); current.current=next; setState(next);
    try { localStorage.setItem(draftKey,JSON.stringify(next)); } catch { setNotice("Could not preserve the local draft. Export your work before leaving."); }
    // Validation is performed by the server; invalid edits remain recoverable locally.
    const pending=writer.enqueue(next,action);
    if (action) actions.current.add(action);
    return pending;
  },[writer,draftKey]);
  const saveWorkflow=useCallback((w: Workflow) => update(s=>({...s,workflows:s.workflows.some(x=>x.id===w.id)?s.workflows.map(x=>x.id===w.id?{...w,updatedAt:new Date().toISOString()}:x):[...s.workflows,w]}),"edited"),[update]);
  const safely = (promise: Promise<unknown>) => { void promise.catch(()=>{}); };
  const importData = async (raw: string) => {
    const document = readWorkspace(raw);
    if(document.status!=="valid") { setNotice("This document is invalid. The original data is preserved."); return false; }
    if(writer.tasks.length || writer.status!=="saved") { setNotice("Save or resolve pending changes before importing."); return false; }
    try { accept(await jsonRequest("/api/workspace/import",{state:document.state})); setLocalRaw(null); return true; }
    catch(e) { setNotice((e as Error).message); return false; }
  };
  if (!state) return <main id="main" className="workspace-main"><section className="panel settings-panel"><h1>{loadError?"Your workspace could not open":"Opening your workspace…"}</h1>{loadError&&<><p role="alert">{loadError}</p><button className="btn" onClick={()=>void load()}>Retry connection</button><form action="/auth/signout" method="post"><button className="text-btn">Sign out</button></form></>}</section></main>;
  const value: Store = {
    ...state, ready:true, cloud:true, syncStatus:status, notice, onboarding, account:user, executionEnabled, workspaceRevision:writer.revision,
    saveWorkflow,
    addWorkflow(name) { const id=crypto.randomUUID(); const w=starter(id,name); w.active=false; w.nodes=[{id:"n0",type:"forge",position:{x:80,y:150},data:{kind:"trigger",label:"Webhook received",config:{...defaults.trigger}}}]; w.edges=[]; safely(saveWorkflow(w)); return id; },
    duplicateWorkflow(id) { const id2=crypto.randomUUID();const w=current.current!.workflows.find(w=>w.id===id)!;safely(saveWorkflow({...structuredClone(w),id:id2,name:`${w.name} (copy)`,active:false}));return id2; },
    deleteWorkflow(id) { safely(update(s=>({...s,workflows:s.workflows.filter(w=>w.id!==id)}),"edited")); },
    record(e) { const entry:Execution={...e,id:crypto.randomUUID(),time:new Date().toISOString(),sample:true};safely(update(s=>({...s,executions:[entry,...s.executions].slice(0,200)}),"simulated"));return entry; },
    saveSettings(settings) { safely(update(s=>({...s,settings}))); },
    reset() { safely(update(s=>({...s,workflows:seeds(),executions:[]}))); },
    clearExecutions() { safely(update(s=>({...s,executions:[]}))); },
    exportData() { download(JSON.stringify(current.current,null,2)); }, importData,
    markAction(action) { if (!onboarding.includes(action) && !actions.current.has(action)) safely(update(s=>s,action)); },
  };
  return <Context.Provider value={value}>
    <div className="cloud-status" role="status"><span>{status==="saved"?"Saved to workspace":status==="saving"?"Saving…":status==="conflict"?"Save conflict":"Changes need attention"}</span>{notice&&<p>{notice}</p>}
      {(status==="error"||status==="conflict")&&<><button className="text-btn" onClick={()=>download(JSON.stringify(current.current,null,2),"flowforge-unsaved-draft.json")}>Export unsaved draft</button>{status!=="conflict"&&<button className="btn" onClick={()=>void writer.flush()}>Retry save</button>}<button className="text-btn" onClick={()=>{download(JSON.stringify(current.current,null,2),"flowforge-unsaved-draft.json");try{localStorage.removeItem(draftKey);}catch{}window.location.reload();}}>Export and reload server version</button></>}
    </div>
    {localRaw!==null&&<div className="cloud-status"><p>A browser-local workspace is available. Importing adds a copy; the original stays untouched.</p><button className="text-btn" onClick={()=>download(localRaw,"flowforge-local-recovery.json")}>Export original</button><button className="btn" onClick={()=>setConfirmImport(true)}>Review local import</button><button className="text-btn" onClick={()=>setLocalRaw(null)}>Not now</button></div>}
    {draftRaw&&<div className="cloud-status"><p>An unsaved draft from this account is available. Choose how to recover it before editing.</p><button className="text-btn" onClick={()=>download(draftRaw,"flowforge-unsaved-draft.json")}>Export recovered draft</button><button className="text-btn" onClick={()=>setConfirmRestore(true)}>Review draft recovery</button><button className="text-btn" onClick={()=>{download(draftRaw,"flowforge-unsaved-draft.json");try{localStorage.removeItem(draftKey);}catch{}setDraftRaw(null);}}>Export draft and keep server version</button></div>}
    {!draftRaw && children}
    {confirmRestore && <Dialog title="Restore your unsaved draft?" onClose={()=>setConfirmRestore(false)}><p className="muted">This replaces the current cloud workspace with your recovered draft, using the latest loaded revision. Export the current server version first if you want to keep both.</p><div className="modal-actions"><button className="btn" onClick={()=>download(JSON.stringify(current.current,null,2))}>Export server version</button><button className="btn" onClick={()=>setConfirmRestore(false)}>Cancel</button><button className="btn primary" onClick={()=>{const parsed=readWorkspace(draftRaw);if(parsed.status==="valid"&&validState(parsed.state)){safely(update(()=>parsed.state));setDraftRaw(null);setConfirmRestore(false);}else setNotice("The recovered draft is invalid. Export it for manual recovery.");}}>Confirm restore</button></div></Dialog>}
    {confirmImport&&<Dialog title="Add your local workspace?" onClose={()=>setConfirmImport(false)}><p className="muted">This adds copies of local workflows and simulation history without replacing your cloud preferences or deleting local data. Repeating the same import will not create duplicates.</p><div className="modal-actions"><button className="btn" onClick={()=>setConfirmImport(false)}>Cancel</button><button className="btn primary" onClick={async()=>{if(await importData(localRaw!))setConfirmImport(false);}}>Confirm import</button></div></Dialog>}
  </Context.Provider>;
}
