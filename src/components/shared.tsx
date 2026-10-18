"use client";
import Link from "next/link";
import {
  Workflow,
  ArrowUpRight,
  Check,
  Activity,
  Webhook,
  SlidersHorizontal,
  GitBranch,
  Globe,
  Send,
} from "lucide-react";
import type { Kind } from "@/lib/engine";
import { nodeColors } from "@/lib/node-colors";
export const nodeIcons = {
  trigger: Webhook,
  transform: SlidersHorizontal,
  condition: GitBranch,
  http: Globe,
  notification: Send,
};
export function NodeIcon({ kind, size = 18 }: { kind: Kind; size?: number }) {
  const Icon = nodeIcons[kind];
  return <Icon size={size} style={{ color: nodeColors[kind] }} />;
}
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="FlowForge home">
      <span className="logo-mark">
        <Workflow size={21} />
      </span>
      flowforge<span className="logo-dot">®</span>
    </Link>
  );
}
export function Status({ status }: { status: string }) {
  return (
    <span className={`status ${status}`}>
      <span />
      {status === "success"
        ? "Completed"
        : status === "active"
          ? "Active"
          : status === "draft"
            ? "Draft"
            : status === "failed"
              ? "Failed"
              : status === "skipped"
                ? "Skipped"
                : status}
    </span>
  );
}
export function Empty({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <Activity size={28} />
      <h3>{title}</h3>
      <p>{body}</p>
      {href && (
        <Link href={href} className="btn primary">
          {label}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Saved({
  children = "Saved to this browser",
}: {
  children?: React.ReactNode;
}) {
  return (
    <span className="saved" role="status">
      <Check size={14} />
      {children}
    </span>
  );
}
