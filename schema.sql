create table if not exists public.pantry_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  foods jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pantry_snapshots enable row level security;

grant select, insert, update on public.pantry_snapshots to authenticated;

drop policy if exists "Users can read their pantry snapshot" on public.pantry_snapshots;
create policy "Users can read their pantry snapshot"
  on public.pantry_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their pantry snapshot" on public.pantry_snapshots;
create policy "Users can create their pantry snapshot"
  on public.pantry_snapshots
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their pantry snapshot" on public.pantry_snapshots;
create policy "Users can update their pantry snapshot"
  on public.pantry_snapshots
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
