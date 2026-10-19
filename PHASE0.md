# Phase 0 stabilization report — October 19, 2026

Original Phase 0 completion snapshot: implemented and ready for review/approval, with the development dependency advisory noted below. Phase 1 had not started at that point; it was subsequently approved and implemented as documented in `PHASE1.md`. Nothing was deployed, committed, or pushed. The existing palette, fonts, layouts, animations, and Magic UI sources were preserved.

## Defects and fixes

| Area | Root cause | Implemented fix |
| --- | --- | --- |
| Destructive recovery | Failed validation left starter state active, then `ready` enabled unconditional persistence. Invalid JSON also fell into the storage-unavailable catch. | Explicit missing/valid/recovery document results. Recovery guards persistence, blocks editing, preserves the exact raw original, and offers a download. Reset uses a confirmation dialog and archives the raw document before enabling starter persistence. Archive failure aborts reset. Failed initial storage reads disable persistence for the session. Empty saved text is corrupt data, not a first visit. |
| Editor selection | Inspector id and React Flow node `selected` flags could disagree; selection callbacks reinstated the old canvas node. | Inspector derives its id from the controlled node flags. Inspector and canvas interactions update the same flags; the competing selection callback/state was removed. Adding, deselecting, deleting, and connecting use that same source. Configuration, autosave, and playback remain intact. |
| Backup/graph validation | Shallow checks omitted required configurations, identifiers, references, timestamps, history details, limits, and some graph semantics. Reachability and editor cycle checks recursed. | Shared bounded validator checks version, settings, workflow/node/edge identifiers and uniqueness, supported node renderer/kinds, finite positions, required configuration keys, numeric fields, HTTP settings, ports, references, trigger rules, duplicate connections, cycles, execution/step structures and payload depth. Graph reachability/topological traversal and editor cycle checks are iterative. Rejected imports never call the state setter. |
| Settings overflow | Generic input width/padding rules overrode the hidden file input's screen-reader utility dimensions. | Replaced its `sr-only` class with native `hidden`. The visible accessible Import button still opens the picker. No global overflow suppression or layout changes. |
| Workflow truncation | Full lists used an unconditional 100-row slice. | Show 25 matching workflows initially, announce the displayed/total count, and load another 25 per click until all are shown. Search/filter changes reset the display window; duplicate/delete/activate/edit actions are retained. Compact dashboard lists remain four rows. |
| Missing checks | No ESLint configuration or repeatable browser regression suite. | ESLint 10 with the installed Next.js 16.4.2 configuration, Playwright against a fresh production server, and combined validation scripts. |

## Compatibility and limits

- The repository's only released document schema is version 1. Valid version-1 backups retain their version and shape. No documented earlier schema exists to migrate safely; unknown older/newer versions enter recovery without modification.
- Imported documents: maximum 5,000,000 UTF-8 bytes, 1,000 workflows, 1,000 nodes and 5,000 edges per workflow, 200 execution records, 10,000 characters per normal string, and 200 characters per identifier. Execution JSON payload traversal has depth/value bounds.
- Disconnected nodes are allowed in saved editor drafts, preserving the ability to add nodes, autosave, and restore before wiring. Executing a workflow still requires every node to be reachable from the single trigger. Other structural/cycle/port/configuration validation applies to drafts as well.
- Execution history remains an independent snapshot: a historical workflow/node can have been deleted. History identifiers and structures are still validated, including unique run/step identifiers, durations, statuses, and object payloads.
- Reset recovery copies use the browser key `flowforge:recovery`; export is available before reset. Storage remains local to the browser/origin.

## Files changed

- `src/lib/store.tsx`: guarded restore/persistence and recovery UI; imports use the shared document reader.
- `src/lib/workspace.ts` (new): schema/types, bounded backup validation, recovery classification and persistence/archive guards.
- `src/lib/engine.ts`: identifier/configuration/port/graph validation and iterative graph traversal.
- `src/lib/editor-state.ts` (new): shared selection and iterative connection validation helpers.
- `src/components/editor.tsx`: unified controlled selection and connection helper; primitive follow-camera dependencies.
- `src/components/settings.tsx`: correctly hidden import file input.
- `src/components/workflow-list.tsx`: load-more controls, counts, and search/filter reset.
- `tests/workspace.test.ts` (new): recovery, schema, limits, history, and large-graph regression tests.
- `tests/editor-state.test.ts` (new): inspector/canvas selection and connection regression tests.
- `tests/browser/phase0.spec.ts` (new): isolated end-to-end browser regressions.
- `eslint.config.mjs` (new): Next core-web-vitals/TypeScript flat configuration.
- `playwright.config.ts` (new): isolated Chrome tests and managed production server on port 43821.
- `package.json`, `package-lock.json`: development tooling and repeatable commands.
- `.gitignore`: ignore generated Playwright results/traces.
- `README.md`: current check instructions, runtime prerequisites, recovery and backup behavior.
- `PHASE0.md` (this report).

## Regression coverage

42 new unit tests supplement the 8 existing engine/playback tests, for 50 total. They cover invalid/empty JSON, unknown older/newer versions, malformed documents, exact raw preservation and guarded persistence, archival failure, valid restore, valid historical snapshots after deletion, duplicate identifiers, unsupported node types/kinds, missing configuration, invalid values/ports/references/triggers/cycles, oversized workflow/node/edge/history inputs, malformed execution data, nested payload bounds, disconnected drafts, and a 20,000-node traversal without recursion overflow. Selection tests exercise both input paths and connection creation/rejection.

Nine Playwright tests cover:

1. Corrupt JSON: persistence protection across reload, byte-exact download, canceled reset, confirmed reset with archive.
2. Unsupported version: same recovery/export/confirmation path.
3. Malformed schema: same recovery/export/confirmation path.
4. Existing workspace restore, valid import, rejected import retaining current state, and export.
5–7. Settings at 1440, 768, and 390 pixels: no document overflow; hidden input and visible picker button work.
8. 125 workflows: all five display batches, search/filter, duplicate, and delete.
9. Add node, inspector selection overriding the newly selected node, visible canvas selection, connection creation, canvas-to-inspector selection, configuration autosave/reload, and paused/manual simulation recording a successful execution.

## Executed checks

Final command: `npm.cmd run validate:browser` (with `TSX_DISABLE_CACHE=1` in the process environment).

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | PASS |
| ESLint (`eslint src tests --max-warnings 0`) | PASS — zero warnings/errors |
| Unit tests | PASS — 50/50 |
| Production build (`next build`) | PASS — all existing routes generated/compiled |
| Chrome Playwright regressions | PASS — 9/9 against that production build |
| Production dependency audit (`npm audit --omit=dev --json`) | PASS — zero reported vulnerabilities |

The Windows sandbox initially prevented tsx from reading user information (`uv_os_get_passwd`); tests and the final combined validation ran successfully outside that restriction. The initial editor browser harness had selector/polling defects; those test helpers were corrected, then the final entire suite passed.

ESLint keeps the recommended Next/TypeScript/Hooks checks. The compiler-oriented `react-hooks/set-state-in-effect` rule has a documented exception in the existing editor, store, and upstream Terminal files to retain their established hydration/playback lifecycles without unrelated rewrites. The existing Magic UI source was not edited.

## Remaining issues and approval

No remaining failures in the requested stabilization checks. The design and local simulation behavior remain intact.

The newly required `eslint-config-next` dependency currently introduces five high-severity **development-only** npm audit entries, all from the `braces` → `micromatch` → `fast-glob` → Next lint plugin/config chain. The registry's latest `braces` version is 3.0.3, which remains in the advisory range; npm proposes downgrading Next's lint config to 14.2.35, an incompatible major. No forced downgrade or unverified dependency patch was applied. These advisories do not appear in the production-only audit. They should be revisited when compatible upstream fixes are released.

At the original handoff, Phase 0 was ready for approval with that tooling caveat disclosed. Phase 1 required separate approval; that approval and its subsequent implementation are recorded in `PHASE1.md`.

## Stabilization recheck against the current project

The user resubmitted the Phase 0 brief after Phase 1 implementation. This pass preserves the existing approved authentication/database functionality and checks the stabilization requirements against the current architecture. No authentication, database, external service, dependency, application page, or visual redesign was introduced during this recheck.

Inspection confirmed the existing guarded local restore/persistence, raw-document recovery, explicit reset/archive, shared bounded backup validator, iterative graph traversal, synchronized editor selection, hidden native import input, and 25-row load-more mechanism remain present. The original defect root causes and fixes are listed in the table above; no new application defect was identified in those paths during inspection.

One regression-coverage gap was corrected: the original browser recovery cases targeted the pre-authentication `/settings` page and were no longer part of the active suite. Three equivalent cases now exercise the actual public legacy-recovery entry at `/`, covering corrupt JSON, unsupported versions and malformed documents. Each verifies exact raw preservation across reload, byte-exact export, canceled reset leaving data untouched, explicit confirmed reset, and archival of the original document. The active Settings tests also open the native import picker at 1440/768/390px; the over-100-workflow test now additionally exercises search, duplicate, confirmed delete and active/draft filters.

Files changed in this recheck: `tests/browser/phase1.spec.ts`, `PHASE0.md`, and the current verification summary in `PHASE1.md`. Application runtime code, existing styles/animations, account data and credentials are unchanged. The shared unit cases continue covering valid existing backups, schema/configuration/identifier/graph/history failures, bounds and iterative traversal. Active browser cases retain editor selection, connections, autosave/reload and simulation checks.

Fresh validation: `npm.cmd run validate:browser` passed TypeScript, ESLint, all 67 unit/local PostgreSQL tests, the production build, and all 21 browser tests (53.4 seconds for the browser suite). `git diff --check` passed. Current browser studio tests use the isolated local Auth fixture and PGlite SQL service because the approved project now requires authentication; they do not imply a new hosted Supabase or Google verification result. The legacy recovery cases run without authentication against the public local workspace.

The Phase 0 stabilization recheck is ready for approval. No remaining failure was found in its requested acceptance checks. The historical tooling advisory above was not re-audited during this pass; Phase 1's separate provider/configuration limitations remain tracked in `PHASE1.md`. No new phase was started, and nothing was deployed, committed or pushed.
