import { toast } from 'sonner'
import { restoreNote, softDeleteNote } from '@/db/repo/notes'

export async function deleteNoteWithUndo(id: string, title: string): Promise<void> {
  await softDeleteNote(id)
  toast('Note deleted', {
    description: title || 'Untitled note',
    action: { label: 'Undo', onClick: () => void restoreNote(id) },
  })
}
