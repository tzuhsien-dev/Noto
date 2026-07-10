import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { clearLocalData } from '@/db/database'
import { requestSync } from '@/sync/engine'

/**
 * Local data management. Export/import arrive with the sync-aware data
 * section (see IMPLEMENTATION_PLAN Phase 6); clear-cache is purely local.
 */
export function SettingsDataSection() {
  const [confirmClear, setConfirmClear] = useState(false)

  const clearCache = async () => {
    await clearLocalData()
    requestSync() // cursors were cleared too, so this is a full re-download
    toast('Local cache cleared', {
      description: 'Re-downloading your data from the cloud.',
    })
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-label="Data">
      <h2 className="mb-3 text-sm font-semibold">Data</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)}>
          Clear local cache
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Clearing the cache removes data from this device only — your cloud data is untouched.
      </p>
      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear local cache?"
        description="Unsynced pending changes on this device will be lost. Cloud data is not affected and will be re-downloaded."
        confirmLabel="Clear cache"
        onConfirm={() => {
          setConfirmClear(false)
          void clearCache()
        }}
      />
    </section>
  )
}
