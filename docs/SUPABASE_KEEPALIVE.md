# Supabase keep-alive

GitHub Actions calls `POST /rest/v1/rpc/keep_alive` with an empty JSON object and
the project's publishable API key (or legacy anon key) in the `apikey` header.
The database function returns integer `1` using `SECURITY INVOKER` and the explicit
`pg_catalog` search path. Only `anon` receives an execution grant; no application
tables, data, RLS policies, authentication settings or application routes change.
The publishable key identifies the application; this is not a signed-in user session.

Project inspection found Next.js 16 / React 19 with npm (`package-lock.json`),
`@supabase/supabase-js` and `@supabase/ssr` for browser/server authentication and
database RPCs. No Prisma integration was found. Native PostgreSQL tooling belongs
to the existing operator/recovery scripts and is not used by this automation.
No equivalent keep-alive RPC was found in the public project. Staging is untouched.

The runner needs only its preinstalled Bash, Python 3 and curl. It does not check
out the repository, install packages, use privileged Supabase credentials or require
any `GITHUB_TOKEN` permissions (`permissions: {}`). Each request has a 10-second
connection timeout and 20-second maximum, at most two retries for curl's transient
failures, a 60-second retry window and a two-minute job timeout. HTTP errors and
responses other than `1` fail the job. Credentials and response bodies are not logged.

## Schedule

Workflow: `.github/workflows/supabase-keepalive.yml`, **Supabase keep-alive**.

| UTC | IST (UTC+05:30) |
| --- | --- |
| 02:17 daily | 07:47 daily |
| 14:17 daily | 19:47 daily |

Cron: `17 2,14 * * *` (every 12 hours, away from the top of the hour).
Runs happen on GitHub-hosted `ubuntu-latest` runners even when your computer is off.

## Setup after approval

1. Review and approve only
   `supabase/public-migrations/20261101224928_keep_alive.sql` for public Supabase
   project `kixwwrmedqazurvdnfhi`. Apply it through the existing approved public
   migration process, with migration-history tracking. Do not run a blanket
   `supabase db push`: the regular migration directory includes protected staging
   and real-execution changes. This public track deliberately remains separate.
2. In GitHub repository `yashvatsdev/flowforge`, open **Settings → Secrets and
   variables → Actions → New repository secret** and add:

   | Secret | Value entered privately |
   | --- | --- |
   | `SUPABASE_URL` | The public project's `https://<project-ref>.supabase.co` URL |
   | `SUPABASE_KEY` | That same project's active `sb_publishable_...` key, or compatible legacy JWT with role `anon` |

   Never use `sb_secret_...`, `service_role`, a user access token or database password.
   The workflow rejects malformed keys and legacy JWTs whose role is not `anon`.
   Local JWT decoding only checks the declared role; Supabase validates the key.
   Keep secret values out of chat, source code and `.env` commits. The application's
   existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   are separate deployment variables, not automatically GitHub Actions secrets.
3. After explicit commit/push approval, place the workflow on the default branch
   (`main`). No existing workflows were found locally or on remote `main` during
   setup. The GitHub connector lacks secret-management operations. After owner
   approval, the existing authenticated Git/Vercel tools were used to configure
   these two repository secrets with GitHub's public-key encryption API, without
   printing their values or creating an environment file. Actions is enabled.
4. Ensure GitHub Actions is enabled. Open **Actions → Supabase keep-alive → Run
   workflow**, select `main`, then run it. Inspect the run and the **Ping the
   Supabase database** step. A successful request prints only
   `Supabase database ping succeeded.` Confirm a scheduled run afterward as well.

Adding these files alone does not apply the migration or start a GitHub run. The
approved deployment and successful first manual GitHub run are recorded below.

## Troubleshooting

- **URL/key validation:** secrets must be nonempty, from the same public project,
  without quotes, spaces or newlines. Use the hosted project URL, not the dashboard
  URL, a database connection URI or a URL ending in `/rest/v1`.
- **401:** the key is wrong, disabled or belongs to another project. Prefer an active
  publishable key. Publishable keys belong in `apikey`, not `Authorization: Bearer`.
- **403 / permission denied:** confirm `anon` has schema `USAGE` on `public` (already
  present in this project) and `EXECUTE` on `public.keep_alive()`. Do not grant
  application-table access or change RLS to fix this.
- **404 / PGRST202:** apply the approved migration to the project named by the URL;
  ensure `public` is an exposed API schema. The migration notifies PostgREST to reload
  its schema cache; allow a short refresh delay before retrying manually.
- **Timeout, 429 or 5xx:** inspect Supabase project health and the failed GitHub run.
  Limited transient retries are automatic. A paused project may need the owner to
  restore it in the Supabase dashboard; a failed ping does not unpause it.
- **No scheduled run:** workflow must exist on the default branch, Actions must be
  enabled and repository secrets available. GitHub can delay or drop scheduled runs
  under load. Public-repository schedules can be automatically disabled after 60
  days without repository activity; re-enable the workflow if GitHub disables it.
- **Unexpected result:** verify the function returns JSON integer `1`; never bypass
  the response check or print credentials while investigating.

## Disable

In **Actions → Supabase keep-alive → … → Disable workflow**, disable all runs.
To retain manual runs only, remove the `schedule` trigger through an approved commit.
There is no need to delete the database function or modify application tables.

## Limits and references

This is a best-effort activity request, not a guarantee that Supabase will never
pause a Free project. Provider policies, project health, disabled Actions or delayed
schedules can interrupt it. Do not rely on this for availability guarantees or backups.

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Free project pausing](https://supabase.com/docs/guides/platform/going-into-prod)
- [GitHub scheduled workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

## Validation status

Local validation passed:

- PyYAML parsing and checks of trigger, cron, runner, timeout, secrets and empty
  permissions; Bash syntax validation using the existing Git Bash installation.
- An isolated PGlite PostgreSQL fixture applied the SQL twice, checked invoker mode,
  explicit search path, successful anon result `1`, denial for unnecessary API roles,
  and preservation of the fixture's existing table/data/RLS policy.
- Ten mocked workflow cases exercised publishable and legacy anon keys; missing,
  privileged and malformed credentials; invalid URL/header injection; HTTP failure;
  and an unexpected RPC result. The mocked suite performed no network requests and
  checked that credential values never appeared in captured output.

After explicit owner approval, the migration was applied only to public project
`kixwwrmedqazurvdnfhi`. A live REST POST using its publishable key returned HTTP 200
and integer `1`. Both required repository secret names were verified present.
No application tables, RLS policies, authentication settings, existing workflows,
protected staging or application deployments were changed.

Published only this workflow, migration and documentation to `main` in commit
`3325bc6517824ddfc53bb5c51ad9b84687fe2ced`, using an isolated checkout to preserve
unrelated local changes. Both required repository secrets are configured. The
workflow is active and its first actual manually dispatched GitHub-hosted run
[41360052815 completed successfully](https://github.com/yashvatsdev/flowforge/actions/runs/41360052815),
including **Ping the Supabase database**. This verifies the real runner, secret
injection, REST authentication, RPC request and expected response end to end.
The scheduled trigger is enabled; the first cron-triggered run has not yet been
observed. Check the Actions page for subsequent scheduled runs.
