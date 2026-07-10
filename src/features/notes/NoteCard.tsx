import { Link } from 'react-router-dom'
import { Pin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatRelative } from '@/domain/dates'
import type { Note, Tag } from '@/domain/types'

type NoteCardProps = {
  note: Note
  tags?: Tag[]
}

export function NoteCard({ note, tags = [] }: NoteCardProps) {
  const preview = note.content.replace(/[#>*`[\]()-]/g, '').slice(0, 160)
  return (
    <Link
      to={`/notes/${note.id}`}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-medium">{note.title || 'Untitled note'}</h3>
        {note.pinned ? <Pin className="h-4 w-4 shrink-0 text-primary" aria-label="Pinned" /> : null}
      </div>
      {preview ? (
        <p className="mt-1 line-clamp-3 text-xs whitespace-pre-wrap text-muted-foreground">
          {preview}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag.id} variant="default">
            {tag.name}
          </Badge>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {formatRelative(note.updatedAt)}
        </span>
      </div>
    </Link>
  )
}
