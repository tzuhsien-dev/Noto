# Noto — Security

## Threat model

Assets: the user's tasks, notes, and account credentials.
Adversaries considered:

1. **Anonymous internet users** who find the public GitHub Pages URL.
2. **Other authenticated Supabase users** (if sign-up were ever re-enabled
   or another account exists).
3. **A person with access to the unlocked device** (limited mitigation —
   see below).
4. **Supply-chain attackers** via npm dependencies.

Out of scope: a compromised Supabase project (the owner's dashboard
credentials are the root of trust), targeted malware on the device, and
network adversaries beyond what TLS already covers.

## Why the public GitHub Pages site is acceptable

The frontend is a static bundle; anyone can download and read it. It
contains **no secrets and no data**. All data access goes through Supabase
with the caller's JWT. An anonymous visitor sees the login page and can call
the Supabase API only with the anon/publishable key, which RLS renders
useless for reading or writing any user table. There is deliberately **no
fake frontend password gate** — hiding UI is not security.

## Keys

- **Publishable (anon) key — safe to publish.** It only identifies the
  project and grants the `anon` role, which RLS blocks from all user data.
  It necessarily ships in the JS bundle; treating it as secret would be
  false comfort.
- **service_role key — never in the frontend.** It bypasses RLS entirely.
  It must not appear in the repo, `.env.example`, GitHub Actions logs, or
  build output. This project never needs it at runtime; migrations run via
  the Supabase CLI with the owner's login.
- **GitHub Actions note**: repository secrets keep values out of the _repo_,
  but anything injected as `VITE_*` ends up in the public bundle. Secrets
  make the URL/key configurable, not confidential. The real boundary is
  Auth + RLS, not GitHub Secrets.

## Row Level Security

Every user table (`tasks`, `notes`, `checklist_items`, `projects`, `tags`,
`task_tags`, `note_tags`) has RLS enabled with four policies (SELECT /
INSERT / UPDATE / DELETE), each requiring `auth.uid() = user_id`
(`with check` on INSERT/UPDATE so a user cannot write rows for someone
else). The frontend never filters for security — RLS is the only enforcement
point. pgTAP tests in `supabase/tests/` verify anon access is denied and
users cannot read, write, or forge rows across accounts.

## Sign-up lockdown

After the owner creates their account, public sign-ups are disabled in
Supabase Dashboard → Authentication → Sign In / Providers → “Allow new users
to sign up” = off. From then on the API rejects registration server-side;
the hidden sign-up UI in Noto is cosmetic.

## XSS

Note content is Markdown rendered by `react-markdown`, which builds React
elements and does not emit raw HTML (no `rehype-raw`); script injection via
note content is therefore inert. `dangerouslySetInnerHTML` is not used
anywhere. No third-party scripts, CDNs, fonts, analytics, or ad SDKs are
loaded, which also keeps the CSP surface minimal.

## Session storage

The Supabase JS client stores the session (JWT access + refresh token) in
`localStorage` and auto-refreshes it. XSS is the main risk to localStorage
tokens, mitigated by the measures above. Tokens are never logged; error
messages persisted to the pending queue are sanitized (message text only,
no headers/tokens/response bodies).

## Device compromise limitation

IndexedDB and localStorage are not encrypted at rest by the app. Anyone
with the unlocked device profile can read cached tasks/notes and the
session. Mitigations are OS-level: disk encryption, screen lock, per-user
OS accounts. Sign out (or “Clear local cache”) removes local data from that
device.

## Supply chain

Dependencies are installed only via npm with a committed lockfile
(`package-lock.json`, `npm ci` in CI). The dependency set is deliberately
small and mainstream. CI greps the build output to assert no `service_role`
material ships. Renovate/Dependabot updates are recommended but manual
review applies.

## Backups

Supabase is the single authoritative store. The owner should periodically
use Settings → Export (JSON) and keep the file somewhere safe; import
restores it. Supabase's own point-in-time recovery/backups depend on plan
tier and are documented in DEPLOYMENT.md.

## Company data warning

Noto may be used on a work machine, but it syncs to a personal cloud
database. Do **not** store: employer-confidential information, source code,
customer data, non-public incident/issue details, internal URLs,
credentials/tokens/passwords, crash dumps, or confidential logs. You are
responsible for complying with your employer's security policy. This
warning appears in the README and in Settings → Privacy.

## Known limitations

- No at-rest encryption of the local cache (see device compromise).
- localStorage-based sessions are readable by any successful XSS; the app
  minimizes XSS surface but cannot make it zero.
- Last-write-wins conflict handling can surface “conflict copy” duplicates
  rather than merging.
- No rate limiting beyond what Supabase provides by default.
- Password reset depends on Supabase's built-in email service unless custom
  SMTP is configured (SMTP credentials live only in the Supabase Dashboard,
  never in this repo).
