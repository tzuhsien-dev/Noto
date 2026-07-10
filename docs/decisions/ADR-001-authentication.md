# ADR-001: Authentication — Supabase email/password with locked-down sign-up

## Status

Accepted (2026-07-10)

## Context

Noto is a single-owner app on a public static host. It needs durable
cross-device sessions without running a server. The spec forbids OAuth
providers in v1 and requires that strangers cannot register.

## Decision

- Supabase Auth with email + password only.
- The default `@supabase/supabase-js` client settings are kept:
  `persistSession: true`, `autoRefreshToken: true`, localStorage storage,
  with `detectSessionInUrl: true` and `flowType: 'pkce'` so the
  password-recovery redirect works on a static host.
- Sign-up UI hidden behind `VITE_ENABLE_SIGNUP` (off by default);
  registration is actually disabled in the Supabase Dashboard after the
  owner creates their account. Server-side enforcement is the real control.
- Sign-out deletes the Dexie database and pending queue for that device.

## Consequences

- No server code; sessions survive restarts and refresh automatically.
- Tokens in localStorage are exposed to XSS; mitigated by the no-raw-HTML
  Markdown policy and zero third-party scripts (see SECURITY.md).
- Password reset relies on Supabase's email delivery.
- Re-enabling sign-up later is a Dashboard toggle plus env flag — no code
  change.
