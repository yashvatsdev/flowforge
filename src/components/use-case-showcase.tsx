"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, Pause, Play } from "lucide-react";
import { NodeIcon } from "./shared";
import type { Kind } from "@/lib/engine";

const cases = [
  {
    title: "Operations", headline: "Every order. The right path.",
    description: "Normalize incoming orders, route by value, and prepare a handoff for the right team.",
    labels: ["Sample order", "Route by value", "Operations handoff"],
    kinds: ["trigger", "condition", "notification"],
    events: ["Order #1042 received", "High-value branch matched", "Operations message prepared", "Handoff complete · simulated"],
    href: "/workflows/order-intake", action: "Open order workflow",
  },
  {
    title: "Sales", headline: "A warmer handoff.",
    description: "Adapt the lead-enrichment workflow to your fields and rehearse a sales handoff before connecting services.",
    labels: ["Inbound lead", "Enrich the payload", "Sales handoff"],
    kinds: ["trigger", "transform", "notification"],
    events: ["Sample lead received", "Source and company fields mapped", "Sales notification prepared", "Lead handoff complete · simulated"],
    href: "/workflows/lead-enrichment", action: "Open lead workflow",
  },
  {
    title: "Team updates", headline: "Keep the team in the loop.",
    description: "Use a digest template to explore collecting data, transforming a payload, and preparing a team update.",
    labels: ["Sample event", "Prepare the digest", "Team notification"],
    kinds: ["trigger", "transform", "notification"],
    events: ["Sample event collected", "Digest fields assembled", "Team update prepared", "Digest complete · simulated"],
    href: "/templates", action: "Explore templates",
  },
] satisfies { title: string; headline: string; description: string; labels: string[]; kinds: Kind[]; events: string[]; href: string; action: string }[];

export function UseCaseShowcase({ quiet }: { quiet: boolean }) {
  const root = useRef<HTMLElement>(null);
  const inView = useInView(root, { amount: 0.25 });
  const [playhead, setPlayhead] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const selected = Math.floor(playhead / 4) % cases.length;
  const step = playhead % 4;
  const chosen = cases[selected];
  const playing = !quiet && !paused && !focused && visible && inView;

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setPlayhead((value) => (value + 1) % 12), 1800);
    return () => clearInterval(timer);
  }, [playing]);

  const choose = (index: number) => {
    setPlayhead(index * 4);
    setPaused(true);
  };

  return (
    <section ref={root} className="ff-use-cases ff-section ff-reveal" id="use-cases"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="ff-section-heading">
        <h2>Good systems.<br /><span>At work.</span></h2>
        <div className="ff-case-heading-aside">
          <p>Start with a useful process.<br />Make it your own.</p>
          {quiet ? <span className="ff-case-mode">Manual exploration · reduced motion</span> :
            <button className="ff-case-autoplay" aria-pressed={!paused} onClick={(event) => { setPaused((value) => !value); event.currentTarget.blur(); }}>
              {paused ? <Play size={13} /> : <Pause size={13} />}{paused ? "Auto-explore all" : "Pause exploration"}
            </button>}
        </div>
      </div>
      <div className="ff-case-tabs" role="tablist" aria-label="Workflow use cases">
        {cases.map((item, index) => (
          <button key={item.title} role="tab" id={`case-tab-${index}`} aria-selected={selected === index}
            aria-controls="case-panel" tabIndex={selected === index ? 0 : -1} onClick={() => choose(index)}
            onKeyDown={(event) => {
              if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? 0 : event.key === "End" ? cases.length - 1 :
                (selected + (event.key === "ArrowRight" ? 1 : -1) + cases.length) % cases.length;
              choose(next);
              document.getElementById(`case-tab-${next}`)?.focus();
            }}>
            {item.title}<ArrowUpRight size={16} />
            {selected === index && <span className="ff-case-progress" style={{ transform: `scaleX(${(step + 1) / 4})` }} />}
          </button>
        ))}
      </div>
      <div id="case-panel" role="tabpanel" aria-labelledby={`case-tab-${selected}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={selected} className="ff-case-panel" initial={quiet ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }} exit={quiet ? { opacity: 1 } : { opacity: 0, y: -6 }} transition={{ duration: quiet ? 0 : 0.25 }}>
            <div><h3>{chosen.headline}</h3><p>{chosen.description}</p>
              <Link className="ff-text-link" href={chosen.href}>{chosen.action}<ArrowUpRight size={17} /></Link>
            </div>
            <div className="ff-case-diagram" data-ui data-playing={playing}>
              {chosen.labels.map((label, index) => (
                <div className="ff-case-stage" key={label}>
                  <div data-node-kind={chosen.kinds[index]} data-state={quiet ? "idle" : step > index ? "complete" : step === index ? "running" : "pending"} className="ff-case-node">
                    <NodeIcon kind={chosen.kinds[index]} size={23} /><strong>{label}</strong>
                    <span className="ff-case-node-state">{quiet ? "Ready to explore" : step > index ? <><Check size={11} /> Complete</> : step === index ? "Processing sample" : "Waiting"}</span>
                  </div>
                  {index < 2 && <span className="ff-case-signal" data-active={!quiet && step === index} aria-hidden="true"><ArrowRight size={18} /><i /></span>}
                </div>
              ))}
              <div className="ff-case-event"><span className="live-dot" /><span>{quiet ? "Choose a workflow to explore" : chosen.events[step]}</span><span>{step + 1}/4</span></div>
              <small>Illustrative preview · all services simulated</small>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
