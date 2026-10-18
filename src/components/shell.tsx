"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Workflow,
  Activity,
  Layers,
  Settings,
  ArrowUpRight,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  Command,
} from "lucide-react";
import { Logo } from "./shared";
import { useStore } from "@/lib/store";
const links = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/workflows", "Workflows", Workflow],
  ["/executions", "Executions", Activity],
  ["/templates", "Templates", Layers],
  ["/settings", "Settings", Settings],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    document.querySelector<HTMLAnchorElement>("#workspace-navigation nav a")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  useEffect(() => {
    const query = window.matchMedia("(max-width:760px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const { ready, settings, notice, workflows } = useStore();
  const title = links.find(([p]) => path.startsWith(p))?.[1] || "Workspace";
  return (
    <div className="app-shell">
      <aside
        id="workspace-navigation"
        inert={mobile && !open}
        aria-hidden={mobile && !open}
        className={`sidebar ${open ? "sidebar-open" : ""}`}
      >
        <div className="sidebar-brand">
          <Logo />
          <button
            className="mobile-menu icon-btn"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <Link href="/settings" className="workspace-switch">
          <span className="workspace-avatar">
            {settings.workspace[0] || "P"}
          </span>
          <span>
            <strong>{settings.workspace}</strong>
            <small>Local workspace</small>
          </span>
          <ChevronDown size={14} />
        </Link>
        <span className="nav-caption">WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          {links.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={path.startsWith(href) ? "page" : undefined}
              className={path.startsWith(href) ? "active" : ""}
            >
              <Icon size={18} />
              {label}
              {label === "Workflows" && (
                <span className="nav-count">
                  {ready ? workflows.length : "—"}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sandbox-card">
            <span className="live-dot" />
            <strong>A space to experiment.</strong>
            <p>
              Everything runs as a simulation. Your work stays in this browser.
            </p>
            <Link href="/templates">
              Find your starting point <ArrowRight size={14} />
            </Link>
          </div>
          <Link href="/" className="back-site">
            Visit the studio <ArrowUpRight size={15} />
          </Link>
          <Link href="/settings" className="profile">
            <span>
              {settings.name
                .split(" ")
                .map((s) => s[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{settings.name}</strong>
              <small>Personal account · demo</small>
            </div>
            <Settings size={15} />
          </Link>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="app-content">
        <header className="app-topbar">
          <div>
            <button
              ref={menuButton}
              className="mobile-menu icon-btn"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="workspace-navigation"
            >
              <Menu size={20} />
            </button>
            <span className="muted">Workspace</span>
            <span className="crumb-divider">/</span>
            <strong>{title}</strong>
          </div>
          <div>
            <span className="demo-badge">
              <span />
              SIMULATION MODE
            </span>
            <Link
              href="/settings"
              className="avatar-small"
              aria-label="Account settings"
            >
              {settings.name[0]}
            </Link>
          </div>
        </header>
        <main
          id="main"
          className={
            path.match(/^\/workflows\/.+/) ? "editor-main" : "workspace-main"
          }
        >
          {notice && (
            <p className="notice" role="alert">
              {notice}
            </p>
          )}
          {ready ? (
            children
          ) : (
            <div className="loading-workspace">
              <Command className="loading-icon" />
              <p>Opening your workspace…</p>
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>FLOWFORGE / PERSONAL WORKSPACE</span>
          <span>
            <span className="live-dot" /> Local storage · frontend simulation
          </span>
        </footer>
      </div>
    </div>
  );
}
