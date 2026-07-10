import type { BackendClient } from './types'
import { FakeBackend } from './fake'

export type BackendConfig =
  | { kind: 'supabase'; url: string; publishableKey: string }
  | { kind: 'fake' }
  | { kind: 'unconfigured' }

export function resolveBackendConfig(env: ImportMetaEnv = import.meta.env): BackendConfig {
  if (env.VITE_E2E === '1') return { kind: 'fake' }
  const url = env.VITE_SUPABASE_URL
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (url && publishableKey) return { kind: 'supabase', url, publishableKey }
  return { kind: 'unconfigured' }
}

let instance: BackendClient | null = null

declare global {
  interface Window {
    /** Exposed only in fake mode so Playwright can drive server-side state. */
    __notoFakeBackend?: FakeBackend
  }
}

/**
 * Returns the app-wide backend, or null when Supabase is not configured
 * (the UI shows a configuration-error screen in that case).
 */
export async function getBackend(): Promise<BackendClient | null> {
  if (instance) return instance
  const config = resolveBackendConfig()
  if (config.kind === 'fake') {
    const fake = new FakeBackend()
    window.__notoFakeBackend = fake
    instance = fake
  } else if (config.kind === 'supabase') {
    const { createSupabaseBackend } = await import('./supabase')
    instance = createSupabaseBackend(config.url, config.publishableKey)
  }
  return instance
}
