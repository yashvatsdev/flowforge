import type { State } from "./workspace";
export class SaveError extends Error { constructor(message: string, public status = 503) { super(message); } }
export type SyncStatus = "saved" | "saving" | "error" | "conflict";
type Task = { state: State; action?: string; resolve?: () => void; reject?: (e: Error) => void };
/** Serial writes carry the acknowledged revision. A failed task stays queued for explicit retry. */
export class RevisionWriter {
  revision = 0;
  status: SyncStatus = "saved";
  tasks: Task[] = [];
  private working = false;
  private onStatus: (status: SyncStatus, message: string) => void = () => {};
  constructor(private send: (state: State, revision: number, action?: string) => Promise<number>) {}
  initialize(revision: number) { this.revision = revision; }
  subscribe(listener: (status: SyncStatus, message: string) => void) { this.onStatus = listener; return () => { this.onStatus = () => {}; }; }
  enqueue(state: State, action?: string) {
    // Aggregate snapshots include all local edits. A corrected/new snapshot supersedes
    // an unsuccessful one; stale-revision conflicts always stay blocked.
    if (this.status === "error") { this.tasks = []; this.status = "saved"; }
    const promise = new Promise<void>((resolve, reject) => this.tasks.push({ state: structuredClone(state), action, resolve, reject }));
    if (this.status !== "conflict") void this.flush();
    else { const task = this.tasks[this.tasks.length-1]; task.reject?.(new SaveError("Save is paused; your draft is retained.")); task.reject = undefined; task.resolve = undefined; }
    return promise;
  }
  private update(status: SyncStatus, message = "") { this.status = status; this.onStatus(status, message); }
  async flush() {
    if (this.working) return;
    this.working = true;
    this.update("saving");
    try {
      while (this.tasks.length) {
        const task = this.tasks[0];
        this.revision = await this.send(task.state, this.revision, task.action);
        this.tasks.shift(); task.resolve?.();
      }
      this.update("saved");
    } catch (error) {
      const e = error instanceof Error ? error : new SaveError("Save failed");
      for (const task of this.tasks) { task.reject?.(e); task.reject = undefined; task.resolve = undefined; }
      const conflict = error instanceof SaveError && error.status === 409;
      if (!conflict && this.tasks.length > 1) this.tasks = [this.tasks[this.tasks.length-1]];
      this.update(conflict ? "conflict" : "error", e.message);
    } finally { this.working = false; }
  }
}
