-- pgTAP tests proving the RLS boundary: anon has no access, users are fully
-- isolated, and nobody can forge another user's user_id.
-- Run with: npx supabase test db  (requires `supabase start`)

begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

-- Two users created directly in auth (bypassing signup) for the test run.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'user-a@test.local', 'x', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'user-b@test.local', 'x', now(), now(), now(), '{}', '{}');

-- Seed one row per table for each user (as superuser, bypassing RLS).
insert into public.areas (id, user_id, name) values
  ('60000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A area'),
  ('60000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B area');
insert into public.projects (id, user_id, name, area_id) values
  ('10000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A project', '60000000-0000-4000-8000-00000000000a'),
  ('10000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B project', '60000000-0000-4000-8000-00000000000b');
insert into public.tasks (id, user_id, title) values
  ('20000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A task'),
  ('20000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B task');
insert into public.notes (id, user_id, title) values
  ('30000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A note'),
  ('30000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B note');
insert into public.checklist_items (id, note_id, user_id, content) values
  ('40000000-0000-4000-8000-00000000000a', '30000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A item'),
  ('40000000-0000-4000-8000-00000000000b', '30000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B item');
insert into public.tags (id, user_id, name) values
  ('50000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a-tag'),
  ('50000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b-tag');
insert into public.task_tags (task_id, tag_id, user_id) values
  ('20000000-0000-4000-8000-00000000000a', '50000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('20000000-0000-4000-8000-00000000000b', '50000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.note_tags (note_id, tag_id, user_id) values
  ('30000000-0000-4000-8000-00000000000a', '50000000-0000-4000-8000-00000000000a', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('30000000-0000-4000-8000-00000000000b', '50000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- ---------------------------------------------------------------------------
-- anon: no table privileges at all (denied before RLS is even consulted)
-- ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims to '';

select throws_ok('select count(*) from public.tasks', '42501', null, 'anon cannot read tasks');
select throws_ok('select count(*) from public.notes', '42501', null, 'anon cannot read notes');
select throws_ok('select count(*) from public.projects', '42501', null, 'anon cannot read projects');
select throws_ok('select count(*) from public.areas', '42501', null, 'anon cannot read areas');
select throws_ok('select count(*) from public.tags', '42501', null, 'anon cannot read tags');
select throws_ok('select count(*) from public.checklist_items', '42501', null, 'anon cannot read checklist items');
select throws_ok('select count(*) from public.task_tags', '42501', null, 'anon cannot read task_tags');
select throws_ok('select count(*) from public.note_tags', '42501', null, 'anon cannot read note_tags');

select throws_ok(
  $$insert into public.tasks (id, user_id, title)
    values ('99999999-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'smuggled')$$,
  '42501', null, 'anon cannot insert tasks');

-- ---------------------------------------------------------------------------
-- user A: sees only own rows
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select results_eq(
  'select title from public.tasks order by title',
  array['A task'::text], 'A sees only own tasks');
select results_eq(
  'select title from public.notes order by title',
  array['A note'::text], 'A sees only own notes');
select results_eq(
  'select name from public.projects order by name',
  array['A project'::text], 'A sees only own projects');
select results_eq(
  'select name from public.areas order by name',
  array['A area'::text], 'A sees only own areas');
select results_eq(
  'select name from public.tags order by name',
  array['a-tag'::text], 'A sees only own tags');
select results_eq(
  'select content from public.checklist_items order by content',
  array['A item'::text], 'A sees only own checklist items');
select is ((select count(*) from public.task_tags), 1::bigint, 'A sees only own task_tags');
select is ((select count(*) from public.note_tags), 1::bigint, 'A sees only own note_tags');

-- A cannot forge rows for B
select throws_ok(
  $$insert into public.tasks (id, user_id, title)
    values ('99999999-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'forged')$$,
  '42501', null, 'A cannot insert a task with B''s user_id');
select throws_ok(
  $$insert into public.notes (id, user_id, title)
    values ('99999999-0000-4000-8000-000000000003', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'forged')$$,
  '42501', null, 'A cannot insert a note with B''s user_id');
select throws_ok(
  $$insert into public.task_tags (task_id, tag_id, user_id)
    values ('20000000-0000-4000-8000-00000000000b', '50000000-0000-4000-8000-00000000000b', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,
  '42501', null, 'A cannot insert task_tags for B');

-- A cannot update or steal B's rows (RLS filters them out: 0 rows affected)
update public.tasks set title = 'hijacked' where id = '20000000-0000-4000-8000-00000000000b';
select is (
  (select count(*) from public.tasks where title = 'hijacked'), 0::bigint,
  'A''s update of B''s task affects nothing');

-- A cannot move own row to B (with check blocks the new user_id)
select throws_ok(
  $$update public.tasks set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    where id = '20000000-0000-4000-8000-00000000000a'$$,
  '42501', null, 'A cannot reassign a task to B');

-- A cannot delete B's rows
delete from public.notes where id = '30000000-0000-4000-8000-00000000000b';
select is (
  (select count(*) from public.notes where id = '30000000-0000-4000-8000-00000000000b'), 0::bigint,
  'B''s note invisible to A after attempted delete (still exists for B)');

-- ---------------------------------------------------------------------------
-- user B: still owns their data after A's attempts
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select results_eq(
  'select title from public.tasks order by title',
  array['B task'::text], 'B still sees an unmodified task list');
select is (
  (select title from public.tasks where id = '20000000-0000-4000-8000-00000000000b'),
  'B task', 'B''s task title untouched by A''s update');
select is (
  (select count(*) from public.notes where id = '30000000-0000-4000-8000-00000000000b'),
  1::bigint, 'B''s note survived A''s delete');

-- version trigger: server bumps version on every update
update public.tasks set title = 'B task renamed' where id = '20000000-0000-4000-8000-00000000000b';
select is (
  (select version from public.tasks where id = '20000000-0000-4000-8000-00000000000b'),
  2::bigint, 'version increments on update');
select is (
  (select title from public.tasks where id = '20000000-0000-4000-8000-00000000000b'),
  'B task renamed', 'owner can update own row');

select * from finish();
rollback;
