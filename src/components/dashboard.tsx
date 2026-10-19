"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Workflow,
  Activity,
  CheckCheck,
  Clock3,
  Check,
  Play,
  Layers,
  GitBranch,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { RecentRealRuns } from "./real-executions";
import { NewWorkflowButton, WorkflowList } from "./workflow-list";
import { Status } from "./shared";
import { BlurFade } from "./ui/blur-fade";
import { useReducedMotion } from "@/lib/use-reduced-motion";
export function Dashboard() {
  const { workflows, executions, settings, cloud, onboarding } = useStore();
  const systemReduced = useReducedMotion();
  const quiet = !!systemReduced || settings.reduceMotion;
  const success = executions.filter((e) => e.status === "success").length;
  const active = workflows.filter((w) => w.active).length;
  const simulationHref = cloud ? (workflows[0] ? `/workflows/${workflows[0].id}` : "/templates") : "/workflows/order-intake";
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const runs = executions.filter((execution) => new Date(execution.time).toDateString() === d.toDateString());
    return {
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      count: runs.length,
      success: runs.filter((run) => run.status === "success").length,
      failed: runs.filter((run) => run.status === "failed").length,
    };
  });
  const max = Math.max(3, ...days.map((d) => d.count));
  const metrics = [
    {
      label: "Total workflows",
      value: String(workflows.length).padStart(2, "0"),
      note: `${active} active · ${workflows.length - active} drafts`,
      Icon: Workflow,
    },
    {
      label: "Simulations",
      value: String(executions.length).padStart(2, "0"),
      note: "Manually simulated runs",
      Icon: Activity,
    },
    {
      label: "Simulation success",
      value: executions.length
        ? `${Math.round((success / executions.length) * 100)}%`
        : "—",
      note: executions.length
        ? `${success} completed successfully`
        : "Run a workflow to begin",
      Icon: CheckCheck,
    },
    {
      label: "Simulation duration",
      value: executions.length
        ? `${Math.round(executions.reduce((s, e) => s + e.duration, 0) / executions.length)} ms`
        : "—",
      note: "Deterministic simulated latency",
      Icon: Clock3,
    },
  ];
  const progress = [
    {
      label: "Explore a starter workflow",
      href: cloud ? (workflows[0] ? `/workflows/${workflows[0].id}` : "/templates") : "/workflows/order-intake",
      done: cloud ? !!onboarding?.includes("explored") : false,
    },
    {
      label: "Make it your own",
      href: "/workflows",
      done: cloud ? !!onboarding?.includes("edited") : workflows.length > 3,
    },
    {
      label: "Run your first simulation",
      href: cloud ? (workflows[0] ? `/workflows/${workflows[0].id}` : "/templates") : "/workflows/order-intake",
      done: cloud ? !!onboarding?.includes("simulated") : executions.length > 0,
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Personal workspace / Overview</span>
          <h1>
            Welcome back, {settings.name.split(" ")[0]}
            <span className="accent">.</span>
          </h1>
          <p>Your workflows, execution health, and next steps in one place.</p>
        </div>
        <NewWorkflowButton />
      </div>
      <BlurFade
        duration={quiet ? 0 : 0.35}
        blur={quiet ? "0px" : "6px"}
        offset={quiet ? 0 : 6}
      >
        <div className="metrics-grid">
          {metrics.map(({ label, value, note, Icon }) => (
            <div className="metric" key={label} data-metric={label}>
              <div>
                {label}
                <Icon size={16} />
              </div>
              <strong>{value}</strong>
              <span>{note}</span>
            </div>
          ))}
        </div>
      </BlurFade>
      <div className="dashboard-middle">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Simulation activity</h2>
              <p>Local simulated runs in this workspace.</p>
            </div>
            <span className="period-tag">Last 7 days</span>
          </div>
          <div className="chart">
            <div className="chart-axis">
              <span>{max}</span>
              <span>{Math.round(max / 2)}</span>
              <span>0</span>
            </div>
            <div className="chart-plot">
              {days.map((d, i) => (
                <div className="chart-column" key={i} tabIndex={0} aria-label={`${d.label}: ${d.success} successful, ${d.failed} failed executions`}>
                  <span className="chart-tooltip" role="tooltip">{d.label} · {d.success} successful · {d.failed} failed</span>
                  <div className="bar-track">
                    <div
                      className="chart-bar"
                      style={{ height: `${(d.count / max) * 100}%` }}
                      title={`${d.label}: ${d.count} executions`}
                    >
                      {d.count > 0 && <><i className="chart-segment chart-segment-failed" style={{ height: `${d.failed / d.count * 100}%` }} /><i className="chart-segment chart-segment-success" style={{ height: `${d.success / d.count * 100}%` }} /><span>{d.count}</span></>}
                    </div>
                  </div>
                  <span>{d.label}</span>
                </div>
              ))}
            </div>
            {executions.length === 0 && (
              <div className="chart-empty">
                <Activity size={18} />
                <span>No executions in the last seven days.</span>
                <Link href={simulationHref}>
                  Run the starter workflow <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
          <div className="chart-legend">
            <i /> Successful <i className="chart-failure-key" /> Failed <span>Simulated runs · this workspace</span>
          </div>
        </section>
        <section className="panel getting-started">
          <div className="panel-heading">
            <div>
              <h2>Your first steps</h2>
              <p>From an idea to a working flow.</p>
            </div>
            <span className="mono accent">
              {progress.filter((p) => p.done).length}/3
            </span>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${(progress.filter((p) => p.done).length / 3) * 100}%`,
              }}
            />
          </div>
          {progress.map((p, i) => (
            <Link href={p.href} key={p.label} className="checklist-row">
              <span
                className={p.done ? "checklist-check done" : "checklist-check"}
              >
                {p.done ? <Check size={13} /> : i + 1}
              </span>
              <span>{p.label}</span>
              <ArrowUpRight size={14} />
            </Link>
          ))}
          <p className="micro starter-note">
            Built to experiment. Nothing is sent to external services.
          </p>
        </section>
      </div>
      <section className="panel workflows-panel">
        <div className="panel-heading">
          <div>
            <h2>
              Your workflows{" "}
              <span className="count-label">{workflows.length}</span>
            </h2>
            <p>Manage your flows or open one to keep building.</p>
          </div>
          <Link href="/workflows" className="text-link">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <WorkflowList compact />
      </section>
      <div className="dashboard-lower">
        {cloud ? <RecentRealRuns /> : <section className="panel recent-panel">
          <div className="panel-heading">
            <h2>Recent simulations</h2>
            <Link href="/executions" className="text-link">
              All runs <ArrowRight size={14} />
            </Link>
          </div>
          {executions.length ? (
            executions.slice(0, 3).map((e) => (
              <Link
                href={`/executions?view=simulation&run=${e.id}`}
                className="recent-run"
                key={e.id}
              >
                <span className="table-icon">
                  <Activity size={16} />
                </span>
                <span>
                  <strong>{e.name}</strong>
                  <small>
                    {new Date(e.time).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {e.duration}ms
                  </small>
                </span>
                <Status status={e.status} />
              </Link>
            ))
          ) : (
            <div className="recent-empty">
              <Play size={20} />
              <p>No runs yet. Your canvas is waiting.</p>
              <Link href={simulationHref}>
                Try your first simulation <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
        </section>}
        <Link href="/templates" className="template-promo">
          <span className="eyebrow">A GOOD PLACE TO BEGIN</span>
          <Layers size={24} />
          <h3>
            Your next idea,
            <br />
            with a head start.
          </h3>
          <span>
            Explore the template library <ArrowUpRight size={16} />
          </span>
          <GitBranch className="promo-watermark" />
        </Link>
      </div>
    </>
  );
}
