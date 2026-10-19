# FlowForge Phase 1 — Google OAuth and database-backed workspaces

Status: implementation and the approved hosted migration are present. **Phase 1 remains pending final live verification and Google-only provider configuration.** No application deployment, commit, push, paid infrastructure, duplicate Supabase project, account-security change, or remote data deletion was performed.

## Initial state

Phase 0 supplied workflow editing, deterministic simulations, browser-local autosave/backups, guarded recovery, schema validation, and regression checks. There was no authentication, database schema, workflow API, or authenticated persistence. Dashboard counts were derived from local data; onboarding used heuristics.

Configuration preflight now finds all three required variables with no duplicate definitions. `APP_ORIGIN` is `http://localhost:3001`. `.env.local` is Git-ignored and is not tracked. Supabase DNS resolves and its public Auth settings endpoint returns HTTP 200 with Google enabled. Email remains enabled externally as of the last check. Its configuration was not changed without approval.

## Implemented functionality

- A single Continue with Google entry, using Supabase Auth and pinned `@supabase/ssr` / `@supabase/supabase-js` packages. There are no password, OTP, anonymous, or alternate-provider sign-in interfaces.
- Server-started PKCE OAuth, `/auth/callback` code exchange, safe internal destinations, user-facing canceled/expired/setup errors, and server-side session verification.
- HttpOnly, SameSite=Lax cookies; Secure cookies for an HTTPS application origin. Next.js 16 proxy refreshes sessions and propagates refreshed cookies to the browser. Sign-out is a same-origin POST and uses local-session revocation.
- Protected studio layout plus independent authentication/authorization on every API operation. Server checks verified user identity and verified OAuth authentication-method claims; database policies also require Google/OAuth claims.
- Profile and default personal workspace bootstrap with unique ownership constraints and transactional, repeat-safe creation.
- Existing account menu displays the Google name, email and avatar with a fallback. Display metadata does not determine ownership.
- Workspace fetch/save APIs, workflow list/create/read/update/delete APIs, persisted preferences and simulated history.
- Database-backed store adapter preserves the existing editor, node configurations, validation, React Flow interactions, templates, playback, and workflow actions.
- Existing 800ms editor debounce now waits for database acknowledgement. Serial aggregate saves use acknowledged revisions; failed tasks preserve an account-specific draft, expose retry/export, and block stale-revision writes. Corrected drafts can supersede invalid failed snapshots. An older save acknowledgement does not clear newer editor changes.
- Optional confirmed local import adds copies instead of replacing cloud data. Identifiers are remapped, the import is transactional and fingerprinted, and repeating the same document is a no-op. Original `flowforge:v1` bytes are never deleted by the cloud import.
- Recovered account drafts require an explicit recovery choice before opening the editor. Users can export the server version or recovered draft before replacement/reload.
- Dashboard metrics use the cloud-backed records. Onboarding flags are persisted after acknowledged actions rather than inferred from seed counts. Execution records and latency remain explicitly simulated; HTTP/notification results are not presented as real service delivery.
- The current Steel + Pale Blue styles, fonts, existing animations, Magic UI sources, and responsive layouts are retained. Added auth/status styling reuses the existing tokens.

## Database architecture and migration

Migration: `supabase/migrations/20261018215836_phase1_workspaces.sql`, created using the official Supabase CLI migration command.

Forward-only follow-up: `supabase/migrations/20261018225425_phase1_revision_conflict_status.sql`, also created with the official CLI. It preserves the existing commit function's signature, ownership, grants and authorization logic, changing its application conflict code from `40001` to `PT409`. Both migrations have been applied successfully through the hosted SQL Editor; neither is registered in CLI migration history.

| Object | Purpose |
| --- | --- |
| `ff_profiles` | Auth-user FK, Google display profile and creation time |
| `ff_workspaces` | One default personal workspace per owner, revision, recorded onboarding actions |
| `ff_workflows` | Workspace-scoped workflow ids and compatible workflow JSON |
| `ff_preferences` | Workspace settings JSON |
| `ff_simulations` | Workspace-scoped historical simulation snapshots |
| `ff_imports` | Workspace-scoped SHA-256 import fingerprints |
| `ff_bootstrap` | Idempotent profile/workspace/preferences bootstrap |
| `ff_load` | RLS-filtered workspace envelope |
| `ff_commit` | Atomic revision-checked workspace write |

Workspace/user foreign keys, composite primary keys, uniqueness, document constraints, and indexes are included. Historical workflow/node ids deliberately remain snapshots rather than cascading workflow FKs, so deleting a workflow does not invalidate history.

All six tables enable RLS. Authenticated users receive SELECT access filtered to their own workspace. Direct INSERT/UPDATE/DELETE is not granted: this prevents Data API writes from bypassing revision protection. Private `flowforge_private` definer functions provide narrow mutation capabilities behind public invoker wrappers. Each private operation checks the authenticated subject and Google/OAuth claims; mutation selects the owned workspace and locks its row. Functions use an empty search path and explicit object names; execution is revoked from PUBLIC/anon and granted only to authenticated. No service-role key is used in normal application operations.

A save checks the expected revision, validates bounded data, updates related records in one transaction, and increments the workspace revision. Stale saves return HTTP 409 without applying changes. This first increment uses a **workspace-wide revision**, intentionally favoring atomic compatibility over per-workflow parallel editing.

### Migration application status

- **Local PostgreSQL/PGlite:** migration executed successfully repeatedly in isolated test databases, including real SQL constraints, transactions, grants and RLS.
- **Hosted Supabase:** applied successfully through the signed-in SQL Editor after explicit action-time approval, in one `BEGIN`/`COMMIT` transaction. The submitted SQL was compared with the versioned file and matched exactly. Inspection confirmed six tables, all six with RLS enabled. Existing data was not deleted.
- MCP still lacks access and CLI has no saved access token. SQL Editor application does not register the file in CLI migration history; reconcile that history before a future `db push` to avoid replaying this migration.

## Authentication and API flow

1. The form POSTs to `/auth/start`; exact Origin validation precedes OAuth initiation.
2. Supabase creates the PKCE verifier cookie and redirects to Google. Only OpenID/email/profile scopes are requested; no offline Google API access, Gmail, Drive, Calendar permissions or Google provider-token storage is added.
3. Google redirects to Supabase's `/auth/v1/callback`; Supabase redirects to FlowForge's `/auth/callback` at the configured origin.
4. FlowForge exchanges the single-use code, verifies the user and OAuth claims, bootstraps the workspace, and redirects to an allowlisted studio destination. Arbitrary forwarded hosts and external return URLs are not trusted.
5. Studio requests verify the user server-side. API mutations additionally require an exact application Origin, bounded JSON, schema validation, ownership and revision checks. Private/auth responses are not cached. Next development request logging excludes the OAuth callback so authorization codes are not printed by the framework request logger.
6. The proxy refreshes sessions; POST sign-out removes the current browser session. Account-specific drafts are scoped by user id. Legacy local backups remain available only for explicitly confirmed transfer.

Endpoints: `GET/PUT /api/workspace`, `POST /api/workspace/import`, `GET/POST /api/workflows`, `GET/PUT/DELETE /api/workflows/[id]`, and the three auth routes. No unguarded server actions were added.

## Tests and verification

The repeatable command is `npm run validate:browser`; `npm run verify:config` performs a redacted live configuration preflight.

### Local checks

Final results are recorded after executing the command; the test Auth service is explicitly a fixture, not Google's or hosted Supabase's authentication service.

- TypeScript: passed.
- ESLint: passed, including application, tests, scripts and Playwright configuration.
- Unit/local PostgreSQL tests: **67 passed**, including the original Phase 0 engine, playback and validation cases; local migration/ownership tests; auth/redirect/Origin checks; import validation; serial saves, conflicts and corrected-draft recovery.
- Production build: passed with existing pages, new APIs/auth routes and proxy.
- Browser/API suite: **21 passed** in the latest stabilization recheck. Includes unauthenticated public local-recovery checks and authenticated checks against the local Auth REST fixture plus PostgreSQL/PGlite. Covers raw recovery/export/reset, protected routes, non-Google rejection, PKCE callback and bootstrap, HttpOnly cookies, expired-session refresh, sign-out, API CRUD, actual SQL revision conflicts, two-user isolation, editor selection/connections, cloud autosave/refresh, simulated history, additive/idempotent import, retry/export recovery, stalled-save timeout recovery, more than 100 workflows with search/filter/actions, Settings and its native import picker at 1440/768/390px, and reachable logout at short desktop/mobile viewport sizes.
- Production dependency audit: zero reported vulnerabilities. Existing development-only lint advisories and peer-range warnings remain documented below.

`tests/browser/phase0.spec.ts` is retained as historical local-only coverage; the default browser configuration selects the new Phase 1 suite because studio routes now require authentication. Applicable editor, overflow, backup/list and simulation behavior is covered in the new authenticated suite; Phase 0 unit tests continue running. The new browser suite starts an isolated Next development server on localhost:43821 with `.next-phase1`, plus a local test Auth/REST service on 127.0.0.1:18181. These are test-only environment overrides; no production auth bypass or fake sign-in flag exists in the application. Test fixtures use real PostgreSQL RLS/transactions with controlled claims, and do not establish live provider correctness.

### Live verification

- `.env.local`: required variables present, no duplicates, correct localhost:3001 origin, ignored and untracked.
- DNS and public Supabase Auth API: passed; Google is enabled. Email is still externally enabled, so `verify:config` correctly reports configuration not fully ready.
- Existing app at `http://localhost:3001/login`: HTTP 200 and Google sign-in UI verified.
- Real OAuth initiation: Chrome reached Google's sign-in page without observed invalid-client or redirect-URI mismatch errors. Connected Brave also reached the real account chooser.
- Real Google authorization-code exchange and verified authenticated dashboard access: passed on the subsequent attempt; the authenticated session survived a page reload. Workspace loading stops at the missing database schema.
- Hosted profile/default workspace bootstrap, workflow create/edit/read after refresh, preference save/refresh, and simulated history save/refresh: passed through the real signed-in application.
- Hosted SQL assertions passed for owner reads, repeated bootstrap, invalid/stale revision rejection, foreign read/write denial, and a second isolated workspace. These used controlled claims for two existing Google identities in a rolled-back transaction; they do not constitute two-account browser OAuth verification.

## Changed files

- New auth/persistence server files: `src/proxy.ts`, `src/lib/auth-policy.ts`, `src/lib/server-auth.ts`, `src/lib/supabase/server.ts`, `src/lib/workspace-api.ts`, `src/lib/persistence.ts`, `src/lib/revision-writer.ts`.
- New auth UI/routes: `src/app/login/page.tsx`, `src/app/auth/start/route.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/signout/route.ts`, `src/app/auth.css`.
- New APIs: `src/app/api/workspace/route.ts`, `src/app/api/workspace/import/route.ts`, `src/app/api/workflows/route.ts`, `src/app/api/workflows/[id]/route.ts`.
- New cloud adapter and shared seeds: `src/components/cloud-provider.tsx`, `src/lib/seeds.ts`.
- Existing integration changes: studio/root layouts, `src/lib/store.tsx`, Shell, Settings, Dashboard, Editor, Templates and WorkflowList.
- Migration listed above.
- New tests: `tests/database.test.ts`, `tests/phase1.test.ts`, `tests/browser/phase1.spec.ts`; test service `scripts/test-supabase.mts`; generated-config preservation wrapper `scripts/browser-tests.mjs`; redacted preflight `scripts/verify-config.mjs`.
- Tooling/docs: dependency manifest/lockfile, Playwright configuration, Next configuration, generated Next type declarations, `.gitignore`, README and this file.
- `.env.local` credentials were neither changed nor printed.

## Remaining external actions

1. Reconnect MCP to the correct organization or authenticate the CLI before future managed migrations; reconcile the manually applied migration history. The current hosted schema is already applied and verified.
2. Disable Email Sign-In in that project's Authentication provider settings to match the intended Google-only provider configuration. The application itself exposes only Google and rejects non-OAuth sessions; account-level settings were intentionally not changed.
3. Complete the remaining live browser checks described in the latest follow-up below. Google account selection, consent, workspace initialization and refresh persistence have succeeded.
4. Two authorized Google accounts have now been exercised live. Keep their verification workflows separate; no destructive cleanup is authorized. Remaining live checks are listed in the latest follow-up.

## Limitations and concerns

- Phase 1 is not marked complete while hosted verification is pending.
- Execution remains simulated. There is no worker, scheduler, real webhook receiver, connector credential storage or external HTTP delivery in this increment.
- One personal workspace per user; team membership/invitations are deferred.
- Workspace-wide revisions reject overlapping edits safely, with export/reload recovery; there is no automatic merge or realtime collaboration.
- The current 200-run retention and Phase 0 backup limits remain. Oversized imports are rejected rather than silently trimmed. Semantically invalid recovered drafts can be exported for manual repair; they are never silently loaded or discarded.
- Cookie-authenticated API operations have Origin and ownership checks, bounded input and no public cache. This is not a substitute for a later production-wide security review, rate limiting, CSP and connector egress controls.
- Private SECURITY DEFINER write helpers are a deliberate capability boundary needed to deny direct table writes. Hosted role/ownership checks passed. Supabase Security Advisor was rerun: zero errors, three warnings. Two concern the existing `public.rls_auto_enable()` function being executable by public/signed-in roles; that function is not introduced by this migration. The third is disabled leaked-password protection. Existing account/system settings were not changed; review these warnings before production use.
- The existing Next lint configuration still has five high-severity development-only audit entries through `braces`/`micromatch`/`fast-glob`, with no compatible patched dependency available during the Phase 0 investigation. New installs also report existing ESLint 10 peer-range warnings. Actual lint passes; no forced incompatible downgrade was applied.
- No paid services or project provisioning were introduced.

## Recommended Phase 2

After hosted Phase 1 verification: durable server-side execution with trusted workflow snapshots and measured results; queue/worker lifecycle, retries, cancellation and idempotency; bounded HTTP egress and SSRF controls; encrypted connector credentials; real webhook triggers; audit/observability; production limits and operational recovery. Google authentication continues to request only identity scopes; future Google service connectors require separate explicit consent.

## Historical verification notes before migration approval - October 19, 2026

After the user completed the first Google consent attempt, the connected Brave tab returned to the application with `bad_oauth_state` / ?OAuth state has expired.? This is a provider-state failure, not a successful authenticated FlowForge session. Session persistence, authenticated sign-out, hosted bootstrap and authenticated CRUD are therefore still not marked verified.

A fresh Google attempt was opened and left for the user to complete. Several Google accounts are available; no identity was selected by the agent. The Supabase project dashboard was also checked in the connected browser and requires account sign-in. MCP still lists only the other projects, so no hosted migration was applied.

Additional live checks against localhost:3001:

| Check | Observed result |
| --- | --- |
| Connected Brave opens `/dashboard` without a valid session | Redirects to `/login` |
| Unauthenticated `GET /api/workspace` | 401, private/no-store |
| Unauthenticated `GET /api/workflows` | 401, private/no-store |
| Unauthenticated `GET /api/workflows/not-owned` | 401, private/no-store |
| Cross-origin workspace PUT | 403 |
| Hosted `ff_workspaces` schema probe | 404 / PGRST205 |
| Public Auth configuration | HTTP 200; Google enabled; Email remains enabled |

Fixed a recovery issue exposed by this live attempt: Supabase can redirect expired/provider-state failures to its Site URL before FlowForge's callback route runs. The proxy now forwards those root-level error returns to the sign-in page with a generic retry message, strips untrusted provider descriptions, and leaves normal landing requests unchanged. The authenticated browser suite includes a regression assertion for this return path.

Follow-up files: `src/proxy.ts`, `tests/browser/phase1.spec.ts`, and this document. TypeScript and ESLint passed; the 14 browser/API regressions and production build were rerun after the recovery change. Existing 67 unit/local PostgreSQL results remain the previous executed results; no new live hosted RLS result is claimed.

Remaining prerequisites are unchanged: access to FlowForge's owning Supabase project to apply and inspect the migration, Google-only provider configuration, and a fresh completed OAuth attempt. An expired Google consent URL must not be reused; begin again at `http://localhost:3001/login` when necessary. Phase 1 remains incomplete pending hosted verification.

### Subsequent authenticated inspection

The user completed the fresh Google flow and signed into the Supabase dashboard. The application reached `/login?error=workspace`, which is emitted after code exchange and verified Google/OAuth authentication when workspace bootstrap fails. Opening `/dashboard` displayed the authenticated workspace-loading error, and reloading retained that state rather than redirecting to sign-in.

A read-only SQL query in the correct FlowForge project's SQL Editor returned `ff_bootstrap() = NULL`, **0 public `ff_%` tables**, and **2 Google identities**. The project is healthy but has no Phase 1 schema. This identifies the current workspace failure as missing migrations; no hosted data operation has been fabricated. MCP remains unauthorized for this project despite browser dashboard access.

An action-time confirmation to apply `supabase/migrations/20261018215836_phase1_workspaces.sql` is pending. It creates six tables and owner-scoped RPC/RLS access without deleting existing data. Hosted bootstrap, CRUD, isolation and sign-out remain unverified until that migration is applied and exercised. The earlier expired OAuth state describes the prior attempt, not the current authenticated session.

## Approved migration and live verification - October 19, 2026

The user approved applying the versioned migration through the SQL Editor. It ran atomically and returned success; the submitted migration text was compared with the on-disk file and matched exactly. Hosted inspection confirmed six RLS-enabled tables, one profile/default workspace and one newly created verification workflow. Anonymous workflow SELECT and authenticated direct INSERT privileges both returned false. No previous application tables or user data were removed. CLI migration-history registration was not performed.

Live application checks passed for Google authentication, session persistence across reloads, default workspace/profile creation, workflow creation and edits surviving refresh, preference changes surviving refresh, simulated execution history surviving refresh, connected dashboard totals/onboarding, and secure sign-out. The workspace name was restored to its original value after preference testing. The clearly named verification workflow and its simulated run remain available; no destructive cleanup was performed. After sign-out, requesting `/dashboard` returned to `/login`.

Hosted SQL assertions returned `PASS` for owner reads, idempotent bootstrap, invalid and stale revision rejection, foreign read/write denial, and an isolated second workspace. The script is preserved at `supabase/tests/phase1_hosted_verification.sql`, with explicit prerequisites. It uses controlled claims for two existing Google identities and rolls back all test writes; this is hosted PostgreSQL verification, not two-account browser OAuth verification.

The live stale-tab browser test stayed in a pending-save state. Reload displayed the preserved account draft, and the export/keep-server recovery action restored the authoritative workflow. Browser download-event verification timed out, so a completed download and live conflict banner are not claimed. Added a 30-second client timeout and 15-second database RPC timeouts: an uncertain save keeps its draft and requires an explicit retry, with revisions guarding against overwriting an already committed request. The automated suite now includes a stalled-request/timeout/retry regression. A clean live conflict retest remains outstanding.

Fixed existing cloud presentation gaps without redesigning: cloud storage/workspace labels, empty-dashboard starter destinations, and simulated-history/preferences wording. Follow-up code: `src/components/{shell,dashboard,executions,settings,cloud-provider}.tsx`, `src/lib/workspace-api.ts`, and `tests/browser/phase1.spec.ts`.

Supabase Security Advisor was rerun and showed zero errors and three warnings (existing `public.rls_auto_enable()` public/authenticated execution and disabled leaked-password protection). Redacted configuration preflight still reports Email enabled alongside Google. Account-level settings were not changed. MCP remains unauthorized for this project.

At this point in verification, the second-account browser and clean conflict checks were pending; both subsequently passed as recorded below. Actual hosted session-expiry refresh remains unverified. Local import confirmation/idempotence and expiry refresh are automated fixture/PostgreSQL checks; the user's existing browser workspace was not imported without their explicit confirmation. Phase 1 is not marked complete while the provider configuration and final acceptance remain outstanding.

Evidence: `.phase1-evidence/migration-applied.png` (ignored local artifact). Earlier temporary screenshots under Playwright's `test-results` directory were removed by its normal output cleanup during the final rerun.

Final local rerun after all follow-up code changes: `npm run validate:browser` passed TypeScript, ESLint, all 67 unit/local PostgreSQL tests, production build, and all 15 browser/API regressions (32.2 seconds for the browser suite). The new stalled-save test accelerates the browser timeout in the test harness only, stalls a PUT, verifies retained recovery bytes, then verifies explicit retry persists the edit. `git diff --check` also passed. Live provider preflight remains nonzero because Email is enabled; no hosted browser result is inferred from the automated fixtures.

### Two-account browser verification

After the user selected a different Google account, the real callback opened its separate empty dashboard with zero workflows, zero simulated runs and zero onboarding completion. Direct navigation to the first account's workflow API returned `{"error":"Workflow not found."}`; the matching editor URL showed the unavailable-workflow state without disclosing its document. A separately named verification workflow was then created successfully in the second account. Hosted SQL inspection confirmed two profiles, two workspaces, two distinct owners, two workflows and one simulation. This verifies isolation using two real Google logins in addition to the earlier controlled-claims SQL tests.

Evidence: `.phase1-evidence/second-account-api-denied.png` and `.phase1-evidence/second-account-editor-denied.png` (ignored artifacts). No existing local workspace data was imported or deleted.

### Live conflict diagnosis and resolution

The clean two-tab test exposed a real hosted integration issue missed by the local SQL fixture: raising application conflicts as PostgreSQL `40001` can cause PostgREST to retry the transaction instead of returning promptly. Supabase documents this behavior and recommends a non-retryable code such as `PT409`: https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b .

The forward-only follow-up migration changes only that exception code using `CREATE OR REPLACE FUNCTION`; the original applied migration remains unchanged. The API accepts `PT409` and retains compatibility with `40001`. Unit/database tests and the local REST fixture now execute every migration in filename order, assert the exact new conflict code, and map it to HTTP 409. A temporary code-only diagnostic log was removed after diagnosis; no credentials or raw database error details were logged.

After applying the follow-up, the preserved stale draft immediately produced the correct **Save conflict** recovery banner. The export/reload action then restored the first tab's acknowledged server edit, with **Saved to workspace** displayed. This clean live conflict/recovery check passed. File download completion itself remains unverified by the browser adapter; the recovery action and server state were visibly verified. Hosted inspection confirmed the `PT409` function is installed, anonymous execution remains denied, authenticated execution remains allowed, and zero old active commit requests remained. No backend termination or project restart was necessary.

Follow-up files: the new SQL migration, `src/lib/workspace-api.ts`, `tests/database.test.ts`, `scripts/test-supabase.mts`, `supabase/tests/phase1_hosted_verification.sql`, and this document. Evidence: `.phase1-evidence/live-conflict.png`.

Post-fix final verification: `npm run validate:browser` passed TypeScript, ESLint, 67 unit/local PostgreSQL tests, production build, and 15 browser/API regressions (26.8 seconds for the browser suite). `git diff --check` passed. The live provider preflight was repeated and still reports Email enabled; its readiness check therefore remains unsuccessful even though Google connectivity/authentication works. Final outstanding items are disabling Email through the account owner, reconciling manually applied CLI migration history before future pushes, and optional additional live expiry/download verification. Existing security-advisor warnings remain documented above. No commit, push or application deployment occurred.

### Logout visibility regression fix

The user reported that clicking the account identity appeared to do nothing. The sidebar was fixed to the viewport without vertical overflow handling, and the native details menu expanded downward beyond its bottom edge. The account email could also wrap and push its actions farther off-screen.

The account actions now open upward above the identity with a visible chevron and keyboard focus outline. The sidebar scrolls independently on short screens, identity text truncates, and a permanently visible **Sign out** action is available in the top bar. Mobile top-bar controls wrap without horizontal overflow. Both logout controls retain the same protected POST endpoint; authentication behavior and the existing design tokens are unchanged.

Changed files: `src/components/shell.tsx`, `src/app/auth.css`, `tests/browser/phase1.spec.ts`, and this document. Three new browser regressions verify logout remains within the viewport at 1536x786, 1280x600 and 390x700. Desktop tests click the visible popup action using its actual screen coordinates; mobile tests use the top-bar action. Each confirms redirect to login and protected dashboard access afterward.

Verification: `npm run validate:browser` passed TypeScript, ESLint, 67 unit/local PostgreSQL tests, production build and all **18 browser/API tests** (37.6 seconds for the browser suite). Screenshot evidence: `.phase1-evidence/logout-menu-1280x600.png` and `.phase1-evidence/logout-menu-1536x786.png`. These are automated fixture-session browser checks. The existing Brave connection timed out during attempts to inspect the user's current live tab, so the current live-account click/sign-out was not performed or claimed. No account data, provider settings or credentials were changed by this UI fix.

### Subsequent Phase 0 stabilization recheck

On receiving the original stabilization brief again, the existing Phase 1 implementation was preserved. Added the legacy raw-data recovery browser cases to the active suite at the current public recovery route, restored native Settings picker checks, and extended the large-list case with search/filter/duplicate/delete checks. No application runtime code, styles, services, dependencies or hosted configuration changed in this pass. Fresh full validation passed TypeScript, ESLint, 67 unit/local PostgreSQL tests, production build and **21 browser tests** (53.4 seconds). See `PHASE0.md` for the acceptance recheck report. This does not change the separately documented live/provider readiness limitations.

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
