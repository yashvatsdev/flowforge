# Hosted fingerprint investigation — read only

Target: `kixwwrmedqazurvdnfhi`. Original accepted baseline: [Phase 2B readiness](PHASE2B_READINESS.md), October 19, 2026, approximately 12:11:41 UTC. Investigation observations: October 19, approximately 18:38–18:42 UTC (October 20 Asia/Calcutta). **The accepted baseline has not been changed.**

## Finding and classification

The differences are **consistent with owner-authenticated application editing, but not fully explained or accepted**. They do not establish a tenant-isolation bypass, compromise, or malicious edit. Available evidence cannot establish the exact old workflow content or account for every revision. Keep hosted application/migration approval blocked until an operator resolves those gaps. No application rows, authentication settings, history, or schema were modified during this investigation.

| Table | Rows before / now | Accepted SHA-256 | Observed SHA-256 |
| --- | --- | --- | --- |
| ff_workspaces | 2 / 2 | `6820bb196f55816bf80cb6fd13fb8a53b9eb7a9a3b7e80a6ece567783b9ffbd2` | `3cf767bb5ada36e3bb0c3c114eaadbe9b7788c31a371fa837fe3e1ef0a055628` |
| ff_workflows | 2 / 2 | `d06ab92941decaf470367577d4498ef89ca1192d456c74f419513f62579a080d` | `5b0f8ee8034b960c2aaaba85a8f967dc615aa2b4be586c17c4ae38a665a112d6` |

Profiles (2), preferences (2), simulations (1), and imports (0) exactly match their four accepted count/fingerprint pairs. These are sorted full-row JSONB SHA-256 aggregates using the existing verification script, not backups or transaction logs.

## Record evidence

Workspace A is `579edc56-ee99-47d6-981a-099b38581e0d`, owned by the authenticated subject beginning `a83e3405`. It was created October 18 at 22:50:24.339659 UTC. Current revision is **11**, onboarding is `explored, edited`, and its name matches its preferences document. Its current row hash is `7211be5ec6cfc3911f16b5a0f563ab760764c187ef49b4a8ac91768c2ac78638`.

A SELECT-only reconstruction replaced revision/onboarding in JSON expressions, without updating rows. The original workspace-table aggregate was reproduced **exactly** with Workspace A revision **4** and its current onboarding array, leaving all other current workspace fields/rows unchanged. Subject to ordinary hash assumptions, this strongly localizes workspace-table drift to a **4 → 11 revision change**; it is not a newly accepted baseline or a recovered row snapshot. No other candidate revision/onboarding combination tested matched.

Its workflow `736b4b53-3448-4e44-bc8e-7f30f2605ba8` has three nodes, two edges, expected document keys, and passes `ff_valid_workflow`. Its document `updatedAt` is **2026-10-19 13:43:21.783 UTC**; document hash is `a67f3e286057a894a0408fc31d5303e29b243b3f0a10ba56da2e87a113067e1a`, row hash `c6be308aad8115d30ffb61d37d95e56e00a0512b18bf34ecf9cb67cf1bfb8013`. The workspace and workflow have the same current `xmin`, **984402**, consistent with one atomic save transaction.

Workspace B is `d9d937cb-b5c5-4529-b821-5e02754f40ab`, created October 18 at 22:35:18.668075 UTC, current revision **9**, onboarding `simulated, explored, edited`. Its workflow `f92bf3d3-e7f6-4357-81c1-35c8206bc9a7` has one node, no edges and document `updatedAt` **October 18 22:45:58.622 UTC**. Both current rows have `xmin` **229539**. The workspace reconstruction above leaves B unchanged and matches the original workspace aggregate; the available baseline does not independently preserve per-workflow hashes to prove B's historical document equivalence.

There is no database `updated_at` on these workspace/workflow tables, and workflows have no database `created_at`. Workflow `document.updatedAt` is client-supplied, not an audit timestamp. `track_commit_timestamp` is **off**, so `xmin` cannot provide commit wall-clock time or user identity. One initial metadata SELECT incorrectly requested nonexistent timestamp columns and failed with `42703`; it performed no writes. Subsequent queries used the actual migration schema.

## Audit correlation

Read-only unified-log queries covered 12:11:41 through 18:40 UTC on October 19. They selected timestamps, request paths/methods/status, verified JWT subject/role, SDK identifier and Auth action; no token values, request bodies, IP addresses or credentials were exported.

Four gateway entries show `POST /rest/v1/rpc/ff_commit`, HTTP **200**, role **authenticated**, subject matching Workspace A's owner, client `supabase-ssr/0.12.7 createServerClient`:

| UTC | Observation |
| --- | --- |
| 13:43:04.558 | Successful ff_commit |
| 13:43:05.667 | Successful ff_commit |
| 13:43:07.535 | Successful ff_commit |
| 13:43:22.163 | Successful ff_commit, approximately 380 ms after the workflow's client timestamp |

These calls were preceded by successful `getUser` requests, bootstrap/load traffic and Auth token-refresh events for the same owner. No service-role or foreign-subject write appears in the inspected gateway entries. Later observed traffic is identity/bootstrap/load, not another recorded ff_commit. Token refresh establishes session activity, not proof of who physically operated the browser.

The deployed `commit_workspace` implementation increments revision once, upserts the owner's workflows and preferences, and updates onboarding in one transaction. Thus the affected row grouping, timestamps, SDK and owner are consistent with ordinary editor/autosave activity. Unchanged preferences/simulations/imports are also compatible with workflow-only edits.

**Four recorded commits do not explain seven revision increments.** Gateway logs are not a complete DML audit. The inspected PostgreSQL log entries do not contain a complete write history; aggregate table counters cannot identify actors or dates. Auth's database audit-log table returned no rows for the window, while unified Auth logs contained refresh/revocation events. Do not infer missing writes, deleted audits, malicious access, or absence of privileged activity from those gaps.

## Baseline limits and next operator actions

Retained evidence searches found the accepted table hashes in PHASE2B_READINESS.md but no previous row snapshots, per-row workflow fingerprints, revision history, or old workflow JSON in the repository evidence. A table hash cannot reconstruct the old graph/config/name/positions or reveal a field-level diff. Do not manufacture that comparison.

1. Preserve the original readiness baseline and these observations separately. Do not reset revision to 4, overwrite documents, replay a save, or restore data to make hashes match.
2. The owner reviews the current workflow privately and correlates browser/session activity around 13:43 UTC (19:13 IST). Check any retained authorized application/access logs for the additional three revision changes. Do not share credentials, token-bearing URLs or payloads in chat.
3. If an independently retained prior export/backup exists, separately authorize a secure read-only field diff against it; do not acquire/restore hosted data under this task. Exclude secrets from reports.
4. Identify the expected edits and unexplained increments, or explicitly open an incident investigation. If session use is unrecognized, request separately approved containment/credential actions; do not rotate, revoke or terminate automatically.
5. Only after the differences are explained and reviewed may the operator explicitly accept a new baseline. That is not implied by consistency with application saves, local passing tests, or migration approval. Repeat a quiet-window snapshot and full preflight afterward.

**Unresolved hosted-data discrepancy: deployment/migration blocker.** All further database operations in this task remain read only.
