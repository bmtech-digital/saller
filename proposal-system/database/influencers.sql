-- =========================
-- Influencers Table
-- =========================
-- Per-customer collection of influencers the admin manages manually.
-- Each row = one influencer (a person we paid or owe).
-- Tracks an optional receipt file (stored in the `influencer-receipts` bucket)
-- and a paid/unpaid flag with auto-stamped paid_at.

create table if not exists influencers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  customer_id uuid not null references customers(id) on delete cascade,
  full_name text not null,
  phone text,
  instagram_handle text,
  payment_amount numeric(12,2) not null default 0,
  paid boolean not null default false,
  paid_at timestamptz,
  receipt_storage_path text,
  receipt_mime_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_influencers_customer on influencers(customer_id);
create index if not exists idx_influencers_owner on influencers(owner_id);

-- Reuse the global set_updated_at() trigger function from schema.sql
create trigger influencers_updated_at
  before update on influencers
  for each row execute function set_updated_at();

-- RLS — shared-admin model (matches campaigns / rls-shared-access.sql)
alter table influencers enable row level security;

create policy "authenticated_all" on influencers
  for all to authenticated using (true) with check (true);

-- =========================
-- Storage bucket for receipts
-- =========================
-- Private bucket, accessed via signed URLs from the backend.
insert into storage.buckets (id, name, public)
values ('influencer-receipts', 'influencer-receipts', false)
on conflict (id) do nothing;
