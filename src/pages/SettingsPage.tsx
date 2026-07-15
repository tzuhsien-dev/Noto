import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LogOut, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/input'
import { PageContainer, PageHeader } from '@/components/PageHeader'
import { useAuth } from '@/features/auth/AuthProvider'
import { usePendingCount } from '@/features/data/hooks'
import { useSyncStatus } from '@/sync/status'
import { formatRelative } from '@/domain/dates'
import { useTheme, type ThemeSetting } from '@/app/theme'
import { requestSync } from '@/sync/engine'
import { SettingsDataSection } from '@/features/settings/SettingsDataSection'

// TEMPORARY: live viewport readout to diagnose the iOS standalone PWA
// bottom-gap bug on a real device. Remove once the root cause is fixed.
function readViewport() {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
  document.body.appendChild(probe)
  const cs = getComputedStyle(probe)
  const envTop = cs.paddingTop
  const envBottom = cs.paddingBottom
  probe.remove()
  const vv = window.visualViewport
  return [
    `innerWH: ${window.innerWidth}x${window.innerHeight}`,
    `html client: ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
    `html scrollH: ${document.documentElement.scrollHeight}  scrollY: ${window.scrollY}`,
    `visualViewport: h=${vv ? Math.round(vv.height) : '?'} offsetTop=${vv ? Math.round(vv.offsetTop) : '?'} scale=${vv ? vv.scale : '?'}`,
    `screen: ${window.screen.width}x${window.screen.height}`,
    `env top/bottom: ${envTop} / ${envBottom}`,
    `standalone: ${window.matchMedia('(display-mode: standalone)').matches}`,
  ].join('\n')
}

function ViewportDebug() {
  const [text, setText] = useState('')
  useEffect(() => {
    const update = () => setText(readViewport())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [])
  return (
    <Section title="Viewport diagnostics (temporary)">
      <pre className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {text}
      </pre>
    </Section>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-label={title}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export function SettingsPage() {
  const { state, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const status = useSyncStatus()
  const pending = usePendingCount() ?? 0
  const email = state.status === 'signedIn' ? state.user.email : null

  return (
    <PageContainer>
      <PageHeader title="Settings" />
      <div className="space-y-4">
        <Section title="Appearance">
          <label className="flex items-center justify-between gap-4 text-sm">
            Theme
            <NativeSelect
              className="w-40"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeSetting)}
              aria-label="Theme"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </NativeSelect>
          </label>
        </Section>

        <Section title="Account">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="truncate text-muted-foreground">{email ?? '—'}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void signOut().catch(() => toast.error('Sign out failed — local data was cleared'))
              }
              data-sign-out
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Signing out clears all Noto data cached on this device.
          </p>
        </Section>

        <Section title="Sync">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="capitalize">{status.phase}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Pending changes</dt>
              <dd data-pending-count>{pending}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Last successful sync</dt>
              <dd>{status.lastSyncAt ? formatRelative(status.lastSyncAt) : 'Never'}</dd>
            </div>
            {status.message ? (
              <p className="text-xs text-destructive" role="alert">
                {status.message}
              </p>
            ) : null}
          </dl>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => requestSync()}
            data-retry-sync
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Sync now
          </Button>
        </Section>

        <SettingsDataSection />

        <Section title="Privacy">
          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              Your tasks and notes sync to your personal Supabase project and are cached on this
              device. Nothing is sent anywhere else — no analytics, no third-party scripts.
            </p>
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-400">
              <strong>Using Noto on a work computer?</strong> Don't store anything your employer
              forbids taking off-site: confidential information, source code, customer data,
              non-public incident details, internal URLs, credentials, tokens, passwords, crash
              dumps, or logs. You are responsible for following your company's security policy.
            </p>
          </div>
        </Section>

        <ViewportDebug />

        <Section title="About">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">App</dt>
              <dd>Noto — notes & todos, offline-first</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Version</dt>
              <dd>{__APP_VERSION__}</dd>
            </div>
          </dl>
        </Section>
      </div>
    </PageContainer>
  )
}
