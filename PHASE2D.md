# Phase 2D — Real execution dashboard integration

October 19, 2026. Hosted target: `kixwwrmedqazurvdnfhi`.

Local frontend integration of the existing Phase 2B/2C execution contracts. No hosted database, production configuration, provider schedule, migration, or deployment was changed. Phase 2E implementation is outside this task. Hosted execution and both pending migrations remain unapproved.

## Components, routes, and behavior

- `src/components/real-executions.tsx`: saved-workflow start dialog, persisted history, recent real runs, execution details, node attempts, redacted input/output, cancellation, loading/empty/error/retry states, and cursor navigation.
- `editor.tsx`: separate **Run Workflow** and **Run simulation** actions. Real starts require an acknowledged workspace revision and no unsaved editor changes. Manual input must be a JSON object of at most 64 KiB; SQL remains authoritative for graph/handler validation and all execution limits.
- `executions.tsx`: real execution history is the authenticated default. **Local simulations** uses `?view=simulation`; existing simulation details/export remain intact. Simulation deep links in editor/dashboard/history include that source explicitly.
- `dashboard.tsx`: recent real runs use the API. Existing chart and metrics are explicitly labeled simulations; no real totals, success rates, or invented records are displayed. List names use current saved workflow names, with a fallback for unavailable workflows; details use the immutable run snapshot name.
- `shell.tsx`: distinguishes locally enabled execution from simulation mode; preserves navigation, typography, colors, layout, and motion. `globals.css` adds scoped status, input, JSON, and responsive styles using existing tokens.
- `cloud-provider.tsx`, `store.tsx`, studio `layout.tsx`: expose the acknowledged workspace revision and a server-derived local UI capability. Existing OAuth, persistence, and simulation behavior remain in place.

Reused existing buttons, panels, tables, tabs, dialog, and theme. Additional component libraries were considered unnecessary for these existing surfaces; no dependency or visual redesign was introduced.

## API contracts and authorization

`POST /api/workflows/[id]/runs` sends `{expectedRevision,input}` plus an `Idempotency-Key`. One dialog owns a fixed key and serialized body; concurrent clicks are guarded synchronously. Ambiguous network retries reuse both. Input locks after the first valid submission. Closing an attempted request warns that it may already have committed; after a reload/closed dialog the in-memory key is lost, so users must inspect history before starting again. A 409 explains that the workspace changed; it never silently overwrites, updates the revision, or creates another intent.

History calls `GET /api/executions?cursor=...` (25 rows). Previous pages retain their cursor stack. Search/status filtering is explicitly **this page**, because no server filter or total-count contract exists. Details and steps call `GET /api/executions/[runId]` and `/steps`; cancellation calls `POST /cancel`. Queued, running, cancellation-requested, completed, failed, cancelled, and timed-out states come from persisted responses. Cancellation does not optimistically claim completion. Attempts and timestamps are actual recorded values; missing node attempts are described as unrecorded.

`src/lib/execution/presentation.ts` defines browser DTOs and bounds/redacts JSON inspection. Details/steps route handlers now allowlist returned fields: snapshot config, graph edges, worker/lease fields, fencing generations, workspace IDs, idempotency keys, request hashes, and plans are excluded. Credential-like keys, Bearer/JWT values, and credential-bearing URLs are redacted server-side and again for display. Outputs are depth/length bounded and rendered as text. Redaction is heuristic, not a guarantee that arbitrary user strings cannot contain secrets; do not place credentials in workflow payloads.

Existing authenticated route wrappers, Google-provider verification, Origin checks, UUID/body limits, ownership RPCs, RLS, quotas, and cancellation authority remain unchanged. No browser worker/maintenance call, privileged credential, SQL grant, or migration was added. Direct RPC execution disablement remains PostgreSQL's responsibility as established in Phase 2B.

## Default-disabled behavior

`src/lib/execution/ui-capability.ts` is false by default. The explicit **test/local-only** `FLOWFORGE_EXECUTION_UI_ENABLED=local` opt-in works only outside `NODE_ENV=production` and only with an HTTP loopback Supabase URL. Playwright sets it solely for the disposable fixture. Hosted URLs and production builds always show disabled real starts, with simulation still available. This capability does not grant database permissions or enable workers. Existing history can still be inspected when its schema exists; an unapplied/disabled backend produces a clear unavailable message instead of fake success.

Production enablement is deliberately deferred to a separately reviewed Phase 2E/staging/deployment change. Setting this local flag in production cannot enable execution.

## Refresh lifecycle

`browser-client.ts` uses same-origin credentials, no-store requests, eight-second timeouts, abort propagation, and fixed safe error messages. `polling.ts`/`use-resource.ts` permit one active load per resource, abort on unmount/hidden pages, resume visibility only while nonterminal, and use five-second delays after completed loads (no overlapping interval). Details load the two independent read endpoints together. Active first-page history/recent runs refresh; older pages and terminal-only history stop until manual refresh. Terminal details stop polling. Each resource stops after 120 successful loads (roughly ten minutes or longer with request latency) and offers resume. Errors, including expired sessions, pause polling and offer explicit retry/sign-in. Cancellation refreshes both details and visible history.

## Validation

Browser tests use local fixture Auth and real migration SQL in disposable PGlite, with explicitly synthetic data. Transport signature/worker endpoints remain default off. A test invokes the existing local runner explicitly against only the fixture; no real QStash jobs are published. Browser presentation-only cursor/lifecycle tests use deterministic mocked API responses in addition to the real database flow.

| Check | Final result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed, zero warnings |
| `node --import tsx --test --test-concurrency=1 tests/*.test.ts` | **104 passed**, zero failures/skips; 9.9 s |
| `node scripts/browser-tests.mjs --trace on` | **27 passed**, 50.4 s, Chrome/local fixtures |
| `npm run build` | Passed, Next.js 16.4.2; all expected API/studio routes built |
| Migration fingerprints | All four unchanged |
| `git diff --check` | Passed (Windows line-ending notices only) |

The full browser suite includes the original simulation/editor/export/reload tests, OAuth/proxy fixtures, cross-workspace denial, API idempotency/provenance/cancellation, and the four new UI scenarios. The new real-database browser flow loses a committed start response, retries the same key/body, inspects redacted input, cancels, then starts another fixture run and completes it through the explicit local runner. Its completed node attempt/output is verified in the UI. Error scenarios cover invalid input, 409, disabled 503, network interruption, and expired 401. Cursor tests check next/previous and prove terminal/unmounted details stop requesting. Unit coverage checks input bounds, immutable retry intents, safe errors, DTO filtering, default-disabled capability, polling visibility/abort/overlap/terminal behavior, plus the existing engine/database/security tests.

History and overview were checked at 390/768/1440 px without document overflow. Inspected the saved mobile overview and completed-details screenshots: the established Steel/Pale Blue presentation, table scrolling, modal bounds, and actual run statuses are retained. Existing reduced-motion browser coverage/settings remain unchanged. The React best-practices review checked stable effect dependencies, cleanup, stale-result guards, text-only JSON rendering, accessible input/action labels, and concurrent independent details reads.

Initial new test failures came from sharing a workspace with older empty-workspace assertions, ambiguous selectors that included Next's route announcer, and using request count to drive a mock transition under development Strict Mode. The fixture now has a dedicated third synthetic identity; selectors target application alerts, and mock state transitions are explicit. The first pass also exposed a React key-spread warning, fixed by passing feedback props explicitly. Focused tests and subsequent complete runs passed. Dialog Escape handling now prevents native dismissal until its existing onClose callback approves it, so a pending/ambiguous start cannot bypass the close guard. No timeout was increased.

Logs/screenshots are in ignored `.phase2b-evidence/phase2d-*`; current Playwright traces are in ignored `test-results/`. Build output is isolated in ignored `.next-phase2d-build/`, uses one worker and a 1 GiB JS heap, and restores generated `next-env.d.ts`/`tsconfig.json` after completion. Heavy checks ran sequentially after the user freed RAM; no unrelated workload was stopped.

Testing/support changes: `tests/execution-ui.test.ts`, `tests/browser/phase1.spec.ts`, `scripts/test-supabase.mts`, `playwright.config.ts`, and `.gitignore`. No package/dependency changes were necessary for Phase 2D. The working tree already contained prior-phase changes; those were preserved.

## Limitations and deployment prerequisites

- No hosted migration or worker readiness is asserted by local tests. Verified restorable recovery, isolated restore rehearsal, fresh schema/history/data checks, independent external scheduler inventory, explicit migration approval, and post-application security checks remain required by the Phase 2B runbooks.
- Real OAuth/provider behavior, production QStash delivery, staging acceptance, and other browsers remain Phase 2E concerns. Existing independent PostgreSQL contention evidence belongs to Phase 2B/2C; this phase does not repeat hosted contention tests or change SQL.
- History is cursor based; filters do not search beyond the current page. No unsupported metrics, scheduling, manual retry of terminal runs, or secret configuration inspector is added.
- An interrupted start should be retried in its open dialog or located in history before making a new intent. Graph rejection is authoritative on the backend and is explained with a safe 422 message.
- All four migration SHA-256 fingerprints match the prior phase evidence. No migration changed, and no application data was exported.

## Decision

**GO for Phase 2E local security review and staging acceptance preparation.** Phase 2D local validation is complete. **NO-GO for hosted migration application, hosted execution enablement, or deployment** until the existing recovery, infrastructure, approval, and security gates are independently satisfied. This task stops here and does not begin Phase 2E.
