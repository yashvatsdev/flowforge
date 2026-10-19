"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ArrowUpRight,
  Copy,
  Trash2,
  Workflow as WorkflowIcon,
  Play,
  Pause,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Status, Empty } from "./shared";
import { Dialog } from "./dialog";
export function NewWorkflowButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { addWorkflow } = useStore();
  const router = useRouter();
  return (
    <>
      <button className="btn primary" onClick={() => setOpen(true)}>
        <Plus size={16} />
        New workflow
      </button>
      {open && (
        <Dialog title="A new flow starts here." onClose={() => setOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim())
                router.push("/workflows/" + addWorkflow(name.trim()));
            }}
          >
            <p className="muted">
              Give your automation a name. You can change it later.
            </p>
            <label className="field">
              Workflow name
              <input
                autoFocus
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Customer onboarding"
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className="btn primary">
                Create workflow <ArrowUpRight size={15} />
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
export function WorkflowList({ compact = false }: { compact?: boolean }) {
  const { workflows, saveWorkflow, deleteWorkflow, duplicateWorkflow } =
    useStore();
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(25);
  const [filter, setFilter] = useState("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const list = workflows.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || (filter === "active" ? w.active : !w.active)),
  );
  return (
    <div className="workflow-section">
      {!compact && (
        <div className="list-tools">
          <div className="tabs" role="group" aria-label="Workflow status">
            {["all", "active", "draft"].map((f) => (
              <button
                aria-pressed={filter === f}
                className={filter === f ? "selected" : ""}
                key={f}
                onClick={() => { setFilter(f); setVisible(25); }}
              >
                {f === "all"
                  ? "All workflows"
                  : f === "active"
                    ? "Active"
                    : "Drafts"}{" "}
                <span>
                  {
                    workflows.filter(
                      (w) =>
                        f === "all" || (f === "active" ? w.active : !w.active),
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search workflows"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setVisible(25); }}
              placeholder="Search workflows…"
            />
          </label>
        </div>
      )}
      {message && (
        <span className="saved" role="status">
          {message}
        </span>
      )}
      {!list.length ? (
        <Empty
          title="A little room for possibility."
          body={
            search
              ? "No workflows match your search."
              : "Create a workflow or start with a template."
          }
          href="/templates"
          label="Explore templates"
        />
      ) : (
        <div className="table-scroll" role="region" aria-label="Workflows table" tabIndex={0}>
          <table className="data-table workflow-table">
            <thead>
              <tr>
                <th>WORKFLOW</th>
                <th>STATUS</th>
                <th>NODES</th>
                <th>LAST EDITED</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, compact ? 4 : visible).map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link href={"/workflows/" + w.id} className="workflow-name">
                      <span className="table-icon">
                        <WorkflowIcon size={18} />
                      </span>
                      <span>
                        <strong>{w.name}</strong>
                        <small>{w.description}</small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <Status status={w.active ? "active" : "draft"} />
                  </td>
                  <td className="mono muted">
                    {String(w.nodes.length).padStart(2, "0")}
                  </td>
                  <td className="muted small">
                    {new Date(w.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn"
                        aria-label={`${w.active ? "Pause" : "Activate"} ${w.name}`}
                        title={
                          w.active
                            ? "Pause workflow"
                            : "Mark active (manual simulation only)"
                        }
                        onClick={() => {
                          void Promise.resolve(saveWorkflow({ ...w, active: !w.active })).catch(() => setMessage("Save needs attention. Your draft is preserved."));
                          setMessage(
                            w.active
                              ? "Workflow paused."
                              : "Workflow active. Run it manually in the editor.",
                          );
                        }}
                      >
                        {w.active ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Duplicate ${w.name}`}
                        onClick={() => {
                          duplicateWorkflow(w.id);
                          setMessage("Workflow duplicated.");
                        }}
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label={`Delete ${w.name}`}
                        onClick={() => setDeleting(w.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                      <Link
                        className="icon-btn"
                        aria-label={`Edit ${w.name}`}
                        href={"/workflows/" + w.id}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!compact && list.length > 0 && <div className="pagination">
        <span role="status">Showing {Math.min(visible, list.length)} of {list.length} workflows</span>
        {visible < list.length && <button className="btn" onClick={() => setVisible(count => count + 25)}>Load more workflows</button>}
      </div>}
      {deleting && (
        <Dialog title="Delete this workflow?" onClose={() => setDeleting(null)}>
          <p className="muted">
            “{workflows.find((w) => w.id === deleting)?.name}” will be removed
            from this browser. Past executions will stay in your history.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setDeleting(null)}>
              Keep workflow
            </button>
            <button
              className="btn danger"
              onClick={() => {
                deleteWorkflow(deleting);
                setDeleting(null);
                setMessage("Workflow deleted.");
              }}
            >
              Delete workflow
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
