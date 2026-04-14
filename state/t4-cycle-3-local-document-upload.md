# T4 Cycle 3, local document upload no portal

## Objective
Entregar upload local de documentos no portal do cliente, com armazenamento em disco por lead, metadata persistida em SQLite, isolamento por sessão e visibilidade no cockpit do lead correto.

## What changed
- Portal do cliente usa a trilha canônica de documentos para upload autenticado.
- Os arquivos são materializados localmente em `data/dev/uploads/<leadId>/`.
- A metadata fica persistida em DB por arquivo com os campos exigidos no aceite:
  - `filename` (persistido como `original_filename`)
  - `size` (persistido como `size_bytes`)
  - `mimeType` (`mime_type`)
  - `uploadedAt` (`uploaded_at`)
  - `status`
- O cliente autenticado lista apenas os próprios uploads via sessão do portal.
- Bruno vê os documentos no detalhe do lead no cockpit.
- Não houve storage externo, dependência nova ou acoplamento com VLH.

## Where
- `apps/web/app/api/portal/documents/route.ts`
- `apps/web/app/portal/documents/page.tsx`
- `apps/web/app/portal/dashboard/page.tsx`
- `apps/web/app/api/cockpit/leads/[leadId]/documents/route.ts`
- `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- `apps/web/lib/storage/documents.ts`
- `apps/web/lib/storage/db.ts`
- `infra/scripts/verify-t4-cycle-3-local.sh`

## Verify
```bash
npm run typecheck
rm -rf apps/web/.next && bash infra/scripts/verify-t4-cycle-3-local.sh
```

## Acceptance evidence
- Upload real validado por arquivo materializado em disco.
- Metadata auditável confirmada por consulta direta ao SQLite.
- Isolamento confirmado com dois leads e duas sessões, sem vazamento no portal.
- Visibilidade no cockpit confirmada na rota canônica do lead.
