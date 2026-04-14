# T2 Cycle 2 — Intake Path Implemented (Local)

## Date
2026-04-13

## Scope delivered in this cycle
1. One real CTA path from public landing to intake (`/` -> `/go/intake` -> `/intake`).
2. Real intake form with canonical public fields from `packages/core/src/intake-contract.ts`.
3. Server-side validation using canonical contract helper.
4. Durable lead persistence in local project state (`data/dev/intake-leads.jsonl`).
5. Minimal internal cockpit list with canonical columns (`/cockpit/leads`).
6. Canonical intake events recorded to durable local event log (`data/dev/intake-events.jsonl`).

## Verification path (exact)
1. Start app:
```bash
npm run dev
```
2. Open `http://localhost:3000/`.
3. Click `Iniciar triagem` (routes through `/go/intake` and logs CTA event).
4. Submit valid data in `/intake`.
5. Confirm success state with generated lead ID.
6. Open `http://localhost:3000/cockpit/leads` and verify the new row appears with canonical cockpit columns.
7. Inspect durable files:
```bash
tail -n 5 data/dev/intake-leads.jsonl
tail -n 20 data/dev/intake-events.jsonl
```
8. Validate failure path by submitting invalid payload (e.g., empty consent or invalid email) and confirm server validation errors in UI.

## What remains for cycle 3
- Replace file-backed durable storage with DB-backed persistence if approved by Zeus.
- Add minimal institutional pages required in T2 scope (outside this narrow cycle).
- Harden analytics transport and add basic funnel reporting view if needed.
- Add automated integration test for intake happy/failure paths.

## Notes
- No VLH dependency was introduced.
- No CRM/billing/client portal scope was added.
- T2 is still active and not declared closed in this cycle.
