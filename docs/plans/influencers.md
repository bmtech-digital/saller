# Influencers — design note

> Aligned 2026-04-26. Build target: ship to bemtech-478413 prod after manual verification.

## What

Each customer (an Aiweon client) gets a structured list of **influencers** they hired. The admin manages each influencer manually: name, contact info, agreed payment, optional receipt PDF/image, and a paid/unpaid flag. There's a one-click export of all receipts for a given customer as a ZIP.

This is **separate from `campaigns`**. The existing `campaigns` table stays. Campaigns describe a marketing initiative (campaign-level invoice, bank details, cost). Influencers are people (per-influencer receipts and payment tracking). They will likely be linked later, but for v1 they live independently.

## Schema (`database/influencers.sql`)

```sql
create table influencers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,                              -- creator; not used for visibility (shared admin model)
  customer_id uuid not null references customers(id) on delete cascade,
  full_name text not null,
  phone text,
  instagram_handle text,
  payment_amount numeric(12,2) not null default 0,
  paid boolean not null default false,
  paid_at timestamptz,                                 -- auto-stamped when `paid` flips true
  receipt_storage_path text,                           -- path inside the influencer-receipts bucket
  receipt_mime_type text,                              -- so download can set Content-Type correctly
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- Indexes on `customer_id` and `owner_id`.
- `set_updated_at()` trigger reused (already defined in `schema.sql`).
- RLS: `for all to authenticated using (true) with check (true)` (matches `campaigns` / shared-admin model in `rls-shared-access.sql`).

**Storage bucket**: `influencer-receipts`, private (signed URLs only). Path layout: `<customer_id>/<influencer_id>/<original-filename>`. Created manually in the Supabase dashboard or via SQL `insert into storage.buckets`.

## Backend API

All endpoints under `/api/influencers` and `/api/customers/:customerId/influencers`. Auth required (`authMiddleware`).

| Method | Path | Purpose |
|---|---|---|
| GET    | `/customers/:customerId/influencers` | List for a customer |
| POST   | `/customers/:customerId/influencers` | Create |
| PATCH  | `/influencers/:id`                   | Update fields (name/phone/handle/amount/notes) |
| DELETE | `/influencers/:id`                   | Delete (also deletes receipt from storage) |
| PATCH  | `/influencers/:id/paid`              | Toggle paid (auto-sets `paid_at`) |
| POST   | `/influencers/:id/receipt`           | Upload receipt (multipart, 1 file, ≤10 MB) |
| GET    | `/influencers/:id/receipt`           | Returns a signed URL to view the receipt |
| DELETE | `/influencers/:id/receipt`           | Remove receipt from storage + clear path |
| GET    | `/customers/:customerId/influencers/receipts.zip` | Stream a ZIP of all receipts for the customer |

The ZIP endpoint returns `application/zip` with filename `receipts__<customer_id>__<YYYYMMDD>.zip`. Inside, each file is named `<full_name>__<paid|unpaid>__<original>.<ext>` (sanitized). Influencers without a receipt are skipped — no placeholder file. Empty result returns 404 `אין קבלות לייצוא`.

ZIP is built with `archiver` (added as a backend dep — already pulled in by other transitive deps but adding explicitly).

## Frontend

A new button **"משפיענים"** is added per-customer-row next to the existing "העלאת פרטים" button. Clicking opens a full-screen-ish modal with:

- Header: customer name + count + **"ייצא את כל הקבלות"** button (disabled if zero receipts).
- Add-row form (inline at top of table): name (required), phone, Instagram, amount.
- Table rows with per-row controls: edit, delete, paid toggle (red/green dot — same UX as campaigns), upload receipt (file picker), view receipt (eye icon — opens signed URL in new tab), remove receipt.

Mobile: stacked card list, same fields and actions.

Implementation: new component `InfluencersModal.tsx` under `frontend/src/components/`. Uses `api.*` methods added to `services/api.ts`. Types added to `frontend/src/types/`.

## What we're not doing

- No global influencer registry / cross-customer reuse (per alignment #1).
- No campaign linkage (per #2). The new table doesn't reference `campaigns`.
- No payment-method tracking (per #5). `paid` is boolean only, plus `paid_at`.
- No bulk import / CSV — manual entry only for now.
- No automatic invoice generation. The receipt is always uploaded by the admin.
- The ZIP is a flat archive of files, no per-customer summary CSV included (keep it minimal — can add later).
