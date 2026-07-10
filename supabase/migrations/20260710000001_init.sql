-- Noto schema: tasks, notes, checklists, projects, tags + join tables.
-- All timestamps are timestamptz (UTC). IDs are client-generated UUIDs.

create type public.task_priority as enum ('none', 'low', 'medium', 'high');

-- updated_at/version are server-authoritative: every UPDATE bumps both,
-- regardless of what the client sent. Version powers conflict detection.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

-- --- projects ---------------------------------------------------------------

create table public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  icon text check (icon is null or char_length(icon) <= 50),
  position double precision not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1
);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create index projects_user_id_idx on public.projects (user_id);
create index projects_updated_at_idx on public.projects (user_id, updated_at);

-- --- tasks -------------------------------------------------------------------

create table public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 500),
  description text check (description is null or char_length(description) <= 20000),
  completed boolean not null default false,
  priority public.task_priority not null default 'none',
  due_at timestamptz,
  start_at timestamptz,
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  version bigint not null default 1
);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_updated_at_idx on public.tasks (user_id, updated_at);
create index tasks_open_idx on public.tasks (user_id, completed) where deleted_at is null;
create index tasks_due_at_idx on public.tasks (user_id, due_at) where due_at is not null;
create index tasks_project_id_idx on public.tasks (project_id);
create index tasks_deleted_at_idx on public.tasks (user_id, deleted_at) where deleted_at is not null;

-- --- notes -------------------------------------------------------------------

create table public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 500),
  content text not null default '' check (char_length(content) <= 200000),
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1
);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

create index notes_user_id_idx on public.notes (user_id);
create index notes_updated_at_idx on public.notes (user_id, updated_at);
create index notes_deleted_at_idx on public.notes (user_id, deleted_at) where deleted_at is not null;

-- --- checklist items ----------------------------------------------------------

create table public.checklist_items (
  id uuid primary key,
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(content) <= 2000),
  completed boolean not null default false,
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1
);

create trigger checklist_items_set_updated_at
  before update on public.checklist_items
  for each row execute function public.set_updated_at();

create index checklist_items_user_id_idx on public.checklist_items (user_id);
create index checklist_items_updated_at_idx on public.checklist_items (user_id, updated_at);
create index checklist_items_note_id_idx on public.checklist_items (note_id);

-- --- tags ---------------------------------------------------------------------

create table public.tags (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version bigint not null default 1
);

create trigger tags_set_updated_at
  before update on public.tags
  for each row execute function public.set_updated_at();

create unique index tags_user_name_key on public.tags (user_id, lower(name));
create index tags_updated_at_idx on public.tags (user_id, updated_at);

-- --- join tables ----------------------------------------------------------------

create table public.task_tags (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (task_id, tag_id)
);

create index task_tags_user_id_idx on public.task_tags (user_id);
create index task_tags_tag_id_idx on public.task_tags (tag_id);

create table public.note_tags (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (note_id, tag_id)
);

create index note_tags_user_id_idx on public.note_tags (user_id);
create index note_tags_tag_id_idx on public.note_tags (tag_id);

-- --- realtime -------------------------------------------------------------------

alter publication supabase_realtime add table
  public.tasks,
  public.notes,
  public.checklist_items,
  public.projects,
  public.tags,
  public.task_tags,
  public.note_tags;
