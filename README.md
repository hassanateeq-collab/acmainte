# Hamsun Assets — Asset & Maintenance Portal

The single record of every asset (starting with air conditioners): where it is,
what it is connected to, when it needs service, what went wrong, and what it has
cost. Built with **Next.js (App Router) + TypeScript + Supabase** and designed to
be simple enough for a branch manager or technician to use without training.

Based on the specification in `hamsun-assets-spec.md`.

---

## What's inside

- **Roles** — Admin (head office), Branch manager, Repair company (CoolTech),
  each with its own menu and permissions.
- **Assets** — permanent IDs (`AC-FSL-I-001`), home vs current branch, rooms,
  interior/exterior pairing with a `Swapped` tag, derived status
  (Healthy / Service due / Issue reported / With CoolTech).
- **Transfers** — request → accept/decline; nothing moves without acceptance.
- **Service, repairs & bills** — jobs with bills, itemised additional charges,
  standalone charges, edit/delete with a required reason and a change log.
- **Issues & pickups** — report an issue, CoolTech picks up / returns & logs bill.
- **Notifications** — per-branch, Admin (sees everything) and CoolTech inboxes.
- **People** — Admin creates logins and assigns roles/branches.

---

## Setup (do this once)

### 1. Create the database tables

Open your Supabase project → **SQL Editor** → **New query**, paste the entire
contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
It is idempotent, so it is safe to run again.

### 2. Create your first login (becomes Admin automatically)

Supabase Dashboard → **Authentication → Users → Add user**. Enter an email and
password and tick **Auto Confirm User**. The **first** user created becomes the
**Admin**. From then on, add everyone else inside the portal under **People**.

### 3. Environment variables

Copy `.env.example` to `.env.local` for local dev, and set the same three
variables in Vercel (**Project → Settings → Environment Variables**):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | your **service-role** key (server-only) |

> The service-role key is only ever used server-side (in server actions). It is
> never sent to the browser. All browser data access is blocked by RLS; the app
> reads and writes through the server and enforces role permissions in code.

### 4. Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

### 5. Deploy to Vercel

Import this repository in Vercel, add the three environment variables above, and
deploy. Framework preset: **Next.js** (auto-detected). No extra config needed.

---

## How permissions work

| | Admin | Branch manager | Repair (CoolTech) |
|---|---|---|---|
| See assets | all branches | own branch + browse | all branches |
| Add asset | yes | own branch | no |
| Request transfer | yes | into own branch | no |
| Accept / decline | any | assets their branch owns | no |
| Report issue | yes | yes | no |
| Log service / repair | yes | yes | yes |
| Add charge (job or standalone) | yes | no | yes |
| Edit / delete bill (reason logged) | yes | no | yes |
| Change pairing | yes | own branch | view only |
| Pick up a unit | — | — | yes |

---

## Notes / still to do (from the spec)

- Room occupancy is mocked (`mockOccupancy`) until the PMS feed is connected.
- Other asset types (no I/E segment) are supported by the ID scheme already.
- WhatsApp/Slack delivery of notifications is portal-only for now.
