-- Areas: an optional grouping level above projects (e.g. Work, Life).
-- Sidebar shows projects grouped under their area; area-less projects stay
-- in a flat "Projects" group. Deleting an area never deletes its projects.

create table public.areas (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1
);

create trigger areas_set_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

create index areas_user_id_idx on public.areas (user_id);
create index areas_updated_at_idx on public.areas (user_id, updated_at);

alter table public.projects
  add column area_id uuid references public.areas (id) on delete set null;

create index projects_area_id_idx on public.projects (area_id);

-- Same access model as every other table (see 20260710000002_rls.sql):
-- authenticated + service_role only, RLS scoping rows to their owner.
grant select, insert, update, delete on public.areas to authenticated, service_role;

alter table public.areas enable row level security;

create policy "areas_select_own" on public.areas
  for select using ((select auth.uid()) = user_id);
create policy "areas_insert_own" on public.areas
  for insert with check ((select auth.uid()) = user_id);
create policy "areas_update_own" on public.areas
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "areas_delete_own" on public.areas
  for delete using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.areas;
