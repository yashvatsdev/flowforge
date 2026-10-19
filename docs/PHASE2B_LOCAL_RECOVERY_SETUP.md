# Phase 2B.3 local recovery environment preparation

Recorded October 19, 2026. Source project: `kixwwrmedqazurvdnfhi`. This is a preparation plan, not authorization to install software, start services, export data, restore a database, or apply Phase 2B. Read with [the recovery runbook](PHASE2B_MIGRATION_RECOVERY.md) and [the readiness report](PHASE2B_READINESS.md). The runbook permits a complete logical backup with a successful isolated restore rehearsal; PITR is not mandatory.

## Verified workstation state

Read-only checks found:

| Item | Result |
| --- | --- |
| OS | Windows 11 Home Single Language, x64, build 26200 |
| Package managers | WinGet v1.29.380 available; Chocolatey and Scoop not found in PATH or their usual locations |
| Docker | Per-user Docker Desktop 4.93.0.240920 exists at `%LOCALAPPDATA%/Programs/DockerDesktop`; client 29.8.1 |
| Docker engine | Linux-engine named pipe absent; daemon unavailable. No engine was started |
| WSL | 2.7.13.0; Ubuntu and docker-desktop registered as WSL2 distributions, both stopped |
| Virtualization | HypervisorPresent true. CPU CIM virtualization/SLAT flags returned false; these readings under an active hypervisor do not establish that firmware virtualization is disabled. No BIOS or Windows-feature change is justified by them alone |
| Supporting service | LanmanServer running, Automatic |
| Podman | Not found in PATH or checked standard installation location |
| PostgreSQL | Only version 18 directory found; native pg_dump/pg_restore 18.6 available. No verified 17 client installation |
| RAM | Approximately 23.6 GiB total; only 4.0 GiB free at inspection |
| Storage | C: approximately 38.4 GiB free, NTFS; G: approximately 36.5 GiB free |
| Repository link | `supabase/.temp/project-ref` matches the target |

The previous claim that Docker Desktop was absent was based on PATH/standard system-location inspection. Current host-context checks locate its per-user installation. Reuse it; do not install a duplicate runtime. The exact cause of the difference in visibility is not established. No hosted query or new schema/data audit was run in this preparation task. Cached service metadata records PostgreSQL `17.11.0.003`, Auth `v2.197.0` and Storage `v1.80.2`; these are compatibility inputs to refresh before backup, not proof of a running local match.

## Recommended environment and prerequisites

Use the existing Docker Desktop **Linux-container/WSL2 backend** for a separate Supabase-compatible PostgreSQL 17 recovery environment. Use a standalone directory, dedicated project name, network, ports and volumes. Never initialize/start it from this repository or copy its migrations into the rehearsal: CLI startup can apply migration files automatically. Keep the pending Phase 2B SQL entirely out of the destination bootstrap. Do not link the recovery directory to the hosted project.

Prerequisites before starting anything:

1. Operator confirms Docker terms/licensing eligibility and authorizes starting the installed runtime. Per-user Docker is an existing installation; no reinstall, Windows-feature enablement, reboot or administrator action is currently demonstrated necessary. If startup requests any of those changes, stop for specific approval.
2. Confirm a supported Windows servicing state and WSL2 backend. WSL version exceeds Docker's documented 2.1.5 minimum. Engine readiness remains unverified until a separately authorized start and `docker version`/`docker info` show a Linux server. Do not start Ubuntu simply to test this task.
3. Free enough working memory to allocate a provisional 6-8 GiB runtime budget while retaining Windows headroom. Current 4 GiB free is insufficient for that budget. Operator chooses which applications to close; do not terminate them automatically.
4. Reserve 15-20 GiB of disk for images, a capped VM disk/volumes, logs and rehearsal data. Pull only reviewed services and pin image digests. Use a reviewed Supabase PostgreSQL 17 baseline with compatible Auth/Storage schema versions and required extensions; a vanilla postgres:17 container with improvised auth stubs is not sufficient evidence.
5. Bootstrap required managed schemas before importing, with blank local credentials and no production configuration. Keep Auth/Storage/Realtime/background services stopped while importing; enable only local services needed for acceptance after review. Capture any provider-specific difference rather than ignoring failed COPY/ownership/grant statements.
6. Prove loopback bindings and outbound isolation on the actual Docker/WSL2 backend before loading real data. Loopback publication alone does not block egress.

Docker is preferred because it is already installed and matches the primary documented workflow. Podman and Rancher Desktop are Docker-API-compatible alternatives recognized by Supabase, but would add installation/VM/socket integration work and require compatibility verification. They are fallback choices, not parallel installations. The experimental Supabase native runtime is not the preferred Windows route. See [Supabase local development](https://supabase.com/docs/guides/local-development) and [Docker Windows requirements](https://docs.docker.com/desktop/setup/install/windows-install/).

## PostgreSQL 17 client tools

Safest native option: obtain a current supported PostgreSQL 17 x64 binary ZIP from the EDB download route linked by [PostgreSQL's Windows page](https://www.postgresql.org/download/windows/). Extract side by side to an operator-approved user tools directory such as `%LOCALAPPDATA%/FlowForgeTools/PostgreSQL17`. Preserve the archive's required DLL/lib/share layout; do not copy only EXEs. Check official download provenance, published checksums/signatures where available, and record the downloaded artifact's SHA-256 and version. A locally calculated checksum alone is not publisher authentication.

Verify `psql --version`, `pg_dump --version`, `pg_restore --version` and `pg_dumpall --version` all report major 17 using absolute executable paths. Do not replace PostgreSQL 18, edit global PATH, register a Windows database service, select a server-oriented package-manager install, or install pgAdmin/Stack Builder merely to obtain clients. If a missing Visual C++ runtime requires installation/elevation, stop for approval. Installation/download itself is deferred to the approved setup step.

A reviewed Supabase PostgreSQL 17 image can supply matching Linux clients as an alternative, but their access to source credentials and output mounts must be separately secured. Prefer native tools for the interactive Windows authentication check. Pin the dump/restore toolchain; do not rely on 18-generated archives being accepted by a 17 destination. The source is 17.11: review applicable extension/operator compatibility checks before a real export; do not execute changelog corrective SQL automatically. See [PostgreSQL pg_dump compatibility](https://www.postgresql.org/docs/18/app-pgdump.html) and [the provider's 17.11 notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).

## Backup directory and credential custody plan

Proposed layout, not created:

```text
%LOCALAPPDATA%/FlowForgeRecovery/kixwwrmedqazurvdnfhi/
  credentials/                 # local password/service files, never in the backup bundle
  backups/<UTC-backup-ID>/      # encrypted logical exports and manifest
  rehearsal/<rehearsal-ID>/     # isolated configuration/evidence; volumes may reside in Docker's VM
```

This is outside the repository and ordinary Documents/Desktop sync paths. Confirm actual sync/reparse-point behavior and NTFS ACLs before use. Restrict access to the operator and SYSTEM, removing inherited broad Users/Everyone access on the dedicated directory only. Do not change ACLs on the profile or an existing shared parent. Verify protections before creating a password file or writing a dump. Windows administrators remain trusted. Encryption at rest and off-machine custody are **not verified**; select an encrypted volume/container or encrypted artifact scheme with a separately retained recovery key. ACLs alone are insufficient encryption.

For the previously observed approximately 11 MiB source database, reserve 1 GiB for exports/manifests/logs, plus the 15-20 GiB runtime allowance above. These are provisional budgets, not measured archive sizes. Retain an encrypted independent copy and verify decryption; select custodian, retention/expiry and deletion procedure before acquisition. Backup data and restored Auth records are sensitive even without a database password.

No password, service file, dump or connection string is to be stored in this repository, chat, test artifacts or Git. Existing `.env*`/evidence ignores are useful but are not the storage boundary. A read-only `git ls-files` check found no matching tracked env/dump/backup/pgpass/service artifacts; this is not a comprehensive historical secret scan. No such artifact was created in this task.

## Obtaining and handling the existing password

The operator retrieves the existing database password privately from their password manager or the original provisioning custodian. In Supabase's Connect panel for this exact project, identify the session-pooler host, port and `postgres.<project-ref>` username; do not copy the credential-bearing URI into chat or a shell command. The dashboard/CLI OAuth identity and publishable API key are not the PostgreSQL password. The password is not assumed revealable in Dashboard. If its custodian cannot supply it, stop: password reset or creation of an alternative database login is outside this authorization.

For a one-off authentication check, use native `psql -W` in the operator's own terminal so its password prompt handles entry without echo or shell-history interpolation. Do not run it through an assistant tool that captures the supplied password, pass a password argument, or set PGPASSWORD globally. Do not record the prompt session.

If later multi-step acquisition requires a password file, the operator uses a protected local file under `credentials/`, with exact host/port/database/username matching and no broad wildcards. Escape colons and backslashes per libpq. Point process-scoped PGPASSFILE to that path; never print its contents, mount the whole credential directory into containers, or include it in the backup bundle. Windows libpq does not enforce restrictive password-file ACLs itself, so explicitly verify them. Clear the process setting and remove the temporary credential file after the approved operation; separately retain any credentials required for disaster recovery in the password manager. Reference: [PostgreSQL password files](https://www.postgresql.org/docs/17/libpq-pgpass.html).

## Designed read-only native authentication check — not executed

Prepare a protected external libpq service entry named `flowforge_source_preflight` containing only non-password connection fields obtained from the exact project's Connect panel. Validate the session-pooler username includes `kixwwrmedqazurvdnfhi`; its shared hostname alone is not project identity. Use port 5432/session mode, database postgres, connect_timeout=10 and certificate-verified TLS (`sslmode=verify-full` with a trusted CA configuration validated for that endpoint). Do not downgrade TLS validation to make a failure disappear. Set session defaults to read-only with bounded statement/lock timeouts. Keep source and loopback destination entries separate and never give a restore process the source entry/password.

With PG17 installed and the service entry privately prepared, the operator may later run the following approved check; `$ffPg17` refers to its reviewed absolute executable path:

```powershell
& $ffPg17 -X -W --dbname 'service=flowforge_source_preflight' --set ON_ERROR_STOP=1 --file '<external-reviewed-preflight.sql>'
```

The reviewed SQL should be limited to:

```sql
begin read only;
set local statement_timeout = '10s';
set local lock_timeout = '2s';
select current_database(), current_user,
       current_setting('server_version'),
       current_setting('transaction_read_only');
select version from supabase_migrations.schema_migrations order by version;
select has_table_privilege(current_user,'public.ff_workspaces','SELECT') as can_read_workspace,
       has_table_privilege(current_user,'auth.users','SELECT') as can_read_auth;
rollback;
```

Require successful verified-TLS authentication, the validated target routing, server major 17 and read-only=on, and exactly the two Phase 1 history versions. No application row values or passwords are returned. These two privilege checks are preliminary; a complete dump-access matrix for every included table/sequence/schema still precedes backup. Do not infer full backup access from TCP connectivity or one successful SELECT. Authentication failures are reported without retrying unknown passwords, resetting credentials or changing hosted grants. The check is designed here, not run.

## Isolation and external worker verification

Pre-pull trusted pinned images before loading restored data. Use a dedicated internal container network and explicit 127.0.0.1-only port publication. Prevent dual attachment to a network with internet/LAN/host-service reachability; do not use host networking, host Docker-socket mounts, privileged containers or production source credentials. Validate the actual routes and deny rules, including Docker/WSL host gateway and DNS paths, with harmless probes before data import. If Docker backend behavior cannot prove the boundary, stop and require an operator-approved isolated VM/firewall design; Windows firewall/VM policy changes may need administrator approval. Do not assume a nominal internal-network flag proves the entire boundary.

Use new local JWT/service credentials. Do not configure Google production OAuth, SMTP, external webhooks, QStash tokens, Vault keys or production app URLs in the destination. Mount only the intended backup input read-only to the restore process. No migration directory, source password file, user profile or other project volumes should be mounted. Keep background dispatch/cron/worker services off; inspect the restored definitions before making local services available. Preserve source definitions as evidence without activating external execution. Ordinary database reads/RLS tests do not require enabling execution.

An operator verifies external infrastructure using read-only account/team-scoped inspection and records UTC time, account/project identity, schedules, destinations, state and in-flight work, without exporting tokens:

| Surface | Required check |
| --- | --- |
| Vercel | Every relevant team/project and production/preview deployment; Cron Jobs, configured cron routes, deployed worker endpoints, integrations and recent invocations. Inspect environment-variable names/references without revealing values |
| Upstash/QStash | Every authorized account/region; schedules, destinations/URL groups, queued/retrying deliveries and workflow triggers targeting FlowForge URLs. An empty schedule list alone does not rule out queued or one-off deliveries |
| GitHub Actions | Relevant repositories/branches, workflow schedule/dispatch/reusable/workflow_run triggers, active/queued jobs, self-hosted runners, deployment hooks and other CI providers |
| Workstations/servers | Windows Task Scheduler and services; WSL/Linux cron and systemd timers; containers/Compose, PM2/Supervisor, VMs and other hosting provider jobs |
| Supabase | Fresh project-scoped Edge Functions and cron inventory, database triggers/webhooks/subscriptions, and worker RPC existence/effective grants |

Repository searches and prior absent Supabase cron/functions are scoped evidence, not proof across unknown accounts. Require owner attestation identifying the infrastructure scope reviewed. Discovery of an active worker is a stop; pausing jobs, revoking credentials or terminating sessions requires separately authorized changes. This task does not change any external account.

## Decisions and approval gate

No paid Supabase project or PITR is needed for this local design. Existing Docker licensing eligibility, image-download bandwidth and independent encrypted storage may have costs; verify them before proceeding. PostgreSQL community client tools do not require buying a database subscription. Do not silently subscribe to services or accept licensing terms for the operator.

Outstanding decisions: approve reuse/start of Docker and image downloads; choose/pin the Supabase PG17 baseline and native client package; authorize user-directory extraction or any required elevated prerequisite separately; approve the directory/ACL/encryption/key custodian and independent copy; provide adequate free memory; privately establish existing-password availability; approve the read-only native authentication check; confirm external infrastructure ownership and scope; and authorize a later backup quiet window plus disposable restore.

**NO-GO for authorizing the backup rehearsal now.** Engine readiness, PG17 clients, protected storage/encryption, independent credential authentication and tested network isolation are not established. Preparation documentation is complete. Recheck those prerequisites before separately approving backup acquisition and isolated restore. Hosted Phase 2B migration approval remains NO-GO, regardless of local environment readiness. No software was installed, runtime started, password requested/reset, hosted contents exported, restore performed, migration applied, execution enabled, commit/push/deployment made or Phase 2C work begun.
