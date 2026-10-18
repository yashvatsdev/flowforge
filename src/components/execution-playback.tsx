"use client";

import { useState } from "react";
import { Check, ChevronRight, Circle, X } from "lucide-react";
import { payloadRows } from "@/lib/playback";
import type { Step } from "@/lib/engine";

export function ExecutionPlayback({ steps, completed, running, paused }: { steps: Step[]; completed: number; running: boolean; paused: boolean }) {
  const [inspected, setInspected] = useState<number | null>(null);
  const [mode, setMode] = useState<"input" | "output">("output");
  const followIndex = Math.max(0, Math.min(completed - 1, steps.length - 1));
  const index = inspected !== null && inspected < completed ? inspected : followIndex;
  const entry = steps[index];
  const available = completed > 0;
  const rows = available ? payloadRows(steps, index) : [];
  const fields = mode === "input" ? rows.filter((row) => row.input !== undefined) : rows;

  return (
    <div className="playback-content">
      <div className="playback-timeline" role="group" aria-label="Inspect execution steps">
        {steps.map((step, position) => {
          const done = position < completed;
          const current = running && position === completed;
          const state = done ? step.status : current ? step.status === "skipped" ? "skipped" : "running" : "pending";
          return <button key={step.nodeId} disabled={!done} aria-pressed={available && index === position}
            className="playback-step" data-state={state} onClick={() => setInspected(position)}>
            <span className="playback-step-marker">{state === "success" ? <Check size={12} /> : state === "failed" ? <X size={12} /> : <Circle size={10} />}</span>
            <span><strong>{step.label}</strong><small>{done ? `${step.status === "success" ? "Completed" : step.status === "skipped" ? "Skipped" : "Failed"} · ${step.duration} ms` : current ? paused ? "Playback paused" : step.status === "skipped" ? "Skipping unused branch" : "Processing sample" : "Waiting"}</small></span>
            {available && index === position && <ChevronRight size={13} />}
          </button>;
        })}
      </div>
      <div className="playback-payload">
        <div className="playback-payload-heading">
          <div><strong>{available ? entry.label : "Waiting for the first output"}</strong><span>{available ? entry.message : "Completed steps will reveal their payload here."}</span></div>
          <div className="payload-switch" role="group" aria-label="Payload view">
            <button aria-pressed={mode === "input"} onClick={() => setMode("input")}>Input</button>
            <button aria-pressed={mode === "output"} onClick={() => setMode("output")}>Output</button>
          </div>
        </div>
        {available && entry.status === "skipped" ? <p className="payload-explanation">This node was skipped. It did not change the payload.</p> : null}
        {fields.length ? <div className="payload-fields" role="table" aria-label={`${mode} payload fields`}>
          <div className="payload-field payload-field-header" role="row"><span role="columnheader">Field</span><span role="columnheader">Value</span><span role="columnheader">Change</span></div>
          {fields.map((row) => <div className="payload-field" role="row" data-changed={mode === "output" && row.changed} key={row.key}>
            <code role="cell">{row.key}</code><code role="cell">{row[mode] === undefined ? "—" : JSON.stringify(row[mode])}</code>
            <span role="cell">{mode === "output" && row.changed ? row.input === undefined ? "Added" : row.output === undefined ? "Removed" : "Updated" : "Unchanged"}</span>
          </div>)}
        </div> : <p className="payload-explanation">{available ? "No fields at this step." : "Run the simulation, pause it, or advance one step at a time to follow the data."}</p>}
        {inspected !== null && <button className="text-btn playback-follow-output" onClick={() => setInspected(null)}>Follow latest output <ChevronRight size={13} /></button>}
      </div>
    </div>
  );
}
