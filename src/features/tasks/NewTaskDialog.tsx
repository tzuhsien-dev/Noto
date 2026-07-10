import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { dateInputToIso } from '@/domain/dates'
import type { Priority } from '@/domain/types'
import { createTask } from '@/db/repo/tasks'
import { useProjects } from '@/features/data/hooks'
import { useUserId } from '@/features/auth/AuthProvider'
import { useUiState } from '@/app/ui-state'

type NewTaskDialogProps = {
  /** Preselected project for project-scoped views. */
  defaultProjectId?: string | null
}

/** Quick-add dialog opened by the “N” shortcut and add buttons. */
export function NewTaskDialog({ defaultProjectId = null }: NewTaskDialogProps) {
  const { newTaskOpen, setNewTaskOpen } = useUiState()
  const userId = useUserId()
  const projects = (useProjects() ?? []).filter((p) => !p.archived)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>('none')
  const [projectId, setProjectId] = useState<string | ''>(defaultProjectId ?? '')

  const close = () => {
    setNewTaskOpen(false)
    setTitle('')
    setDueDate('')
    setPriority('none')
    setProjectId(defaultProjectId ?? '')
  }

  const submit = async () => {
    const trimmed = title.trim()
    if (!trimmed) return
    await createTask({
      userId,
      title: trimmed,
      dueAt: dateInputToIso(dueDate),
      priority,
      projectId: projectId || null,
    })
    close()
  }

  return (
    <Dialog open={newTaskOpen} onOpenChange={(open) => (open ? setNewTaskOpen(true) : close())}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>New task</DialogTitle>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            aria-label="Task title"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Due date</span>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="Due date"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Priority</span>
              <NativeSelect
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                aria-label="Priority"
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </NativeSelect>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Project</span>
              <NativeSelect
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                aria-label="Project"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!title.trim()}>
              Add task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
