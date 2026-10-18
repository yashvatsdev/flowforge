"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useInView } from "motion/react";
import { ArrowRight, Check, GitBranch, Workflow } from "lucide-react";
import { AnimatedList } from "./ui/animated-list";
import { NodeIcon } from "./shared";

type PreviewProps = { quiet: boolean; paused: boolean };

/** Keep the live previews idle off screen, in background tabs, or when paused. */
function usePreviewClock({ quiet, paused }: PreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const [visible, setVisible] = useState(true);
  const [tick, setTick] = useState(0);
  const playing = inView && visible && !quiet && !paused;

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setTick((current) => current + 1), 1800);
    return () => clearInterval(timer);
  }, [playing]);

  return { ref, tick, playing };
}

export function FlowPreview(props: PreviewProps) {
  const { ref, tick, playing } = usePreviewClock(props);
  return (
    <div
      ref={ref}
      className="mini-flow live-preview"
      data-playing={playing}
      aria-hidden="true"
    >
      <span data-active={tick % 3 === 0}>
        <NodeIcon kind="trigger" />
        Receive
        <i className="preview-node-dot" />
      </span>
      <div className="flow-link" data-active={tick % 3 === 0}>
        <ArrowRight />
      </div>
      <span data-active={tick % 3 === 1}>
        <NodeIcon kind="transform" />
        Transform
        <i className="preview-node-dot" />
      </span>
      <div className="flow-link" data-active={tick % 3 === 1}>
        <ArrowRight />
      </div>
      <span className="accent-node" data-active={tick % 3 === 2}>
        <NodeIcon kind="notification" />
        Deliver
        <i className="preview-node-dot" />
      </span>
      <div className="flow-preview-caption">
        <span className="live-dot" />
        {tick % 3 === 0
          ? "Receiving a sample event"
          : tick % 3 === 1
            ? "Mapping the payload"
            : "Delivery simulated · complete"}
      </div>
    </div>
  );
}

const events = [
  { label: "Payload verified", duration: 80 },
  { label: "CRM record prepared", duration: 112 },
  { label: "Team message delivered", duration: 144 },
  { label: "Webhook received", duration: 68 },
  { label: "Condition matched", duration: 96 },
  { label: "Order normalized", duration: 124 },
];

export function ActivityPreview(props: PreviewProps) {
  const { ref, tick, playing } = usePreviewClock(props);
  const items = [tick, tick + 1, tick + 2].map((id) => {
    const event = events[id % events.length];
    return (
      <div key={id} className="activity-example">
        <Check size={15} />
        <span className="activity-event-name">{event.label}</span>
        <small>#{1042 + Math.floor(id / 3)}</small>
        <span>{event.duration}ms</span>
      </div>
    );
  });
  return (
    <div
      ref={ref}
      className="mini-activity live-preview"
      data-playing={playing}
      aria-hidden="true"
    >
      {props.quiet || !playing ? (
        <div className="activity-static">{[...items].reverse()}</div>
      ) : (
        <AnimatedList delay={650}>{items}</AnimatedList>
      )}
    </div>
  );
}

export function TemplatePreview(props: PreviewProps) {
  const { ref, playing } = usePreviewClock(props);
  return (
    <div
      ref={ref}
      className="template-visual live-preview"
      data-playing={playing}
      aria-hidden="true"
    >
      <span className="template-sheet middle" />
      <span className="template-sheet back" />
      <span className="template-sheet">
        <GitBranch />
        <span>01 / OPERATIONS</span>
        <strong>
          Your next
          <br />
          head start.
        </strong>
        <span className="template-sheet-line" />
      </span>
      <span className="template-orbit-dot" />
    </div>
  );
}

const heights = [
  15, 28, 20, 40, 30, 52, 42, 60, 49, 72, 61, 84, 67, 90, 79, 100, 89, 115, 96,
  125,
];

export function DashboardPreview(props: PreviewProps) {
  const { ref, tick, playing } = usePreviewClock(props);
  return (
    <div
      ref={ref}
      className="dashboard-mini live-preview"
      data-playing={playing}
      aria-hidden="true"
    >
      <div>
        <Workflow size={14} />
        OVERVIEW<span>SIMULATED ACTIVITY</span>
      </div>
      <div className="mini-stats">
        <span>
          <strong>03</strong>WORKFLOWS
        </span>
        <span>
          <strong>01</strong>ACTIVE
        </span>
        <span>
          <strong className="mini-run-count">
            {String(24 + tick).padStart(2, "0")}
          </strong>
          DEMO EVENTS
        </span>
      </div>
      <div className="mini-chart">
        {heights.map((height, i) => (
          <i
            key={i}
            style={{ height, "--bar-delay": `${i * -0.19}s` } as CSSProperties}
          />
        ))}
      </div>
      <span className="mini-chart-label">
        <span className="live-dot" />
        WORK, IN MOTION <span>LIVE PREVIEW</span>
      </span>
    </div>
  );
}
