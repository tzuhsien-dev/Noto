import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pencil, Plus, Tag as TagIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageContainer, PageHeader } from '@/components/PageHeader'
import { sortTasks } from '@/domain/filters'
import { createTag, deleteTag, renameTag } from '@/db/repo/tags'
import { useNotes, useNoteTagIds, useTags, useTasks, useTaskTagIds } from '@/features/data/hooks'
import { useUserId } from '@/features/auth/AuthProvider'
import { NoteCard } from '@/features/notes/NoteCard'
import { TaskList } from '@/features/tasks/TaskList'
import type { Tag } from '@/domain/types'

function TagFormDialog({
  open,
  onOpenChange,
  tag,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag?: Tag
}) {
  const userId = useUserId()
  const [name, setName] = useState(tag?.name ?? '')

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (tag) await renameTag(tag.id, trimmed)
    else await createTag({ userId, name: trimmed })
    onOpenChange(false)
    if (!tag) setName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{tag ? 'Rename tag' : 'New tag'}</DialogTitle>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tag name"
            aria-label="Tag name"
          />
          <Button type="submit" disabled={!name.trim()}>
            {tag ? 'Save' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function TagsPage() {
  const tags = useTags() ?? []
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Tag | null>(null)
  const [deleting, setDeleting] = useState<Tag | null>(null)

  return (
    <PageContainer>
      <PageHeader
        title="Tags"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New tag
          </Button>
        }
      />
      {tags.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title="No tags"
          description="Tags let you slice tasks and notes across projects."
        />
      ) : (
        <ul className="space-y-1">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
            >
              <Link to={`/tags/${tag.id}`} className="min-w-0 flex-1 truncate text-sm">
                {tag.name}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditing(tag)}
                aria-label={`Rename ${tag.name}`}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => setDeleting(tag)}
                aria-label={`Delete ${tag.name}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <TagFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editing ? (
        <TagFormDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          tag={editing}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete tag “${deleting?.name ?? ''}”?`}
        description="The tag is removed from all tasks and notes. The tasks and notes themselves are kept."
        confirmLabel="Delete tag"
        onConfirm={() => {
          if (deleting) void deleteTag(deleting.id)
          setDeleting(null)
        }}
      />
    </PageContainer>
  )
}

export function TagDetailPage() {
  const { tagId } = useParams<{ tagId: string }>()
  const tags = useTags()
  const tasks = useTasks()
  const notes = useNotes() ?? []
  const taskTagIds = useTaskTagIds() ?? new Map<string, Set<string>>()
  const noteTagIds = useNoteTagIds() ?? new Map<string, Set<string>>()
  const tag = tags?.find((t) => t.id === tagId)

  if (tags && !tag) {
    return (
      <PageContainer>
        <EmptyState icon={TagIcon} title="Tag not found" />
      </PageContainer>
    )
  }

  const taggedTasks =
    tasks && tagId
      ? sortTasks(tasks.filter((t) => !t.deletedAt && taskTagIds.get(t.id)?.has(tagId)))
      : undefined
  const taggedNotes = tagId
    ? notes.filter((n) => !n.deletedAt && noteTagIds.get(n.id)?.has(tagId))
    : []

  return (
    <PageContainer>
      <PageHeader title={`# ${tag?.name ?? '…'}`} />
      <section aria-label="Tagged tasks">
        <h2 className="mb-1 text-sm font-medium text-muted-foreground">Tasks</h2>
        <TaskList tasks={taggedTasks} emptyTitle="No tasks with this tag" />
      </section>
      <section aria-label="Tagged notes" className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Notes</h2>
        {taggedNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes with this tag</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {taggedNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  )
}
