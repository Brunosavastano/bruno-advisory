# T4 Cycle 3 — Document Upload

## What was built
- Added the canonical document upload model with statuses, allowed MIME types, max size, and storage path convention.
- Added `lead_documents` persistence in SQLite plus filesystem-backed storage under `data/dev/uploads/<leadId>/`.
- Added portal upload/list route at `/api/portal/documents` gated by `portal_session` via `getSession()`.
- Added portal documents page and dashboard link.
- Added cockpit document listing and review routes plus a documents section in the lead detail page.
- Added a local verifier that builds, uploads, lists, reviews, checks unauthorized access, and writes evidence JSON.

## Files
- `packages/core/src/document-upload-model.ts`
- `packages/core/src/index.ts`
- `apps/web/lib/storage/db.ts`
- `apps/web/lib/storage/documents.ts`
- `apps/web/lib/intake-storage.ts`
- `apps/web/app/api/portal/documents/route.ts`
- `apps/web/app/portal/documents/page.tsx`
- `apps/web/app/portal/dashboard/page.tsx`
- `apps/web/app/api/cockpit/leads/[leadId]/documents/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/documents/[documentId]/route.ts`
- `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- `infra/scripts/verify-t4-cycle-3-local.sh`
- `state/evidence/T4-cycle-3/summary-local.json`

## Verification target
- `bash infra/scripts/verify-t4-cycle-3-local.sh`

## Notes
- Files remain local only. No external storage or new dependency was introduced.
- Legacy `/api/portal/uploads` compatibility stays in place, but cycle 3 canon is `/api/portal/documents`.
