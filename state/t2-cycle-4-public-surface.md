# T2 Cycle 4 — Public Institutional and Compliance Surface

## Date
2026-04-13

## Scope delivered in this cycle
1. Institutional public pages were added so an external visitor can understand who the service is for and how it works.
2. Public compliance pages were added for privacy and terms.
3. The homepage now links into the institutional and compliance pages.
4. The intake flow now exposes privacy and terms links in nearby copy and in the consent text.
5. The existing CTA -> intake -> submit -> cockpit flow and DB-backed persistence were preserved.

## Routes added or completed
- `/para-quem-e`
- `/como-funciona`
- `/privacidade`
- `/termos`

## Notes on canonical placeholders
The compliance canon still leaves some publication fields unresolved, including public CVM identification details, public privacy contact, professional address, and forum/city reference. These were surfaced explicitly as pending publication details instead of being invented.

## Verification path (exact)
1. Start app:
```bash
npm run dev
```
2. Open `http://localhost:3000/`.
3. Verify visible links to:
   - `/para-quem-e`
   - `/como-funciona`
   - `/privacidade`
   - `/termos`
4. Open `http://localhost:3000/intake`.
5. Verify privacy and terms links are visible above the form and inside the consent text.
6. Submit a valid intake and confirm the existing success flow still works.
7. Open `http://localhost:3000/cockpit/leads` and confirm the lead remains visible.

## Notes
- No CRM, billing, portal, auth or ornamental redesign scope was added.
- No legal facts absent from canon were invented.
- T2 remains active and is not closed in this cycle.
