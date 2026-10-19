# FlowForge Phase 2B — Durable execution core

Date: October 19, 2026 (Asia/Calcutta).

**Status: Phase 2B.2 browser verification and hosted read-only preflight passed; STOPPED before hosted application. NO-GO: a verified restorable recovery point and successful restore rehearsal are still missing. Explicit application approval is also required after those prerequisites and an immediate fresh preflight. Admission and workers default DISABLED. Phase 2C, production workers and deployment remain out of scope.**

The approved architecture is recorded in [PHASE2A.md](PHASE2A.md). This section supersedes the historical prerequisite records retained below. No Phase 2B SQL has been applied to the hosted project.

Phase 2C was subsequently authorized **locally only** by the user's attached implementation request. See [PHASE2C.md](PHASE2C.md) for completed local acceptance: TypeScript/lint/build, 97 unit/database tests, 12 independent-session assertion groups and 23 browser tests passed. It adds a second pending execution migration; the runbook's old one-pending-file condition is no longer met. Hosted Phase 2B/2C application and execution remain unapproved. This local result does not satisfy backup/restore prerequisites. Phase 2D local prerequisites are GO; its implementation has not begun.

## Phase 2B.4 local setup results

See [docs/PHASE2B_LOCAL_RECOVERY_RESULTS.md](docs/PHASE2B_LOCAL_RECOVERY_RESULTS.md). Installed native PostgreSQL 17.11 client tools side by side under `%LOCALAPPDATA%/FlowForgeTools/PostgreSQL17`, with no new server service or PATH change. Created protected recovery directories outside the repository, with only operator/SYSTEM ACLs. No hosted credentials, data exports or restores were performed.

Runtime setup stopped under the user's resource limit: free RAM declined from approximately 2.8 GiB to 0.98 GiB. Docker/WSL were not started, so no recovery container/network/volume exists and isolation/restore compatibility remain unverified. Disk encryption inspection was denied by Windows; Git-bundled GPG's synthetic test failed to start its agent. DPAPI passed a synthetic check but does not satisfy independent recovery encryption. Accessible Vercel matching projects and QStash schedules were empty; local task/service matching found none. GitHub Actions and broader external inventories remain incomplete. **NO-GO for backup rehearsal; native authentication remains unperformed and separately gated.** The hosted migration gate is unchanged.

## Phase 2B.3 local recovery environment preparation

The setup and credential/isolation plan is [docs/PHASE2B_LOCAL_RECOVERY_SETUP.md](docs/PHASE2B_LOCAL_RECOVERY_SETUP.md). Read-only workstation inspection found an existing **per-user Docker Desktop installation**, correcting the earlier absence assumption based on standard system-path checks. Its Linux engine is stopped; WSL 2.7.13 and stopped Ubuntu/docker-desktop WSL2 distributions exist. WinGet is available. Native clients remain PostgreSQL 18.6; no PG17 client installation was verified. Total RAM is approximately 23.6 GiB, but only 4 GiB was free during inspection, so working-memory headroom must be established before the proposed 6-8 GiB runtime allocation. C: has approximately 38.4 GiB free on NTFS.

Recommend reusing Docker's WSL2 Linux backend with a dedicated Supabase-compatible PG17 destination outside this repository, no copied migration files or hosted link, explicit loopback bindings and verified outbound isolation. Obtain side-by-side official PG17 client binaries, privately establish the existing password, verify protected/encrypted storage, and run the designed read-only native check only after the operator authorizes those next steps. No installation, runtime start, external directory/ACL creation, native password check, hosted export, restore, migration or external infrastructure change occurred. **Backup rehearsal remains NO-GO pending those prerequisites and authorization.** The hosted migration gate is unchanged.

## Phase 2B.2 final readiness investigation

The detailed results, evidence, fingerprints, recovery prerequisites and remaining limits are in [docs/PHASE2B_READINESS.md](docs/PHASE2B_READINESS.md). This entry supersedes the unresolved browser blocker below; the Phase 2B.1 results remain historical evidence.

The export/reload timeout was a browser-test interaction with the existing native beforeunload confirmation. The failing trace records download start followed by an unresolved dialog, with no preceding JavaScript exception (the deliberate revision-conflict HTTP 409 is expected). Explicitly accepting that confirmation resolves the stall. Independent repetition additionally exposed a setup synchronization race with the editor's asynchronous first-exploration write, and reuse of a fixed workflow ID across repeats. The test now waits for onboarding persistence, uses a unique ID, accepts the confirmation, and verifies completed JSON download content, server reload and draft cleanup. No application implementation, browser timeout, migration or privilege was changed.

Final results: affected test **5/5 passed (20.9 seconds)**, then complete configured browser suite **22/22 passed (42.8 seconds)**, TypeScript and ESLint passed, unit/database tests **85/85 passed**. Traces and logs are retained under ignored `.phase2b-evidence/browser-2b2/`; these exercise local fixture Auth/PostgreSQL, not hosted OAuth or a production restore.

Fresh CLI/MCP checks confirmed linked active project `kixwwrmedqazurvdnfhi` (FlowForge, ap-northeast-1, PostgreSQL 17.11), exactly two paired Phase 1 migration versions and only `20261019110206` pending. All three recorded checksums match; Phase 2B SHA-256 remains `61E741AE92C314F94CDD3BF9B04F69BEBC1F04A45A6ABA47A130F74BBB4A63E2`. Hosted Phase 1 catalog, policies, function definitions/settings/ACLs, default privileges, columns and effective table permissions match the reconciled baseline. Six application-table counts and full-row legacy fingerprints match. No execution tables/RPCs exist remotely. No Supabase Edge Functions or cron.job relation exist; the repository has no production scheduler/QStash integration and the runner rejects hosted URLs and production mode. Arbitrary external scheduler/hosting accounts are outside the inspected scope and require operator confirmation.

Read-only CLI backup listing returned `backups: null`, `physical_backup_data: {}`, `pitr_enabled: false`, `walg_enabled: true`. WAL-G enablement alone is not a recovery point. There is no verified backup identifier, recovery timestamp/window, expiry, eligible restore destination or successful restore rehearsal. No backup or database was created/restored. This fails the mandatory recovery prerequisite even though browser tests and schema preflight now pass. No hosted migration, enablement, commit, push or deployment occurred.

## Phase 2B.1 safety and recovery gate

The dedicated operator runbook is [docs/PHASE2B_MIGRATION_RECOVERY.md](docs/PHASE2B_MIGRATION_RECOVERY.md). It covers preflight/checksums, a mandatory restorable backup/recovery point, the supported CLI transaction path, independent commit verification, ambiguous outcomes, partial/history drift, incident containment, reversible disablement, data-preserving forward fixes, restoration limitations, recovery acceptance, independent-session reproduction and bounded future retention.

One justified safety correction was made to the **unapplied** Phase 2B migration: remove initial EXECUTE grants for start/claim/advance. The original audited SHA-256 `B7BE32F314963FA14CBE3497087C997E96970E4120B801143ED10C1512FB0F8A` is superseded by `61E741AE92C314F94CDD3BF9B04F69BEBC1F04A45A6ABA47A130F74BBB4A63E2`. Function bodies, tables and constraints are unchanged; both applied Phase 1 migrations retain their recorded hashes. No extra migration or runtime control table was added.

The grant-only scripts `supabase/operations/phase2b_disable_execution.sql` and `phase2b_enable_execution.sql` operate only on the new start/claim/advance function capabilities. They preserve run/step/outbox records, read/cancel access, old workspace/auth permissions, editing and simulation. They account for direct RPC access. Hosted use and re-enablement require separate explicit operator authorization. Revocation blocks new calls but does not abort already-authorized statements; the runbook requires runner stop, transaction drain and quiescence verification before declaring disablement complete. No hosted script was executed.

Read-only verification SQL was added at `supabase/verification/phase2b_inventory.sql` (schema/source hashes, RLS, grants/effective privileges and history) and `phase1_data_fingerprints.sql` (row counts/content digests, not a backup). `scripts/verify-phase2b-concurrency.mjs` creates only its own disposable loopback PostgreSQL cluster and independent psql sessions; it cannot accept a hosted database URL.

The installed PostgreSQL binaries were discovered outside PATH at `C:/Program Files/PostgreSQL/18/bin`. Real-session verification now passed **eight assertion groups** on PostgreSQL 18.6 / CLI 2.121.0: atomic successful application/default-off privileges; rollback of an injected failing migration and its history row with Phase 1 fixture preservation; contended two-slot admissions; racing idempotency; tenth/eleventh minute-quota starts; competing leases and stale-generation recovery; cancellation/checkpoint locking in both orders; and disable/re-enable preservation. Lock-wait barriers recorded distinct backend PIDs. Evidence: `.phase2b-evidence/pg-nZgOHe/results.json`, its CLI logs, and `inventory-disabled.json`. The final harness waited for its own server to exit. Earlier attempts exposed harness startup/barrier/SQL-NULL handling issues, which were corrected; those failed setup attempts are not counted as successful evidence.

CLI `migration up --linked` is the documented supported hosted procedure **only after approval** and only when exactly `20261019110206` is pending. The same CLI command with an internally generated loopback `--db-url` was exercised locally. The failure injection proves per-migration SQL/history atomicity for the installed CLI; it does not justify inferring rollback from a network/client error. Reconnect and classify actual schema plus history before any approved retry or repair.

The runbook specifies future Phase 2E retention implementation: full runs/snapshots and attempt metadata 30 days after terminal completion; step outputs 7 days after terminal completion; acknowledged outbox events 7 days after acknowledgement/terminal completion; minimal idempotency tombstones 90 days after admission/completion. Pending outbox events are never blindly deleted: alert after 24 hours, operator resolution/archive within 7 days or explicit incident hold. Current schemas lack separate tombstones, so no pruning may begin until a reviewed implementation preserves deduplication and active checkpoints. No cleanup schedule, DELETE or Phase 2C implementation was introduced.

Changed in Phase 2B.1: this report; the two final grants/comment in the pending migration; `.gitignore` for local evidence; explicit test-only enablement in `scripts/test-supabase.mts`; default-disabled and toggle/integrity tests in `tests/execution.test.ts`. New: the runbook, two ACL operation scripts, two read-only verification SQL files, and the disposable concurrency/atomicity harness. No frontend, simulator, existing authentication code, dependency or existing hosted object was changed.

Remaining external gate: a restorable hosted backup/PITR point and restore rehearsal have **not** been verified or created. Exact hosted preflight and approval must be repeated immediately before application. The available real-session test server is PostgreSQL 18.6, not hosted 17.11; hosted PostgREST behavior, provider network failure handling and a production-equivalent restore remain explicit acceptance gaps. Local concurrency no longer relies solely on serialized PGlite. Application must leave execution disabled; re-enablement/production execution is a separate future decision.

Phase 2B.1 final checks: TypeScript and ESLint passed; all **85 unit/database tests** passed, including the new read-only fingerprint SQL. The full existing browser suite was attempted twice: **21 passed / 1 failed on each run**. The existing test `real revision conflict preserves the draft and offers export before server reload` timed out during the click/download/reload sequence at `tests/browser/phase1.spec.ts:167`; teardown then forced Chrome closed. This does not establish a native crash or identify a cause. Its draft-preservation/conflict assertions passed before that action; completion of export/reload remains unverified. No frontend or simulator implementation was changed to bypass it, and the gate remains NO-GO rather than claiming a full green browser run. Initial trace evidence is preserved at `.phase2b-evidence/browser-initial-failure/trace.zip`; the second trace is under `test-results/phase1-real-revision-confl-1854c-export-before-server-reload/trace.zip`. The previous Phase 2B production-build result is unchanged; no new application code required a build in Phase 2B.1.

Fresh hosted read-only inspection again verified the exact target URL and exactly the two registered Phase 1 migrations; schema/default privileges/function ACLs and all six original application-table row counts/content fingerprints match the reconciled baseline. No new execution objects exist remotely. No hosted DDL/DML/ACL/history changes, production worker, QStash setup, commit, push or deployment occurred. New artifact whitespace checks passed.

## Architecture and resolved contracts

PostgreSQL owns admission, graph compilation, state transitions, deterministic handler evaluation, quotas, leases, checkpoints, and cancellation. The TypeScript runner orchestrates narrow worker RPCs. It never submits a graph or execution result. QStash remains replaceable delivery infrastructure for Phase 2C and is not configured here.

- Start only from the owner's saved `ff_workflows.document`. Atomically lock the existing workspace, check its expected bigint revision, compile the saved graph, capture its immutable snapshot/provenance, reserve a concurrency slot, and insert the ready outbox event. Do not increment the workspace revision for execution.
- Idempotency keys are 1–128 ASCII letters/digits or `._:-`, scoped to a workspace across workflows. They have **no automatic expiry in Phase 2B**. SHA-256 hashes cover workflow ID, expected workspace revision, and normalized JSONB manual input. An identical retry returns the original run before current-revision/quota validation; changed content with the same key returns 409. Rejected starts do not reserve a key.
- Manual input must be a JSON object. The trigger copies it, ignoring the simulator's configured sample amount/email. Transforms assign one top-level literal string; blank, oversized, and prototype-related field names are rejected. Conditions compare a JSON numeric `amount` to the configured numeric threshold. Missing/non-numeric amounts fail the node; no expression/template evaluation occurs.
- Reject unsupported handlers, cycles, invalid ports/references, disconnected nodes, duplicate identities/connections, and multiple incoming edges. Fan-out is allowed; joins are not. Compile breadth-first, with sibling target IDs sorted. Each child receives only its parent's committed JSONB output. Unselected branches checkpoint as skipped with empty outputs; siblings cannot change each other's payloads.
- State transitions: queued → running → succeeded/failed/timed_out; queued cancellation finishes immediately as cancelled; running cancellation records cancellation_requested, then the next claim/checkpoint finalizes cancelled. Terminal states stay terminal. Failures stop the entire run; nodes not yet begun have no attempt records. Already committed results remain intact.
- A claim obtains a 30-second lease and increments a bigint fencing generation. Every advance checks worker UUID, generation, lease expiry, and checkpoint cursor while locking the run row. Valid advances renew the lease, capped by the execution deadline. A completed checkpoint cannot be replayed into the next node.
- Each node uses separate begin and completion transactions. Interrupted running attempts become abandoned on lease takeover. Committed nodes are never recomputed. At most three attempts per node are allowed, including abandoned attempts; only lease/interruption recovery is retryable. Malformed input, unsupported graphs, numeric errors, and output-limit failures are not retried. A transport/lease error stops the local drain; rerun it after the lease expires.
- The five-minute deadline starts at the first worker claim and does not reset on recovery. Queue wait is measured from admission and capped at thirty minutes. Expiration is enforced before execution/checkpoint and during admission cleanup/cancellation. Without a running poller a stored status can remain stale until touched; no late checkpoint can commit.
- Two queued/running/cancellation_requested runs reserve the two workspace slots. Admission serializes on the workspace row; expired/cancellation-requested rows are finalized before quota counting. Ten accepted new starts are allowed in a sliding sixty-second window, including subsequently failed/cancelled runs. Identical retries do not count again. Quota RPC responses return `limited:true` so cleanup can commit; the HTTP adapter returns 429.
- Retention: retain runs, attempts, snapshots, idempotency records, and outbox records without automatic pruning in Phase 2B. Workflow deletion does not remove historical runs. Existing account/workspace deletion cascades through the new objects, preserving Phase 1's cascade semantics. Ordinary authenticated clients have no delete capability. A bounded operational retention/pruning policy is required before production.
- Ready events are inserted atomically with runs; cancellation and terminal events are durable and deduplicated by (run,event). The local runner polls authoritative run rows; claim acknowledges ready delivery and terminalization acknowledges remaining events. QStash dispatch/retry/reconciliation is deferred to Phase 2C.

All approved limits are enforced by PostgreSQL: 100 nodes, 500 edges, 256 KiB snapshot, 64 KiB manual input, 64 KiB node output, 1 MiB total committed outputs, two active reservations, ten starts/minute, five-minute execution and thirty-minute queue wait. Byte accounting uses UTF-8 PostgreSQL JSONB text, including its normalized whitespace; skipped empty outputs also count. The API additionally uses existing bounded JSON parsing (5,000,000 raw bytes) and the smaller manual-input bound. SQL remains authoritative if JS serialization counts fewer bytes.

## Database migration ready for review

File: [20261019110206_phase2b_execution_core.sql](supabase/migrations/20261019110206_phase2b_execution_core.sql)

Created using `supabase migration new phase2b_execution_core`. SHA-256:

```text
61E741AE92C314F94CDD3BF9B04F69BEBC1F04A45A6ABA47A130F74BBB4A63E2
```

The migration is additive and was applied only to isolated local PGlite test databases. It creates:

- `public.ff_runs`: saved provenance, immutable snapshot/compiled plan/manual input, request hash/key, state, deadlines, cancellation, lease/fence, cursor and aggregate output accounting.
- `public.ff_run_steps`: tenant/run FK, node ordinal, attempt/generation, state, measured transaction timestamps, committed output/branch and safe error codes. A partial unique index prevents duplicate committed checkpoints.
- `flowforge_private.ff_execution_outbox`: ready/cancel/terminal events with durable acknowledgement and pending index.
- Four private helpers (immutable-provenance trigger, compiler, terminalization, expiration) and five public RPCs (`ff_exec_start`, `ff_exec_cancel`, `ff_exec_read`, `ff_exec_claim`, `ff_exec_advance`).
- RLS on all three tables, owner/Google-OAuth read policies on runs and steps, explicit grants/revokes, tenant/history/claim/checkpoint/outbox indexes and constraints.

There are no changes to previously applied migration files, no seed/data backfill, no drop/truncate statements, and no changes to existing Phase 1 object definitions/grants. Application DML occurs only inside the new execution functions when those functions are later invoked. Immutable provenance is protected by a before-update trigger.

Expected new privileges:

| Principal | Capability |
| --- | --- |
| authenticated | Owner/Google-OAuth SELECT on runs/steps; execute cancel/read; start disabled until approved opt-in |
| service_role | No execution capability initially; after separately approved enablement, claim/advance only; never direct new-table SELECT or writes |
| anon / PUBLIC | No new-table or new-function access |
| function owner | Narrow definer functions perform execution writes; empty search_path |
| all API roles | No direct private helper/outbox/sequence access |

No blanket schema usage or old-table privileges are added. The old service-role limitations remain intact. Definer worker RPCs compute results internally; neither authenticated users nor the runner can submit fabricated outputs.

## HTTP contracts

All endpoints reuse existing independently verified Google/Supabase authentication, mutation Origin checks, bounded JSON parsing, and private/no-store responses. No worker HTTP route exists.

| Endpoint | Request | Response |
| --- | --- | --- |
| POST /api/workflows/[id]/runs | Idempotency-Key header; JSON `{expectedRevision: integer, input: object}`; extra body keys rejected | 200 `{runId,state,replayed}` |
| GET /api/executions | Optional `cursor=<run UUID>` | `{runs,nextCursor}`, newest first, 25 summaries |
| GET /api/executions/[runId] | Run UUID | Owner-visible run details and immutable snapshot/input; worker identity/lease, key/hash and compiled plan excluded from this HTTP response |
| GET /api/executions/[runId]/steps | Run UUID | Attempts ordered by node ordinal and attempt; bounded by 100 nodes × 3 attempts |
| POST /api/executions/[runId]/cancel | Run UUID, same Origin | `{runId,state}`; repeat-safe |

History uses a tenant-visible (created_at,id) keyset anchored by the cursor run. Invalid UUIDs return 400; absent/foreign runs and cursors return 404. Authentication failures retain existing 401/403 behavior. Revision/idempotency conflicts return 409; unsupported/malformed starts return 422; admission quotas return 429; unavailable database/RPCs return a redacted 503. Existing raw-body parsing failures return 400. HTTP error messages do not expose SQL/credentials.

## Local runner

After explicitly enabling capabilities in an authorized local fixture using the operation script above, run `node --import tsx scripts/run-executions.mts` with `FLOWFORGE_RUNNER_URL` and `FLOWFORGE_RUNNER_SERVICE_KEY` supplied for that local Supabase instance. No environment files or credentials were added/changed. The script rejects hosted URLs and production mode, accepts loopback hosts only, drains at most ten runs by default, and does not poll indefinitely. The reusable drain supports an explicit cap of 1–100 runs and at most 100 node operations per claimed run.

The runner only calls service-role-only claim/advance RPCs. A wrong role cannot claim work, and the worker cannot write tables directly. It can resume from persisted checkpoints with a new worker identity after lease expiry. HTTP, notification, external side effects, arbitrary code, webhook ingress, and QStash remain disabled. The existing frontend still invokes its unchanged simulator.

## Files created and modified by this implementation

Created:

- The single migration above.
- `src/lib/execution/compiler.ts`: real-graph admission/types and pure reference handler checks; SQL compilation/evaluation is the production authority.
- `src/lib/execution/api.ts`: request validation, UUID checks and safe RPC/error adapter.
- `src/lib/execution/runner.ts`: bounded, restartable RPC orchestration.
- `scripts/run-executions.mts`: loopback-only runner command.
- `src/app/api/workflows/[id]/runs/route.ts`.
- `src/app/api/executions/route.ts`.
- `src/app/api/executions/[runId]/route.ts`.
- `src/app/api/executions/[runId]/steps/route.ts`.
- `src/app/api/executions/[runId]/cancel/route.ts`.
- `tests/execution.test.ts`.

Modified:

- `tests/database.test.ts`: add the existing Supabase service role to its isolated auth fixture, required by the new explicit grants.
- `scripts/test-supabase.mts`: same fixture role; explicit execution RPC adapters; a test-only loopback service credential restricted to the two worker RPCs.
- `tests/browser/phase1.spec.ts`: execution API and standalone local-runner integration case.
- This report. Next's build refreshes its generated type references; pre-existing working-tree changes were preserved.

No frontend components/styles, simulator behavior, authentication implementation, dependencies, or existing migration SQL were changed by this implementation.

## Verification and evidence

- TypeScript: passed.
- ESLint, zero warnings: passed.
- Complete unit/local PostgreSQL suite in Phase 2B.1: **85 passed**, including existing simulation/persistence/auth regressions, default-disabled effective privilege checks, reversible ACL disable/re-enable, and hosted/production runner guard checks without credential leakage.
- Prior Phase 2B browser/API baseline: **22 passed** (50.3 seconds), followed by the strengthened execution case passing (15.3 seconds including startup). Phase 2B.1 reruns instead produced 21 passed / 1 unresolved export/reload timeout on each of two attempts; see the current safety-gate entry above.
- Production Next.js build: passed; all five new API routes are present in the route manifest.
- Execution tests cover graph rejection, immutable snapshots, saved-workflow deletion, numeric branching, sibling payload isolation, idempotency/hash conflicts, revisions, quotas, role/RLS isolation, forged-write denial, lease expiry/fencing, abandoned attempts, bounded retries, duplicate checkpoint requests, crash continuation, cancellation, deadline and queue-wait expiry, per-node/aggregate output growth, and outbox records.
- The integrated API case covers unauthenticated/cross-origin requests, graph/owner-body rejection, owner/foreign reads and cancellation, idempotency mismatch, and execution through the actual runner CLI → loopback REST fixture → PostgreSQL → authenticated details/steps APIs.
- Test fixture identities/credentials are synthetic and confined to loopback; these results do not claim fresh live Google OAuth or hosted execution acceptance. No runtime test wrote hosted data.
- The initial sandbox test launch failed in Node account lookup before tests ran. Authorized local execution outside that sandbox passed; that initial failure is not counted as a feature failure.
- Superseded Phase 2B limitation: PGlite serialized its single connection and psql was not on PATH. Phase 2B.1 discovered PostgreSQL 18.6 outside PATH and passed the independent-session contention/recovery harness described above. PostgreSQL 17/Supabase-hosted parity and exhaustive scheduling/provider-failure coverage remain unverified.
- A standalone local Supabase/PostgREST stack was not available; REST integration used the existing explicit test fixture. The actual loopback runner process was exercised through that fixture.

## Hosted pre-application safety inspection

Read-only MCP inspection confirmed the target URL `https://kixwwrmedqazurvdnfhi.supabase.co`; the saved CLI project ref also matches. Hosted migration history still contains **only** `20261018215836` and `20261018225425`. New execution objects are absent.

Application catalogs, RLS/policies, function definitions/grants, schema/default privileges, and event triggers match the reconciled baseline. All six application-table row counts and full-row fingerprints still match the earlier reconciliation: profiles 2, workspaces 2, workflows 2, preferences 2, simulations 1, imports 0. Neither existing migration SHA-256 changed. No unexpected hosted privilege changes were found.

The proposed SQL was inspected for scope and explicit permissions. Its intended new privileges are enumerated above. No hosted migration has run and no data was changed. Recheck target/history/fingerprints immediately before applying if approval is later given.

## Remaining gate and Phase 2C prerequisites

**Await restorable recovery-point evidence, fresh preflight and explicit approval to apply exactly the revised Phase 2B migration to project kixwwrmedqazurvdnfhi.** This is the user's migration-safety requirement, not an inferred approval rule. Follow the dedicated runbook and supported CLI procedure; do not use db push/reset or replay prior SQL. No approval to enable execution or start a hosted worker is implied.

After an approved hosted application, verify exact migration history/schema, intended new privileges and unchanged Phase 1 permissions/data; verify PostgREST RPC visibility and authenticated tenant behavior. Exercise genuine multi-session PostgreSQL admission/lease/cancellation contention in an authorized test environment. Keep the loopback guard and hosted execution disabled in this phase.

Phase 2C requires separate work/authorization for QStash configuration, authenticated delivery, outbox dispatch leases/retries/backoff, duplicate/stale delivery rejection, recovery/sweeper operation, operational logging/redaction and retention. The current outbox is a durable foundation, not a deployed queue-delivery system. Frontend integration remains Phase 2D; production security/staging acceptance remains Phase 2E. No commit, push, deployment or Phase 2C implementation occurred.

---

## Historical prerequisite records

### Original prerequisite report

Date: October 19, 2026 (Asia/Calcutta).

Status: **GO for Phase 2B implementation. Migration history is reconciled and the approved architecture is restored in PHASE2A.md. Implementation and QStash integration have not started.**

The Phase 2B brief explicitly requires stopping if hosted database access is unavailable or migration history is inconsistent. No execution implementation or schema changes were made.

## 1. Architecture implemented

None in this phase. The existing Next.js, Supabase Auth, PostgreSQL persistence, frontend, and browser simulator remain unchanged by this task.

The approved Phase 2A architecture was initially missing. It has now been reconstructed in [PHASE2A.md](PHASE2A.md) from the user's supplied prior-approved decisions. That document distinguishes the reconstructed approval, recorded reconciliation evidence, focused repository compatibility observations, and implementation details still to specify. Earlier blockers below are historical; see the latest restoration entry for the current decision.

## 2. Database inspection and changes

Local migrations inspected:

- `supabase/migrations/20261018215836_phase1_workspaces.sql`
- `supabase/migrations/20261018225425_phase1_revision_conflict_status.sql`

Phase 1 defines profiles, workspaces, workflows, preferences, simulations, and import fingerprints. User/profile and workspace identifiers are UUIDs. Workflow identifiers are text, with the composite key `(workspace_id, id)`. Workspaces carry a bigint revision. The follow-up migration changes revision-conflict errors to `PT409`.

`PHASE1.md` states that both migrations were manually applied through the hosted SQL Editor and neither was registered in CLI migration history. This is an unresolved, documented history discrepancy; its current hosted state could not be independently verified.

The configured Supabase hostname matches the FlowForge project returned by the connected Primary account's project listing. However, both read-only prerequisite calls failed:

- `list_migrations`: `You do not have permission to perform this action`.
- `execute_sql`: the same permission denial. The query requested migration-history table existence, application table/RLS metadata, policies, and workflow role privileges; no application row data or writes were requested.

Project visibility does not establish database inspection permissions. Hosted schema, policies, privileges, and migration history remain unverified in this session. No history repair, migration creation/application, provider setting change, or hosted data mutation was attempted.

## 3. New files

- `PHASE2B.md`: this prerequisite/blocker report.

## 4. Modified files

None by this task. The working tree already contained substantial Phase 1 edits and untracked files; those were preserved.

## 5. API contracts

The five requested execution endpoints were not implemented. Existing authentication/API helpers were inspected: server-verified Google identity and OAuth claims, exact-Origin checks for mutations, private/no-store response headers, bounded JSON parsing, and revision-checked workspace RPCs are available for reuse.

## 6. Execution state machine

Not implemented. No durable runs, node attempts/checkpoints, leases, fencing generations, cancellation, retries, deadlines, worker, or outbox were introduced. Production execution remains unimplemented by this task.

The existing graph contract uses `Workflow`, React Flow nodes/edges, and trigger/transform/condition/http/notification kinds. `graphError` validates identifiers, required configuration, numeric values, and ports. The execution foundation still needs its stricter supported-node subset, limits, DAG/join restrictions, and branch-local payload semantics; those were not added to the simulator.

## 7. Security controls inspected

Local Phase 1 SQL enables RLS on all six application tables. Read policies require Google/OAuth authentication and workspace ownership. Authenticated clients receive SELECT privileges rather than direct table writes. Narrow private SECURITY DEFINER helpers enforce authentication and revision checks, with public SECURITY INVOKER wrappers and explicit function grants/revokes. Hosted equivalence could not be verified.

No secrets were printed or changed. No authentication provider settings, dependencies, frontend files, applied migrations, deployment settings, queue resources, or schedules were changed. No commit, push, or deployment was performed.

## 8. Test results

The existing database strategy was inspected in `tests/database.test.ts`: PGlite executes the sorted SQL migration files against PostgreSQL with fixture auth roles/claims. Existing cases exercise bootstrap, actual SQL permissions/RLS, two-user isolation, revision conflicts/rollback, persisted simulations, import idempotency, and anonymous/email-principal rejection. These are local PostgreSQL authorization checks, not hosted Supabase verification. The browser fixture in `scripts/test-supabase.mts` also loads the migration files in order.

No tests were added. TypeScript, ESLint, unit tests, database tests, and production build were not run because implementation stopped at the required prerequisite gate. No prior verification results are claimed as results of this task. The documentation diff was checked with `git diff --check -- PHASE2B.md`.

## 9. Unresolved blockers and resumption requirements

1. Restore read access to FlowForge's hosted migration history and SQL metadata through the connected Supabase account or another authorized database connection.
2. Verify the actual hosted schema against both existing migration files and reconcile the documented manual-application/history discrepancy before execution migration work. Do not edit applied migrations or replay them speculatively.
3. Supply the approved Phase 2A architecture report or its location so implementation can follow its decisions.

Once these prerequisites are satisfied, repeat the hosted checks before implementing the requested execution foundation and full verification suite.

## 10. Queue integration decision

**NO-GO.** The database prerequisite gate has not passed and the durable execution foundation has not been implemented or verified. QStash integration and deployment require the user's subsequent approval after Phase 2B completion.

## Migration-history reconciliation preflight — October 19, 2026

Latest status: **BLOCKED / NO-GO for Phase 2B. No history repair performed.**

The newly authenticated Supabase MCP resolves to `https://kixwwrmedqazurvdnfhi.supabase.co`. Fresh read-only catalog queries match the previous hosted baseline: tables, columns/defaults/nullability, constraints, indexes, RLS flags/policies, function definitions/security settings/ACLs, schema permissions, default privileges, role table privileges, and event triggers are unchanged. This includes the seven Phase 1 functions and the `PT409` revision-conflict code. The additional hosted `rls_auto_enable` function/`ensure_rls` trigger and previously observed service-role privileges are unchanged.

MCP `list_migrations` returns an empty list. Catalog inspection still finds no `supabase_migrations.schema_migrations` table. There are exactly two local migration SQL files and no unexpectedly registered remote versions.

Local SHA-256 fingerprints recorded for the next approval preflight:

- `20261018215836_phase1_workspaces.sql`: `8E0CE236B2DCFD81B2B1086448E745047800D284FDE2034A45844AF4F20C985D`
- `20261018225425_phase1_revision_conflict_status.sql`: `3EBFE46DB82850B25283903E60195308EE46D57B5B19163B90250A929B80FBF0`

Neither migration was edited. These fingerprints establish the current byte baseline; the earlier audit did not record file hashes, so byte-for-byte identity with that earlier point is not independently attested.

Installed Supabase CLI version `2.121.0` was verified, and help for `whoami`, `link`, `migration list`, and `migration repair` was inspected. CLI `whoami --output-format json` failed with `AccessTokenRequiredError`: no CLI access token is available. MCP OAuth authentication does not supply CLI authentication. This checkout has no `supabase/.temp/project-ref`, so a linked target cannot yet be verified. The required `migration list --linked` preflight has not run successfully; MCP history inspection does not replace that requirement.

Next steps, in order:

1. Authenticate the CLI with `supabase login`; verify `supabase whoami`.
2. Link explicitly with `supabase link --project-ref kixwwrmedqazurvdnfhi`; verify the saved project ref equals that exact target.
3. Run `supabase migration list --linked`; require only the two expected local versions and neither remote version. Recheck the hashes and hosted schema/history immediately before repair; stop on any difference.
4. Obtain the user's explicit metadata-change approval, as required by their reconciliation procedure.
5. Only after approval, run `supabase migration repair 20261018215836 --status applied --linked` and `supabase migration repair 20261018225425 --status applied --linked`. These commands register tracking metadata without replaying application migration SQL.
6. Verify both versions in LOCAL and REMOTE history, recheck application schema and permissions, and record the actual outcome in both phase reports.

No hosted schema, migration metadata, or application data was changed. No migration SQL was replayed; no db push/reset, commit, push, deployment, or Phase 2B implementation occurred. The migration-history prerequisite remains unresolved. The approved Phase 2A architecture report also remains an outstanding prerequisite documented in PHASE2B.md.

## Authenticated CLI preflight completed — October 19, 2026

This update supersedes the CLI authentication/link blockers in the preceding preflight. Supabase CLI 2.121.0 successfully authenticated with `whoami`; `projects list` confirmed access to the ACTIVE_HEALTHY FlowForge project `kixwwrmedqazurvdnfhi`. The requested `supabase link --project-ref kixwwrmedqazurvdnfhi` succeeded. The saved `supabase/.temp/project-ref` was checked for an exact match before listing migrations.

`supabase migration list --linked` succeeded and returned exactly:

| Local version | Remote version |
| --- | --- |
| 20261018215836 | absent |
| 20261018225425 | absent |

Both migration files retain the SHA-256 fingerprints recorded above, checked before linking and after the history inspection. No extra local migration files or registered remote versions were found. Fresh MCP catalog comparisons before and after the CLI operations match the audited hosted schema and permissions baseline, including all Phase 1 functions and the PT409 conflict behavior. The post-list MCP history remains empty and the tracking table remains absent.

**Ready for explicit metadata-repair approval; repair has not run.** Proposed commands:

```powershell
supabase migration repair 20261018215836 --status applied --linked
supabase migration repair 20261018225425 --status applied --linked
```

After approval, recheck the exact linked target, fingerprints, hosted schema/permissions, and history immediately before repair; stop on any unexpected change. Then verify both versions in local/remote history and recheck schema/permissions afterward. Phase 2B remains NO-GO until reconciliation is completed and verified; the approved Phase 2A architecture report remains separately outstanding. No application schema/data changes, migration replay, db push/reset, commit, push, deployment, or Phase 2B implementation occurred.

## Approved migration-history reconciliation completed — October 19, 2026

**Database prerequisite: GO. Overall Phase 2B implementation: NO-GO pending the approved Phase 2A architecture report.** This result supersedes earlier migration-history/authentication/link blockers; earlier entries are retained as historical records.

The user explicitly approved only the two named metadata repairs against `kixwwrmedqazurvdnfhi`. Immediately before execution, the saved linked project ref matched that exact target; CLI `migration list --linked` showed exactly the two expected local versions with empty remote entries; MCP history was empty; hosted schema and permissions matched the audited baseline. Both migration SHA-256 fingerprints matched the values recorded above before execution and again after verification.

Both approved commands completed successfully with exit code 0, individually:

```powershell
supabase migration repair 20261018215836 --status applied --linked
supabase migration repair 20261018225425 --status applied --linked
```

CLI returned `Repaired migration history: [20261018215836] => applied` and `Repaired migration history: [20261018225425] => applied`. No fallback or additional repair was attempted.

Post-repair `supabase migration list --linked` succeeded:

| LOCAL | REMOTE |
| --- | --- |
| 20261018215836 | 20261018215836 |
| 20261018225425 | 20261018225425 |

MCP independently returned exactly those versions, named `phase1_workspaces` and `phase1_revision_conflict_status`. There are no unexpected registered versions. The formerly absent `supabase_migrations.schema_migrations` tracking table now exists.

Hosted application tables/columns/defaults/nullability, constraints, indexes, RLS flags and policies, all function definitions/signatures/security settings/ACLs, schema permissions, default privileges, role table privileges, and event triggers match the immediately preceding baseline. The application tables inventory is unchanged; only migration-history objects were excluded from that inventory comparison. PT409 remains present in the commit function. No application schema changes were detected.

Application data was checked with read-only, order-independent full-row content fingerprints (MD5 of sorted per-row JSON hashes) and exact row counts immediately before and after repair. All six counts and fingerprints matched:

| Table | Rows before / after |
| --- | --- |
| ff_profiles | 2 / 2 |
| ff_workspaces | 2 / 2 |
| ff_workflows | 2 / 2 |
| ff_preferences | 2 / 2 |
| ff_simulations | 1 / 1 |
| ff_imports | 0 / 0 |

These checks cover all existing rows in the six application tables without outputting their contents. They are snapshot comparisons, not an assertion about unrelated Supabase-managed data or concurrent activity outside the inspection interval.

Migration history is reconciled and the database gate is cleared. The separately documented approved Phase 2A architecture report was not supplied and a fresh repository filename search did not locate it; implementation remains on hold for that prerequisite. No Phase 2B code or execution migration was created. No migration SQL was replayed, no db push/reset was run, and no application data mutation, commit, push, or deployment was performed. Documentation whitespace validation passed.

## Phase 2A architecture restored — October 19, 2026

**GO for Phase 2B implementation.** The missing architecture-document prerequisite is resolved by [PHASE2A.md](PHASE2A.md), reconstructed from the user's supplied prior approval. The reconciliation evidence in PHASE1.md and this report confirms the database gate already passed; no new hosted inspection was performed for the documentation restoration.

The focused compatibility check found no blocking contradiction. Real execution must use the existing workspace-wide revision, stricter graph/size admission, branch-local immutable payloads, and separate run/step/outbox state while preserving the current persistence, simulation, auth, and frontend. Exact API/schema contracts, idempotency semantics, handler details, leases/retries/cancellation, quota/timing/byte accounting, runner permissions, and retention remain implementation decisions listed in PHASE2A.md. They are not invented prior approvals.

This entry supersedes earlier NO-GO decisions based on migration history or the missing architecture. It does not establish queue, staging, or production readiness, or close unrelated Phase 1 provider-setting caveats. Phase 2B implementation has not begun. Only PHASE2A.md and this report were changed in this restoration task; no execution objects, APIs, migrations, hosted changes, commit, push, or deployment were made. Documentation whitespace checks passed; runtime tests/builds were not run for these documentation-only changes.
