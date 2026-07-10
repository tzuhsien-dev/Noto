import { AlertTriangle, Check, CloudOff, Loader2, UploadCloud } from 'lucide-react'
import { usePendingCount } from '@/features/data/hooks'
import { useSyncStatus } from '@/sync/status'
import { cn } from '@/lib/utils'

export function SyncStatusChip() {
  const status = useSyncStatus()
  const pending = usePendingCount() ?? 0

  const view = (() => {
    if (status.phase === 'offline')
      return { icon: CloudOff, label: 'Offline', className: 'text-muted-foreground' }
    if (status.phase === 'syncing')
      return { icon: Loader2, label: 'Syncing', className: 'text-muted-foreground', spin: true }
    if (status.phase === 'error')
      return { icon: AlertTriangle, label: 'Sync error', className: 'text-destructive' }
    if (pending > 0)
      return {
        icon: UploadCloud,
        label: `${pending} pending`,
        className: 'text-amber-600 dark:text-amber-400',
      }
    return { icon: Check, label: 'Synced', className: 'text-muted-foreground' }
  })()

  const Icon = view.icon
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs', view.className)}
      role="status"
      aria-live="polite"
      data-sync-status
    >
      <Icon className={cn('h-3.5 w-3.5', view.spin && 'animate-spin')} aria-hidden />
      {view.label}
    </span>
  )
}
