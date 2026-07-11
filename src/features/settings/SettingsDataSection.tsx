import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Download, FileText, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { clearLocalData } from '@/db/database'
import { requestSync } from '@/sync/engine'
import { useUserId } from '@/features/auth/AuthProvider'
import {
  buildExport,
  buildMarkdownExport,
  downloadFile,
  mergeImport,
  validateImport,
  type ImportPreview,
} from './export-import'

const PREVIEW_LABELS: Record<string, string> = {
  tasks: 'Tasks',
  notes: 'Notes',
  checklistItems: 'Checklist items',
  projects: 'Projects',
  areas: 'Areas',
  tags: 'Tags',
}

export function SettingsDataSection() {
  const userId = useUserId()
  const [confirmClear, setConfirmClear] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const stamp = () => format(new Date(), 'yyyy-MM-dd')

  const exportJson = async () => {
    const file = await buildExport()
    downloadFile(`noto-export-${stamp()}.json`, JSON.stringify(file, null, 2), 'application/json')
  }

  const exportMarkdown = async () => {
    downloadFile(`noto-export-${stamp()}.md`, await buildMarkdownExport(), 'text/markdown')
  }

  const onFilePicked = async (file: File | undefined) => {
    if (!file) return
    try {
      setPreview(await validateImport(await file.text()))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read that file.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const runImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      const count = await mergeImport(preview.file, userId)
      requestSync()
      toast(count > 0 ? `Imported ${count} items` : 'Nothing new to import')
      setPreview(null)
    } catch {
      toast.error('Import failed — your existing data was not changed.')
    } finally {
      setImporting(false)
    }
  }

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
        <Button variant="outline" size="sm" onClick={() => void exportJson()}>
          <Download className="h-4 w-4" aria-hidden /> Export JSON
        </Button>
        <Button variant="outline" size="sm" onClick={() => void exportMarkdown()}>
          <FileText className="h-4 w-4" aria-hidden /> Export Markdown
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden /> Import JSON
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Import file"
          onChange={(e) => void onFilePicked(e.target.files?.[0])}
        />
        <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)}>
          Clear local cache
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Import merges by ID and never overwrites existing items; a snapshot of your data is kept
        first. Clearing the cache removes data from this device only.
      </p>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent>
          <DialogTitle>Import preview</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            New items are added; existing items are left untouched.
          </DialogDescription>
          {preview ? (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Type</th>
                  <th className="py-1 font-medium">In file</th>
                  <th className="py-1 font-medium">New</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(preview.counts).map(([key, value]) => (
                  <tr key={key} className="border-t border-border">
                    <td className="py-1.5">{PREVIEW_LABELS[key] ?? key}</td>
                    <td className="py-1.5">{value.total}</td>
                    <td className="py-1.5">{value.new}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void runImport()} disabled={importing}>
              {importing ? 'Importing…' : 'Merge into my data'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
