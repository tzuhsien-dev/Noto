-- Local-development seed. Creates one demo auth user with fictional data.
-- NEVER run against a production project; contains a well-known password hash
-- (password: "noto-demo-password").

-- Token columns must be empty strings, not NULL — GoTrue fails to scan NULLs.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated',
  'demo@noto.local',
  crypt('noto-demo-password', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  '', '', '', '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"demo@noto.local"}',
  'email', now(), now(), now()
);

insert into public.projects (id, user_id, name, position) values
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111', 'Household', 0),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111111', 'Hobby coding', 1);

insert into public.tasks (id, user_id, title, description, priority, due_at, project_id) values
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111',
   'Water the plants', null, 'low', now() + interval '1 day', '22222222-2222-4222-8222-222222222201'),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111111',
   'Renew library books', 'Three books due', 'medium', now(), null),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111111',
   'Try the new pasta recipe', null, 'none', null, '22222222-2222-4222-8222-222222222201');

insert into public.notes (id, user_id, title, content, pinned) values
  ('44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111111',
   'Packing list', E'# Packing list\n\n- Chargers\n- Rain jacket\n- Passport', true),
  ('44444444-4444-4444-8444-444444444402', '11111111-1111-4111-8111-111111111111',
   'Book ideas', 'Sci-fi anthology, gardening basics, a cookbook.', false);

insert into public.checklist_items (id, note_id, user_id, content, completed, position) values
  ('55555555-5555-4555-8555-555555555501', '44444444-4444-4444-8444-444444444401',
   '11111111-1111-4111-8111-111111111111', 'Chargers', true, 0),
  ('55555555-5555-4555-8555-555555555502', '44444444-4444-4444-8444-444444444401',
   '11111111-1111-4111-8111-111111111111', 'Rain jacket', false, 1);

insert into public.tags (id, user_id, name) values
  ('66666666-6666-4666-8666-666666666601', '11111111-1111-4111-8111-111111111111', 'errands'),
  ('66666666-6666-4666-8666-666666666602', '11111111-1111-4111-8111-111111111111', 'reading');

insert into public.task_tags (task_id, tag_id, user_id) values
  ('33333333-3333-4333-8333-333333333302', '66666666-6666-4666-8666-666666666601',
   '11111111-1111-4111-8111-111111111111');

insert into public.note_tags (note_id, tag_id, user_id) values
  ('44444444-4444-4444-8444-444444444402', '66666666-6666-4666-8666-666666666602',
   '11111111-1111-4111-8111-111111111111');
