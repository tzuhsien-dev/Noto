# ADR-004: GitHub Pages routing — HashRouter + configurable base path

## Status

Accepted (2026-07-10)

## Context

GitHub Pages is a static file host with no rewrite rules: a hard refresh on
`/Noto/app/today` returns 404 with BrowserRouter. Common workarounds are a
`404.html` redirect shim (sessionStorage or query-string tricks) or hash
routing.

## Decision

- `HashRouter`: all routes live after `#`, so every deep link and refresh
  hits `/Noto/index.html` and just works — including inside an installed
  PWA and through the service worker.
- Vite `base` comes from `VITE_BASE_PATH` (CI sets `/Noto/`; dev/preview
  default `/`), affecting asset URLs only.
- The Supabase password-recovery redirect targets the app origin + base;
  hash routing keeps it a single static URL.

## Alternatives rejected

- `404.html` redirect shim: works but adds a moving part that breaks
  subtly (SW navigation-fallback interplay, double redirects on slow
  connections). For a private single-user app, clean URLs buy nothing.
- BrowserRouter + serving `index.html` as `404.html`: every deep link is a
  real 404 status; interacts badly with Pages caching.

## Consequences

- URLs look like `https://…/Noto/#/today`. Acceptable: no SEO or sharing
  requirements.
- If the app ever moves to a host with rewrites, swapping to
  BrowserRouter is a one-line change plus redirect config.
