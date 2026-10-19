# Phase 2B.4 local recovery setup results

Recorded October 19, 2026. Target: `kixwwrmedqazurvdnfhi`. **NO-GO for the combined native-authentication and backup-rehearsal gate.** Client tools and protected storage are prepared; a compatible running restore destination, network isolation and independent encryption are not verified. No hosted password was retrieved, reset or requested; no hosted database contents were exported or restored.

This result supplements [the setup plan](PHASE2B_LOCAL_RECOVERY_SETUP.md), [the recovery runbook](PHASE2B_MIGRATION_RECOVERY.md) and [the readiness report](PHASE2B_READINESS.md). The user's Phase 2B.4 request authorized local preparation, but conditioned Docker startup on sufficient resources and no disruption. Resource checks prevented startup; this report does not claim that the complete environment is ready.

## Resources and runtime

- Windows has approximately 23.6 GiB usable total RAM. Free physical memory declined from approximately 2.8 GiB at initial inspection to **0.98 GiB** at the final check. No applications were terminated and no Docker/WSL recovery workload was started. No attribution of the decline to a particular existing workload is asserted.
- Final free storage: C: `40,854,614,016` bytes (38.05 GiB), G: `38,811,881,472` bytes (36.15 GiB). The PG17 archive is 381,531,864 bytes; extracted tools total 92,770,649 bytes. Preparation used approximately 452 MiB plus small evidence files. Other disk changes are not attributed to this task.
- WSL2 was already installed; Ubuntu and docker-desktop were stopped. Existing per-user Docker Desktop and its Linux-engine configuration are present, but the engine named pipe remains absent. `docker ps` could not connect. No existing Docker workloads were stopped, restarted, reconfigured or deleted; persisted workloads cannot be inventoried while the daemon is unavailable.
- Preserve the setup plan's provisional 6-8 GiB runtime budget plus Windows headroom and 15-20 GiB disk allowance for a reduced service set. At current memory levels even the published 4 GB minimum for all Supabase components cannot be allocated safely. Do not start the default full stack or change global Docker/WSL resource settings as a workaround.

## Native PostgreSQL 17 client installation

Obtained the Windows x64 archive from the EDB binaries page, which linked `https://sbp.enterprisedb.com/getfile.jsp?fileid=1260616`; its HTTPS redirect was:

`https://get.enterprisedb.com/postgresql/postgresql-17.11-5-windows-x64-binaries.zip`

Archive SHA-256: `80379B2C04D51C30225532E0AE04509899141E9957ED096FE749D7FD9DF8F82F`.

Client root: `C:/Users/yashv/AppData/Local/FlowForgeTools/PostgreSQL17`.

Only four EXEs were extracted, together with supporting DLLs, library DLLs and share files. The archive was read through streaming download/extraction rather than loading it into memory. No installer, initdb, pg_ctl or server executable was run or installed as a service. No global PATH change was made.

| Executable | Verified output |
| --- | --- |
| bin/psql.exe | psql (PostgreSQL) 17.11 |
| bin/pg_dump.exe | pg_dump (PostgreSQL) 17.11 |
| bin/pg_restore.exe | pg_restore (PostgreSQL) 17.11 |
| bin/pg_dumpall.exe | pg_dumpall (PostgreSQL) 17.11 |

The four EXEs report Authenticode NotSigned. Provenance is the official EDB HTTPS distribution plus a locally recorded integrity hash; no independent published checksum/signature was verified. This limitation is explicit. Windows service inventory before/after shows only the existing running `postgresql-x64-18`; no PostgreSQL 17 service was added. Its installation and operation were not altered.

## Protected storage and encryption

Created:

`C:/Users/yashv/AppData/Local/FlowForgeRecovery/kixwwrmedqazurvdnfhi/`

Subdirectories: `credentials`, `backups`, `rehearsal`, `downloads`, `evidence`. The root `FlowForgeRecovery` has inheritance disabled and exactly two FullControl allow entries: the current Windows account and SYSTEM, inheritable to descendants. Child directory ACL checks confirmed the two inherited rules. The root is an ordinary directory, not a reparse point. No profile/shared-parent ACL was changed. This location is outside Git; no backup credential or source connection file was created.

Final inspection found **zero files in credentials, backups and rehearsal**. The downloaded public tool archive, installation manifest and synthetic encryption-test artifacts are confined to downloads/evidence. No production configuration or credential was copied. Because no container exists, there is no running recovery-container environment to attest; do not represent empty directories as a verified compatible destination.

Encryption checks:

1. `manage-bde -status C:` was denied by Windows for insufficient administrative rights. This was an OS privilege failure, not an automatic approval-review rejection. Disk/VM encryption state remains unknown. No encryption setting was changed.
2. Existing Git-bundled GPG 2.4.8 was tested only with synthetic text and a generated ephemeral test passphrase. The first attempt exposed MSYS path conversion; the second corrected it but could not start the bundled agent. The synthetic encryption test therefore **did not pass**. The attempted cleanup targeted only the dedicated synthetic-test agent home. No real backup or operator passphrase was involved, and no test passphrase was persisted.
3. Windows DPAPI CurrentUser protect/unprotect passed a synthetic in-memory round trip. This is an available local-profile protection option, **not** evidence of a portable independently recoverable backup or encrypted Docker volume.

Before any hosted data is downloaded/restored, verify local encrypted storage (including Docker's VM/volume location) and establish artifact encryption plus a separately held, tested recovery key. ACLs or DPAPI alone do not close that prerequisite. No new encryption software was installed merely to bypass the unresolved checks.

## Restore compatibility and isolation evidence

No Docker image was pulled and no network, container, volume or local database was created. The restore environment is **not yet instantiated or compatible by demonstrated evidence**. No production credentials are present in the prepared empty credential/rehearsal directories; the eventual container configuration still requires verification.

Consequently, loopback-only publication, egress denial, host-gateway/LAN isolation and dependency compatibility have **no passing runtime test evidence**. No probes were sent to hosted Supabase. The approved next setup step remains a separate Supabase-compatible PostgreSQL 17 baseline with dedicated network/volumes/local credentials, no copied repository migrations, pinned images, no production URL/credential mounts and a reviewed deny-egress design. Use synthetic endpoints/probes before real data; stop if the actual Docker/WSL backend cannot demonstrate isolation. Do not label a merely declared internal network as tested.

## Read-only external inventory

Inspected accessible configuration without modifying it or requesting credentials:

| Surface | Observation and limit |
| --- | --- |
| Vercel | Personal/default scope and the one returned team, techtroop, returned zero projects matching either FlowForge's name or exact GitHub repository URL. No matching deployment/cron configuration could therefore be inspected. This is not a claim about projects under other names/repositories/accounts |
| QStash | Metadata-only user listing identified EU and US regional scopes. Schedule listings in both returned empty arrays. No credential-bearing listing was requested. Existing queued/one-off deliveries, URL groups, other accounts and workflow activity remain unverified; empty schedules do not prove absence of execution |
| GitHub Actions | Repository remote is `yashvatsdev/flowforge`. The connector rejected the Actions workflow-list endpoint as unsupported; the workflows-directory request returned 404, which does not distinguish absent content from unavailable repository access. Remote Actions inventory remains unverified; no alternate-path retries or workflow mutations were attempted |
| Repository | No .github workflow directory or vercel.json exists in this working tree; local runner retains its loopback/production guard. This does not inventory remote deployments |
| Windows Task Scheduler | 210 accessible tasks checked; none matched FlowForge, QStash, the project ref or run-executions in task identity/actions. Action arguments were used for matching but were not printed or retained |
| Windows services | 318 accessible services checked; none matched those identifiers in name/display name/executable path. Generic wrappers and unrelated machines are outside this matching-based result |
| WSL/other hosts | Stopped WSL distributions were not booted for cron inspection. Other servers, CI accounts and hosting providers remain operator inventory gaps |
| Supabase | Scoped read-only metadata check at 2026-10-19 12:51:19 UTC found no cron.job relation and zero public start/claim/advance entrypoints. Edge Function listing was empty. No application rows or hosted credential contents were fetched |

No jobs/schedules were paused, no messages published, no QStash configuration changed and no privileged endpoint invoked. Account-owner confirmation and remaining read-only queue/Actions/deployment/other-host checks are still required. This task is not a comprehensive attestation across all external infrastructure.

## Remaining prerequisites and decision

1. Operator frees sufficient RAM without disrupting required workloads. Recheck memory immediately before starting Docker; no approval to exhaust Windows headroom is inferred from the setup authorization.
2. Start the existing Linux engine only when safe, inventory existing containers first, and preserve them. Create only dedicated recovery resources.
3. Resolve encrypted local storage/VM protection and independent artifact/key custody; test decryption on synthetic input before real backup use.
4. Instantiate and verify the compatible PG17/Supabase baseline and actual network boundaries with synthetic tests. Verify credentials/mounts/endpoints contain no production configuration.
5. Complete the external inventory gaps and document the operator-owned infrastructure scope.
6. Then separately authorize the native PostgreSQL read-only authentication check. Tools are ready for it, but no hosted password may be supplied to the assistant; use the private procedure in the setup plan. A successful native login is not a backup.
7. Only after all prerequisites pass, separately authorize source backup acquisition and isolated restore rehearsal, with a quiet window and integrity manifest. The pending hosted Phase 2B migration remains unapproved.

**NO-GO for backup rehearsal.** Native client installation is GO as an accomplished preparation step; native authentication is unperformed and requires the next explicit authorization. No hosted migration, data export/restore, password retrieval/reset, execution enablement, commit, push, deployment or Phase 2C implementation occurred.
