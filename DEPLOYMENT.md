# Noto — Deployment runbook (zero to deployed)

Follow these steps in order. You need: a GitHub account, a Supabase account,
Node 20+, and this repository pushed to GitHub (e.g.
`github.com/<you>/Noto`).

## 1. Create the Supabase project

1. Sign in at [supabase.com](https://supabase.com) → **New project**.
2. Pick any name/region; set a strong **database password** and store it in
   your password manager. It is never used by the app — only by you/CLI.
3. When the project is ready, note from **Project Settings → API**:
   - Project URL (`https://<ref>.supabase.co`)
   - Publishable key (or legacy `anon` key)

Never copy the `service_role` key anywhere. Noto does not need it.

## 2. Configure Authentication

Dashboard → **Authentication**:

1. **Sign In / Providers**: keep **Email** enabled; leave every OAuth
   provider disabled.
2. Recommended: keep “Confirm email” on (default). You'll confirm your own
   account by clicking the email link once.
3. **URL Configuration → Site URL**: set to your final app URL, e.g.
   `https://<you>.github.io/Noto/` (needed for password-reset links). Add
   `http://localhost:5173` under Additional Redirect URLs for local dev.

## 3. Apply the database migrations

```bash
npx supabase login                      # opens browser, uses YOUR account
npx supabase link --project-ref <ref>   # ref from the project URL
npx supabase db push                    # applies supabase/migrations/*
```

`db push` creates the tables, the `updated_at`/`version` trigger, indexes,
the Realtime publication, and all Row Level Security policies. Do **not**
run `supabase/seed.sql` against production — it is for local development
only.

## 4. Create your account

Option A (Dashboard, simplest): Authentication → **Add user** → enter your
email + password → “Auto confirm user”.

Option B (through the app): run locally with sign-up temporarily enabled:

```bash
cp .env.example .env    # fill in the URL + publishable key from step 1
echo 'VITE_ENABLE_SIGNUP=true' >> .env
npm ci && npm run dev   # open http://localhost:5173, create the account
```

Then remove the `VITE_ENABLE_SIGNUP` line again.

Verify you can **sign in** (not just sign up) before continuing.

## 5. Disable public sign-up

Dashboard → Authentication → **Sign In / Providers** → turn **off** “Allow
new users to sign up” → Save.

From this moment the API rejects all registrations server-side. The login
page is still publicly reachable — that is expected and safe; see
SECURITY.md.

## 6. Configure GitHub Actions

In your GitHub repo:

1. **Settings → Pages** → Build and deployment → Source: **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables** → add:
   - `VITE_SUPABASE_URL` = your project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key

(Variables, not secrets, is fine: both values are public by design. Using
secrets works too but hides nothing — they are embedded in the shipped JS.)

## 7. Deploy

```bash
git push origin main
```

The `Deploy to GitHub Pages` workflow typechecks, lints, tests, builds with
`VITE_BASE_PATH=/<repo>/`, scans the bundle for privileged credentials, and
publishes. When it finishes, the app is live at
`https://<you>.github.io/<repo>/`.

## 8. Verify RLS

1. Open the deployed site in a private/incognito window: you must see only
   the login page, with no sign-up button.
2. Wrong password → “Invalid email or password”.
3. API-level check (anon key, no login — must return an error, not data):

```bash
curl -s "https://<ref>.supabase.co/rest/v1/tasks?select=*" \
  -H "apikey: <publishable-key>" -H "Authorization: Bearer <publishable-key>"
```

Expected: a `permission denied` error. If you ever see `[]` or rows, stop
and re-check the migrations (`npx supabase db push`).

4. Optional, thorough: run the pgTAP suite locally —
   `npx supabase start && npx supabase test db` (26 assertions covering
   anon denial, cross-user isolation, and forged `user_id` rejection).

## 9. Verify multi-device sign-in and sync

1. Sign in on your computer; create a task.
2. Sign in on your phone (same account): the task appears after the initial
   sync; new changes stream in via Realtime while both are open.
3. Put the phone in airplane mode, edit a task, reopen the network: the
   change uploads and appears on the computer.

## 10. Verify PWA installation

- **iPhone (Safari)**: Share → Add to Home Screen → the app opens standalone
  and shows cached data instantly.
- **Android (Chrome)**: ⋮ → Install app.
- **Desktop (Chrome/Edge)**: install icon in the address bar.
- After a new deployment, an open app shows “A new version of Noto is
  available” with a Reload button.

## Ongoing

- **Backups**: periodically Settings → Data → Export JSON.
- **Dependency updates**: standard `npm` flow; CI gates every push.
- **Password reset**: “Forgot password?” on the login page emails a reset
  link that lands on the app's reset page (requires Site URL from step 2).
