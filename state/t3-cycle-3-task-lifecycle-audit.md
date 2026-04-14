# T3 Cycle 3 — Task lifecycle and audit trail on lead detail

## Status
Implemented locally on 2026-04-14 (Europe/Berlin).

## What changed
- Extended SQLite-backed storage with a task lifecycle audit entity linked to lead and task:
  - `lead_internal_task_audit` (`from_status`, `to_status`, `changed_by`, `changed_at`)
- Added typed helpers in `apps/web/lib/intake-storage.ts`:
  - `updateLeadInternalTaskStatus(...)`
  - `listLeadInternalTaskAudit(...)`
- Added app mutation route:
  - `POST /api/cockpit/leads/[leadId]/tasks/[taskId]/status`
- Updated lead detail screen (`/cockpit/leads/[leadId]`) to:
  - mutate task status across canonical statuses (`todo`, `in_progress`, `done`)
  - render task status audit history per task on the operator surface
- Preserved T2 funnel behavior and T3 cycle 1/2 surfaces (commercial stage, notes, and task creation).

## Local verification commands
1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:t3:cycle3`
4. `npm run verify:t3:cycle3:local` (fallback when environment blocks socket bind)

## Evidence folder
- `state/evidence/T3-cycle-3/`

## What remains for cycle 4
- define the minimal billing entry condition using persisted operator task/commercial state as trigger inputs
