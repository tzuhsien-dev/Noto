import { useState } from 'react'
import { FileText, ListChecks, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { PageContainer, PageHeader } from '@/components/PageHeader'
import { permanentlyDeleteNote, restoreNote } from '@/db/repo/notes'
import { permanentlyDeleteTask, restoreTask } from '@/db/repo/tasks'
import { useNotes, useTasks } from '@/features/data/hooks'

type PendingAction = { kind: 'task' | 'note'; id: string; title: string } | { kind: 'empty' }

export function TrashPage() {
  const deletedTasks = (useTasks() ?? []).filter((t) => t.deletedAt)
  const deletedNotes = (useNotes() ?? []).filter((n) => n.deletedAt)
  const [confirm, setConfirm] = useState<PendingAction | null>(null)

  const emptyTrash = async () => {
    for (const task of deletedTasks) await permanentlyDeleteTask(task.id)
    for (const note of deletedNotes) await permanentlyDeleteNote(note.id)
  }

  const isEmpty = deletedTasks.length === 0 && deletedNotes.length === 0

  return (
    <PageContainer>
      <PageHeader
        title="Trash"
        actions={
          isEmpty ? undefined : (
            <Button size="sm" variant="destructive" onClick={() => setConfirm({ kind: 'empty' })}>
              <Trash2 className="h-4 w-4" aria-hidden /> Empty trash
            </Button>
          )
        }
      />
      {isEmpty ? (
        <EmptyState
          icon={Trash2}
          title="Trash is empty"
          description="Deleted tasks and notes stay here until you remove them permanently."
        />
      ) : (
        <div className="space-y-6">
          {deletedTasks.length > 0 ? (
            <section aria-label="Deleted tasks">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <ListChecks className="h-4 w-4" aria-hidden /> Tasks
              </h2>
              <ul className="space-y-1">
                {deletedTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    <Button size="sm" variant="ghost" onClick={() => void restoreTask(task.id)}>
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setConfirm({ kind: 'task', id: task.id, title: task.title })}
                    >
                      Delete forever
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {deletedNotes.length > 0 ? (
            <section aria-label="Deleted notes">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" aria-hidden /> Notes
              </h2>
              <ul className="space-y-1">
                {deletedNotes.map((note) => (
                  <li
                    key={note.id}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{note.title || 'Untitled note'}</span>
                    <Button size="sm" variant="ghost" onClick={() => void restoreNote(note.id)}>
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() =>
                        setConfirm({ kind: 'note', id: note.id, title: note.title || 'Untitled' })
                      }
                    >
                      Delete forever
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.kind === 'empty'
            ? 'Empty trash?'
            : `Permanently delete “${confirm && 'title' in confirm ? confirm.title : ''}”?`
        }
        description="This cannot be undone. The item is removed from all your devices."
        confirmLabel={confirm?.kind === 'empty' ? 'Empty trash' : 'Delete forever'}
        onConfirm={() => {
          if (!confirm) return
          if (confirm.kind === 'empty') void emptyTrash()
          else if (confirm.kind === 'task') void permanentlyDeleteTask(confirm.id)
          else void permanentlyDeleteNote(confirm.id)
          setConfirm(null)
        }}
      />
    </PageContainer>
  )
}
