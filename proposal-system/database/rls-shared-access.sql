-- Switch from owner-scoped RLS to a shared-admin model.
-- Every authenticated user is implicitly an admin and has full access
-- to every row in every business table. owner_id is retained as
-- "who created this row" but no longer restricts visibility.
--
-- Idempotent: drops existing policies if present, then creates new ones.
-- error_logs / admin_settings are unaffected (RLS not enabled on them).

begin;

-- Drop the per-owner policies created by schema.sql
drop policy if exists "customers_owner_all"     on customers;
drop policy if exists "proposals_owner_all"     on proposals;
drop policy if exists "blocks_owner_all"        on proposal_blocks;
drop policy if exists "block_text_owner_all"    on block_text_items;
drop policy if exists "signatures_owner_all"    on signatures;
drop policy if exists "documents_owner_all"     on documents;
drop policy if exists "sendlogs_owner_all"      on send_logs;

-- Drop the per-owner policies created by campaigns.sql
drop policy if exists "Users can view own campaigns"   on campaigns;
drop policy if exists "Users can create own campaigns" on campaigns;
drop policy if exists "Users can update own campaigns" on campaigns;
drop policy if exists "Users can delete own campaigns" on campaigns;

-- Drop new policies if a previous run of this script created them
drop policy if exists "authenticated_all" on customers;
drop policy if exists "authenticated_all" on proposals;
drop policy if exists "authenticated_all" on proposal_blocks;
drop policy if exists "authenticated_all" on block_text_items;
drop policy if exists "authenticated_all" on signatures;
drop policy if exists "authenticated_all" on documents;
drop policy if exists "authenticated_all" on send_logs;
drop policy if exists "authenticated_all" on campaigns;

-- Any authenticated user can SELECT/INSERT/UPDATE/DELETE every row
create policy "authenticated_all" on customers         for all to authenticated using (true) with check (true);
create policy "authenticated_all" on proposals         for all to authenticated using (true) with check (true);
create policy "authenticated_all" on proposal_blocks   for all to authenticated using (true) with check (true);
create policy "authenticated_all" on block_text_items  for all to authenticated using (true) with check (true);
create policy "authenticated_all" on signatures        for all to authenticated using (true) with check (true);
create policy "authenticated_all" on documents         for all to authenticated using (true) with check (true);
create policy "authenticated_all" on send_logs         for all to authenticated using (true) with check (true);
create policy "authenticated_all" on campaigns         for all to authenticated using (true) with check (true);

commit;
