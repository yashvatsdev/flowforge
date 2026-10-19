# FlowForge Phase 2B.2 hosted migration readiness

Recorded October 19, 2026. Target: `kixwwrmedqazurvdnfhi`. **Decision: NO-GO for hosted application.** The browser blocker is resolved; the mandatory verified recovery point and restore rehearsal remain absent. This report authorizes no hosted writes or execution enablement. See [the recovery runbook](PHASE2B_MIGRATION_RECOVERY.md).

## Browser investigation and minimal change

Inspected the two earlier failure records, Playwright JSON action/network/console traces, error context, the last screenshot, and the existing CloudProvider/editor unload guards. Preserved the latest original trace and screenshot at `.phase2b-evidence/browser-2b2/before-trace.zip` and `before-last-frame.jpeg`. The screenshot shows the preserved edit and conflict UI. Native dialogs do not appear in the page screenshot; their presence is established by the protocol trace.

The original trace records the download event at monotonic 37454.032 ms followed by a `beforeunload` dialog at 37475.396 ms. No explicit dialog handler accepted it; the export/reload click and context teardown stalled until their 40-second timeouts. There was no preceding application JavaScript exception. HTTP 409 is the deliberately induced revision conflict. Chrome's eventual forced termination was teardown fallout, not evidence of a spontaneous browser crash.

The test omitted the user's confirmation of the existing unsaved-work guard. This is an automation interaction in an existing Phase 1 flow, rather than evidence of a Phase 2B application regression. Playwright documents native modal handling and explicit acceptance at [Dialogs](https://playwright.dev/docs/dialogs). The investigation does not establish why this Chrome/Playwright combination failed to settle the dialog through its default behavior; it establishes the blocking event and verifies the explicit supported interaction.

Only `tests/browser/phase1.spec.ts` changed. It accepts precisely a beforeunload dialog registered before clicking; asserts the downloaded file completed successfully and contains `My preserved edit`; then verifies `Other tab edit` loaded and the recovery draft was removed. No timeout increase or application-code workaround was made.

The first five-repeat diagnostic run after adding dialog handling failed in setup: the first iteration's simulated other-tab update received 409 because the editor's first-exploration onboarding write changed the workspace revision. The remaining iterations collided with the same fixed workflow ID left in the shared fixture. These are separate test setup defects, not export failures. The final test uses a fresh UUID per iteration and waits for persisted `explored` onboarding and Saved status before capturing the other tab's revision. This waits for a concrete acknowledged state rather than sleeping or retrying a failed mutation.

| Final check | Result |
| --- | --- |
| `node scripts/browser-tests.mjs --grep 'real revision conflict' --repeat-each 5 --trace on` | 5 passed, 20.9 s |
| `node scripts/browser-tests.mjs --trace on` | Complete configured suite: 22 passed, 42.8 s |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | 85 passed, zero failures/skips |

The passing full-suite trace records Dialog.accept, the download, and completed reload. Reduced-motion and NO_COLOR/FORCE_COLOR notices were non-failing environment warnings. Repeated passing traces are saved at `.phase2b-evidence/browser-2b2/repeated-pass/`. Full-suite traces are copied to `.phase2b-evidence/browser-2b2/full-suite/`; console output and unit results are `full-suite.log` and `unit-tests.log`. These ignored local artifacts can contain synthetic fixture data and are not recovery backups. No production build was rerun for a test-only change; the prior build result is historical. Coverage is the configured Chrome suite with local Auth/database fixtures; real hosted OAuth, other browsers, declined unload confirmation, and provider restore behavior are not established by it.

## Recovery-point evidence and operator steps

Authenticated CLI 2.121.0 lists the linked FlowForge project ACTIVE_HEALTHY, ref `kixwwrmedqazurvdnfhi`, region ap-northeast-1. Scoped MCP independently reports `https://kixwwrmedqazurvdnfhi.supabase.co`. No alternative project was inspected or linked.

After inspecting CLI help, ran only the read-only command:

```powershell
supabase backups list --project-ref kixwwrmedqazurvdnfhi --output json
```

Successful response:

```json
{"backups":null,"physical_backup_data":{},"pitr_enabled":false,"region":"ap-northeast-1","walg_enabled":true}
```

This exposes no selectable backup or recovery timestamp. It does not prove provider backups are physically absent, but it supplies no evidence of a user-restorable point. WAL-G capability is insufficient. PITR is explicitly disabled. No separate logical backup manifest, custody record or successful restore-rehearsal evidence was found in the supplied repository/runbook. No restore method has been tested for this project; the disposable migration-atomicity tests did not restore its data.

Before requesting application approval, the operator must:

1. In this exact project's Database Backups/PITR settings, establish an eligible existing recovery point or supply a separately authorized complete logical backup. If none exists, arrange backup acquisition as a separate approved task; this task creates nothing and enables no paid feature. Do not treat a dashboard tab or WAL-G flag as proof.
2. Record backup ID/type, UTC recovery timestamp or earliest/latest PITR interval, completion/availability status, expiry, coverage, custodian, approved restore destination, downtime and acceptable data-loss window. Confirm availability through the migration/recovery window. Include Auth, public/private application data, roles/ownership/grants and migration history. Record separate Storage object/configuration and OAuth/provider configuration recovery requirements; hashes/schema-only dumps are insufficient.
3. Select the provider-supported restore procedure for that actual backup type. [Supabase backups](https://supabase.com/docs/guides/platform/backups) describe daily/PITR recovery; [restore to a new project](https://supabase.com/docs/guides/platform/clone-project) describes the eligible paid physical-backup option and the configuration it does not copy. Do not assume that option is available for this project. For logical backups use the complete provider backup/restore guide linked in the recovery runbook.
4. Separately authorize a restore rehearsal to a disposable isolated destination, with external execution disabled. Record successful completion, source point and destination IDs, counts/content hashes, migration history, object owners, function bodies/settings, RLS/effective grants, Auth access and recovery duration. Never rehearse by overwriting this hosted project. Obtain explicit approval for costs and privileged actions first.
5. Attach the evidence, confirm external schedulers/workers remain absent or stopped, serialize migration writers, and repeat linked-project/history/hash/schema/data preflight immediately before requesting approval for this exact artifact. Execution enablement requires separate authorization later.

## Fresh read-only preflight

CLI `migration list --linked` and scoped MCP agreed:

| Version | Local | Hosted |
| --- | --- | --- |
| 20261018215836 | Present | Applied |
| 20261018225425 | Present | Applied |
| 20261019110206 | Present | Absent; sole pending file |

SHA-256 checks matched every approved migration byte:

| Migration | SHA-256 |
| --- | --- |
| Phase 1 workspaces | `8E0CE236B2DCFD81B2B1086448E745047800D284FDE2034A45844AF4F20C985D` |
| Phase 1 revision conflict | `3EBFE46DB82850B25283903E60195308EE46D57B5B19163B90250A929B80FBF0` |
| Phase 2B execution core | `61E741AE92C314F94CDD3BF9B04F69BEBC1F04A45A6ABA47A130F74BBB4A63E2` |

Read-only catalog comparison matched the earlier reconciled Phase 1 baseline: tables/owners/RLS, columns/defaults, constraints/indexes, policies, non-internal triggers, function definitions/settings/ACLs, schema/default privileges, event triggers and effective API-role table permissions. Migration-history objects were excluded only from comparison with the pre-repair catalog. No unexpected application-schema drift was detected. Hosted PostgreSQL is 17.11; a database check at **2026-10-19 12:11:41 UTC** found no ff_runs, ff_run_steps, execution outbox or ff_exec_* functions.

Full-row legacy content fingerprints for the six existing application tables exactly matched the pre-reconciliation baseline. The read-only repeatable-read verification script also generated the following current SHA-256 baseline (a different algorithm from the legacy comparison):

| Table | Rows | Current SHA-256 content fingerprint |
| --- | ---: | --- |
| ff_profiles | 2 | `5b06e7c65ef6f3bdec2b8529e89a63a87fbd6829f75b3167b41dbae4f3958e2d` |
| ff_workspaces | 2 | `6820bb196f55816bf80cb6fd13fb8a53b9eb7a9a3b7e80a6ece567783b9ffbd2` |
| ff_workflows | 2 | `d06ab92941decaf470367577d4498ef89ca1192d456c74f419513f62579a080d` |
| ff_preferences | 2 | `9cbdf293910618239177a160f98475938aee1a900738c42a1b0d08753cd4dfc4` |
| ff_simulations | 1 | `a2f0a3ac09c643508617ed5f78965c2d78b5f6fe7635f685208c89c190c8bd6c` |
| ff_imports | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

The pending migration explicitly revokes EXECUTE on every new function from PUBLIC, anon, authenticated and service_role, then grants only read/cancel to authenticated. Start/claim/advance remain disabled for direct RPC calls. All API-role direct writes to execution tables remain revoked. No grants were changed during this task.

No Supabase Edge Functions are deployed, and `cron.job` does not exist on the target. The repository contains no QStash integration/dependency, Vercel cron config, GitHub scheduled workflow, deployed worker route or Supabase function worker. Its manual runner accepts only loopback URLs and rejects NODE_ENV=production. No worker was launched against hosted Supabase. Inspection cannot establish the state of arbitrary external hosting/Upstash/OS scheduler accounts; obtain operator confirmation of those outside this repository/project before application. Even an external caller cannot invoke the absent hosted execution RPCs now, and the reviewed migration leaves their worker grants disabled.

## Remaining gate

Local concurrency evidence from Phase 2B.1 remains eight passing independent-session assertion groups on PostgreSQL 18.6; those tests were not rerun because SQL did not change. Hosted 17.11/PostgREST acceptance and provider restore rehearsals remain distinct checks. All current read-only preflight results are point-in-time observations, not a reservation against future changes.

**NO-GO** until a restorable recovery point and successful isolated restore evidence meet the runbook, external-worker state is confirmed, and the immediate pre-application gate is repeated. Then obtain explicit approval for the exact checksum and supported application procedure. No migration was applied, execution enabled, backup created/restored, database data changed, commit made, code pushed, deployment made or Phase 2C work begun.
