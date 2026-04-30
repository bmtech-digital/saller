-- Add project_type to proposals + campaigns
-- Idempotent: safe to re-run

do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_type') then
    create type project_type as enum ('influencers','videos','agents');
  end if;
end $$;

alter table proposals
  add column if not exists project_type project_type not null default 'influencers';
create index if not exists idx_proposals_project_type on proposals(project_type);

alter table campaigns
  add column if not exists project_type project_type not null default 'influencers';
create index if not exists idx_campaigns_project_type on campaigns(project_type);
