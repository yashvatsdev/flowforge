"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Activity,
  Search,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Status, Empty } from "./shared";
import { Dialog } from "./dialog";
export function Executions() {
  const { executions, workflows } = useStore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const params = useSearchParams();
  const router = useRouter();
  const selected = executions.find((e) => e.id === params.get("run"));
  const filtered = executions.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) &&
      (status === "all" || e.status === status),
  );
  const pages = Math.ceil(filtered.length / 10);
  const close = () => router.replace("/executions", { scroll: false });
  const exportRun = () => {
    if (!selected) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(selected, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `flowforge-run-${selected.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EVERY STEP TELLS A STORY.</span>
          <h1>
            Executions<span className="accent">.</span>
          </h1>
          <p>Follow the data. Find the details. Keep things moving.</p>
        </div>
        <span className="period-tag">{executions.length} simulated runs</span>
      </div>
      <section className="panel">
        <div className="list-tools">
          <div className="tabs" role="group" aria-label="Execution status">
            {["all", "success", "failed"].map((s) => (
              <button
                key={s}
                aria-pressed={s === status}
                className={s === status ? "selected" : ""}
                onClick={() => {
                  setStatus(s);
                  setPage(0);
                }}
              >
                {s === "all"
                  ? "All runs"
                  : s === "success"
                    ? "Completed"
                    : "Failed"}
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search executions"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search executions…"
            />
          </label>
        </div>
        {!filtered.length ? (
          <Empty
            title={
              executions.length
                ? "No matching executions."
                : "Your first run starts here."
            }
            body={
              executions.length
                ? "Try another search or status filter."
                : "Run a workflow from the canvas. Every step and its output will appear here."
            }
            href="/workflows"
            label="Open workflows"
          />
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>WORKFLOW / RUN</th>
                    <th>STATUS</th>
                    <th>STARTED</th>
                    <th>DURATION</th>
                    <th>STEPS</th>
                    <th>
                      <span className="sr-only">Inspect</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(page * 10, page * 10 + 10).map((e) => (
                    <tr key={e.id}>
                      <td>
                        <button
                          className="workflow-name text-left"
                          onClick={() =>
                            router.push(`/executions?run=${e.id}`, {
                              scroll: false,
                            })
                          }
                        >
                          <span className="table-icon">
                            <Activity size={18} />
                          </span>
                          <span>
                            <strong>{e.name}</strong>
                            <small className="mono">{e.id.slice(0, 8)}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <Status status={e.status} />
                      </td>
                      <td className="small muted">
                        {new Date(e.time).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="mono small">{e.duration}ms</td>
                      <td className="mono small">{e.steps.length}</td>
                      <td>
                        <button
                          className="icon-btn"
                          aria-label={`Inspect run ${e.id.slice(0, 8)}`}
                          onClick={() =>
                            router.push(`/executions?run=${e.id}`, {
                              scroll: false,
                            })
                          }
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {filtered.length} runs · page {page + 1} of {pages}
              </span>
              <div>
                <button
                  className="icon-btn"
                  aria-label="Previous page"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="icon-btn"
                  aria-label="Next page"
                  disabled={page >= pages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      <p className="page-footnote">
        Run history stores up to 200 local executions. Durations represent
        deterministic simulated latency.
      </p>
      {selected && (
        <Dialog title="Execution details" onClose={close}>
          <div className="run-detail-heading">
            <h3>{selected.name}</h3>
            <Status status={selected.status} />
            <p className="micro">
              {selected.id}
              <br />
              {new Date(selected.time).toLocaleString()} · {selected.duration}ms
            </p>
          </div>
          <div className="detail-steps">
            {selected.steps.map((s, i) => (
              <details
                key={i}
                className="detail-step"
                open={s.status === "failed"}
              >
                <summary>
                  <span className="step-number">{i + 1}</span>
                  <strong>{s.label}</strong>
                  <Status status={s.status} />
                  <span className="mono small">{s.duration}ms</span>
                </summary>
                <p>{s.message}</p>
                <span className="eyebrow">OUTPUT PAYLOAD</span>
                <pre>{JSON.stringify(s.output, null, 2)}</pre>
              </details>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={exportRun}>
              <Download size={15} />
              Export run
            </button>
            {workflows.some((w) => w.id === selected.workflowId) && (
              <Link
                className="btn primary"
                href={"/workflows/" + selected.workflowId}
              >
                Open workflow <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
