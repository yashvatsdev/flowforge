"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity } from "lucide-react";
import { useStore } from "@/lib/store";
import { executionRequest, manualInput, StartIntent } from "@/lib/execution/browser-client";
import { duration, failureExplanation, redactValue, runLabel, runStates, terminalRun, type RunDetails, type RunPage, type RunStep } from "@/lib/execution/presentation";
import { useExecutionResource } from "@/lib/execution/use-resource";
import { Dialog } from "./dialog";

const activePage = (page: RunPage) => page.runs.some(run => !terminalRun(run.state));
const activeDetail = (value: { run: RunDetails; steps: RunStep[] }) => !terminalRun(value.run.state);
const timestamp = (value: string | null) => value ? new Date(value).toLocaleString() : "Not started";
function RunStatus({ state }: { state: string }) { return <span className={`status real-status ${state}`}>{runLabel(state)}</span>; }
function Feedback({ error, status, retry }: { error?: string; status?: number; retry: () => void }) {
  return error ? <div className="execution-feedback" role="alert"><p>{error}</p>{status === 401 ? <Link href="/login">Sign in again</Link> : <button className="btn" onClick={retry}>Retry</button>}</div> : null;
}
function JsonValue({ value }: { value: unknown }) { return <pre className="execution-json">{JSON.stringify(redactValue(value), null, 2)}</pre>; }

export function RunWorkflowButton({ workflowId, blocked }: { workflowId: string; blocked: boolean }) {
  const { cloud, executionEnabled, workspaceRevision } = useStore();
  const [open, setOpen] = useState(false);
  const enabled = cloud && executionEnabled && workspaceRevision !== undefined;
  return <div className="real-start"><button className="btn" disabled={!enabled || blocked} onClick={() => setOpen(true)}>Run Workflow</button>
    {!enabled && <small>Real execution disabled. Use simulation.</small>}
    {enabled && blocked && <small>Save changes before a real run.</small>}
    {open && <StartDialog workflowId={workflowId} revision={workspaceRevision!} onClose={() => setOpen(false)} />}
  </div>;
}
function StartDialog({ workflowId, revision, onClose }: { workflowId: string; revision: number; onClose: () => void }) {
  const router = useRouter();
  const [raw, setRaw] = useState("{}");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [hasIntent, setHasIntent] = useState(false);
  const intent = useRef<StartIntent | null>(null), busy = useRef(false);
  const submit = async () => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      intent.current ??= new StartIntent(revision, manualInput(raw));
      setHasIntent(true);
      const result = await intent.current.send(workflowId);
      router.push(`/executions?run=${encodeURIComponent(result.runId)}`);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start execution."); }
    finally { busy.current = false; setPending(false); }
  };
  return <Dialog title="Run saved workflow" onClose={() => { if (!busy.current && (!intent.current || confirm("A request may already have created a run. Check real execution history before starting again. Close this request?"))) onClose(); }}>
    <p>This starts a persisted real run from saved workspace revision {revision}. Simulation remains separate.</p>
    <label className="execution-input">Manual input (JSON object, up to 64 KiB)<textarea rows={7} value={raw} disabled={hasIntent || pending} onChange={e => setRaw(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    {hasIntent && error && <p>Retry sends the same idempotency key and saved input. Check history before creating another request.</p>}
    <div className="modal-actions"><button className="btn primary" disabled={pending} onClick={submit}>{pending ? "Starting…" : hasIntent ? "Retry same request" : "Start real run"}</button></div>
  </Dialog>;
}

export function RecentRealRuns() {
  const { workflows } = useStore();
  const load = useCallback((signal: AbortSignal) => executionRequest<RunPage>("/api/executions", {}, signal), []);
  const resource = useExecutionResource("recent-runs", load, activePage);
  return <section className="panel recent-panel"><div className="panel-heading"><h2>Recent real executions</h2><Link className="text-link" href="/executions">All runs →</Link></div>
    {resource.loading && <p role="status">Loading real runs…</p>}
    <Feedback error={resource.error} status={resource.status} retry={resource.refresh} />
    {resource.data?.runs.slice(0, 3).map(run => <Link className="recent-run" key={run.id} href={`/executions?run=${run.id}`}><span className="table-icon"><Activity size={16} /></span><span><strong>{workflows.find(w => w.id === run.workflow_id)?.name ?? "Saved workflow"}</strong><small>{timestamp(run.created_at)} · {duration(run)}</small></span><RunStatus state={run.state} /></Link>)}
    {resource.data?.runs.length === 0 && <p className="recent-empty">No persisted real runs yet. Local simulation is available.</p>}
    {resource.paused && <button className="btn" onClick={resource.refresh}>Resume refresh</button>}
  </section>;
}

export function RealExecutions() {
  const { workflows, executionEnabled } = useStore();
  const router = useRouter(), params = useSearchParams();
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [search, setSearch] = useState(""), [status, setStatus] = useState("all");
  const cursor = cursors.at(-1) ?? null;
  const load = useCallback((signal: AbortSignal) => executionRequest<RunPage>(`/api/executions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, {}, signal), [cursor]);
  const poll = useCallback((value: RunPage) => !cursor && activePage(value), [cursor]);
  const resource = useExecutionResource(`history:${cursor}`, load, poll);
  const name = (id: string) => workflows.find(w => w.id === id)?.name ?? "Saved workflow (unavailable)";
  const runs = resource.data?.runs.filter(run => (status === "all" || status === run.state) && `${name(run.workflow_id)} ${run.id}`.toLowerCase().includes(search.toLowerCase()));
  const selected = params.get("run");
  return <>
    <div className="page-heading"><div><h1>Executions</h1><p>Persisted real workflow runs. Local simulations have their own history.</p></div><button className="btn" onClick={resource.refresh}>Refresh</button></div>
    {!executionEnabled && <p className="execution-feedback">Real execution starts are disabled in this environment. Existing run history remains available when the database supports it.</p>}
    <div className="list-tools"><label>Filter this page <input aria-label="Search real runs" value={search} placeholder="Workflow or run ID" onChange={e => setSearch(e.target.value)} /></label><select aria-label="Real run status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{runStates.map(s => <option key={s} value={s}>{runLabel(s)}</option>)}</select></div>
    {resource.loading && <p role="status">Loading real runs…</p>}<Feedback error={resource.error} status={resource.status} retry={resource.refresh} />
    {runs && <section className="panel table-scroll"><table className="data-table"><thead><tr><th>Workflow</th><th>Status</th><th>Requested</th><th>Started</th><th>Duration</th><th>Details</th></tr></thead><tbody>{runs.map(run => <tr key={run.id}><td>{name(run.workflow_id)}</td><td><RunStatus state={run.state} /></td><td>{timestamp(run.created_at)}</td><td>{timestamp(run.started_at)}</td><td>{duration(run)}</td><td><Link href={`/executions?run=${run.id}`} aria-label={`View run ${run.id}`}>View run →</Link></td></tr>)}</tbody></table>{!runs.length && <p className="recent-empty">{resource.data?.runs.length ? "No matching runs on this page." : "No real runs yet. Start a saved supported workflow when execution is enabled."}</p>}</section>}
    <div className="pagination"><button className="btn" disabled={cursors.length === 1 || resource.loading} onClick={() => setCursors(v => v.slice(0, -1))}>Previous</button><span>Page {cursors.length} · up to 25 runs</span><button className="btn" disabled={!resource.data?.nextCursor || resource.loading} onClick={() => { const next = resource.data?.nextCursor; if (next) setCursors(v => [...v, next]); }}>Next</button></div>
    {resource.paused && <p>Automatic refresh paused after ten minutes. <button className="text-btn" onClick={resource.refresh}>Resume refresh</button></p>}
    {selected && <ExecutionDetails key={selected} id={selected} changed={resource.refresh} close={() => router.replace("/executions", { scroll: false })} />}
  </>;
}
function ExecutionDetails({ id, close, changed }: { id: string; close: () => void; changed: () => void }) {
  const [pending, setPending] = useState(false), [message, setMessage] = useState("");
  const busy = useRef(false);
  const load = useCallback(async (signal: AbortSignal) => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid run identifier.");
    const [run, steps] = await Promise.all([
      executionRequest<RunDetails>(`/api/executions/${id}`, {}, signal),
      executionRequest<RunStep[]>(`/api/executions/${id}/steps`, {}, signal),
    ]);
    return { run, steps };
  }, [id]);
  const resource = useExecutionResource(id, load, activeDetail);
  const cancel = async () => {
    if (busy.current) return; busy.current = true; setPending(true); setMessage("");
    try { const result = await executionRequest<{ state: string }>(`/api/executions/${id}/cancel`, { method: "POST" }); setMessage(runLabel(result.state)); resource.refresh(); changed(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Cancellation unavailable."); }
    finally { busy.current = false; setPending(false); }
  };
  const run = resource.data?.run;
  return <Dialog title="Real execution details" onClose={close}>
    {resource.loading && <p role="status">Loading execution…</p>}<Feedback error={resource.error} status={resource.status} retry={resource.refresh} />
    {run && <><h3>{run.snapshot.name}</h3><p className="execution-id">Run {run.id} · workspace revision {run.workspace_revision}</p><RunStatus state={run.state} /><p>Requested {timestamp(run.created_at)}<br />Started {timestamp(run.started_at)}<br />Finished {timestamp(run.finished_at)}<br />Duration: {duration(run)}</p>
      {run.error_code && <p role="alert">{failureExplanation(run.error_code)}</p>}
      <details><summary>Manual input (sensitive fields redacted)</summary><JsonValue value={run.manual_input} /></details>
      <h3>Node history</h3>{resource.data!.steps.length === 0 && <p>No node attempts recorded yet.</p>}
      {resource.data!.steps.map(step => <article className="detail-step" key={`${step.node_id}:${step.attempt}`}><h4>{run.snapshot.nodes.find(n => n.id === step.node_id)?.data.label ?? "Workflow node"} · attempt {step.attempt}</h4><RunStatus state={step.state} /><p>{timestamp(step.started_at)} → {timestamp(step.finished_at)}</p>{step.error_code && <p>{failureExplanation(step.error_code)}</p>}<details><summary>Output (sensitive fields redacted)</summary><JsonValue value={step.output} /></details></article>)}
      {!terminalRun(run.state) && <button className="btn" disabled={pending || run.state === "cancellation_requested"} onClick={cancel}>{pending ? "Requesting cancellation…" : run.state === "cancellation_requested" ? "Cancellation requested" : "Cancel execution"}</button>}
    </>}
    {message && <p role="status">{message}</p>}{resource.paused && <button className="btn" onClick={resource.refresh}>Resume refresh</button>}
  </Dialog>;
}
