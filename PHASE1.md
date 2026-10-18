# FlowForge Phase 1 — approved scope with Google-only authentication

Status: implementation plan updated October 19, 2026. OAuth and backend features described here are planned, not implemented or verified. External Google/Supabase configuration must be established before OAuth implementation. Phase 0 remains the verified baseline.

## Inspection and initial state

The project is Next.js 16 App Router with React, TypeScript, React Flow, and Phase 0 validation/recovery. Workflow editing, configuration, connections, local autosave, backups, and local dashboard calculations work. Runs remain deterministic simulations: HTTP responses, notification delivery, and durations are simulated. No Supabase packages/configuration, auth routes, proxy, environment files, database persistence, workflow API, or worker exist in the inspected project. The account UI currently reads local profile settings.

The earlier audit roadmap prioritizes authenticated persistent workspaces, followed by durable execution and real connectors. This phase retains all approved persistence, safe autosave, compatibility, local-data import, connected-dashboard, testing, and design requirements.

## Authentication implementation plan

1. Add `@supabase/supabase-js` and `@supabase/ssr` clients for the existing App Router stack. Provide exactly one authentication entry: **Continue with Google**. No email/password, OTP, anonymous login, or additional social providers.
2. Start Google OAuth through Supabase using PKCE and an explicitly configured application origin. Request only basic `openid email profile` identity scopes. Do not request Google API access or Google offline-access tokens, and do not store Google provider tokens for integrations.
3. Implement `src/app/auth/callback/route.ts`: handle consent denial, missing/expired/replayed code, PKCE exchange failure, and verified session establishment. Use an allowlisted application origin and a fixed or validated internal destination; never trust arbitrary forwarded hosts or return URLs. Prevent sensitive callback responses from being cached or leaking codes/tokens in logs/errors.
4. Bootstrap the profile and default workspace after verified authentication in an atomic, idempotent database operation. Enforce unique profile/user and default-workspace ownership constraints. Concurrent/repeated sign-ins must not create duplicates or overwrite existing workspaces. A replayed single-use code may fail safely; it must not create duplicate data.
5. Add Next.js 16 session-refresh proxy and verified server auth helpers. Protect studio pages, each workflow API, and every server mutation independently. PostgreSQL RLS enforces ownership/workspace membership on exposed tables; editable profile metadata must never determine authorization. Authentication and approved-provider checks must fail closed.
6. Add persistent cookie-based Supabase sessions, refresh/error handling, and same-origin POST sign-out with session cleanup. Clear account-specific cached data on logout/account change and report failures safely. Do not silently redirect database/network failures into an empty starter workspace.
7. Adapt the existing account menu to show Google name, avatar (with fallback), and email, plus sign-out. Treat those values as display data. Preserve the Steel + Pale Blue components, typography, responsive layout, and animations.

## Remaining approved Phase 1 increments

- Add versioned PostgreSQL schema/migrations for profiles, personal workspaces, membership/ownership, workflows, settings, and simulation history. Preserve existing workflow node/configuration JSON compatibility and historical run snapshots.
- Add typed, authenticated Next.js APIs with shared server-side validation and bounded inputs. Adapt the existing Context store through a persistence interface instead of rebuilding the editor.
- Add revision-based optimistic concurrency, acknowledged saves, pending/error/retry states, and protection against stale overlapping requests. Preserve unsaved changes on failures and prevent cross-account draft leakage.
- Offer explicit, confirmed transfer of a valid local workspace into the signed-in workspace. Preserve original local bytes and Phase 0 recovery/export. Use transactional, idempotent import and explicit conflict handling; never automatically replace existing server data.
- Connect dashboard, workflow actions, preferences, and history to persisted records. Replace onboarding heuristics with recorded user actions. Keep simulation history/durations explicitly labeled; client-submitted simulation records must not be treated as authoritative server execution evidence.

## Exact external configuration

Canonical initial development origin: `http://localhost:3000`. Use this consistently in the browser, Supabase settings, and OAuth initiation; `127.0.0.1` is a different origin. If port 3000 is occupied, choose another port and update every application-origin entry before testing.

### Google Cloud / Google Auth Platform

1. Create or select a Google Cloud project and open Google Auth Platform.
2. Configure Branding: FlowForge app name, user support email, and developer contact email. Configure required domain/privacy information when publishing a public application.
3. Configure Audience as External for general Google accounts (or Internal only for an intentionally restricted Google Workspace organization). While in Testing, add the Google accounts that will test sign-in as test users.
4. In Data Access, enable only OpenID, email, and basic profile scopes: `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile`. No Gmail, Drive, Calendar, or other Google API permissions.
5. Create an OAuth client of type **Web application**. Authorized JavaScript origin: `http://localhost:3000`.
6. Authorized redirect URI: the exact Supabase Google-provider callback copied from its dashboard, normally `https://<project-ref>.supabase.co/auth/v1/callback`. This is the Google-to-Supabase destination, not FlowForge's callback. Custom Supabase auth domains require the callback supplied by that project's dashboard.
7. Paste the Google Client ID and Client Secret directly into the Supabase Google provider settings. Do not put the secret in chat, application source, public environment variables, screenshots, or documentation.

### Supabase

1. Select a dedicated development Supabase project; obtain its project URL and publishable key from its Connect/API settings.
2. Authentication → Sign In / Providers: enable Google with the Google OAuth Client ID/Secret. Disable email/password, phone, anonymous sign-ins, and all other providers for this Google-only application. Existing non-Google accounts/sessions in a reused project require explicit handling; disabling providers alone does not revoke existing sessions.
3. Authentication → URL Configuration: Site URL `http://localhost:3000`; allowlisted Redirect URL `http://localhost:3000/auth/callback`. Use exact URLs rather than broad wildcards.
4. Keep normal OAuth verification enabled. Database migrations and RLS will be prepared as part of Phase 1, with no destructive resets or remote changes assumed by this plan.
5. The app needs these local configuration values, with actual values entered directly into the ignored `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
APP_ORIGIN=http://localhost:3000
```

The publishable key is designed for browser use; RLS remains mandatory. Google Client Secret, Supabase secret/service-role key, database password, and access/refresh tokens must never be exposed. Normal user workflow operations will use the user's session and RLS rather than a privileged service-role key.

No external project or credentials have been created/configured by this documentation update. No OAuth implementation has started. External configuration cannot be verified from the repository alone.

## Planned tests and verification

- Unit tests: provider/scope configuration, safe redirect handling, auth errors, validation, revision conflicts, imports, and idempotent bootstrap.
- Database/API integration tests against a dedicated test project: unauthenticated denial, rejected non-Google principals, user A cannot read/write user B's workspace/workflows/settings/history, reassignment denial, duplicate/concurrent bootstrap, import atomicity, and stale-save rejection. Exercise RLS directly as well as application APIs.
- Browser regressions: single Google button, protected-route redirects, callback success/error paths, refresh/reload, sign-out, account data isolation, autosave failures/conflicts, confirmed local import, and connected dashboard; retain Phase 0 coverage and responsive checks.
- Automated callback/session tests must clearly identify controlled fixtures; they do not prove Google's live consent page works. Complete a separate manual Google sign-in using an authorized test account and verify persisted profile/workspace/session end to end before claiming live OAuth verification. No production auth bypass or fake provider success.
- Run TypeScript, ESLint, unit/integration tests, browser tests, production build, and dependency review. Record actual results here after implementation; none of the new checks has run yet.

## Expected changed files

Existing store, workspace types/validation, Shell/account menu, studio layout, Settings, dashboard, and workflow/editor persistence call sites; new auth routes/UI, `src/proxy.ts`, Supabase clients/auth guards, typed workflow/workspace APIs, persistence adapter, generated database types and migrations, tests/configuration, dependency manifest/lockfile, setup docs, and this report. The precise list will be recorded from implemented changes.

## Security, dependencies, and architecture concerns

Use verified sessions with per-operation authorization and RLS. Add same-origin protections for cookie-authenticated mutations, safe redirects, noncached private/auth responses, bounded requests, and redacted errors. Preserve Phase 0 data recovery and version compatibility. Supabase availability/configuration errors must be explicit. Google display metadata is not an ownership source. Avoid privileged keys in regular user request paths. Review the existing Phase 0 development-only lint dependency advisories alongside any new dependencies.

## Recommended Phase 2

Durable server execution with real measured outcomes, trusted workflow snapshots, queue/worker lifecycle, retries/cancellation/idempotency, HTTP egress controls, encrypted connector credentials, real webhook triggers, and execution observability. Google sign-in continues to request identity scopes only; any future Google service connector requires separately approved consent.

## Delivery restrictions

No deployment, commit, or push without approval. Preserve the existing frontend design and working functionality. Update this file with implemented features, exact changed files, architecture decisions, test results, and remaining limitations at the end of Phase 1.
