import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { addChecklistItem, deleteChecklistItem, updateChecklistItem } from '@/db/repo/notes'
import { useChecklistItems } from '@/features/data/hooks'
import { useUserId } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'

export function ChecklistEditor({ noteId }: { noteId: string }) {
  const userId = useUserId()
  const items = useChecklistItems(noteId) ?? []
  const [newContent, setNewContent] = useState('')

  const add = async () => {
    const content = newContent.trim()
    if (!content) return
    await addChecklistItem({ noteId, userId, content })
    setNewContent('')
  }

  return (
    <section aria-label="Checklist" className="space-y-1">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Checklist
      </h2>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2">
            <Checkbox
              checked={item.completed}
              onCheckedChange={(checked) =>
                void updateChecklistItem(item.id, { completed: checked === true })
              }
              aria-label={`Toggle ${item.content}`}
            />
            <Input
              defaultValue={item.content}
              onBlur={(e) => {
                const content = e.target.value.trim()
                if (content && content !== item.content) {
                  void updateChecklistItem(item.id, { content })
                }
              }}
              aria-label="Checklist item"
              className={cn(
                'h-8 border-none bg-transparent px-1',
                item.completed && 'text-muted-foreground line-through',
              )}
            />
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => void deleteChecklistItem(item.id)}
              aria-label={`Delete ${item.content}`}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <Plus className="h-4 w-4 text-muted-foreground" aria-hidden />
        <Input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Add checklist item"
          aria-label="Add checklist item"
          className="h-8 border-none bg-transparent px-1"
        />
      </form>
    </section>
  )
}
