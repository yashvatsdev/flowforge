# FlowForge Phase 2A — Reconstructed approved execution architecture

Recorded: October 19, 2026 (Asia/Calcutta).

Status: **Prior architecture approval restored. GO for Phase 2B implementation.** Implementation has not started under this documentation task.

## Source and scope

This document reconstructs the architecture previously reviewed and approved in ChatGPT, using the decisions supplied by the user in the request titled “FLOWFORGE — RESTORE PHASE 2A ARCHITECTURE AND UNBLOCK PHASE 2B.” The original report/transcript is not present in the repository. This is not a verbatim recovery, a new architecture approval, or a fresh comprehensive repository or hosted-database audit.

The approved decisions and limits below come from that supplied summary. Repository compatibility observations and unresolved implementation details are explicitly separated from those decisions. No missing contracts, SQL definitions, or operational settings are asserted as previously approved.

## Confirmed prerequisite evidence

The latest “Approved migration-history reconciliation completed” entries in [PHASE1.md](PHASE1.md) and [PHASE2B.md](PHASE2B.md), together with the preceding reconciliation results in this session, establish the database prerequisite for project `kixwwrmedqazurvdnfhi`:

| Migration version | LOCAL | REMOTE |
| --- | --- | --- |
| 20261018215836 | Registered | Registered |
| 20261018225425 | Registered | Registered |

Both specifically approved CLI metadata repairs succeeded. CLI and MCP showed exactly those two versions. Application schema and permissions were unchanged, and row counts and full-row fingerprints matched before and after repair for all six application tables. The original migration SQL was not replayed.

This task confirms the recorded reconciliation evidence; it does not rerun hosted inspection or claim a new data-integrity test. Earlier blocker entries in the phase reports are historical and are superseded by their completion entries and this restored architecture.

## Approved architecture decisions

- PostgreSQL is the authoritative execution state machine. QStash is replaceable job-delivery infrastructure.
- Preserve Google OAuth, Supabase Auth, RLS, existing workflow persistence, and local simulation.
- Every real run uses an immutable workflow snapshot and captures the existing workspace revision. Do not introduce a separate workflow-revisions table in this increment.
- Add `public.ff_runs`, `public.ff_run_steps`, and `flowforge_private.ff_execution_outbox`.
- Support manual triggers, literal field transforms, and numeric conditions. Reject joins, cycles, malformed graphs, and unsupported handlers.
- Use branch-local immutable payloads.
- Add authenticated start, history, details, steps, and cancellation APIs. Require idempotency keys and expected workflow revisions.
- Enforce ownership and execution quotas in PostgreSQL.
- Use durable checkpoints, leases, fencing generations, and cancellation.
- Implement an outbox for reliable queue delivery.
- Use a local runner before introducing QStash.
- Keep HTTP requests, notifications, arbitrary code execution, and external side effects disabled for real execution in this increment.
- Preserve the existing frontend and its visual design.

“Expected workflow revision” refers to the approved existing workspace revision captured with the workflow snapshot. It does not imply a new per-workflow revision counter or revision table.

## Approved initial execution limits

| Limit | Value |
| --- | --- |
| Nodes per workflow | 100 |
| Edges per workflow | 500 |
| Workflow snapshot | 256 KiB |
| Manual input | 64 KiB |
| Per-node output | 64 KiB |
| Aggregate output | 1 MiB |
| Concurrent runs per workspace | 2 |
| Execution starts per workspace per minute | 10 |
| Execution deadline | 5 minutes |
| Maximum queue wait | 30 minutes |

KiB and MiB denote binary units (1,024 and 1,048,576 bytes respectively). Exact serialization/accounting and timing boundaries remain implementation details to specify below.

## Approved implementation order

1. Phase 2B: durable database and execution core.
2. Phase 2C: QStash delivery and recovery.
3. Phase 2D: frontend integration.
4. Phase 2E: security and staging acceptance.
5. Phase 3: production deployment.

Phase 2B includes the local runner and outbox foundation. Introducing QStash delivery belongs to Phase 2C. Restoring this document does not establish acceptance of any implementation or authorize deployment.

## Focused repository compatibility check

The following observations are from inspecting the existing phase reports, Phase 1 migrations, `src/lib/engine.ts`, `src/lib/workspace.ts`, `src/lib/persistence.ts`, `src/lib/server-auth.ts`, `src/lib/workspace-api.ts`, existing workflow API routes, and the database-test fixture. This is a scoped consistency check, not a fresh repository audit.

| Existing contract or behavior | Compatibility implication |
| --- | --- |
| Workspaces use UUIDs; workflows use text IDs scoped by `(workspace_id, id)`; `ff_workspaces.revision` is a workspace-wide bigint. | Preserve these identifiers and use the existing revision for snapshot concurrency checks. Workflow `updatedAt` is not a separate revision mechanism. |
| Workspace saves replace the aggregate workflow/preferences/simulation state and increment the workspace revision. | Keep real execution state in the new run/step/outbox objects, outside the existing aggregate simulation-save contract. Define snapshot capture against concurrent saves in Phase 2B. |
| Existing auth helpers verify Google/OAuth identity, check Origin for mutations, and return private/no-store API responses. Phase 1 uses RLS and narrow private write helpers. | Retain the existing authentication and ownership boundaries. Execution APIs and runner capabilities need their own explicit PostgreSQL authorization design. |
| The editor/simulator accepts trigger, transform, condition, HTTP, and notification kinds. The trigger is presented as a sample Webhook. | Real execution must enforce the approved manual-only subset and reject unsupported handlers. This does not authorize real webhooks or changing existing simulation labels/behavior. |
| The simulator uses a shared mutable traversal payload; graph validation permits joins and persisted disconnected drafts. | Branch-local immutable execution and join rejection require a distinct real-execution path. The simulator cannot be reused unchanged as the durable runner. Preserve valid editor drafts and local simulation. |
| Current persistence permits 1,000 nodes, 5,000 edges, and a 5,000,000-byte aggregate document. | The approved smaller limits apply at real-run admission and execution. Do not reduce existing persistence/recovery limits as an incidental change. |
| Existing `Execution`/`Step` types describe simulated history with a smaller status set. | Define durable-run API/storage contracts without silently reclassifying simulations or changing existing frontend consumers. Frontend integration is Phase 2D. |
| Existing database tests execute sorted migration files in isolated PGlite with fixture auth claims. | This is a useful existing verification mechanism; no new execution tests or acceptance results are claimed here. |

The previous hosted audit also recorded that `service_role` lacks SELECT/INSERT/UPDATE/DELETE on the six Phase 1 tables. The local runner must not assume that role already has the required access. This is an implementation authorization boundary to design, not permission to broaden existing grants.

No blocking contradiction was found between the supplied approved architecture and these inspected contracts. Differences between simulation and real execution are expected boundaries, not reasons to rewrite the existing simulator or frontend.

## Decisions not recovered by the supplied approval

These details are not specified by the reconstructed summary and must be made concrete and tested during Phase 2B before the affected contracts are finalized. They are not represented as prior approvals:

- Exact table columns, SQL/RPC signatures, API routes, request/response schemas, pagination, error codes, and run/step state-transition matrix.
- Idempotency-key scope, expiry, request fingerprint, and behavior when a key is reused with different input or a now-stale expected revision; transaction ordering for ownership, revision checks, snapshot capture, quotas, and outbox insertion.
- Manual-input JSON shape, literal-transform field semantics, numeric-condition coercion/error behavior, reachable-graph requirements, fan-out ordering, and skipped-branch step representation. Existing simulator behavior is context, not an automatically approved real-run contract.
- Lease duration and renewal, generation advancement, checkpoint granularity, stale-worker fencing, cancellation races, terminal-state handling, retry/attempt budgets, and local-runner credential/capability boundary.
- When the five-minute deadline and thirty-minute queue-wait clocks begin, which states occupy concurrency slots, minute-window semantics, and treatment of retried/idempotent starts. Output/snapshot serialization, byte accounting, and aggregate-output accounting also need precise definitions.
- Outbox claim/acknowledgement and retry semantics in the local-runner foundation; QStash-specific transport, redelivery, and recovery settings are Phase 2C work.
- Real-run retention/deletion behavior, workflow deletion versus retained snapshots, and diagnostics/redaction. Do not inherit simulation retention or cascade behavior without an explicit contract.

These are bounded implementation decisions within the approved architecture, not missing approval of its central design. A choice that changes the approved scope or limits must be surfaced rather than silently attributed to this reconstruction.

## Phase 2B decision

**GO for Phase 2B implementation.** The recorded database prerequisite is satisfied and the previously missing approved architecture is now restored. There is no remaining blocker solely from the missing Phase 2A document.

This GO permits the next implementation phase to proceed when requested. It does not claim execution correctness, staging acceptance, queue readiness, completed Phase 1 provider configuration, or production readiness. Existing Phase 1 operational caveats remain recorded in PHASE1.md for their applicable acceptance stages.

Only documentation was changed for this restoration. No execution table, API, migration, dependency, or runner was created; no hosted change, commit, push, or deployment was performed.
