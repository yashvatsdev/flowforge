# Phase 2C — Local durable delivery and QStash integration

October 19, 2026. Target hosted project: `kixwwrmedqazurvdnfhi`.

**Status: Phase 2C local implementation and acceptance checks complete. GO for Phase 2D local development against disposable/local infrastructure in a subsequent task. Hosted migration, execution, schedules and deployment remain disabled/unapproved; hosted application remains NO-GO.**

## Authorization, inspection and contradictions

The user's attached Phase 2C request explicitly authorizes local development while the Phase 2B hosted recovery gate remains NO-GO. This supersedes earlier instructions to defer Phase 2C implementation; it does not authorize hosted operations or Phase 2D. Reviewed AGENTS.md, phase documents/runbooks, migrations, API/runner/compiler patterns, tests, package/configuration and Next route documentation. Applied Supabase and QStash SDK skills. No frontend redesign is included.

The 2B outbox has only event identity/acknowledgement and cannot safely track publication ownership/attempts. Its ready acknowledgement means a worker claimed authoritative work, not that transport publication succeeded. The 2B global worker claim also cannot target a delivered run. New local SQL adds dispatch metadata and a targeted claim; it never edits either applied Phase 1 migration or the reviewed Phase 2B migration. Cancellation and terminal events remain governed by 2B; Phase 2C publishes only useful ready/cancel notifications, never reinterpreting terminal events as executable jobs.

The hosted backup/recovery blocker remains unresolved. Windows memory initially blocked verification (down to approximately 314 MiB free), but the user subsequently freed memory. Final checks ran sequentially with resource monitoring; the build used one worker and a bounded JS heap. No unrelated process was terminated. Historical interrupted/failing checks are superseded only by the completed results below.

## Architecture and files

PostgreSQL remains authoritative for snapshots, tenant authorization, quotas, node evaluation, checkpoints, leases, fencing, cancellation and deadlines. QStash supplies duplicate-tolerant delivery only. No Redis execution store was added. No handler, local simulation, OAuth flow, workspace persistence or visual component changed.

New files:

- `supabase/migrations/20261019134354_phase2c_delivery.sql` — additive outbox metadata, private attempt records, five public delivery RPCs and a private capability gate; defaults disabled.
- `supabase/operations/phase2c_enable_delivery.sql`, `phase2c_disable_delivery.sql` — narrowly scoped capabilities, documented only for operator use; tests opt in on disposable databases.
- `src/lib/execution/delivery.ts` — versioned strict message schema, bounded dispatcher, worker consumer, local in-process transport, allowlisted operational log fields.
- `src/lib/execution/qstash.ts` — official SDK publishing/Receiver verification, bounded redacted HTTP requester, bounded raw-body reader.
- `src/lib/execution/background-http.ts` — signature-protected worker and Bearer-protected maintenance handlers.
- `src/lib/execution/background-runtime.ts` — default-off local-only runtime/service credential boundary.
- `src/app/api/internal/execution-worker/route.ts` and `execution-maintenance/route.ts` — POST-only nodejs entrypoints, empty worker responses.
- `scripts/delivery.mts` — explicit local dispatch/recover/status invocations; no automatic loop or schedule.
- `tests/delivery.test.ts` — SDK/HTTP/security and PostgreSQL integration coverage.

Modified: shared `runner.ts` extracts the existing begin/complete protocol into a time-budgeted helper; `proxy.ts` delegates authentication of exactly the two internal paths to their handlers without cookie processing/body consumption; `tests/execution.test.ts` includes the new child table in disposable cleanup; `scripts/verify-phase2b-concurrency.mjs` adds optional Phase 2C independent-session groups; browser tests add default-disabled ingress coverage; package/lock add pinned `@upstash/qstash` **2.12.0** and its dependencies. `.gitignore` excludes the isolated production-build directory. PHASE2B.md and its recovery runbook link this phase and explicitly warn that the old exactly-one-pending-migration gate is no longer satisfied. No production credential file was changed.

## Transport and lifecycle

Messages contain exactly `{version:1, runId, eventId, deliveryId}`. UUID, positive bigint-as-string event ID (up to PostgreSQL bigint maximum), exact field set, version and `deliveryId = ff:<eventId>` are validated. There is no workspace claim, graph, snapshot, node output or workflow input. Stable logical identity is `ff:<eventId>`; publication dedup identity additionally includes the durable attempt number, permitting deliberate recovery republication without depending on the provider's dedup retention window.

The local transport queues at most 25 validated copies in memory and explicitly flushes to the same consumer. Local maintenance/CLI dispatch claims only one message per invocation before synchronous consumption, keeping its aggregate work bounded. It is a development transport, not durable infrastructure. A process crash loses its in-memory messages, and DB recovery republishes them. It provides no HTTP authentication bypass.

The dispatcher requests one leased row at a time, at most ten per default call (hard maximum 25), with a 15-second loop budget. PostgreSQL claims use SKIP LOCKED, a 30-second dispatch lease, monotonically increasing generation and durable attempt insertion. Abandoned publishing attempts become ambiguous. A result must match dispatcher UUID, generation and an unexpired lease; a stale acknowledgement is inert. Publication confirmation sets `published_at`; a rejected/unknown publication never does. Worker acknowledgements and confirmed publication remain separate fields.

Attempts are capped at 12 per event. Database backoff is exponential, capped at 60 seconds, with 50-100% jitter. Known transient API errors are retryable; permanent request/auth errors terminal; unknown network/timeout outcomes ambiguous. Unknown results are never assumed rolled back. If publication succeeds and DB settlement fails, the claim expires and another dispatch can publish a duplicate. PostgreSQL worker guards make that safe.

QStash requests have four destination retries (five delivery attempts total), exponential delay `min(60000, pow(2, retried) * 5000)`, 20-second destination timeout and explicit publication dedup IDs. The SDK's default HTTP requester prints raw network errors, so the implementation replaces its public requester with a publication-only bounded fetch adapter. SDK message/header construction is retained; the adapter uses the fixed official API origin, refuses redirects, aborts after five seconds, caps successful responses at 4 KiB and never logs provider bodies/errors. An aborted request can still have published remotely and is classified ambiguous. See [QStash retry documentation](https://upstash.com/docs/qstash/features/retry).

## Worker authority, cancellation and recovery

The worker verifies the original bounded raw body using official `Receiver.verify`, both configured signing keys, exact configured canonical URL and zero clock tolerance. Missing/malformed/expired/wrong-key/body/URL signatures fail closed. Raw reads are capped at 1 KiB and two seconds, including streamed bodies. Valid signatures do not confer run ownership or execution authority beyond the narrow worker capability: the DB validates the event/run relationship, locks the authoritative run, checks terminal/cancellation/deadline state and grants a fresh fenced lease only when available.

The shared existing `ff_exec_advance` evaluates all nodes in PostgreSQL. Workers submit no result values. Each invocation allows at most 100 begin/complete pairs and ten seconds of work plus bounded RPC completion (two-second RPC timeout); a yield leaves the lease intact. The HTTP response is 503 for busy/yielded work, 204 for completed/inert delivery, and never includes run/step data. Retried delivery resumes after lease expiry; a stale generation cannot commit. Declaring busy successful would risk stranding a crashed worker, so busy is retryable.

Explicit recovery maintenance scans at most 25 eligible runs by default (hard maximum 100). It locks runs before outbox rows, skips locked rows, enforces cancellation/queue/execution deadlines, and republishes unleased work when confirmation is older than 60 seconds or a claimed checkpoint was abandoned. Attempt exhaustion finalizes a stranded run as failed with `delivery_exhausted`, preserving existing snapshots/steps/attempts. It never kills a valid lease or retries indefinitely. Provider delivery/DLQ exhaustion is inferred from stale authoritative work, not trusted callback claims. No failure callback endpoint is required.

Recovery requires a regularly invoked operator/maintenance trigger to make progress; without a trigger, timeouts/status can remain stale until touched, as in Phase 2B. This task installs no live trigger. Repeated manual `recover`, then `dispatch` invocations exercise the same safe bounded path. Unknown/foreign event IDs and terminal/cancelled runs are inert. One active worker may finish while duplicate requests arrive; all committed transitions remain fenced by the core.

## Security and configuration

All new RPCs default denied to PUBLIC, anon, authenticated and service_role. The private attempt table has RLS and no API-role table grants. The new definer functions have empty search paths and fully qualified application objects. Enablement requires both the new delivery grants and the existing 2B worker grants. Every new mutating RPC checks the effective service-role EXECUTE privileges on the old claim/advance functions; running the existing 2B disable script therefore closes new worker/dispatcher/recovery entrypoints too. Status remains an explicitly granted metadata-only maintenance read. Revocation does not abort in-flight authorized transactions; preserve the runbook's stop/drain/quiescence procedure. No direct user write grants or authenticated worker execution grants were added.

Runtime variables (server-only):

| Variable | Purpose |
| --- | --- |
| FLOWFORGE_DELIVERY_MODE | Must explicitly equal `local`; unset is disabled |
| FLOWFORGE_DELIVERY_DATABASE_URL | Must be HTTP loopback; hosted targets rejected |
| FLOWFORGE_DELIVERY_SERVICE_KEY | Dedicated local service credential; never NEXT_PUBLIC |
| FLOWFORGE_DELIVERY_TRANSPORT | `local` (default), or separately configured `qstash` |
| FLOWFORGE_WORKER_URL | Exact canonical worker endpoint for signature subject verification; QStash publisher requires HTTPS |
| QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY | Both required, no environment/dev-server fallback |
| FLOWFORGE_MAINTENANCE_TOKEN | Dedicated random token of at least 32 characters, constant-time checked |
| QSTASH_TOKEN | Required only for QStash publishing; unavailable/not retrieved during this task |

`NODE_ENV=production` is a hard stop in the current runtime even if flags are set. This is intentional local-only authorization, not production readiness. A later reviewed rollout must change that barrier, use deployment-specific credentials/URLs and verify canonical URL behavior. No hosted activation is possible solely by setting an environment flag in this increment. The QStash transport is implemented and mocked locally; public delivery to a developer's loopback URL is not claimed to work. No tunnel, paid account, remote schedule or production secret is needed for tests.

Maintenance supports only dispatch/recover/status actions, requires its dedicated Bearer token, bounds the request, and is POST-only. Internal requests skip cookie Auth only at two exact paths; their explicit authentication cannot be replaced by user cookies or Origin. Default configuration returns 503 before touching the database. No worker credential is passed to the frontend.

## Operations and retention

`node --import tsx scripts/delivery.mts status|recover|dispatch` uses the same runtime guards and server-only credentials. No automatic scheduler exists. The maintenance POST handler is ready for a future authenticated trigger but no Cron/QStash schedule is configured. Do not use live credentials to test local development.

Operational logs allow only event/run/delivery/outbox IDs, attempt/generation, duration and fixed classifications/recovery action. They omit exception text, provider response bodies, headers, snapshots and input/output data. `ff_delivery_status()` exposes aggregate pending/exhausted/queued/expired counts only to its explicitly enabled service capability. For diagnosis, an approved operator can inspect the private outbox/attempt records in the intended environment: compare availability, dispatch lease/generation, publication and acknowledgement timestamps, fixed failure code and attempt outcome. Never put sensitive row exports in ordinary logs.

For stale queued/running work, first verify the delivery switches, inspect counts/leases, then invoke bounded recovery/dispatch. For exhausted work, retain failed runs/steps and investigate the fixed error/attempt history; do not reset attempts blindly or replay externally acknowledged side effects. Unsupported external effects remain disabled. A new run requires a deliberate new idempotency key after resolving the cause. Unknown schema/history or security failures use the existing data-preserving recovery runbook, not destructive rollback.

No deletion/retention job was added. New attempts follow their parent outbox lifecycle and are preserved for investigation. Phase 2E retention implementation must incorporate attempt history and the existing incident-hold/idempotency constraints before any pruning. Disabling delivery or leaving additive tables/functions in place preserves evidence and data. Both migration application and any hosted enablement remain separately approved actions.

## Verification record and outstanding acceptance

Final executed checks after the user freed memory:

| Check | Result / evidence |
| --- | --- |
| `npm run typecheck` | Passed on the final source/test changes |
| `npm run lint` | Passed, zero warnings |
| Sequential full unit/database/integration suite | **97 passed, zero failures/skips**, 12.5 seconds; `.phase2b-evidence/phase2c-unit-final.log` |
| Independent PostgreSQL sessions | **12 assertion groups passed** (eight core plus four new delivery groups), PostgreSQL 18.6 / CLI 2.121.0; `.phase2b-evidence/pg-INimem/results.json` and CLI logs |
| Full configured Chrome browser suite | **23 passed**, 1.2 minutes; `.phase2b-evidence/phase2c-browser-final.log`, retained traces under `.phase2b-evidence/phase2c-browser-final/` |
| Production build | Passed; `.phase2b-evidence/phase2c-build-final.log`; both new internal routes compiled as dynamic server routes |
| Production dependency audit | `npm audit --omit=dev`: **zero reported vulnerabilities**; `.phase2b-evidence/phase2c-production-audit.json` |
| Migration checksums / whitespace | All prior approved hashes unchanged; new hash below; `git diff --check` passed |

Delivery coverage includes official current/next signing-key verification, raw body/URL/expiry binding, malformed/oversized/stream-stalled bodies, mocked SDK publication headers and error classification, forged worker/missing-maintenance authorization, hard production/hosted runtime denial, bounded local inbox/maintenance batch, private RPC/table denial, duplicate/out-of-order delivery, ambiguous/failed publication, stale dispatch generations, interrupted worker recovery from a committed checkpoint, stale worker fences, cancellation, deadlines, exhaustion and disable-switch preservation. The native contention groups exercised distinct dispatcher claims, abandoned publication, targeted competing workers and contended cancellation using independent backend processes. The disposable server's log confirms shutdown and its postmaster.pid is absent.

Browser regressions include the new default-off ingress check, local OAuth/PKCE fixture, session refresh/sign-out, tenant isolation/execution API behavior, workflow persistence, simulation, recovery import/export and conflict download/reload. The production build used `CIRCLE_NODE_TOTAL=2` (one Next page worker), `NODE_OPTIONS=--max-old-space-size=1024` and `FLOWFORGE_TEST_DIST=.next-phase2c-build`. A wrapper restored next-env.d.ts and tsconfig.json byte-for-byte afterward, preserving the original application configuration and avoiding shared build output. No frontend implementation was changed.

Historical failures were corrected and rerun: old disposable TRUNCATE fixtures omitted the new FK child table; native psql returns boolean `t/f` rather than JSON booleans for settlement; SDK/header and typed-array test declarations needed TypeScript corrections; the local transport had an unused argument. A dedicated stalled-stream test verifies the timeout rejects before cancelling the reader, and local dispatch is capped at one synchronous worker to preserve the route budget. These corrected failures are not counted as green evidence themselves. No unresolved test failure remains in the executed final suite.

The full dependency audit still reports five high findings in existing **development lint-toolchain** packages (`eslint-config-next`, `@next/eslint-plugin-next`, fast-glob, micromatch, braces). No QStash or production-package finding was reported. These packages are not imported by the new worker runtime. This is not a vulnerability-free repository claim: use trusted repository/filesystem inputs for local tooling and review patched compatible dependency updates before Phase 2E acceptance. No force-upgrade or unrelated lint-stack change was made merely to clear an audit count. This known development-tool risk does not block Phase 2D local integration; hosted/production readiness is not granted.

Reproduction commands (run serially with memory headroom):

```powershell
npm run typecheck
npm run lint
node --import tsx --test --test-concurrency=1 tests/*.test.ts
$env:FLOWFORGE_TEST_DELIVERY = '1'
$env:FLOWFORGE_TEST_SUPABASE_CLI = '<installed Supabase CLI absolute path>'
node scripts/verify-phase2b-concurrency.mjs
node scripts/browser-tests.mjs
# Use an isolated build output and restore generated config files afterward,
# as recorded above, when another development server shares the repository.
npm run build
```

The native harness accepts no hosted database URL and creates/stops its own synthetic loopback cluster. Its new groups check distinct dispatcher claims, expired dispatch fencing, targeted concurrent workers/recovery and contended cancellation using separate psql backends. PGlite tests do not substitute for those independent sessions. No test QStash publish was sent to the real provider; fetch is mocked.

Applied Phase 1 checksums remain `8E0CE236B2DCFD81B2B1086448E745047800D284FDE2034A45844AF4F20C985D` and `3EBFE46DB82850B25283903E60195308EE46D57B5B19163B90250A929B80FBF0`. Reviewed Phase 2B remains `61E741AE92C314F94CDD3BF9B04F69BEBC1F04A45A6ABA47A130F74BBB4A63E2`. The new Phase 2C migration currently has SHA-256 `DE5F1020470B22D23C7A04AE0A10227043CC73051C2CE70C981E1A72C1C466A0`; any future byte correction requires a refreshed review/checksum.

## Hosted dependencies and Phase 2D gate

**GO for Phase 2D local development** against mocks/disposable databases in a separately requested task: corrected fixture/contention tests, complete configured browser suite, TypeScript, lint and production build all passed. The development-tool audit findings are assessed above and remain tracked limitations. Phase 2D implementation has not begun. No production-readiness claim is made.

Hosted verification additionally requires Phase 2B backup/recovery evidence, approval and application of both still-pending migrations in reviewed order, expanded schema/permissions/history and data verification, real PostgREST behavior, signing-key/canonical URL checks, actual provider retries/outage/DLQ testing, authenticated maintenance/recovery liveness and separately approved environment/grants/activation. The 2B runbook's historical exactly-one-pending-file condition no longer holds locally: there are now two unapproved execution migrations, so its application command must not be run as written. Future application scope must explicitly approve the pending set and use a revised procedure. No migration repair is appropriate for unexecuted SQL.

No hosted SQL/ACL/history change, production QStash operation, real workflow side effect, deploy, commit, push or Phase 2D implementation occurred.
