import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { createTask } from '@/db/repo/tasks'
import { useUserId } from '@/features/auth/AuthProvider'

type QuickAddProps = {
  projectId?: string | null
  /** Due date applied to tasks created from this view (e.g. Today). */
  defaultDueAt?: string | null
  placeholder?: string
}

/** Inline one-field task entry at the top of task lists. */
export function QuickAdd({ projectId = null, defaultDueAt = null, placeholder }: QuickAddProps) {
  const userId = useUserId()
  const [title, setTitle] = useState('')

  const submit = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    await createTask({ userId, title: trimmed, projectId, dueAt: defaultDueAt })
    setTitle('')
  }

  return (
    <form
      className="relative mb-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <Plus
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder ?? 'Add a task…'}
        aria-label="Add a task"
        className="pl-9"
        data-quick-add
      />
    </form>
  )
}
