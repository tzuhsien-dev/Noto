import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Archive, ArchiveRestore, ArrowLeft, Eye, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Markdown } from '@/components/Markdown'
import { formatRelative } from '@/domain/dates'
import { updateNote } from '@/db/repo/notes'
import { setNoteTags } from '@/db/repo/tags'
import { useNote, useNoteTagIds } from '@/features/data/hooks'
import { useUserId } from '@/features/auth/AuthProvider'
import { ChecklistEditor } from '@/features/notes/ChecklistEditor'
import { deleteNoteWithUndo } from '@/features/notes/note-actions'
import { TagPicker } from '@/features/tags/TagPicker'
import { debounce } from '@/lib/utils'

export const NOTE_AUTOSAVE_MS = 800

export function NoteEditorPage() {
  const { noteId } = useParams<{ noteId: string }>()
  const navigate = useNavigate()
  const userId = useUserId()
  const note = useNote(noteId)
  const noteTagIds = useNoteTagIds()
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  // Draft state is local; persistence is debounced so keystrokes don't each hit storage.
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const loadedId = useRef<string | null>(null)

  const save = useMemo(
    () =>
      debounce((id: string, patch: { title: string; content: string }) => {
        void updateNote(id, patch)
      }, NOTE_AUTOSAVE_MS),
    [],
  )

  useEffect(() => {
    if (note && loadedId.current !== note.id) {
      loadedId.current = note.id
      setTitle(note.title)
      setContent(note.content)
    }
  }, [note])

  // Flush the pending autosave when leaving the page.
  useEffect(() => () => save.flush(), [save])

  const onChangeTitle = useCallback(
    (value: string) => {
      setTitle(value)
      if (noteId) save(noteId, { title: value, content })
    },
    [noteId, content, save],
  )

  const onChangeContent = useCallback(
    (value: string) => {
      setContent(value)
      if (noteId) save(noteId, { title, content: value })
    },
    [noteId, title, save],
  )

  if (!noteId) return null
  if (note === undefined) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (note === null || note.deletedAt) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        This note is not available.
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/notes')}>
            Back to notes
          </Button>
        </div>
      </div>
    )
  }

  const tagIds = [...(noteTagIds?.get(note.id) ?? [])]

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3 p-4">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Button>
        <span className="text-xs text-muted-foreground">
          Edited {formatRelative(note.updatedAt)}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
            aria-label={mode === 'edit' ? 'Preview' : 'Edit'}
          >
            {mode === 'edit' ? (
              <Eye className="h-4 w-4" aria-hidden />
            ) : (
              <Pencil className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void updateNote(note.id, { pinned: !note.pinned })}
            aria-label={note.pinned ? 'Unpin' : 'Pin'}
          >
            {note.pinned ? (
              <PinOff className="h-4 w-4" aria-hidden />
            ) : (
              <Pin className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void updateNote(note.id, { archived: !note.archived })}
            aria-label={note.archived ? 'Unarchive' : 'Archive'}
          >
            {note.archived ? (
              <ArchiveRestore className="h-4 w-4" aria-hidden />
            ) : (
              <Archive className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => {
              save.cancel()
              void deleteNoteWithUndo(note.id, note.title)
              navigate('/notes')
            }}
            aria-label="Delete note"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => onChangeTitle(e.target.value)}
        placeholder="Note title"
        aria-label="Note title"
        className="border-none bg-transparent px-1 text-lg font-semibold"
      />

      {mode === 'edit' ? (
        <Textarea
          value={content}
          onChange={(e) => onChangeContent(e.target.value)}
          placeholder="Write in Markdown…"
          aria-label="Note content"
          className="min-h-[40dvh] flex-1 resize-none font-mono text-sm"
        />
      ) : (
        <div className="min-h-[40dvh] flex-1 overflow-y-auto rounded-md border border-border bg-card p-4">
          {content ? (
            <Markdown>{content}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview.</p>
          )}
        </div>
      )}

      <ChecklistEditor noteId={note.id} />

      <div className="pb-2">
        <TagPicker
          selectedIds={tagIds}
          onChange={(ids) => void setNoteTags(note.id, userId, ids)}
        />
      </div>
    </div>
  )
}
