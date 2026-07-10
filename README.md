# Noto

A personal Note + Todo web app that works everywhere you do — macOS, Windows,
iPhone, and Android — as a website or an installable PWA. Your data lives in
your own Supabase project, is cached locally in IndexedDB for instant startup
and offline use, and syncs across devices automatically.

> ⚠️ **Using Noto on a work computer?** It syncs to a personal cloud database.
> Do not store anything your employer forbids taking off-site: confidential
> information, source code, customer data, non-public incident details,
> internal URLs, credentials/tokens/passwords, crash dumps, or logs. You are
> responsible for following your company's security policy.

## Features

- **Tasks**: quick add, due dates, priorities, projects, tags, batch
  complete/delete, soft delete with undo, Trash with restore/permanent delete.
- **Notes**: Markdown with edit/preview toggle, debounced auto-save,
  checklists, pin, archive, tags.
- **Views**: Inbox, Today (due + overdue), Upcoming (7/30 days), All,
  Completed, Notes, Pinned, Archive, Projects, Tags, Trash, Settings.
- **Search**: instant client-side search across tasks, notes, projects, and
  tags with type/status/project/tag filters (`/` shortcut).
- **Offline-first**: everything renders from IndexedDB; offline edits queue
  up and sync on reconnect with conflict detection (see SPEC.md §6).
- **Cross-device sync**: Supabase Realtime pushes changes live; foreground
  refresh covers the rest.
- **PWA**: installable, offline app shell, in-app update prompt.
- Dark mode, keyboard shortcuts (`N` task, `Shift+N` note, `/` search,
  `Esc` close), mobile-friendly layout with iOS safe areas.

## Architecture

```
React UI ──reads──▶ Dexie (IndexedDB, local source of truth)
   │                        ▲       │
   └─writes──▶ repositories ┘       │ pending mutation queue
                                    ▼
                            SyncEngine ◀──Realtime/pull── Supabase (authoritative)
```

- **Frontend**: Vite + React + TypeScript (strict) + Tailwind CSS v4.
- **Backend**: Supabase — Auth (email/password), PostgreSQL with Row Level
  Security, Realtime. No custom server.
- **Sync**: version-guarded last-write-wins with conflict copies
  (docs/decisions/ADR-003).
- **Routing**: HashRouter — refresh-safe on GitHub Pages (ADR-004).
- Details: [SPEC.md](SPEC.md), [SECURITY.md](SECURITY.md),
  [docs/decisions/](docs/decisions/).

## Local development

```bash
npm ci
cp .env.example .env    # fill in your Supabase URL + publishable key
npm run dev
```

No Supabase project yet? Run against the in-memory fake backend (sign in
with `demo@noto.local` / `noto-demo-password`):

```bash
VITE_E2E=1 npm run dev
```

### Local Supabase (optional, needs Docker)

```bash
npx supabase start          # boots Postgres/Auth/API, applies migrations + seed
npx supabase status         # shows the local API URL and anon key for .env
npx supabase test db        # runs the pgTAP RLS test suite
```

The seed creates a demo login: `demo@noto.local` / `noto-demo-password`.

## Supabase project setup (production)

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for the full zero-to-deployed runbook.
Short version:

1. Create a project at [supabase.com](https://supabase.com).
2. Apply migrations: `npx supabase link --project-ref <ref>` then
   `npx supabase db push`.
3. Create your account: set `VITE_ENABLE_SIGNUP=true` locally, run the app,
   sign up (or create the user in Dashboard → Authentication → Add user).
4. Verify you can sign in.
5. **Disable public sign-up**: Dashboard → Authentication → Sign In /
   Providers → turn off “Allow new users to sign up”. From now on strangers
   see only a login page and the API rejects registration server-side.

### Environment variables

| Variable                        | What                         | Public?                     |
| ------------------------------- | ---------------------------- | --------------------------- |
| `VITE_SUPABASE_URL`             | Project API URL              | yes                         |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key       | yes — designed to be public |
| `VITE_ENABLE_SIGNUP`            | Show sign-up UI (setup only) | n/a, default off            |

The **service_role key, database password, and access tokens must never**
appear in this repo, `.env` files that get committed, or the build output.
The real security boundary is Supabase Auth + Row Level Security — see
[SECURITY.md](SECURITY.md).

## GitHub Pages deployment

Deployment is automated via `.github/workflows/deploy.yml` on every push to
`main`:

1. Repo → Settings → Pages → Source: **GitHub Actions**.
2. Repo → Settings → Secrets and variables → Actions → **Variables**: add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Push to `main`. The app deploys to
   `https://<user>.github.io/<repo>/`.

Note: GitHub secrets/variables only keep values out of the repo — anything
prefixed `VITE_` is embedded in the public JS bundle. That is fine for the
publishable key and fatal for anything privileged; CI fails the build if
service-role material is detected in `dist/`.

## PWA installation

- **iPhone**: open the site in Safari → Share → “Add to Home Screen”.
- **Android**: Chrome shows an install prompt, or ⋮ → “Install app”.
- **macOS/Windows**: Chrome/Edge → install icon in the address bar.

## Testing

```bash
npm run typecheck    # TypeScript strict
npm run lint         # oxlint + prettier
npm test             # Vitest unit + component tests (fake backend, fake IndexedDB)
npm run test:e2e     # Playwright, desktop + mobile projects (fake backend)
npx supabase test db # pgTAP RLS suite against the local stack (Docker)
```

CI (`.github/workflows/ci.yml`) runs all of the above except the pgTAP suite,
plus a bundle secret scan.

## Backup and restore

- **Backup**: Settings → Data → “Export JSON” (complete, versioned) or
  “Export Markdown” (human-readable). Keep the JSON somewhere safe.
- **Restore**: Settings → Data → “Import JSON” — validated, previewed, and
  merged by ID (never overwrites existing items); a local snapshot is stored
  before every import.
- Supabase-side backups (point-in-time recovery) depend on your plan tier;
  see the Supabase dashboard.

## Known limitations

- No attachments/images/audio; no sharing between users; no recurring tasks.
- Conflicts create “(conflict copy)” items rather than merging field-by-field.
- The local cache is not encrypted at rest — protect the device itself.
- Search runs over locally synced data only (fine for personal scale).
- Sessions live in localStorage; see SECURITY.md for the XSS discussion.
