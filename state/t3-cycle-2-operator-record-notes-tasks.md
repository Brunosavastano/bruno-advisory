# T3 Cycle 2 — Notes and Tasks on Lead Detail

## Status
Implemented locally on 2026-04-14 (Europe/Berlin).

## What changed
- Extended SQLite-backed storage with DB-backed operator record entities linked by `lead_id`:
  - `lead_internal_notes` (content, author_marker, created_at)
  - `lead_internal_tasks` (title, status, due_date optional, created_at)
- Added app mutation routes:
  - `POST /api/cockpit/leads/[leadId]/notes`
  - `POST /api/cockpit/leads/[leadId]/tasks`
- Updated lead detail screen (`/cockpit/leads/[leadId]`) to:
  - render existing notes and tasks
  - provide create-note and create-task forms tied to each lead
- Preserved existing T2 intake funnel and T3 cycle 1 commercial stage/audit behavior.

## Local verification commands
1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:t3:cycle2`
4. `npm run verify:t3:cycle2:local` (fallback when environment blocks socket bind)

## Evidence folder
- `state/evidence/T3-cycle-2/`

## What remains for cycle 3
- add lightweight task lifecycle progression and assignment conventions if needed
- decide minimal bridge from operator record maturity to billing-trigger preconditions
