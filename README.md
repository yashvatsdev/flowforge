# FlowForge

A Next.js App Router + TypeScript workflow studio. The public site, dashboard, and editor share the Steel + Pale Blue design system.

## Run locally

Requires Node.js 20.19+, 22.13+, or 24+ for the ESLint 10 toolchain. Browser regressions use an installed Google Chrome by default.

```sh
npm install
npm run dev -- --port 43819
```

On Windows PowerShell with script execution disabled, use `npm.cmd` in place of `npm`.

```sh
npm run typecheck
npm test
npm run build
npm start -- --port 43820
```

No environment variables, database, credentials, or external services are required. Fontsource bundles the fonts locally. Run `npm run validate` for TypeScript, ESLint, unit regressions, and a production build. Run `npm run validate:browser` to include the Playwright browser regressions. On a machine without Chrome, install a Playwright browser and set `PLAYWRIGHT_CHANNEL=chromium`. Browser tests launch their own production server on port 43821 and use isolated browser storage. See PHASE0.md for stabilization details.

## Routes and behavior

| Route | Working features |
| --- | --- |
| `/` | Interactive six-node order simulation, amount-dependent routing, node output inspector, pause/speed/manual stepping, preview run count, use-case tabs, FAQ, workspace links |
| `/dashboard` | Browser-backed workflow metrics, seven-day activity, first steps, workflow actions, recent executions |
| `/workflows` | Create, search, filter, activate/pause, duplicate, delete, and edit workflows |
| `/workflows/[id]` | React Flow canvas, node library, ports, branching connectors, inspector, zoom, keyboard editing, autosave, manual simulation, step outputs |
| `/executions` | Search, status filters, pagination, step outputs, JSON export, direct links via `?run=<id>` |
| `/templates` | Six editable templates with text/category filtering |
| `/settings` | Local profile, workspace name, reduced motion, JSON backup export/import, history clearing, workspace reset |

## Try a workflow

1. Open the starter order workflow and run its simulation.
2. Select the webhook, change the sample amount from 149 to 20, and run again. The standard queue is selected instead of the CRM branch.
3. Set the amount back to 149 and enable the HTTP node's simulated failure. Downstream work is skipped after the simulated 503.
4. Open execution history and inspect a step's payload.
5. Add a transform from the node library, connect it, configure it, and reload. The editor autosaves changes after 800ms and flushes when following links. A manual Save button is also available.
6. Export a JSON backup in Settings before clearing browser storage. Import validates the backup and requires confirmation because it replaces the workspace.

On phones and tablets, the editor opens with readable nodes and a pannable canvas; drag the background to explore and use the zoom/fit controls. The inspector opens on node selection. The node library scrolls horizontally on phones and supports click-to-add. React Flow supports keyboard node selection, arrow-key repositioning, and Delete/Backspace removal. Workflow tables scroll within their own keyboard-focusable region.

## Simulation boundaries

### Execution playback

The editor shows configured values directly inside each node. Start a simulation to follow the active route, pause/resume it, advance one step, or choose 0.5×/1×/2× playback speed. “Follow node” keeps the active node in view; manually moving the canvas switches following off. Node configuration is read-only during playback, but nodes remain selectable for inspection.

Completed steps reveal their actual input/output payloads. Added, updated, and removed fields are identified; skipped nodes are explicitly labeled. Only the active connector animates, completed paths remain marked, and unused branches fade. A finished simulation records one execution; pausing does not create a partial history entry. Editing a graph or configuration clears stale playback visuals. Reduced motion retains the controls and data progression without connector/pulse animation or animated camera movement.

The dashboard's seven-day activity bars separate successful and failed runs in green/coral. Hover or keyboard-focus a day for its actual counts. Saves show a short “Saved just now” confirmation.

This is a frontend application. HTTP requests and notifications never contact their configured destinations. Webhooks use sample payloads. Active/draft labels do not schedule background jobs. Executions are manually initiated and require the editor to remain open. The landing demo uses the same pure simulation engine, but its preview runs are separate from workspace history.

The engine validates one trigger, graph connectivity, cycles, configuration, and URLs. It evaluates a deterministic topological order, routes using amount ≥ threshold, skips unused branches, and stops subsequent work after failure. It uses a single shared payload rather than a parallel production execution model.

Data is versioned under `flowforge:v1` in localStorage. The latest 200 workspace executions are retained. Storage is browser- and origin-specific; it does not sync between devices or local ports. Profile settings do not create an account.

## Design implementation

Current darker palette: base `#08090B`, panel `#0E1114`, raised `#171D23`, border `#22282E`, accent `#A8C7E6`, text `#E9EDF1`. `src/app/surfaces.css` refines the surface hierarchy with floating menus (`#1D252D`), softer inactive borders, brighter headings, a fading canvas grid, and local highlights on active ports. Large metric values stay neutral; node icons and status indicators retain their semantic colors. Native controls use a dark color scheme, and the ambient background is softened. Existing fonts, component tooling, routes, and engine contracts are retained.

The landing page follows the `design-taste-frontend` “product performs” direction: the interface is the principal visual material. GSAP handles staggered entrances and a desktop-only pinned story heading, with scoped cleanup. Motion handles tab-panel transitions and the existing Magic UI beam component. Animation pauses offscreen, in background tabs, and on request; reduced motion provides manual stepping and static content. The application surfaces use flat panels, readable tables, and restrained interaction feedback.

`src/app/refinement.css` holds the redesign, imported after the established global styles. The visual refinement added no dependencies; Phase 0 adds ESLint and Playwright as development dependencies. Existing Magic UI Animated Beam source was checked against its connected official registry. Vengeance UI was considered, but the official CLI page was inaccessible; no unverified registry URLs or components were installed.

The landing background includes a custom canvas signal field: slow steel-blue currents, drifting points, and traveling line segments. Use “Pause background” below the demo to freeze it. Rendering is capped at 30fps, pixel density at 1.5×, and pauses in hidden tabs; reduced motion renders a static field. It is decorative, ignores pointer input, and is hidden from assistive technology.

The use-case section automatically explores Operations, Sales, and Team updates with four illustrative execution phases per case. Its nodes show processing/completed/waiting states, traveling signals, and changing event messages. Choosing a tab pauses the tour; “Auto-explore all” resumes it. Keyboard focus, offscreen visibility, hidden tabs, and reduced-motion preferences suspend automatic progression. These are labeled illustrative previews, separate from saved executions.

The expanded accent palette follows the later request for green/orange diagram differentiation: green `#91CBA7` triggers, blue `#A8C7E6` transforms, orange `#E5B47F` conditions, teal `#94C8C5` HTTP requests, and lavender `#C2B5DE` notifications. The same colors identify node icons, canvas cards, ports, source connectors, minimap nodes, and template diagrams. Green success, orange draft/running, and coral failure states retain their text labels and icons. Dashboard metrics use restrained color accents without altering the dark surface palette or real metric values.

See [VERIFICATION.md](VERIFICATION.md) for validation and [DESIGN_REVIEW.md](DESIGN_REVIEW.md) for the design review, exceptions, and screenshot evidence.

## Workspace recovery and backup limits

Invalid JSON, unsupported versions, or malformed existing documents open a recovery screen instead of silently replacing saved work. Export preserves the exact original text. Reset requires confirmation and saves a second raw copy under `flowforge:recovery`; a failed archival write aborts reset. If the initial storage read fails, persistence remains disabled for that session.

Version 1 remains the only released document schema; no speculative migration is applied to unrecognized versions. Imports accept valid version-1 backups within 5 MB, 1,000 workflows, 1,000 nodes and 5,000 edges per workflow, and 200 executions. Identifiers, configurations, ports, graph cycles, and historical step payloads are validated. Disconnected editor drafts can round-trip; running them still requires every node to connect to the trigger. Historical runs remain valid after their workflow or nodes are deleted.
