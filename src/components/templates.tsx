"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight, ArrowRight, Layers } from "lucide-react";
import { useStore, starter } from "@/lib/store";
import { NodeIcon, Empty } from "./shared";
import {
  defaults,
  type FlowNode,
  type Kind,
  type Workflow,
} from "@/lib/engine";
const templates = [
  {
    name: "Order intake → team handoff",
    category: "Operations",
    description:
      "Normalize an order, check its value, and route it to the right team.",
    spec: ["trigger", "transform", "condition", "http", "notification"],
  },
  {
    name: "A warmer welcome",
    category: "Sales",
    description:
      "Capture a new lead, tag its source, and prepare a welcome message.",
    spec: ["trigger", "transform", "notification"],
  },
  {
    name: "The daily briefing",
    category: "Operations",
    description: "Turn a sample payload into a concise update for your team.",
    spec: ["trigger", "transform", "notification"],
  },
  {
    name: "A signal worth sharing",
    category: "Engineering",
    description:
      "Receive an event, prepare an API call, and notify your engineering channel.",
    spec: ["trigger", "http", "notification"],
  },
  {
    name: "High-value, high-touch",
    category: "Sales",
    description:
      "Give high-value orders a dedicated path and a personal handoff.",
    spec: ["trigger", "condition", "notification"],
  },
  {
    name: "An API health rehearsal",
    category: "Engineering",
    description:
      "Practice diagnosing a failed request with a safe, simulated 503 response.",
    spec: ["trigger", "http", "notification"],
  },
] satisfies {
  name: string;
  category: string;
  description: string;
  spec: Kind[];
}[];
function fromTemplate(index: number): Workflow {
  const t = templates[index];
  const id = crypto.randomUUID();
  if (index === 0)
    return {
      ...starter(id, t.name),
      active: false,
      updatedAt: new Date().toISOString(),
    };
  const nodes: FlowNode[] = t.spec.map((kind, i) => ({
    id: `n${i}`,
    type: "forge",
    position: { x: i * 290 + 60, y: 180 },
    data: {
      kind,
      label:
        kind === "trigger"
          ? "Event received"
          : kind === "transform"
            ? "Prepare the payload"
            : kind === "http"
              ? "Call the API"
              : kind === "condition"
                ? "High-value order?"
                : "Notify the team",
      config: {
        ...defaults[kind],
        ...(index === 5 && kind === "http" ? { fail: "true" } : {}),
        ...(kind === "notification"
          ? {
              channel:
                t.category === "Engineering"
                  ? "#engineering"
                  : t.category === "Sales"
                    ? "#sales"
                    : "#operations",
            }
          : {}),
      },
    },
  }));
  return {
    id,
    name: t.name,
    description: t.description,
    active: false,
    nodes,
    edges: nodes
      .slice(0, -1)
      .map((n, i) => ({
        id: `e${i}`,
        source: n.id,
        target: nodes[i + 1].id,
        ...(n.data.kind === "condition"
          ? { sourceHandle: "true", label: "Yes" }
          : {}),
      })),
    updatedAt: new Date().toISOString(),
  };
}
export function Templates() {
  const [category, setCategory] = useState("All templates");
  const [search, setSearch] = useState("");
  const { saveWorkflow } = useStore();
  const router = useRouter();
  const filtered = templates
    .map((t, i) => ({ ...t, index: i }))
    .filter(
      (t) =>
        (category === "All templates" || t.category === category) &&
        `${t.name} ${t.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">GOOD IDEAS DESERVE A HEAD START.</span>
          <h1>
            Template library<span className="accent">.</span>
          </h1>
          <p>A few useful systems. A thousand ways to make them yours.</p>
        </div>
        <span className="library-badge">
          <Layers size={18} />6 starting points
        </span>
      </div>
      <div className="template-banner">
        <span className="template-banner-icon">
          <Layers size={30} />
        </span>
        <div>
          <span className="eyebrow">THE FIRST CONNECTION IS ALREADY MADE.</span>
          <h2>Start with a little structure.</h2>
          <p>
            Every template is editable. Every integration is simulated. Every
            possibility is yours.
          </p>
        </div>
        <ArrowRight size={28} />
      </div>
      <div className="list-tools template-tools">
        <div className="tabs" role="group" aria-label="Template categories">
          {["All templates", "Operations", "Sales", "Engineering"].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={c === category}
              className={c === category ? "selected" : ""}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search templates"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a starting point…"
          />
        </label>
      </div>
      <div className="templates-grid">
        {filtered.map((t) => (
          <article className="template-card" key={t.name}>
            <div className="template-card-top">
              <span className="eyebrow">{t.category.toUpperCase()}</span>
              <span className="micro">
                {String(t.index + 1).padStart(2, "0")} / 06
              </span>
            </div>
            <div className="template-diagram">
              {t.spec.map((kind, i) => (
                <span className="template-diagram-item" key={i}>
                  <span className="template-node" data-node-kind={kind}>
                    <NodeIcon kind={kind} />
                  </span>
                  {i < t.spec.length - 1 && <i />}
                </span>
              ))}
            </div>
            <h2>{t.name}</h2>
            <p>{t.description}</p>
            <div className="template-card-bottom">
              <span className="micro">
                {t.index === 0 ? 6 : t.spec.length} nodes · frontend simulation
              </span>
              <button
                className="text-link"
                onClick={() => {
                  const w = fromTemplate(t.index);
                  void Promise.resolve(saveWorkflow(w)).catch(() => { /* The workspace save banner retains and reports failed drafts. */ });
                  router.push("/workflows/" + w.id);
                }}
                aria-label={`Use template ${t.name}`}
              >
                Use template <ArrowUpRight size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <Empty
          title="No matching templates."
          body="Try another category or search term."
        />
      )}
    </>
  );
}
