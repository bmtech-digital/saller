-- =========================
-- Campaigns Table
-- =========================
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  customer_id uuid not null references customers(id) on delete cascade,
  campaign_name text not null,
  influencers text not null default '',
  invoice_url text,
  bank_details text default '',
  cost numeric(12,2) not null default 0,
  is_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaigns_owner on campaigns(owner_id);
create index if not exists idx_campaigns_customer on campaigns(customer_id);

-- Updated at trigger
create trigger campaigns_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

-- RLS
alter table campaigns enable row level security;

create policy "Users can view own campaigns"
  on campaigns for select
  using (owner_id = auth.uid());

create policy "Users can create own campaigns"
  on campaigns for insert
  with check (owner_id = auth.uid());

create policy "Users can update own campaigns"
  on campaigns for update
  using (owner_id = auth.uid());

create policy "Users can delete own campaigns"
  on campaigns for delete
  using (owner_id = auth.uid());
