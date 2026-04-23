-- =========================
-- Proposal Signature System - Database Schema
-- =========================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- =========================
-- Sequences
-- =========================
-- מספור שורות בטבלה: 10,20,30...
create sequence if not exists row_number_seq
  start with 10
  increment by 10
  minvalue 10;

-- מספר הזמנה פנימי (רציף רגיל)
create sequence if not exists order_number_seq
  start with 1000
  increment by 1
  minvalue 1;

-- =========================
-- Helpers: updated_at trigger
-- =========================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================
-- Customers
-- =========================
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  full_name text not null,
  doc_number text,
  phone text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_owner on customers(owner_id);
create index if not exists idx_customers_phone on customers(phone);
create index if not exists idx_customers_email on customers(email);

create trigger trg_customers_updated
before update on customers
for each row execute function set_updated_at();

-- =========================
-- Proposals
-- =========================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'proposal_status') then
    create type proposal_status as enum ('draft','sent','signed','void');
  end if;
end $$;

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  customer_id uuid not null references customers(id) on delete restrict,
  proposal_date date not null default current_date,
  row_number bigint not null default nextval('row_number_seq'),
  order_number bigint not null default nextval('order_number_seq'),
  currency text not null default 'ILS',
  vat_rate numeric(6,4) not null default 0.1700,
  subtotal numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  terms_text text,
  status proposal_status not null default 'draft',
  client_token text unique,
  client_token_expires_at timestamptz,
  contract_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_proposals_owner_row unique (owner_id, row_number),
  constraint uq_proposals_owner_order unique (owner_id, order_number)
);

create index if not exists idx_proposals_owner on proposals(owner_id);
create index if not exists idx_proposals_status on proposals(status);
create index if not exists idx_proposals_customer on proposals(customer_id);
create index if not exists idx_proposals_client_token on proposals(client_token);

create trigger trg_proposals_updated
before update on proposals
for each row execute function set_updated_at();

-- =========================
-- Proposal Blocks
-- =========================
create table if not exists proposal_blocks (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  sort_order int not null default 1,
  title text not null,
  unit_price numeric(12,2) not null default 0,
  quantity int not null default 1 check (quantity >= 0),
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blocks_proposal on proposal_blocks(proposal_id);
create index if not exists idx_blocks_sort on proposal_blocks(proposal_id, sort_order);

create trigger trg_blocks_updated
before update on proposal_blocks
for each row execute function set_updated_at();

-- =========================
-- Block Text Items
-- =========================
create table if not exists block_text_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references proposal_blocks(id) on delete cascade,
  sort_order int not null default 1,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_block_text_block on block_text_items(block_id);
create index if not exists idx_block_text_sort on block_text_items(block_id, sort_order);

create trigger trg_block_text_updated
before update on block_text_items
for each row execute function set_updated_at();

-- =========================
-- Signatures
-- =========================
create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references proposals(id) on delete cascade,
  signed_at timestamptz,
  signer_ip inet,
  signer_user_agent text,
  signature_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_signatures_updated
before update on signatures
for each row execute function set_updated_at();

-- =========================
-- Documents (PDF urls)
-- =========================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'document_kind') then
    create type document_kind as enum ('unsigned_pdf','signed_pdf');
  end if;
end $$;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  kind document_kind not null,
  storage_bucket text not null default 'proposal-pdfs',
  storage_path text not null,
  public_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_documents_proposal_kind unique (proposal_id, kind)
);

create index if not exists idx_docs_proposal on documents(proposal_id);

create trigger trg_documents_updated
before update on documents
for each row execute function set_updated_at();

-- =========================
-- Send Logs
-- =========================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'send_channel') then
    create type send_channel as enum ('whatsapp','sms','email');
  end if;
end $$;

create table if not exists send_logs (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  channel send_channel not null,
  destination text not null,
  sent_at timestamptz not null default now(),
  meta jsonb
);

create index if not exists idx_sendlogs_proposal on send_logs(proposal_id);

-- =========================
-- Helper Function
-- =========================
create or replace function recalc_proposal_totals(p_proposal_id uuid)
returns void as $$
declare
  v_subtotal numeric(12,2);
  v_vat_rate numeric(6,4);
begin
  select coalesce(sum(line_total),0)
    into v_subtotal
  from proposal_blocks
  where proposal_id = p_proposal_id;

  select vat_rate into v_vat_rate from proposals where id = p_proposal_id;

  update proposals
  set subtotal = v_subtotal,
      vat_amount = round(v_subtotal * v_vat_rate, 2),
      total = round(v_subtotal + (v_subtotal * v_vat_rate), 2)
  where id = p_proposal_id;
end;
$$ language plpgsql;

-- =========================
-- RLS Policies
-- =========================
alter table customers enable row level security;
alter table proposals enable row level security;
alter table proposal_blocks enable row level security;
alter table block_text_items enable row level security;
alter table signatures enable row level security;
alter table documents enable row level security;
alter table send_logs enable row level security;

create policy "customers_owner_all" on customers
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "proposals_owner_all" on proposals
for all
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "blocks_owner_all" on proposal_blocks
for all
using (
  exists (select 1 from proposals p where p.id = proposal_blocks.proposal_id and p.owner_id = auth.uid())
)
with check (
  exists (select 1 from proposals p where p.id = proposal_blocks.proposal_id and p.owner_id = auth.uid())
);

create policy "block_text_owner_all" on block_text_items
for all
using (
  exists (
    select 1
    from proposal_blocks b
    join proposals p on p.id = b.proposal_id
    where b.id = block_text_items.block_id and p.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from proposal_blocks b
    join proposals p on p.id = b.proposal_id
    where b.id = block_text_items.block_id and p.owner_id = auth.uid()
  )
);

create policy "signatures_owner_all" on signatures
for all
using (
  exists (select 1 from proposals p where p.id = signatures.proposal_id and p.owner_id = auth.uid())
)
with check (
  exists (select 1 from proposals p where p.id = signatures.proposal_id and p.owner_id = auth.uid())
);

create policy "documents_owner_all" on documents
for all
using (
  exists (select 1 from proposals p where p.id = documents.proposal_id and p.owner_id = auth.uid())
)
with check (
  exists (select 1 from proposals p where p.id = documents.proposal_id and p.owner_id = auth.uid())
);

create policy "sendlogs_owner_all" on send_logs
for all
using (
  exists (select 1 from proposals p where p.id = send_logs.proposal_id and p.owner_id = auth.uid())
)
with check (
  exists (select 1 from proposals p where p.id = send_logs.proposal_id and p.owner_id = auth.uid())
);

-- =========================
-- Error Logs (Admin Only)
-- =========================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'error_severity') then
    create type error_severity as enum ('info','warning','error','critical');
  end if;
end $$;

create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  severity error_severity not null default 'error',
  source text not null,
  message text not null,
  stack_trace text,
  user_agent text,
  url text,
  user_id uuid,
  user_email text,
  ip_address text,
  meta jsonb,
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_errorlogs_severity on error_logs(severity);
create index if not exists idx_errorlogs_created on error_logs(created_at desc);
create index if not exists idx_errorlogs_resolved on error_logs(resolved);
create index if not exists idx_errorlogs_source on error_logs(source);

-- Admin settings for logs password
create table if not exists admin_settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_admin_settings_updated
before update on admin_settings
for each row execute function set_updated_at();

-- Insert default logs password (hashed: AdminLogs2024!)
insert into admin_settings (key, value)
values ('logs_password_hash', '$2b$10$rqT1PqKvEy.WxXvZxvl0kuQ0nZpXYJBqLq4Zs8')
on conflict (key) do nothing;

-- =========================
-- Storage Bucket (run in Supabase Dashboard)
-- =========================
-- insert into storage.buckets (id, name, public) values ('proposal-pdfs', 'proposal-pdfs', false);
