import { useNavigate } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ListSkeleton } from '@/components/ui/skeleton'
import { PageContainer, PageHeader } from '@/components/PageHeader'
import { createNote } from '@/db/repo/notes'
import { useNotes, useNoteTagIds, useTags } from '@/features/data/hooks'
import { useUserId } from '@/features/auth/AuthProvider'
import { NoteCard } from '@/features/notes/NoteCard'

export function NotesPage({ variant }: { variant: 'all' | 'pinned' }) {
  const navigate = useNavigate()
  const userId = useUserId()
  const notes = useNotes()
  const tags = useTags() ?? []
  const noteTagIds = useNoteTagIds() ?? new Map<string, Set<string>>()

  const newNote = async () => {
    const note = await createNote({ userId })
    navigate(`/notes/${note.id}`)
  }

  if (!notes) {
    return (
      <PageContainer>
        <PageHeader title={variant === 'pinned' ? 'Pinned Notes' : 'Notes'} />
        <ListSkeleton />
      </PageContainer>
    )
  }

  const visible = notes
    .filter((n) => !n.deletedAt && !n.archived && (variant !== 'pinned' || n.pinned))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))

  return (
    <PageContainer>
      <PageHeader
        title={variant === 'pinned' ? 'Pinned Notes' : 'Notes'}
        actions={
          <Button size="sm" onClick={() => void newNote()} data-new-note>
            <Plus className="h-4 w-4" aria-hidden /> New note
          </Button>
        }
      />
      {visible.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={variant === 'pinned' ? 'No pinned notes' : 'No notes yet'}
          description={
            variant === 'pinned'
              ? 'Pin a note to keep it at hand.'
              : 'Create your first note — Markdown supported.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visible.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              tags={tags.filter((t) => noteTagIds.get(note.id)?.has(t.id))}
            />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
