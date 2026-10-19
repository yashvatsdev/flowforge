# FlowForge Phase 2B migration application and recovery runbook

Recorded October 19, 2026 (Asia/Calcutta). Target: **kixwwrmedqazurvdnfhi**.

This is an operator procedure, not permission to run hosted writes. Phase 2B.1 executes only disposable local tests and hosted read-only inspection. Hosted migration application, ACL operations, repair, restoration, and later execution enablement each require explicit operator approval identifying the target and action. No production worker or QStash service is started here.

## Reviewed artifact and safe initial state

Migration: `supabase/migrations/20261019110206_phase2b_execution_core.sql`.

| Artifact | SHA-256 |
| --- | --- |
| Phase 1 workspaces | `8E0CE236B2DCFD81B2B1086448E745047800D284FDE2034A45844AF4F20C985D` |
| Phase 1 conflict status | `3EBFE46DB82850B25283903E60195308EE46D57B5B19163B90250A929B80FBF0` |
| Original, unapplied Phase 2B audit artifact | `B7BE32F314963FA14CBE3497087C997E96970E4120B801143ED10C1512FB0F8A` |
| Revised Phase 2B.1 application artifact | `61E741AE92C314F94CDD3BF9B04F69BEBC1F04A45A6ABA47A130F74BBB4A63E2` |

The justified pre-application correction removes automatic grants for start/claim/advance. No function body, table, constraint, existing migration, or Phase 1 permission changed. The new migration grants authenticated users only execution read/cancel; admission and worker RPCs default **disabled**. The old checksum is superseded and must not be approved as the revised artifact. Any later byte change invalidates these checksums and requires review again. This amendment is allowed only because this migration has not been applied anywhere except disposable tests; never edit an applied migration.

No worker, schedule, connector or outbound operation is created by applying this DDL. The database owner remains a trusted break-glass operator; ACL disablement is not a restriction on an administrator who can change database objects.

## 1. Pre-application gate

**Phase 2C local-development update:** the repository now also contains the unapproved `20261019134354_phase2c_delivery.sql`. The exactly-one-pending prerequisite below is therefore no longer satisfied. Do not run `migration up --linked` from this repository under a Phase 2B-only approval: it would include additional pending SQL. A future hosted request must explicitly review/approve its intended pending set and revise this application procedure. No hosted application is authorized by local Phase 2C development.

1. Identify one operator and one migration window; serialize migration writers. Stop if another person or pipeline could apply pending SQL. Do not run this procedure alongside migration repair or schema-editor changes.
2. Verify installed CLI version and help. This procedure was checked with **Supabase CLI 2.121.0**, including local application and injected failure testing. Revalidate behavior after any CLI upgrade.
3. Verify CLI account/project access and the saved linked ref; do not trust a shell prompt or API hostname alone:

   ```powershell
   supabase --version
   supabase whoami
   supabase projects list
   $ffRef = (Get-Content -LiteralPath supabase/.temp/project-ref -Raw).Trim()
   if ($ffRef -ne 'kixwwrmedqazurvdnfhi') { throw 'Wrong linked project' }
   supabase migration list --linked
   ```

4. Require remote history to contain exactly `20261018215836` and `20261018225425`, both paired with LOCAL; require exactly one local-only version, `20261019110206`. List `supabase/migrations/*.sql` and inspect the SQL again. `migration up` applies all pending files and has no single-version flag: any extra pending/missing/unexpected version is a hard stop. Do not use `--include-all`, db push, db reset, or speculative history repair.
5. Verify the three checksums above. For the new file:

   ```powershell
   $ffHash = (Get-FileHash -LiteralPath supabase/migrations/20261019110206_phase2b_execution_core.sql -Algorithm SHA256).Hash
   if ($ffHash -ne '61E741AE92C314F94CDD3BF9B04F69BEBC1F04A45A6ABA47A130F74BBB4A63E2') { throw 'Unreviewed migration bytes' }
   ```

6. Capture a timestamped read-only hosted baseline in a secured operator evidence directory. Capture all Phase 1 columns/constraints/indexes, policies, schema/function ACLs, function source hashes and settings, role memberships/default privileges, and event triggers. Record PostgreSQL version and object owners. Use `supabase/verification/phase2b_inventory.sql` for exact new-object/history inventory and `phase1_data_fingerprints.sql` for row counts/content hashes; capture existing Phase 1 definitions separately as in the prior audit. The before inventory must contain no new execution tables, functions, trigger, sequence or indexes. Check `flowforge_private`, `ff_workspaces`, `ff_google`, `ff_valid_workflow`, required roles, UUID and SHA-256 builtins. Trusted `postgres` must own the migration's objects. Any new collision/drift or unexpected privilege is a stop.
7. Establish an application quiet window or account for concurrent legitimate edits. A changed data hash requires explanation; do not automatically overwrite data to make a hash match. Hashes are not backups. Keep raw backup contents and credentials out of Git, chat output and process command lines.

## 2. Restorable recovery-point prerequisite — mandatory

Before approving application, the operator must supply a usable recovery point covering this exact project and taken before the change. Record backup/PITR identifier, UTC timestamp, coverage, retention/expiry, custodian, restoration destination, expected downtime, recovery-point/data-loss window, and evidence of a successful restore rehearsal to an authorized disposable destination. Confirm the point remains available throughout the maintenance/recovery window.

Prefer an existing provider-managed recovery point with verified restore eligibility. Do not assume the project's plan includes backups/PITR, enable paid features, or create a new paid project in this task. If a logical backup is used instead, follow the provider's complete backup/restore procedure and include roles/ownership/grants, Auth data, public and private application schemas/data, and `supabase_migrations` history. A schema-only `db dump`, exported workflow JSON, or checksum manifest is insufficient. A restore rehearsal must check RLS/definer ownership as well as rows. Securely retain separately required role credentials.

Supabase database backups do not include Storage API object contents; record whether external storage/provider configuration also needs preservation. See [Supabase database backups](https://supabase.com/docs/guides/platform/backups). Restoring the live project is a separate privileged/destructive operation requiring approval; never do it as an automatic response to a CLI error. A disposable restore may incur cost and also requires its own authorization.

**No restorable hosted backup/recovery-point evidence was created or verified in Phase 2B.1. That remains an operator pre-application prerequisite.**

## 3. Exact supported CLI application — after explicit approval only

The following is documented, not executed by this task:

```powershell
supabase migration up --help
supabase migration list --linked
# Recheck the exact ref, one pending version, hashes and recovery point above.
# STOP here until explicit approval for the revised artifact is recorded.
supabase migration up --linked
supabase migration list --linked
```

Use CLI 2.121.0 from the repository root; do not pass a different project ref/database URL or change workdir for hosted application. The approved pending set must still consist of only the new Phase 2B migration. Capture stdout/stderr and exit status in protected evidence; do not enable verbose credential logging. The CLI applies a migration's SQL and its history entry transactionally. This was verified for the installed CLI against disposable PostgreSQL with a deliberately failing final statement: no Phase 2B objects/history row survived, while previously committed Phase 1 schema/data remained.

This atomicity is per migration, not a transaction spanning all migration files. Do not split the file into SQL Editor statements, append manual history inserts, or apply the DDL with a different tool under this procedure. DDL can briefly lock the existing workspace relation while adding foreign keys. Use the controlled window; a hang/timeout/disconnect is an ambiguous outcome, not proof of rollback. Read the failure matrix before retrying.

## 4. Verify commit independently of CLI exit code

Reconnect using a fresh read-only session and verify:

- Remote and LOCAL contain exactly the three expected versions; the new name is `phase2b_execution_core`. There is no pending or extra version. Verify stored statements against the approved SQL if available; history alone is not proof of schema equivalence.
- The complete new-object inventory matches the reviewed migration: three tables, identity sequence, all indexes/constraints/FKs, two read policies, nine functions, and the immutable-provenance trigger. Verify bodies/signatures, trusted owners, empty function search paths, SECURITY DEFINER/INVOKER modes, and effective privileges including inherited roles/PUBLIC. Compare canonical inventory to the disposable reference from the same checksum; review PostgreSQL version rendering differences explicitly, not by accepting arbitrary mismatches.
- All three tables have RLS; runs/steps are owner/Google-OAuth readable; outbox has no API-role allow policy/access. Authenticated users have no direct writes. Start/claim/advance have **no API-role EXECUTE** after application. Only read/cancel are executable by authenticated; no new access for anon or service_role. Owner/operator authority is expected.
- Phase 1 schema/grants/default privileges/functions/policies and data hashes match the quiet-window baseline. No new runs/steps/outbox rows should exist before separately authorized execution enablement. If rows unexpectedly exist, preserve them and investigate privileged activity; do not delete them.
- Use owner, second-tenant, non-Google and anonymous sessions in an approved test environment to validate read/cancel denial/isolation. Do not perform hosted data mutations as a side effect of verification without approval. Retain the local independent-session evidence; hosted PostgREST visibility/role behavior remains an acceptance check after application.

`supabase/verification/phase2b_inventory.sql` is read-only and covers definitions, source hashes, RLS, constraints/indexes, sequence ACLs and effective function/table grants. Execute through an authorized metadata connection; a successful SELECT is not a repair. Keep the before/after inventories with operator sign-off. If any object, ACL or row differs unexpectedly, keep admission/workers disabled and enter the matrix below.

## 5. Ambiguous/failing application decision matrix

| Observed after reconnect | Required response |
| --- | --- |
| Two Phase 1 history rows; no Phase 2B objects; Phase 1 unchanged | Not applied/rolled back. Preserve exact error/logs. Identify cause, reconfirm backup and checksum, then request approval before retrying the same one pending migration. |
| Three correct history rows and complete matching Phase 2B schema/ACLs; CLI reported failure/disconnected | Treat as committed despite the client result. Do not replay, repair or remove history. Record independent evidence, retain default-disabled state, and complete post-checks. |
| DDL/history disagree, any partial object set, wrong function body/owner, or extra version | Stop. Preserve inventories/data and logs; do not replay CREATE statements or mark history applied/reverted speculatively. Obtain approval for a reviewed, narrowly scoped corrective migration/history reconciliation after determining actual state. A partial set is unexpected for this transaction path and needs root-cause investigation. |
| Post-migration security checks fail | No execution enablement. Request approval for execution disablement/quarantine of only new execution capabilities; preserve rows and evidence. Review/fix locally, then obtain separate approval for forward correction. |
| Unexpected grants, RLS-off table, PUBLIC helper access, or compromised worker credential | Incident: stop affected approved runners, request privileged operator containment, inspect effective privileges/roles and access logs. Revoke only identified new execution exposures under approval; never blanket-revoke old schema/function access. Credential rotation/termination is separately approved. |
| Cannot reconnect or establish actual state | Remain NO-GO. Do not retry writes or infer rollback. Escalate connection/provider recovery with evidence until a fresh metadata session can classify the outcome. |

Normal disablement below covers start/claim/advance only. If new execution data reads/private helpers have been exposed, incident containment must also revoke the affected **new** table/helper/read ACLs under explicit approval, preserving their data. Do not revoke all functions in `flowforge_private`: that would break Phase 1 bootstrap/persistence. Do not use a broad DROP or restore the entire project just to remove these additive objects.

## 6. Reversible execution disablement

Normal migration application starts in this state; no additional hosted disable command is needed. To disable an environment that was separately enabled, an approved trusted operator executes:

```text
supabase/operations/phase2b_disable_execution.sql
```

Use an authorized PostgreSQL connection with `psql -X -v ON_ERROR_STOP=1 -f supabase/operations/phase2b_disable_execution.sql` (connection supplied through approved secure service/credential configuration). Verify the connection's project before execution. Never copy credentials into this runbook, shell history or Git. The script wraps its changes in a transaction with local lock/statement timeouts and revokes start/claim/advance from PUBLIC, anon, authenticated and service_role. It changes no table rows, history, auth or Phase 1 privileges. Execution read/cancel, workflow editing and simulation remain available.

ACL revocation affects new calls, including direct Supabase RPCs, not only Next.js routes. It **does not abort statements already authorized/in flight**. Stop the intended worker processes first, commit revocation, then confirm all earlier execution calls/transactions have drained before declaring disablement complete. Inspect `pg_stat_activity` using trusted operator access: exclude the observer PID; identify active/idle-in-transaction calls to start/claim/advance and known runner application names; inspect transaction age/blocking. Do not assume that merely waiting thirty seconds proves quiescence. If an unknown/blocked transaction cannot drain, retain disabled grants and request separate approval before cancelling/terminating a session. Never terminate arbitrary PostgREST/workspace traffic. Capture run/step counters/fingerprints again after quiescence; permitted cancellation may legitimately change a run's status.

Existing records are not cancelled, deleted, rewound, or silently requeued by disablement. Their deadlines and leases continue to age. While paused, history may display queued/running until later authorized cleanup observes expiry. Reads and cancellation remain tenant-controlled. A stolen/unauthorized API role has no worker EXECUTE grant; PostgreSQL administrators remain trusted and must not bypass the pause with direct owner calls.

## 7. Authorization to re-enable

Re-enablement is a separate operator decision, **not implied by migration application approval**. Record incident resolution/change reason, environment/project, checksum, responsible operator, current schema/ACL inventory, verified backup, tenant/security test results and authorization for the intended admission/worker capabilities. Verify quiescence, intact records and expected history; do not reset generation, cursor, attempts or timestamps to make old runs retry.

After approval only, run `supabase/operations/phase2b_enable_execution.sql` through the same verified connection. It normalizes the three capability ACLs and restores exactly authenticated start plus service-role claim/advance; no table/sequence access is granted. Verify PUBLIC/anon/ordinary authenticated workers remain denied. Verify normal read/cancel and Phase 1 access. The script grants capabilities but starts no process. Starting any hosted/production worker remains forbidden in this phase; that requires later, separate operational approval and Phase 2C/2E acceptance. The local runner's loopback/production guard remains intact.

When authorized local execution resumes, a new claim increases generation and recovers only incomplete checkpoints after lease expiry. Completed steps are never replayed; abandoned attempts count toward the three-attempt cap. Five-minute execution and thirty-minute queue deadlines are not extended. Expired/cancellation-requested runs terminalize on the next authorized touch. A failed/expired run requires a distinct, intentionally authorized new request/key, not an edit to its historical state.

## 8. Data-preserving forward fix and restoration

Preferred recovery is **disable → quiesce → preserve/export → reviewed forward migration → verify → separately approve re-enable**. Preserve run IDs, snapshots, inputs, request hashes/idempotency keys, attempts, outputs, timestamps, generations, cursor, cancellation and outbox acknowledgement state. Capture a consistent secured export/recovery point of affected records and metadata, including active rows; never publish these payloads in issue logs. Do not clear history, truncate execution tables, reset counters, or edit previously applied files.

Disable execution for any unexpected RLS/ACL/body/owner drift, duplicate or unfenced commit, quota breach, unsafe handler, data mismatch, unexplained application outcome, compromised credential, or recovery correctness failure. A forward fix must keep existing records readable and use new reviewed/versioned SQL, local tests and separate hosted approval. Schema/history corrections must reflect proven state; migration repair changes metadata only and never undoes SQL.

Once runs exist, a schema rollback can discard provenance, checkpoints and idempotency protection; it is not a safe default. Leaving additive disabled tables/functions in place is the normal rollback of runtime capability. There is no default DROP TABLE rollback command in this runbook. A whole-project restore can lose unrelated workflow edits/users/auth activity after the recovery point. It requires an explicit operator decision accepting that loss/downtime, a verified restorable point, secured exports of newer records, an isolated restore rehearsal and an approved reconciliation/cutover plan. Do not blindly merge conflicting historical executions or replay acknowledged outbox events after restore.

Recovery verification repeats full inventories/effective privileges, Phase 1 data/ownership checks, retained run/step/outbox hashes, idempotent-retry behavior, stale-generation rejection, cancellation/deadline behavior, and independent-session races in a disposable environment. Confirm no unauthorized worker is running. Resume only after the operator accepts the evidence and separately authorizes capability grants; otherwise leave disabled.

## 9. Independent-session concurrency reproduction

Prerequisites: Node/dependencies installed, PostgreSQL binaries (`initdb`, `postgres`, `pg_ctl`, `psql`), installed CLI 2.121.0, and permission to start a disposable loopback server. The harness accepts **no database URL**; it creates its own fresh cluster/data directories under ignored `.phase2b-evidence`, allocates a loopback-only port, seeds only synthetic identities/workflows, and never touches the existing PostgreSQL service or hosted project. Its TRUNCATE/time manipulation is confined to those newly created test records. It preserves logs/manifests and stops its own server. Review local disk use before reruns; retained clusters are test artifacts, not backups.

```powershell
$env:FLOWFORGE_PG_BIN = 'C:\Program Files\PostgreSQL\18\bin'
$env:FLOWFORGE_TEST_SUPABASE_CLI = '<absolute path to the installed supabase.exe>'
node scripts/verify-phase2b-concurrency.mjs
```

Each psql invocation is an independent backend/session. Explicit workspace/run locks plus `pg_stat_activity` lock-wait barriers establish actual overlap; the harness records distinct waiting PIDs. It exercises:

1. Supported CLI application, disabled ACLs and committed history/schema; a copied migration with an injected final division-by-zero to prove rollback of both DDL/history while retaining Phase 1 fixture data.
2. Three racing starts under a held workspace lock: exactly two admitted and one limited.
3. Two simultaneous identical idempotency keys: one run, one replay; changed-input reuse rejected.
4. Racing tenth/eleventh starts after nine accepted/cancelled starts: one admission and one minute-quota rejection.
5. Competing workers: one lease only; expired incomplete attempt abandoned; replacement generation increases; stale worker rejected; one committed result per node after recovery.
6. Cancellation winning before checkpoint: worker blocks, then produces no success result. Final checkpoint winning first: cancellation blocks, then cannot rewrite succeeded.
7. ACL disable/re-enable: direct start/worker denial, unchanged run rows, retained workspace/history reads and idempotency on explicit restoration.

The last successful run records eight assertion groups (the first item includes two atomicity groups). Evidence paths and version-specific limitations are recorded in PHASE2B.md. PostgreSQL **18.6** is the available local server; hosted is **17.11**. Do not mislabel this as hosted/PostgREST/provider-network-failure acceptance or exhaustive scheduling proof. An operator should reproduce the suite on an approved disposable PostgreSQL 17/Supabase environment before production enablement. Never point contention fixtures at the hosted target. If the harness fails, inspect its retained failure/logs and keep the gate closed; do not improvise hosted SQL tests.

## 10. Bounded retention policy — specified, not enabled

Phase 2B currently performs no automatic pruning. The following is the target policy for **Phase 2E implementation and acceptance before production enablement**; Phase 2C may use these requirements when designing delivery recovery but no queue/cleanup work begins here.

| Data | Normal retention | Eligibility and preservation rule |
| --- | --- | --- |
| Full run history/snapshot/manual input | 30 days after terminal finished_at | Never prune active/cancellation-requested runs. Before removal preserve required incident/audit evidence and transfer idempotency tombstone. Workspace/account deletion remains its existing explicit cascade exception. |
| Step output payloads | 7 days after parent terminal finished_at | Never erase active-run inputs/checkpoints or failed attempts needed for an open recovery/incident. Redact outputs only after recovery is closed; retain attempt metadata through run retention. |
| Step/attempt metadata | 30 days after parent terminal finished_at | Keep node identity, attempt/generation, status/timing/safe error metadata with its run; purge only with eligible run cleanup. |
| Acknowledged outbox events | 7 days after acknowledgement and parent terminal, whichever is later | Require delivery/recovery reconciliation complete. Never treat age as delivery acknowledgement. |
| Pending/unacknowledged outbox | No blind age-based deletion | Alert/escalate after 24 hours; resolve or archive/dead-letter under operator control within 7 days. Retention beyond that requires an explicit incident hold with owner/review date. No live delivery record is silently discarded. |
| Idempotency tombstones | 90 days after admission or terminal completion, whichever is later | Preserve workspace/key/request hash/run ID and an expired-history response; same-key retry must not accidentally create a second run when full history expires. |

This requires a future reviewed migration/cleanup implementation: current keys live on `ff_runs`, so deleting runs today would prematurely remove deduplication. Add separate minimal tombstones and explicit expired-history API semantics before enabling run pruning; after the ninety-day window, documented key reuse may be treated as a new request. No payloads/secrets are needed in tombstones. Cleanup must be dry-run first, bounded batches, least privilege, idempotent, observable, with a current recovery point and operator-approved legal/incident holds. Holds are explicit exceptions, not unnoticed indefinite retention. Restore/prune tests must prove active leases/checkpoints, tenant isolation and duplicate-start protection survive. No DELETE, automatic schedule or cleanup role is introduced by Phase 2B.1.

## Gate checklist

Phase 2B.2 resolved the browser export/reload automation blocker: five repeated passes followed by all 22 configured browser tests passing, with 85 unit/database tests, TypeScript and ESLint passing. Its fresh read-only schema/history/data/checksum preflight also passed. See [the readiness report](PHASE2B_READINESS.md) for exact evidence and scope. Earlier Phase 2B.1 browser failures are historical. Hosted application remains **NO-GO**: backup listing returned no identifiable recovery point (`backups: null`, empty physical backup data, PITR false), and no successful restore rehearsal is verified. WAL-G enabled alone is insufficient. Obtain the report's recovery evidence, confirm external workers/schedulers are absent or stopped, repeat immediate preflight/window checks, and obtain explicit application approval for the revised artifact. None of those external prerequisites is inferred from passing local tests. Application must leave execution disabled. Production/QStash/Phase 2C remain out of scope.
