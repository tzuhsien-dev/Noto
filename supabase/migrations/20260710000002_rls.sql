-- Row Level Security: the only data-access boundary in Noto.
-- Every table gets four policies, each requiring auth.uid() = user_id.
-- The anon role never matches auth.uid() and therefore has no access.

-- Supabase no longer grants DML on new tables to API roles by default.
-- Grant it to authenticated (RLS still filters rows) and service_role
-- (dashboard/admin tooling); anon deliberately gets nothing at all.
grant select, insert, update, delete
  on public.projects, public.tasks, public.notes, public.checklist_items,
     public.tags, public.task_tags, public.note_tags
  to authenticated, service_role;

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.checklist_items enable row level security;
alter table public.tags enable row level security;
alter table public.task_tags enable row level security;
alter table public.note_tags enable row level security;

-- projects
create policy "projects_select_own" on public.projects
  for select using ((select auth.uid()) = user_id);
create policy "projects_insert_own" on public.projects
  for insert with check ((select auth.uid()) = user_id);
create policy "projects_update_own" on public.projects
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "projects_delete_own" on public.projects
  for delete using ((select auth.uid()) = user_id);

-- tasks
create policy "tasks_select_own" on public.tasks
  for select using ((select auth.uid()) = user_id);
create policy "tasks_insert_own" on public.tasks
  for insert with check ((select auth.uid()) = user_id);
create policy "tasks_update_own" on public.tasks
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "tasks_delete_own" on public.tasks
  for delete using ((select auth.uid()) = user_id);

-- notes
create policy "notes_select_own" on public.notes
  for select using ((select auth.uid()) = user_id);
create policy "notes_insert_own" on public.notes
  for insert with check ((select auth.uid()) = user_id);
create policy "notes_update_own" on public.notes
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "notes_delete_own" on public.notes
  for delete using ((select auth.uid()) = user_id);

-- checklist_items
create policy "checklist_items_select_own" on public.checklist_items
  for select using ((select auth.uid()) = user_id);
create policy "checklist_items_insert_own" on public.checklist_items
  for insert with check ((select auth.uid()) = user_id);
create policy "checklist_items_update_own" on public.checklist_items
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "checklist_items_delete_own" on public.checklist_items
  for delete using ((select auth.uid()) = user_id);

-- tags
create policy "tags_select_own" on public.tags
  for select using ((select auth.uid()) = user_id);
create policy "tags_insert_own" on public.tags
  for insert with check ((select auth.uid()) = user_id);
create policy "tags_update_own" on public.tags
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "tags_delete_own" on public.tags
  for delete using ((select auth.uid()) = user_id);

-- task_tags
create policy "task_tags_select_own" on public.task_tags
  for select using ((select auth.uid()) = user_id);
create policy "task_tags_insert_own" on public.task_tags
  for insert with check ((select auth.uid()) = user_id);
create policy "task_tags_update_own" on public.task_tags
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "task_tags_delete_own" on public.task_tags
  for delete using ((select auth.uid()) = user_id);

-- note_tags
create policy "note_tags_select_own" on public.note_tags
  for select using ((select auth.uid()) = user_id);
create policy "note_tags_insert_own" on public.note_tags
  for insert with check ((select auth.uid()) = user_id);
create policy "note_tags_update_own" on public.note_tags
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "note_tags_delete_own" on public.note_tags
  for delete using ((select auth.uid()) = user_id);
