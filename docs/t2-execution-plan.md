# T2 Execution Plan

## Status
T2 is open. This document is the canonical execution order for the active tranche.

## Objective
Put the public acquisition surface live and make intake work end to end.

T2 only counts as done if:
1. a visitor understands the offer
2. a visitor can submit their data
3. the submission is validated and persisted in the project DB
4. Bruno can see the lead in the internal cockpit
5. basic analytics show the funnel is alive
6. the full path is proven by evidence

## Scope

### In scope
- homepage
- essential institutional pages
- compliance pages already defined in T1
- one primary CTA
- fit/intake form
- server-side validation
- DB persistence for leads
- internal leads cockpit
- basic analytics events
- end-to-end verification proof

### Out of scope
- full CRM
- billing
- client portal
- recommendation ledger implementation
- ornamental design work
- broad automation beyond minimum analytics and intake

## Execution order

### Step 1 — Lock the intake contract
Define the operational contract before UI polish.

Deliverables:
- lead schema
- required and optional fields
- canonical lead statuses
- internal list columns
- event names for analytics

Minimum evidence:
- typed schema or DB schema committed
- one short canonical doc or code source naming the intake contract

Exit condition:
- Vulcanus can implement form, DB and cockpit against one fixed contract

---

### Step 2 — Build the public page skeleton
Implement the public acquisition surface from T1 copy.

Deliverables:
- homepage
- essential institutional pages
- compliance links wired in navigation/footer
- primary CTA leading into intake

Minimum evidence:
- working routes in the app
- visual proof or local render proof

Exit condition:
- an external visitor can understand what Bruno Advisory is and where to act

---

### Step 3 — Implement the real intake form
Build the fit/contact flow as a real working path.

Deliverables:
- form UI
- server action or API route
- field validation
- success state
- failure state

Minimum evidence:
- successful local submission
- failure case proof for invalid data

Exit condition:
- the form no longer acts as a placeholder

---

### Step 4 — Persist leads in the project DB
Connect submission to durable project storage.

Deliverables:
- DB table or equivalent storage model for leads
- insert path from form submission
- timestamps and source tracking
- status default on creation

Minimum evidence:
- stored record visible via query, log, or internal read path

Exit condition:
- a submitted lead exists durably in project state

---

### Step 5 — Build the internal leads cockpit
Give Bruno basic operator visibility.

Deliverables:
- internal page listing leads
- lead detail view or expandable record view
- visible fields: name, contact, source, created_at, status, fit summary if available

Minimum evidence:
- a submitted lead appears internally without manual file inspection

Exit condition:
- Bruno can confirm intake is alive from inside the app

---

### Step 6 — Add basic analytics
Avoid a blind public funnel.

Deliverables:
- page view event
- CTA click event
- form start event
- submit success event
- submit failure event

Minimum evidence:
- event logs or analytics traces showing each event path works

Exit condition:
- T2 can answer whether the funnel is being used and where it fails

---

### Step 7 — Run end-to-end proof
Prove the whole chain, not isolated pieces.

Deliverables:
- one clean end-to-end test run
- one invalid/failed submission proof
- evidence pack for Zeus review

Minimum evidence:
- submit from public page
- DB persistence confirmed
- internal cockpit visibility confirmed
- analytics events confirmed
- state updated truthfully

Exit condition:
- Zeus can audit a real working funnel, not a stitched demo

## Acceptance criteria
T2 closes only if all are true:
- public site is understandable
- intake form is real
- submission persists
- internal visibility exists
- analytics are not blind
- end-to-end evidence exists

## Failure conditions
T2 fails if any of these happen:
- pretty site but fake intake
- form submits but does not persist
- DB persists but Bruno cannot see the lead internally
- analytics absent or non-verifiable
- state claims more than the evidence proves

## Recommended implementation discipline
- functional funnel first
- minimal styling second
- one narrow happy path first, then failure handling
- keep the lead model small
- do not widen into CRM or billing
- do not open T3 work during T2

## Suggested evidence pack
- changed files list
- one screenshot or page render proof
- one successful submission log
- one DB proof
- one cockpit proof
- one analytics proof
- one short state update

## Canonical handoff to Vulcanus
Build T2 as a narrow, fully auditable intake tranche.
Prioritize a working acquisition funnel over visual sophistication.
No ornamental expansion, no fake placeholders, no silent scope drift.
