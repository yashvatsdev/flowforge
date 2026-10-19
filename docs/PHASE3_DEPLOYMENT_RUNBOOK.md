# FlowForge deployment runbook — preparation only

No deployment or hosted mutation is authorized by this document. Existing production reference: **kixwwrmedqazurvdnfhi**. Gate A must use a separately approved isolated staging database and synthetic users/data. Do not reuse the production project as a staging convenience. See [Phase 2E](../PHASE2E.md), [recovery procedures](PHASE2B_MIGRATION_RECOVERY.md), and [unresolved data drift](PHASE2E_DATA_DRIFT.md).

## Independent approvals

| Gate | Exact scope | Required evidence before approval |
| --- | --- | --- |
| A | Protected staging deployment, execution disabled | Approved isolated project/origin/team, correct Phase 1 schema, staging-only configuration, OAuth setup, protection on every URL, local validation, no workers/credentials/schedules |
| B | Database migration application | Named environment/project, exact ordered migration set and hashes, fresh history/catalog/data preflight, explained drift, recovery point and isolated restore, serialized operator window |
| C | Delivery, worker and execution activation | A/B acceptance, reviewed removal of production/hosted runtime barriers, narrow grants, signing-key/bypass design, staging smoke tests, recovery/monitoring/retention readiness and explicit scope |
| D | Public production launch | Security/staging acceptance, production environment review, privacy/support/abuse/retention controls, cost and incident readiness, separate public-launch approval |

Approval for one gate does not approve the others. Creating a hosted staging project, paid features, OAuth/provider changes, deployment protection changes, database credentials/roles, and baseline acceptance are separate concrete operator actions requiring approval. This task does none of them. Do not start Phase 3 from this runbook automatically.

## 1. Prepare the staging target and release

1. Choose the responsible operator, Vercel team/project and stable exact HTTPS origin. Record account ownership, plan/cost limits and access to logs. Do not use a public production alias as an unprotected preview shortcut.
2. Separately approve/create an isolated Supabase staging project, or identify an existing approved one. Record its reference, region, PostgreSQL/extension versions and ownership; use synthetic accounts/data. Do not clone production data into an internet-connected staging app.
3. A fresh staging database needs its Phase 1 schema before the studio works. That bootstrap is a separate **database approval under B**, naming only the two Phase 1 files in an operator-reviewed immutable release bundle. Never let gate A or a Vercel build apply SQL. Do not run migration up from a four-file directory under a two-file bootstrap approval.
4. Pin/review the release source, lockfile, Node version and migration manifest. The current local validation used Node 24.18.1 and Next 16.4.2. Confirm the platform supports the chosen Node major before approving deployment. Builds run `npm ci` and `npm run build`; no migrate, seed, runner, dispatcher or cron command belongs in install/build/start hooks.
5. Keep `.vercelignore`: local environment files, test clusters, ignored evidence, generated builds and credential/backup files must not be uploaded by a source deployment. Inspect the actual artifact/source inventory; ignore rules do not secure an independently copied backup. Production secrets stay in scoped secret configuration, never the source bundle.

## 2. Gate A environment variables

Use [config/staging.env.example](../config/staging.env.example) as a **name-only template**; it is not loaded automatically. Enter values privately in the staging project's appropriate Vercel environment, not chat or Git. Preview/custom environment and production variables must be separately scoped. Rebuild after changing a `NEXT_PUBLIC_` value because it is bundled into client code. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

| Name | Gate A value/source |
| --- | --- |
| FLOWFORGE_ENVIRONMENT | `staging` (offline validation marker) |
| FLOWFORGE_STAGING_PROJECT_REF | Exact isolated staging reference, never the existing production reference |
| NEXT_PUBLIC_SUPABASE_URL | `https://<staging-ref>.supabase.co` |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Modern publishable key from that staging project; verify provenance, not just key prefix |
| APP_ORIGIN | Exact approved HTTPS origin, no trailing slash/path/query/credentials |

Omit **all** `FLOWFORGE_EXECUTION_UI_ENABLED`, `FLOWFORGE_DELIVERY_*`, `FLOWFORGE_RUNNER_*`, `FLOWFORGE_WORKER_*`, `FLOWFORGE_MAINTENANCE_*`, `QSTASH_*`, database URL/password and Supabase service/secret credentials. Do not copy `.env.local`, pull production secrets, set `NODE_ENV` to development, or import the loopback test fixture into staging.

With the intended non-secret process environment privately configured, run locally:

```powershell
node --import tsx scripts/verify-staging.mts
```

It loads no env file, contacts no service and prints no values. It rejects the production project, mismatched URL, insecure/malformed origin, privileged key format, public secret names, and execution/provider credentials. Success validates configuration shape only: it cannot prove that a publishable key belongs to the project, that an origin is operator-owned, that Vercel protection is enabled, or that database ACLs are correct. Those remain independent read-only checks and post-deployment acceptance.

## 3. Supabase and OAuth configuration

For the isolated project, privately configure a staging Google OAuth client/provider through a separately approved operator action. Google credentials remain with Supabase/Google, not browser or application environment variables. Use only the necessary basic identity scopes and approved test users/consent state.

- Google authorized redirect URI: `https://<staging-ref>.supabase.co/auth/v1/callback`.
- Supabase Site URL: exact staging application origin.
- Supabase allowed app redirect: `https://<staging-host>/auth/callback` (the application includes a safe `next` query; verify provider matching without broad wildcard origins).
- Review and disable unneeded alternate providers/password/anonymous registration under separately approved provider configuration. Application and SQL already require Google/OAuth; do not weaken them to compensate for bad provider settings.
- Verify HTTP-only/Secure/SameSite cookies, token refresh, logout, callback failures, safe destinations and no-store responses on the actual protected HTTPS origin.

These are two different callbacks: Google returns to Supabase, and Supabase returns to the app. Follow [Google sign-in configuration](https://supabase.com/docs/guides/auth/social-login/auth-google) and [redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls). No real hosted OAuth acceptance is claimed by the local fixture tests.

## 4. Protection and disabled-deployment acceptance

Configure and verify Vercel Authentication or another approved protection method on **all reachable deployment URLs**, including custom aliases and generated deployment URLs. Standard protection may exclude production domains; selecting a protected URL does not prove aliases are protected. Check logged-out and authorized-team access, and plan/cost availability before choosing paid controls. See [Deployment Protection](https://vercel.com/docs/deployment-protection).

Do not set public deployment flags, create share/bypass links, add public exceptions or disable protection to make OAuth/tests pass. Verify that the approved browser can complete the OAuth return through the protection layer. Do not log authorization codes or token-bearing URLs; development log suppression alone does not prove platform access logs are redacted. Establish permitted logs/access/retention before acceptance.

After **separate A approval** and an operator deployment, verify:

1. Every unauthenticated URL is protected; ordinary application auth still independently protects studio/API ownership.
2. Google login/refresh/logout work, two synthetic tenants cannot read or mutate each other, non-Google/anonymous users fail, foreign Origin mutations fail.
3. Workflow editing/saving/import/revision conflicts and simulation work; no fake real-run success or invented history appears.
4. Real-start UI is disabled; internal worker/maintenance routes return default-disabled responses. Do not call a start RPC as a probe that could create a run. Inspect effective privileges read only.
5. No privileged/QStash/production credentials are in browser bundles, logs, source uploads or variable scopes. No job, schedule, hook or build step starts execution.
6. Record the actual deployment ID, source digest, staging database ref, URL/protection settings, test identities and evidence. A successful local preflight is not this evidence.

## 5. Gate B: backup, baseline and exact migration application

The existing project's accepted Phase 2B baseline remains unchanged. Workspace/workflow hash drift is unresolved; [investigate and obtain explicit acceptance](PHASE2E_DATA_DRIFT.md) before creating a new approved baseline. Do not overwrite rows or reset revisions.

A **verified restorable recovery point plus successful isolated restore rehearsal** is mandatory for the existing hosted project's migration. Logical recovery is permitted; PITR is not required. Follow the complete existing recovery runbook: timestamp/coverage/custody/expiry, schema/data/Auth/roles/grants/history, encryption and separately retained decryption key, tested isolated restore and RLS/ownership checks. Workflow JSON, schema-only dump, WAL-G availability or a dashboard tab is insufficient. Do not retrieve/reset passwords or acquire backups without the separately approved credential/export/rehearsal task. No restorable point is currently verified.

For an approved target that already has exactly the two Phase 1 versions, the reviewed pending order and hashes are:

| Version | SHA-256 |
| --- | --- |
| 20261019110206 | `61E741AE92C314F94CDD3BF9B04F69BEBC1F04A45A6ABA47A130F74BBB4A63E2` |
| 20261019134354 | `DE5F1020470B22D23C7A04AE0A10227043CC73051C2CE70C981E1A72C1C466A0` |

Before requesting B approval: verify installed CLI/help/account, exact saved linked ref versus the separately approved target, all four local hashes, complete remote history, no object collision/unexpected schema/privilege drift, explained quiet-window content hashes, recovery evidence, external worker quiescence and one migration operator. Staging and existing production are different targets; never reuse a cached link without checking it. Existing Phase 1 hashes are in the recovery runbook and PHASE2E.md.

**Only if both pending files are explicitly approved together**, and immediate history still contains exactly the two Phase 1 versions with exactly these two pending files, the documented CLI procedure is:

```powershell
supabase --version
supabase whoami
supabase projects list
supabase migration up --help
supabase migration list --linked
Get-FileHash supabase/migrations/*.sql -Algorithm SHA256
# Verify saved project-ref equals the approved environment's exact reference.
# Verify backup/restore evidence and record separate B approval; STOP otherwise.
supabase migration up --linked
supabase migration list --linked
```

These commands are **not run by this task**. `migration up --linked` applies all pending files, not a selected version. A Phase 2B-only approval does not authorize it from the present two-pending-file checkout. Do not improvise include-all, db push/reset, SQL Editor replay or metadata repair.

Atomicity is **per migration**: B can commit and C fail. On disconnect/error, reconnect read only and classify actual history plus full object/ACL inventories before any retry. Expected outcomes include neither committed, only B committed, or both committed. History and schema must agree for each version. A successful first file is never replayed merely because the second failed. Partial objects within one file, wrong owner/body/grant or unexpected history are a stop requiring separately approved corrective action.

Post-check all new public/private tables, sequence/indexes/FKs, RLS, policies, trusted owners, empty search paths, function body/signature hashes and inherited/PUBLIC effective ACLs against a disposable reference from the exact same SQL. Verify Phase 1 objects/data and target PostgreSQL compatibility. Require no execution rows and admission/claim/advance/delivery EXECUTE still denied to normal API roles; read/cancel remain intentionally granted only where specified. Verify PostgREST exposure on staging. Applying either file creates no scheduler or background execution.

## 6. Gate C: delivery and execution activation

Current code **cannot run hosted production workers or real-start UI by setting environment flags**. `backgroundRuntime`, local runner and UI capability deliberately reject production/hosted targets. Keep those controls. Gate C requires a new reviewed rollout change, production-equivalent PG17/Supabase acceptance, narrowed operational authority, complete retention/tombstone implementation or approved bounded staging exception, monitoring and recovery readiness. Do not infer C readiness from this runbook.

Before that separate change is approved, design:

- Server-only project service capability, QStash publication token, **both** current/next signing keys and dedicated maintenance token with least access and independently scoped staging/production credentials.
- Exact canonical HTTPS worker URL, signature body/URL/expiry verification, fixed provider API, duplicate/fenced execution and delivery recovery behavior.
- Compatibility with Vercel protection: protected endpoints may reject provider traffic before signature handling. A separately approved narrow automation/bypass design must keep bypass material server-only and retain signature verification. Do not expose a general public bypass or switch off protection automatically.
- Signing-key rotation: obtain approved provider current/next keys privately, update both verifier keys atomically, verify staged signed traffic under both, preserve overlap until provider rotation completes, then remove retired material under approval. Never print keys, disable verification or use development signing mode.
- Maintenance actions are POST JSON `dispatch`, `recover`, or `status` with a dedicated constant-time-checked Bearer token, not a browser session. Vercel Cron's ordinary request method/body/auth does **not** automatically satisfy this contract; design/test an approved adapter before adding any schedule.
- No automatic schedule initially. After separate schedule approval, use bounded dispatch/recovery, alert on oldest pending events >24h/exhausted attempts/expired leases, cap retries/backlogs and cost. Preserve unacknowledged events, checkpoints and idempotency; do not delete to clear alerts.

Only after all C prerequisites and approval may the operator use the reviewed grant scripts for the named environment. 2C grants do not restore 2B worker permissions. Capability grants start no process; starting workers/schedules is a separately specified action. Test synthetic one-node/branch runs, idempotent repeat, cancellation, signed duplicate delivery, stale fence and lease recovery in **staging**, with no external HTTP/notification/arbitrary-code handlers. Inspect persisted state and sanitized logs before considering production execution.

## 7. External inventory and performance acceptance

Inventory all operator-owned accounts/projects/regions, not just repository text: Vercel deployments/Cron/hooks, QStash schedules/queued/retrying/DLQ/URL groups, Supabase functions/database jobs/triggers, GitHub Actions active/queued/scheduled/reusable workflows and self-hosted runners, Windows tasks/services, WSL/Linux timers/containers/other providers. Record timestamp, scope and unavailable systems; obtain owner attestation. Do not pause/delete/rotate anything under read-only inventory authorization.

Existing history uses a `(workspace_id, created_at desc, id desc)` cursor index and 25-row limit. Browser polling is five seconds after each successful load, visible/active only, up to 120 successful loads, with explicit retry after error. Terminal-only history needs manual refresh for new runs. Step/output totals are bounded; outbox uses a partial due index and SKIP LOCKED, one leased publication at a time. Worker compute is budgeted, but end-to-end RPC/provider latency still needs staging measurement. Status aggregates scan execution/outbox state and are privileged/manual; do not poll them aggressively.

Next uses HTTPS Data API RPCs, not one native PostgreSQL connection per browser; provider pool/statement limits still require review. Record actual function duration/memory/concurrency, database connection usage, query plans and backlog under a bounded synthetic load. Do not introduce Redis, realtime infrastructure or indexes without a measured bottleneck. Add launch-appropriate edge/Auth/API rate and cost limits under approval: per-workspace SQL start quotas do not protect every read/OAuth/API path or global signup abuse.

## 8. Rollback, incidents and gate D

For an execution-disabled app regression, restore the previously approved **application artifact** with the same isolated target/protection and no credentials/workers; verify auth/editing/simulation. App rollback does not undo committed migrations. Do not roll back by changing a public database target or copying production variables.

For security/state/integrity failure: keep new starts off, stop only specifically authorized workers/triggers, obtain approval for narrow execution/delivery ACL revocation, drain and inspect in-flight statements, preserve records/logs/checkpoints and incident holds. Privilege revocation does not terminate statements already authorized. Follow the existing recovery failure matrix; prefer data-preserving forward fixes. No default DROP/TRUNCATE or automatic restore/history repair. Full restore requires a verified point, isolated rehearsal, accepted data-loss window, newer-data preservation, and separate privileged approval.

Resume only after post-recovery inventories/hashes, tenant/RLS/privilege tests, idempotency/fencing/cancellation checks and external inventory pass, and the operator separately approves re-enable. Public launch D additionally requires completed staging/provider/security acceptance, explained hosted drift, operational backup/decryption/restore readiness, retention/idempotency preservation, abuse controls, scoped secrets/logs and on-call/cost ownership. **Current gate status: A NO-GO; B NO-GO; C NO-GO; D not begun.**
