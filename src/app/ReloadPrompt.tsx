import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

/** Non-intrusive banner shown when a new app version has been downloaded. */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 shadow-lg md:bottom-4"
    >
      <span className="text-sm">A new version of Noto is available.</span>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        Reload
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)} aria-label="Dismiss">
        Later
      </Button>
    </div>
  )
}
