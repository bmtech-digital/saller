-- =========================
-- Campaigns Table
-- =========================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_type') then
    create type project_type as enum ('influencers','videos','agents');
  end if;
end $$;

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
  project_type project_type not null default 'influencers',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill column on existing deployments
alter table campaigns
  add column if not exists project_type project_type not null default 'influencers';

create index if not exists idx_campaigns_owner on campaigns(owner_id);
create index if not exists idx_campaigns_customer on campaigns(customer_id);
create index if not exists idx_campaigns_project_type on campaigns(project_type);

-- Updated at trigger
create trigger campaigns_updated_at
  before update on campaigns
  for each row execute function set_updated_at();

-- RLS
alter table campaigns enable row level security;

-- Shared-admin model: every authenticated user has full access to every row.
create policy "authenticated_all" on campaigns
  for all to authenticated using (true) with check (true);
