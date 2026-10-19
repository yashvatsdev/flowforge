# Phase 2E — Security audit and staging readiness

Audit began October 19, 2026; final observations extend into October 20 Asia/Calcutta. Existing hosted project: **kixwwrmedqazurvdnfhi**. **NO-GO for a protected hosted deployment now. NO-GO for real execution.** Local audit/preparation and validation are complete; the external prerequisites below are not satisfied. No Phase 3 deployment or hosted modification was performed.

## Scope and audit outcome

Read AGENTS.md, PHASE1/2A/2B/2C/2D, all migrations and operations, recovery/readiness/setup/results documents, API/auth/persistence code, execution/delivery/worker/UI code, tests and build configuration. Used Supabase, Codex Security and Vercel environment guidance. The Standard source audit included an independent baseline, an independent architecture review and focused browser/presentation reviews, followed by parent source/counterevidence validation. It is not a fresh approval of prior architecture decisions.

No confirmed exploitable tenant-isolation, SQL/JavaScript injection, worker-authentication, lease/fencing, idempotency or cancellation bypass survived review. This is not an absence-of-vulnerabilities guarantee. Large design/refinement stylesheets received complete targeted security-construct searches rather than full manual line-by-line review; generated/ignored evidence, binary dependencies and Git history were not comprehensively secret audited. Hosted provider acceptance and recovery were not exercised. The generated report intentionally records partial coverage and operational follow-up.

Codex Security scan: `69128ad8-d05e-4e63-be89-52adb0f57a1e`. Its immutable generated report is at `C:/Users/yashv/.codex/state/plugins/codex-security/scans/flowforge-source/22129ba38cf0d7057d03c8c325b8b2fb58430a93_20261019T182611Z_lrywwq9m/report.md`. That source audit completed before the local copy/configuration changes below and the subsequent detailed drift investigation. It was not rewritten to imply those later changes were present in its original source snapshot. Account Daybreak access was reported not granted; this did not block the local audit.

| Surface | Verified controls and limits |
| --- | --- |
| Auth/session | Server `getUser` plus verified claims, OAuth AMR and Google identity; user metadata is display-only. PKCE callback, safe internal redirects, exact configured mutation Origin, HTTP-only/SameSite cookies, Secure with HTTPS APP_ORIGIN, private/no-store API responses. Real hosted provider/cookie/protection acceptance remains pending. |
| Ownership/RLS | Existing owner-scoped SELECT policies, authenticated direct writes denied, narrow private write functions checking identity/revision. Execution public/private tables use RLS and explicit ACL revocation; no browser-provided tenant identity authorizes a write. Direct RPC access is considered independently of Next routes. |
| Definer/injection | Empty function search paths and qualified objects; no dynamic SQL/code handler or arbitrary result-writing capability. Real handlers admit manual trigger/literal transform/numeric condition only; HTTP/notification/arbitrary code remain disabled. |
| Execution | Transactional owner/revision/idempotency/quota admission; immutable snapshot/provenance; row locks, live leases, monotone fences and checkpoint cursor; bounded deterministic outputs; terminal-state/cancellation checks. No SQL changed in this task. |
| Delivery/maintenance | Raw-body signature/body/canonical-URL/expiry verification with current and next keys; strict identifiers, bounded ingress and fixed provider destination; constant-time dedicated maintenance Bearer, fixed actions, no browser worker endpoint. Durable dispatch attempts, stale-generation rejection, duplicate-safe targeted claims and bounded recovery remain SQL-authoritative. |
| Disablement | Migration grants remain default off, including direct RPC. Local runner/background runtime reject hosted/production targets; UI also rejects production/hosted enablement. Flags alone cannot activate production. Revocation does not abort already authorized statements; quiescence is independently required. |
| Payloads/logs | API DTOs omit private execution/configuration metadata and redact bounded text; React renders text. Redaction is heuristic and does not restrict an owner's direct RLS-authorized original-data reads. Operational logging selects metadata; no credentials/raw RPC errors are spread. No real embedded privileged credential was established in inspected source. |
| Resource/abuse | JSON byte limits and graph/output/admission quotas are present. Not all OAuth/read/save paths have application-wide rate limits. A request-body timeout hypothesis did not establish unlimited DoS given inspected Next/Node buffering/time controls; a route-only timer would not bound pre-route trickling. Actual platform body/time/rate/cost controls remain launch acceptance requirements. |
| Backups/privacy | Protected storage was previously prepared, but independent encryption/decryption custody, a restorable backup and isolated restore are unverified. Browser recovery exports are sensitive documents, not database disaster recovery. |

## Local corrections and staging implementation

1. Corrected `src/components/landing.tsx` privacy/account/storage copy. Public simulation stays local; Google-authenticated studio saves cloud workspace data; real execution remains hosted-disabled. Layout, styles, animations and simulation behavior were preserved.
2. Corrected README route/storage/import/execution descriptions and aligned its local start-port example with APP_ORIGIN. Authenticated import adds copies; explicit draft restoration remains a separately confirmed replacement.
3. Added `src/lib/staging-policy.ts` and `scripts/verify-staging.mts`: offline, process-environment-only gate A validation, no file loading/provider calls/deployment. It rejects the production project reference, mismatched target, insecure/malformed origin, non-publishable key format, operational credentials and privileged NEXT_PUBLIC names. It never prints values. It cannot prove key provenance, ownership, RLS or platform protection.
4. Added `config/staging.env.example`, with placeholders only, and `.vercelignore` to exclude local env/credentials, generated outputs, evidence/test clusters and backups from CLI source uploads.
5. Added `tests/staging-policy.test.ts` with positive isolated-config and negative target/origin/key/credential cases. No grant, runtime activation barrier, request API contract, package dependency or SQL was changed. No confirmed vulnerability required an authorization-weakening workaround or speculative parser rewrite.
6. Created [the deployment runbook](docs/PHASE3_DEPLOYMENT_RUNBOOK.md) and [the separate data-drift investigation](docs/PHASE2E_DATA_DRIFT.md). The accepted PHASE2B_READINESS baseline remains unchanged.

These are the only Phase 2E source/configuration/document changes: the five new staging/support files above, the two new dedicated documents, this report, README and landing copy. Existing prior-phase uncommitted work was preserved. No production credential/environment file was edited.

## Hosted migration and data preflight

Fresh read-only MCP checks identify FlowForge ACTIVE_HEALTHY, region ap-northeast-1, PostgreSQL **17.11**. History contains exactly `20261018215836` and `20261018225425`; Phase 2B and 2C remain absent. No ff_runs, ff_run_steps or execution outbox exists. Six Phase 1 tables retain RLS and expected owner/Google read policies; effective authenticated SELECT is allowed, API direct writes are denied, anon/service-role table access remains denied. Public wrappers and private bootstrap/commit helper ACLs/search paths remain narrow. No public application triggers or cron.job relation were observed.

| Migration | SHA-256, unchanged |
| --- | --- |
| 20261018215836_phase1_workspaces.sql | `8E0CE236B2DCFD81B2B1086448E745047800D284FDE2034A45844AF4F20C985D` |
| 20261018225425_phase1_revision_conflict_status.sql | `3EBFE46DB82850B25283903E60195308EE46D57B5B19163B90250A929B80FBF0` |
| 20261019110206_phase2b_execution_core.sql | `61E741AE92C314F94CDD3BF9B04F69BEBC1F04A45A6ABA47A130F74BBB4A63E2` |
| 20261019134354_phase2c_delivery.sql | `DE5F1020470B22D23C7A04AE0A10227043CC73051C2CE70C981E1A72C1C466A0` |

B must precede C: C adds columns/indexes on B's private outbox and new private attempt records/functions, not old application tables. No destructive modification of existing Phase 1 schema/data appears in either pending file. Applying DDL starts no worker or scheduler. Existing tests exercise ordered application and default-off permissions. No hosted SQL was applied to prove compatibility; production-equivalent **PG17/Supabase/PostgREST acceptance is still required**, and this is not a new full canonical catalog equivalence attestation.

**Data discrepancy:** all original table counts match (2/2/2/2/1/0). Four content fingerprints match; workspace and workflow fingerprints differ. The user's follow-up explicitly requires investigation without accepting a new baseline. The detailed read-only investigation found Workspace A revision **4 → 11** by exact virtual hash reconstruction, a current workflow timestamp **13:43:21.783 UTC**, matching workspace/workflow transaction identity, and four owner-authenticated successful ff_commit calls between **13:43:04.558 and 13:43:22.163 UTC** from the expected SSR SDK. This is consistent with normal application saves. It does **not** explain all seven increments or recover the old workflow content. No prior row snapshot/per-row workflow fingerprint was retained; transaction commit timestamps are disabled and the available logs are not a complete DML audit. **Unresolved deployment/migration blocker; no accepted baseline was updated.**

Migration application remains NO-GO: resolve that discrepancy, verify an independently restorable point and isolated rehearsal, complete external inventory, freeze a quiet-window baseline, review exact current pending set and obtain explicit target/hash/application approval. The new runbook documents both-file application and per-file ambiguous-outcome recovery; do not run the historical exactly-one-pending procedure against this checkout.

## External worker inventory — scoped observations

Read-only connector and workstation checks; no jobs were invoked, paused, deleted or configured.

| System | Current observation | Remaining limit |
| --- | --- | --- |
| Vercel | Default/personal and returned team `techtroop` have zero projects matching FlowForge | No matching deployment/Cron/protection/settings to inspect. Other names/accounts/repos are not ruled out. |
| QStash | Metadata-only listing shows US/EU scopes. Both return empty schedules, delivery-event logs and DLQ | Not an exhaustive live queued/retrying/URL-group/other-account inventory. No tokens/signing credentials retrieved. |
| Supabase | Exact target, zero Edge Functions, no cron.job relation or hosted execution objects; no public application triggers | Other operator-owned projects/providers and integrations require inventory; no new runtime can execute through absent RPCs. |
| GitHub Actions | Remote is yashvatsdev/flowforge. Connector repository metadata returns 404 | Access/absence cannot be distinguished; remote workflows/runs/runners remain unverified. No local .github workflow or Vercel cron configuration was found. |
| Windows | 210 accessible tasks, 318 services inspected; zero names/actions matching FlowForge/QStash/project/ref/runner/maintenance | Matching does not inventory generic wrappers, remote hosts, other accounts or inactive scripts. Action arguments were not printed. |
| WSL/containers/other hosts | No service/runtime was started for inventory | Linux cron/systemd/other servers and complete container state require separately scoped operator inspection. |

Obtain operator-owned account/project/region scope and attestation, enumerate in-flight work, and preserve unavailable-system gaps. A repository search or empty schedule list does not prove global absence of workers.

## Performance and dependencies

No demonstrated bottleneck justified a new service, index or frontend optimization. History uses indexed 25-row cursor pages; browser loads do not overlap per resource, active first-page/details poll five seconds after response, hidden/unmounted work aborts, terminal details stop, errors pause and 120 successful loads require explicit resume. Detail input/output totals are bounded by SQL. Status aggregates can scan run/outbox state; keep privileged/manual until staging measurements justify changes. Worker compute budgets, two-second RPC bounds, five-second provider calls and dispatch loop bounds are present; end-to-end platform latency/backlog/connection capacity remains staging acceptance.

The app uses Supabase HTTPS RPC clients, not a new native PG connection for every browser poll. No production connection load test was performed. Final local build emitted **22 JS chunks, 1,248,470 raw bytes / 408,522 gzip bytes in aggregate**; largest raw chunk 229,820 bytes. These are all-build chunk totals, **not per-route initial transfer or browser performance metrics**. No speculative bundle refactor was made.

Resource-aware checks ran sequentially. At inventory Windows had approximately **4,380 MiB free RAM**, 23.6 GiB total, and **70.5 GiB C: free**. Build used one worker and a 1 GiB JS heap, with isolated output and generated config restored. No unrelated workload was stopped. One restricted-shell CLI attempt failed in Node userInfo before application code (`uv_os_get_passwd ENOMEM`); the host-context rerun worked, so this was not counted as a test pass or attributed to actual low RAM.

Current `npm audit --omit=dev`: **zero findings**. Full audit: **five high development-only entries** through eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces, originating in [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Registry latest braces is 3.0.3; the advisory lists no patched version. npm suggests a major lint-config downgrade to 14.2.35, which was rejected as an unsafe automatic remedy for this Next16/ESLint10 project. No app runtime import or attacker-controlled production glob path was established. Keep tooling inputs trusted, isolate untrusted PR/build jobs from secrets, and review a compatible upstream patch when available. No package/lock change or forced audit fix was made; dev advisories remain tracked.

## Local validation

| Command/check | Final result |
| --- | --- |
| npm run typecheck | Passed |
| npm run lint | Passed, zero warnings |
| node --import tsx --test --test-concurrency=1 tests/*.test.ts | **107 passed**, zero failures/skips, 13.0 s |
| node scripts/browser-tests.mjs --trace on | **27 passed**, 53.1 s |
| npm run build | Passed, Next16.4.2, one worker; compile 3.3 s, TypeScript 4.0 s |
| Gate A CLI with absent staging env | Correctly rejected, exit 1, safe messages, no provider contact |
| npm audit / npm audit --omit=dev | Five dev-only entries / zero production entries |
| Migration SHA-256 / git diff --check | Unchanged / passed (Windows line-ending notices only) |

Security regression coverage includes the three new staging gate cases and existing Google/Origin/redirect/session tests, two-tenant RLS/RPC isolation, prohibited direct writes, default-off/toggle permissions, idempotency/quotas, stale fences/checkpoints/cancellation, signature forgery/body/URL/expiry/key-rotation, maintenance token/ingress size bounds, duplicate delivery/recovery and DTO secret redaction. Browser coverage retains editor/simulation/export/reload/responsive checks plus real persisted-run UI. All run against disposable local fixtures, not real hosted execution/QStash. Existing native independent-session tests were reviewed but not rerun because SQL/runtime core did not change; prior PG18 results are not PG17 acceptance.

Ignored local logs: `.phase2b-evidence/phase2e-*`; current browser traces: `test-results/`. The source audit's measured workbench usage was **12,029,247 total tokens**, **11,994,754 input**, **11,629,824 cached input** (three recorded threads, measured coverage complete). These are tool-reported scan-accounting values, not a billing estimate or a statement of complete security coverage.

## Approval gate and remaining blockers

**Protected execution-disabled deployment: NO-GO now.** Local configuration/template/runbook are prepared, but no isolated staging project/reference, approved HTTPS origin/team, Phase 1 staging schema, Google provider/redirect acceptance, all-URL deployment protection or hosted smoke evidence is verified. Existing-production data drift remains unresolved and must not be bypassed by pointing staging at that project. Obtain specific resource/configuration/deployment approvals only after those concrete prerequisites are ready.

**Real execution: NO-GO.** In addition to the above: explain/accept data drift, verify backup/encryption/isolated restore, review and separately approve both migrations, prove PG17/PostgREST behavior, complete external in-flight inventory, implement/accept production retention with idempotency tombstones and safe cleanup, add monitoring/abuse/cost limits, and review the currently absent production activation path. No automatic deletion is enabled. QStash/Vercel protection interoperability and real provider/security acceptance remain unverified.

The runbook separates A protected deployment, B migrations, C delivery/worker/real execution and D public launch; none is authorized by completing Phase 2E locally. No hosted DDL/DML/ACL/history change, database export/restore/reset, password retrieval/reset, job publication/schedule, production credential change, deployment, commit or push occurred. Stop before hosted changes and Phase 3.
