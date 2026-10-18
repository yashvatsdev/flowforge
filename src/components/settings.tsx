"use client";
import { useState, useRef } from "react";
import {
  User,
  SlidersHorizontal,
  Database,
  Download,
  Upload,
  Check,
  Trash2,
  Info,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Dialog } from "./dialog";
export function SettingsPage() {
  const store = useStore();
  const [form, setForm] = useState(store.settings);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<"reset" | "history" | null>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A WORKSPACE THAT FEELS LIKE YOU.</span>
          <h1>
            Settings<span className="accent">.</span>
          </h1>
          <p>A few details. A little fine-tuning. All yours.</p>
        </div>
      </div>
      <div className="settings-layout">
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            store.saveSettings({
              ...form,
              name: form.name.trim(),
              workspace: form.workspace.trim(),
            });
            setMessage("Preferences saved to this browser.");
          }}
        >
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <span className="table-icon">
                <User size={18} />
              </span>
              <div>
                <h2>Your profile</h2>
                <p>Personalize your local workspace.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                Display name
                <input
                  value={form.name}
                  required
                  maxLength={60}
                  pattern=".*\S.*"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="field">
                Email address
                <input
                  value={form.email}
                  required
                  type="email"
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="field full-field">
                Workspace name
                <input
                  value={form.workspace}
                  required
                  pattern=".*\S.*"
                  maxLength={60}
                  onChange={(e) =>
                    setForm({ ...form, workspace: e.target.value })
                  }
                />
              </label>
            </div>
            <p className="micro">
              Profile details are for this demo only. No account or
              authentication is created.
            </p>
          </section>
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <span className="table-icon">
                <SlidersHorizontal size={18} />
              </span>
              <div>
                <h2>Make yourself comfortable</h2>
                <p>Keep the interface at your pace.</p>
              </div>
            </div>
            <label className="switch-row">
              <span>
                <strong>Reduce motion</strong>
                <small>
                  Use quieter transitions and advance the landing demo manually.
                  <br />
                  Your system’s reduced-motion preference is always respected.
                </small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={form.reduceMotion}
                onChange={(e) =>
                  setForm({ ...form, reduceMotion: e.target.checked })
                }
              />
            </label>
            <div className="palette-setting">
              <span className="micro">STEEL + PALE BLUE</span>
              <div>
                {[
                  "#0C0E10",
                  "#121518",
                  "#1A1E22",
                  "#282E34",
                  "#A8C7E6",
                  "#E9EDF1",
                ].map((color) => (
                  <span
                    style={{ background: color }}
                    title={color}
                    key={color}
                  />
                ))}
              </div>
              <span className="micro">Made for focus.</span>
            </div>
          </section>
          <div className="settings-save">
            <span className="saved" role="status">
              {message && (
                <>
                  <Check size={14} />
                  {message}
                </>
              )}
            </span>
            <button className="btn primary">Save preferences</button>
          </div>
        </form>
        <aside>
          <section className="panel settings-panel">
            <div className="settings-section-title">
              <span className="table-icon">
                <Database size={18} />
              </span>
              <div>
                <h2>Your data, your browser.</h2>
                <p>A workspace without a server.</p>
              </div>
            </div>
            <p className="muted small">
              Workflows, settings, and up to 200 executions are stored locally.
              Export a backup before switching browsers or clearing site data.
            </p>
            <div className="data-summary">
              <span>
                Workflows <strong>{store.workflows.length}</strong>
              </span>
              <span>
                Executions <strong>{store.executions.length}</strong>
              </span>
            </div>
            <button
              type="button"
              className="btn data-btn"
              onClick={store.exportData}
            >
              <Download size={15} />
              Export workspace
            </button>
            <button
              type="button"
              className="btn data-btn"
              onClick={() => input.current?.click()}
            >
              <Upload size={15} />
              Import workspace
            </button>
            <input
              ref={input}
              hidden
              type="file"
              accept=".json,application/json"
              aria-label="Import workspace JSON"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 5_000_000)
                    setMessage(
                      "Please choose a workspace backup smaller than 5 MB.",
                    );
                  else setPendingImport(await file.text());
                }
                e.target.value = "";
              }}
            />
            <p className="micro">
              Imports replace this local workspace after confirmation.
            </p>
          </section>
          <section className="panel settings-panel danger-zone">
            <span className="eyebrow">FRESH STARTS</span>
            <button
              type="button"
              className="text-btn"
              onClick={() => setConfirm("history")}
            >
              <Trash2 size={14} />
              Clear execution history
            </button>
            <button
              type="button"
              className="text-btn"
              onClick={() => setConfirm("reset")}
            >
              <Trash2 size={14} />
              Reset workspace to starters
            </button>
          </section>
          <div className="settings-note">
            <Info size={16} />
            <span>
              This is a frontend demonstration. Requests, notifications, and
              integrations are simulated. There are no API keys to configure.
            </span>
          </div>
        </aside>
      </div>
      {confirm && (
        <Dialog
          title={
            confirm === "reset"
              ? "Reset your workspace?"
              : "Clear execution history?"
          }
          onClose={() => setConfirm(null)}
        >
          <p className="muted">
            {confirm === "reset"
              ? "This removes your workflows, run history, and preferences, then restores the starter workspace. Export a backup first if you want to keep your work."
              : "This removes all saved runs from this browser. Your workflows and settings will stay."}
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              className="btn danger"
              onClick={() => {
                if (confirm === "reset") {
                  store.reset();
                  setForm({
                    name: "Alex Morgan",
                    email: "alex@example.com",
                    workspace: "Personal workspace",
                    reduceMotion: false,
                  });
                } else store.clearExecutions();
                setMessage(
                  confirm === "reset"
                    ? "Starter workspace restored."
                    : "Execution history cleared.",
                );
                setConfirm(null);
              }}
            >
              Confirm {confirm === "reset" ? "reset" : "clear"}
            </button>
          </div>
        </Dialog>
      )}
      {pendingImport && (
        <Dialog
          title="Replace this workspace?"
          onClose={() => setPendingImport(null)}
        >
          <p className="muted">
            Importing replaces all local workflows, executions, and preferences.
            Export a backup first to keep your current work.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setPendingImport(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              onClick={() => {
                const ok = store.importData(pendingImport);
                setMessage(
                  ok
                    ? "Workspace imported."
                    : "This file is not a valid FlowForge workspace backup.",
                );
                if (ok) {
                  try {
                    setForm(JSON.parse(pendingImport).settings);
                  } catch {}
                }
                setPendingImport(null);
              }}
            >
              Import workspace
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
