-- Hosted Supabase projects ship default privileges that grant DML on new
-- public tables to the anon role. RLS already filters every row, but Noto
-- has no unauthenticated surface at all, so drop anon's table privileges
-- entirely: unauthenticated API calls fail with "permission denied" instead
-- of returning empty sets. (The local dev stack already behaves this way.)

revoke all privileges
  on public.projects, public.tasks, public.notes, public.checklist_items,
     public.tags, public.task_tags, public.note_tags
  from anon;

-- Future tables created by migrations should not leak grants to anon either.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
