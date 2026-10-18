"use client";
import Link from "next/link";
import { createRef, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, GitBranch, Menu, Pause, Play, Plus, ShieldCheck, X } from "lucide-react";
import { useInView } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { starter, useStore } from "@/lib/store";
import { simulate } from "@/lib/engine";
import { Logo, NodeIcon } from "./shared";
import { AnimatedBeam } from "./ui/animated-beam";
import { AmbientBackground } from "./ambient-background";
import { UseCaseShowcase } from "./use-case-showcase";
import { nodeColors } from "@/lib/node-colors";

const questions = [
  ["What can I build here?", "Create visual workflows with sample webhooks, data transforms, conditions, simulated HTTP requests, and notifications. Start with a template or build a graph from scratch, then inspect the output of every step."],
  ["Does this connect to my real tools?", "This workspace is a frontend simulation. HTTP requests and notifications do not contact external services, and webhooks use sample payloads. Configure and test a process without sending any data."],
  ["Where are my workflows saved?", "Workflows, settings, and the latest 200 workspace executions are saved in this browser using local storage. Export a JSON backup from Settings to keep a copy or move your workspace to another browser."],
  ["Do active workflows run automatically?", "No. Active and draft are organizational labels. All executions are started manually, and the editor must stay open while a simulation runs. There is no background scheduler."],
  ["Can I use it without an account?", "Yes. Open the workspace and begin. No account, credentials, or installation is required. Profile settings are local preferences and do not create an online account."],
];

export function Landing() {
  const { settings, workflows, executions } = useStore();
  const reduced = useReducedMotion();
  const quiet = !!reduced || settings.reduceMotion;
  const root = useRef<HTMLDivElement>(null);
  const graph = useRef<HTMLDivElement>(null);
  const inView = useInView(graph, { amount: 0.15 });
  const refs = useMemo(() => Array.from({ length: 6 }, () => createRef<HTMLButtonElement>()), []);
  const [menu, setMenu] = useState(false);
  const [paused, setPaused] = useState(false);
  const [backgroundPaused, setBackgroundPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [amount, setAmount] = useState(149);
  const [selected, setSelected] = useState(2);
  const demo = useMemo(() => {
    const workflow = starter();
    workflow.nodes[0].data.config.amount = String(amount);
    return { workflow, result: simulate(workflow) };
  }, [amount]);
  const steps = demo.result.steps;
  const cursor = tick % (steps.length + 1);
  const current = steps[cursor];
  const inspected = steps.find((step) => step.nodeId === `n${selected}`);
  const playing = !paused && !quiet && visible && inView;
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1500 / speed);
    return () => clearInterval(timer);
  }, [playing, speed]);
  useEffect(() => {
    if (quiet || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      gsap.fromTo(".ff-intro > *", { y: 24, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, duration: 0.8, ease: "power3.out" });
      gsap.utils.toArray<HTMLElement>(".ff-reveal").forEach((section) => {
        gsap.fromTo(section.children, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease: "power2.out", scrollTrigger: { trigger: section, start: "top 88%", once: true } });
      });
      media.add("(min-width: 1000px)", () => {
        ScrollTrigger.create({ trigger: ".ff-story", start: "top 120px", end: "bottom bottom-=90px", pin: ".ff-story-heading", pinSpacing: false });
      });
    }, root);
    return () => { media.revert(); context.revert(); };
  }, [quiet]);
  return (
    <div className="ff-site" ref={root}>
      <AmbientBackground paused={backgroundPaused || quiet} />
      <header className="ff-header"><Logo /><nav className={menu ? "ff-navigation is-open" : "ff-navigation"} aria-label="Main navigation">{[["#product", "Product"], ["#use-cases", "Use cases"], ["#integrations", "Integrations"], ["#questions", "FAQ"]].map(([href, label]) => <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>)}</nav><Link href="/dashboard" className="ff-header-action">Open workspace <ArrowUpRight size={16} /></Link><button className="ff-menu" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label={menu ? "Close navigation" : "Open navigation"}>{menu ? <X /> : <Menu />}</button></header>
      <main id="main">
        <section className="ff-hero" id="product">
          <div className="ff-intro"><h1>Make work<br /><span>flow together.</span></h1><div className="ff-intro-aside"><p>A visual workspace for the work between your tools. Build the logic. Follow the data. Find your flow.</p><div className="ff-actions"><Link href="/dashboard" className="ff-button">Start building <ArrowUpRight size={18} /></Link><a href="#live-workflow" className="ff-text-link">Try the canvas <ArrowRight size={16} /></a></div><span className="ff-note">No account needed. Your workspace stays local.</span></div></div>
          <div className="ff-workbench" id="live-workflow" data-ui>
            <div className="ff-bench-bar"><div><GitBranch size={17} /><strong>Order intake</strong><span className="ff-bench-descriptor">Interactive simulation</span></div><Link href="/workflows/order-intake">Open in editor <ArrowUpRight size={15} /></Link></div>
            <div className="ff-demo-controls"><label>Sample order <select value={amount} onChange={(event) => { setAmount(Number(event.target.value)); setTick(0); }}><option value={149}>$149 · high value</option><option value={49}>$49 · standard</option></select></label><div><button onClick={() => setSpeed(speed === 1 ? 2 : 1)} aria-label="Change simulation speed">{speed}× speed</button><button onClick={() => setTick((value) => value + 1)}>Next step <ChevronRight size={14} /></button><button className="ff-play" onClick={() => quiet ? setTick((value) => value + 1) : setPaused(!paused)} aria-label={quiet ? "Advance simulation" : paused ? "Resume simulation" : "Pause simulation"}>{quiet || paused ? <Play size={14} /> : <Pause size={14} />}</button></div></div>
            <div className="ff-graph" ref={graph}>
              <div className="ff-graph-label"><span className="live-dot" />{quiet ? "Manual preview" : paused ? "Preview paused" : "Live preview"}<span>Choose a node to inspect its output</span></div>
              {demo.workflow.nodes.map((node, index) => { const step = steps.find((item) => item.nodeId === node.id); const active = current?.nodeId === node.id; return <button ref={refs[index]} key={node.id} data-node-kind={node.data.kind} aria-pressed={selected === index} onClick={() => setSelected(index)} className={`ff-node ff-node-${index} ${active ? "is-running" : ""} ${selected === index ? "is-selected" : ""} ${step?.status === "skipped" ? "is-skipped" : ""}`}><span className="ff-node-type"><NodeIcon kind={node.data.kind} size={16} />{node.data.kind === "http" ? "HTTP request" : node.data.kind}<span>{active ? <span className="live-dot" /> : step?.status === "skipped" ? "—" : <Check size={12} />}</span></span><strong>{node.data.label}</strong><span className="ff-node-detail">{index === 0 ? `order.amount: ${amount}` : index === 1 ? "3 fields mapped" : index === 2 ? "amount ≥ 100" : index === 3 ? "POST /orders · simulated" : node.data.config.channel}</span><i className="ff-port ff-port-in" /><i className="ff-port ff-port-out" /></button>; })}
              {demo.workflow.edges.map((edge) => { const from = Number(edge.source.slice(1)); const to = Number(edge.target.slice(1)); const active = current?.nodeId === edge.source && steps.find((step) => step.nodeId === edge.target)?.status !== "skipped"; return <AnimatedBeam key={`${edge.id}-${cursor}-${amount}`} containerRef={graph} fromRef={refs[from]} toRef={refs[to]} pathColor={nodeColors[demo.workflow.nodes[from].data.kind]} pathOpacity={0.3} pathWidth={1.5} curvature={to === 5 ? -85 : to === 3 ? 40 : 0} gradientStartColor={active && playing ? nodeColors[demo.workflow.nodes[from].data.kind] : "transparent"} gradientStopColor={active && playing ? "#E9EDF1" : "transparent"} repeat={0} duration={1.5 / speed} />; })}
              <span className="ff-graph-footer">6 nodes <span>/</span> 2 possible paths <span>/</span> one clear process</span>
            </div>
            <div className="ff-demo-bottom"><div className="ff-inspection"><span>Node output <ArrowRight size={13} /></span><strong>{demo.workflow.nodes[selected].data.label}</strong><code>{inspected?.status === "skipped" ? "Skipped · branch not selected" : JSON.stringify(inspected?.output || {})}</code></div><div className="ff-execution-state"><span className="live-dot" /><span>{current ? current.label : "Simulation complete"}<small>{current ? `${current.status} · ${current.duration} ms` : `${demo.result.duration} ms · no external requests`}</small></span><span className="ff-run-total">{Math.floor(tick / (steps.length + 1))}<small>preview runs</small></span></div></div>
          </div>
          <div className="ff-under-demo"><span>Interactive preview · no external services contacted</span><button className="ff-atmosphere-control" disabled={quiet} aria-pressed={!backgroundPaused && !quiet} onClick={() => setBackgroundPaused((value) => !value)}>{quiet ? <Pause size={13} /> : backgroundPaused ? <Play size={13} /> : <Pause size={13} />}{quiet ? "Background motion off" : backgroundPaused ? "Resume background" : "Pause background"}</button></div>
        </section>
        <section className="ff-story ff-section" aria-labelledby="story-title"><div className="ff-story-heading"><h2 id="story-title">From idea<br /><span>to outcome.</span></h2><p>Workflows should be easy to follow.<br />Even when the work isn’t simple.</p><Link className="ff-text-link" href="/workflows/order-intake">Explore the editor <ArrowUpRight size={17} /></Link></div><div className="ff-story-chapters">
          <article className="ff-chapter ff-reveal"><div className="ff-logic-fragment" data-ui><div><NodeIcon kind="condition" /><strong>High-value order?</strong><span>Condition</span></div><label>Route when order.amount is at least <strong>$100</strong></label><div className="ff-route-options"><span className={amount >= 100 ? "chosen" : ""}><Check size={14} /> Yes → CRM record</span><span className={amount < 100 ? "chosen" : ""}><ArrowRight size={14} /> No → Standard queue</span></div></div><h3>Complexity, made legible.</h3><p>Connect steps, branch your logic, and make the process match the way you work. Every decision has a visible path.</p></article>
          <article className="ff-chapter ff-reveal"><div className="ff-output-fragment" data-ui><div><span className="live-dot" /><strong>Execution inspector</strong><span>Sample output</span></div><pre>{JSON.stringify({ order: 1042, amount, branch: amount >= 100 ? "high-value" : "standard", status: "success", externalRequests: 0 }, null, 2)}</pre><div><Check size={14} /> Deterministic execution. Inspectable results.</div></div><h3>Nothing behind a black box.</h3><p>Follow the payload from input to output. Inspect each step, spot a skipped branch, and rehearse a failure before it matters.</p><Link className="ff-text-link" href="/executions">Explore execution history <ArrowUpRight size={16} /></Link></article>
          <article className="ff-chapter ff-reveal"><div className="ff-workspace-fragment" data-ui><div><strong>Your workspace</strong><span>Live browser data</span></div><div className="ff-mini-metrics"><span><strong>{workflows.length}</strong>Workflows</span><span><strong>{executions.length}</strong>Executions</span><span><strong>{workflows.filter((workflow) => workflow.active).length}</strong>Active</span></div>{workflows.slice(0, 3).map((workflow) => <Link key={workflow.id} href={`/workflows/${workflow.id}`}><GitBranch size={15} /><span>{workflow.name}</span><ArrowUpRight size={15} /></Link>)}</div><h3>A place for the whole process.</h3><p>Your workflows, recent runs, and reusable starting points in one focused workspace. Pick up exactly where you left off.</p></article>
        </div></section>
        <UseCaseShowcase quiet={quiet} />
        <section className="ff-integrations ff-section ff-reveal" id="integrations"><div><h2>Between<br /><span>your tools.</span></h2><p>Explore the building blocks behind connected work. Configure your destinations and rehearse the data flow in a safe, local environment.</p><Link href="/templates" className="ff-text-link">Find your starting point <ArrowUpRight size={17} /></Link></div><div className="ff-integration-grid" data-ui>{demo.workflow.nodes.slice(0, 5).map((node) => <div key={node.data.kind}><NodeIcon kind={node.data.kind} size={25} /><strong>{({ trigger: "Webhooks", transform: "Data transforms", condition: "Conditional logic", http: "HTTP APIs", notification: "Team messages" })[node.data.kind]}</strong><span>{node.data.kind === "trigger" ? "Sample payloads" : node.data.kind === "http" || node.data.kind === "notification" ? "Simulated delivery" : "Working local logic"}</span></div>)}<Link href="/workflows"><Plus size={25} /><strong>Your next workflow</strong><span>Build it on the canvas <ArrowUpRight size={13} /></span></Link></div></section>
        <section className="ff-trust ff-section ff-reveal"><div className="ff-trust-title"><ShieldCheck size={30} /><h2>Clear by<br /><span>design.</span></h2></div><div className="ff-trust-notes"><article><h3>Your data stays with you.</h3><p>Workflows are stored in this browser. Export a JSON backup whenever you need one.</p></article><article><h3>Experiment without side effects.</h3><p>No credentials. No external requests. Test branches and failures with sample data.</p></article><article><h3>Understand every outcome.</h3><p>Graph validation, explicit failure states, and step-level outputs make each run inspectable.</p></article></div></section>
        <section className="ff-faq ff-section ff-reveal" id="questions"><h2>Good<br /><span>questions.</span></h2><div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={19} /></summary><p>{answer}</p></details>)}</div></section>
        <section className="ff-final ff-section ff-reveal"><h2>Less repetition.<br /><span>More possibility.</span></h2><div><p>Your next workflow starts with one connection.</p><Link href="/dashboard" className="ff-button">Open your workspace <ArrowUpRight size={18} /></Link><span className="ff-note">Free to explore. No account required.</span></div></section>
      </main>
      <footer className="ff-footer"><Logo /><span>A little less manual. A lot more momentum.</span><a href="#product">Back to top ↑</a><span>© {new Date().getFullYear()} FlowForge</span></footer>
    </div>
  );
}
