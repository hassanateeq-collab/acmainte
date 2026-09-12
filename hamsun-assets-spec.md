# Hamsun Assets — Asset & Maintenance Portal

Specification of the HTML prototype (`hamsun-assets-prototype.html`), written so it can be rebuilt as a real application (Lovable + Supabase) or handed to a developer.

Status: prototype, September 2026. First asset type is air conditioners; other types are added later. Room occupancy is mocked and will come from the PMS.

---

## 1. Purpose

Hamsun runs several hotel branches. Assets — starting with ACs — get moved between branches, sent to the repair company, and swapped part-for-part, and it has become hard to know where each one is, what has been done to it, and what it has cost. The portal is the single record of every asset: where it is, what it is connected to, when it needs service, what went wrong, and what was billed.

Design rule throughout: **simple enough that a branch manager or a technician understands it without training.** Every screen states in one line what it is for, and every action names what will happen.

---

## 2. Branches and people

| Code | Branch |
|---|---|
| FSL | Shahrah-e-Faisal |
| EXT | Extension |
| CLF | Clifton |
| DHA | DHA |

Repair company: **CoolTech Services** (services and repairs ACs).

---

## 3. Roles and access

| | Admin (head office) | Branch manager | Repair company |
|---|---|---|---|
| Sees assets of | all branches | own branch (can browse others to request) | all branches |
| Add asset | yes | own branch only | no |
| Request transfer | yes | yes (into own branch) | no |
| Accept / decline transfer | yes, any | only for assets the branch owns | no |
| Report an issue | yes | yes | no |
| Log service / repair with bill | yes | yes | yes |
| Add a charge to a job, or standalone charge | yes | no | yes |
| Edit or delete a bill entry (with reason, logged) | yes | no | yes |
| Change which interior/exterior are paired | yes | own branch only | no (view only) |
| "Pick up" a unit (notifies branch manager) | — | — | yes |
| See room occupancy | yes | yes | yes |
| Notifications | everything, all branches | own branch | CoolTech inbox |

Menus differ per role:

- **Admin / Branch manager:** Home · Assets · Transfers · Service & repairs · Bills · Notifications
- **Repair company:** Home · Service due · Issues & pickups · All ACs · Bills · Notifications

---

## 4. Asset identity

### 4.1 ID format

`<TYPE>-<BRANCH>-<PART>-<NNN>`

- `TYPE` — asset type code, e.g. `AC`
- `BRANCH` — branch the asset was **first registered** to
- `PART` — for ACs only: `I` = interior (indoor unit), `E` = exterior (outdoor unit / compressor). Other asset types have no part segment.
- `NNN` — three-digit sequence, counted **per type + branch + part**. `AC-FSL-I-001`, `AC-FSL-I-002`, `AC-FSL-E-001` …

Examples: `AC-FSL-I-001`, `AC-FSL-E-001`, `AC-EXT-E-004`.

When adding an AC the form asks which part it is, then shows the ID it will get before saving.

### 4.2 The ID never changes

If an asset moves to another branch, it keeps its ID (the physical sticker stays valid). The portal tracks **current branch** separately from **home branch** (the branch in the ID) and shows "originally from FSL" where they differ.

### 4.3 Asset record

Per asset:

- id, type, part (I/E or none)
- home branch, current branch, room (`store` = spare, not installed)
- installed date, expected life (years; default 10)
- last service date, service interval (days; default 90) → next service date is derived
- open issue (text, or none)
- at vendor (true while CoolTech has it)
- **pair** — the asset it is currently connected to (see §5)
- history of jobs (see §7), moves (see §6), pairing changes (see §5)

### 4.4 Status (derived, in this order)

1. **With CoolTech** — picked up, not yet returned
2. **Issue reported** — open issue
3. **Service due** — next service within 14 days (shows "Overdue Nd" if past)
4. **Healthy**

---

## 5. AC pairing (interior ↔ exterior)

Interior and exterior units are separate assets with separate IDs, but they work as a set. The portal records **which exterior is physically connected to which interior** as an explicit link — not by room, because in practice parts get swapped:

- `AC-EXT-I-002` may run on `AC-EXT-E-004`
- `AC-FSL-E-002` may end up connected to `AC-EXT-I-009`

Rules:

- The Assets list shows **one row per interior** with its paired exterior beside it. Exteriors paired to nothing appear as their own rows ("spare, not connected").
- A **Swapped** tag appears when the paired exterior is not the one the interior was originally installed with (different home branch or sequence number).
- **Change pairing** (Admin or owning branch manager): pick any opposite part from any branch, or "nothing — keep as spare", and give a reason. If the chosen part was paired to something else, that link is broken and logged too.
- Every change writes a "Pairing changed: X → Y, by whom, why" entry on **all** affected assets.
- Pairing across branches does not move the asset; a transfer (§6) should be raised separately so the move is recorded. (Open decision: merge these into one action.)

---

## 6. Transfers between branches

A branch manager who needs a part requests it from the branch that has it. Any part (I or E) can be requested on its own.

Request record: asset, from branch, to branch, reason, requested by, requested at, status (waiting / accepted / declined), decided at, decided by.

Flow:

1. Requester picks the part and gives a reason → status **Waiting**. Owning branch manager and Admin are notified.
2. Owning branch manager (or Admin) **accepts** or **declines**.
3. On accept: asset's current branch changes; a "Moved FROM → TO" entry with both names, dates and reason is added to the asset history; requester is notified.

Transfers screen shows "Waiting for a decision" and "Completed" separately. A badge on the menu shows how many are waiting for the signed-in user.

---

## 7. Service, repairs and bills

### 7.1 Job entry

Each visit by the repair company is a job on one asset:

- date, type (**Service** / **Repair** / **Charge**)
- problem
- what was done / part replaced
- bill amount
- additional charges (with an itemised list: label, amount, date)
- total = bill + additional
- days taken

Saving a service or repair job sets the asset's last-service date, clears the open issue, and marks it returned from the vendor.

### 7.2 Charges

- **Add to an existing job** — e.g. transport, gas top-up billed later. Added to that job's Additional column and listed under it.
- **Standalone charge** — e.g. visit or inspection fee with no service done. Shown as its own "Charge" line; does not change the service date.

### 7.3 Editing and deleting

Admin and repair company can edit any field of a job. A **reason is required**; the job keeps a change log ("bill Rs 2,500 → Rs 3,000, by CoolTech, why"), and the branch and Admin are notified. Delete asks for confirmation and is logged to Admin. Branch managers can see but not edit.

### 7.4 Issues

Admin or branch manager reports an issue on an asset with a description. CoolTech and Admin are notified; the asset shows "Issue reported" until a repair job is logged.

### 7.5 Pick up / return

CoolTech presses **Pick up** on a unit (from Service due, Issues & pickups, or the asset record). The branch manager and Admin are notified; the asset shows "With CoolTech". **Return & log bill** closes the loop with the job entry.

### 7.6 What the repair company sees

- **Service due** — units within 30 days of service, sorted soonest first, with room occupancy, repairs so far and last problem.
- **Issues & pickups** — reported issues, and units in their workshop.
- **All ACs** — full list, read-only for pairing/transfers.
- **Bills** — all their jobs, with totals; Add charge / Edit per row.

---

## 8. Notifications

Inboxes: one per branch, Admin, CoolTech. Admin sees everything. Bell in the top bar shows unread count; Home shows the latest six as "Recent activity".

Events that notify:

| Event | Notified |
|---|---|
| Transfer requested | owning branch, Admin |
| Transfer accepted / declined | requesting branch, Admin |
| Issue reported | CoolTech, Admin |
| Unit picked up | branch, Admin |
| Job logged / unit returned | branch, Admin |
| Charge added | branch, Admin |
| Bill edited / deleted | branch, Admin |
| Pairing changed | Admin |

---

## 9. Screens

**Home** (per role) — greeting; five clickable tiles (AC parts tracked, service due within 14 days, open issues, with CoolTech, transfers to decide / billed this year); "Needs attention" list in plain sentences with the action inline; recent activity.

**Assets** — branch tabs (Admin/CoolTech), status filter, text filter. One row per room: branch, room + occupancy, interior unit (ID + status), exterior unit (ID + status + Swapped tag), next service, life left, repairs, total spent. Click → asset record.

**Asset record** (side panel) — ID and location; alerts for open issue / with CoolTech; "This AC set" showing both paired units (click to switch); details grid (status, occupancy, last/next service, installed, life left, times repaired, total spent); full timeline (jobs with amounts, moves, pairing changes, installed); action bar with the actions the role is allowed.

**Transfers** — waiting / completed tables with Accept / Decline.

**Service & repairs / Service due** — due in 30 days / later, with Log service / Pick up / Serviced on site.

**Issues & pickups** (CoolTech) — reported issues / in workshop.

**Bills** — totals tiles; every job with bill, additional (itemised), total, days; Edit / Add charge.

**Notifications** — list, unread highlighted.

**Forms:** Add asset · Request transfer · Report an issue · Log service / repair · Add charge · Edit job · Change pairing.

---

## 10. Decisions made in the prototype

1. ID is permanent; branch in the ID = where it was first registered.
2. Interior/exterior pairing is an explicit link with its own history, not inferred from room.
3. Transfers require acceptance by the owning branch; nothing moves silently.
4. Money records are never silently changed: edits need a reason and keep a log; deletes are logged.
5. Repair company can bill and add charges but cannot move assets or change pairings.
6. Statuses are words with colours (Healthy / Service due / Issue reported / With CoolTech), never codes.

## 11. Still to decide / build later

- Room occupancy from the PMS (currently mock text).
- Whether a cross-branch pairing change should automatically create the transfer.
- Other asset types (no I/E segment in the ID).
- Bulk import of existing assets.
- WhatsApp/Slack delivery of notifications (portal-only in the prototype).
- Reports: spend per branch / per unit, repair frequency, units near end of life.
