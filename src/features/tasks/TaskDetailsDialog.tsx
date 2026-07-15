import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { dateInputToIso, isoToDateInput } from '@/domain/dates'
import { taskFormSchema } from '@/domain/schemas'
import type { Task } from '@/domain/types'
import { setTaskCompleted, updateTask } from '@/db/repo/tasks'
import { setTaskTags } from '@/db/repo/tags'
import { useProjects, useTaskTagIds } from '@/features/data/hooks'
import { useUserId } from '@/features/auth/AuthProvider'
import { TagPicker } from '@/features/tags/TagPicker'
import { deleteTaskWithUndo } from './task-actions'

type FormValues = z.infer<typeof taskFormSchema>

type TaskDetailsDialogProps = {
  task: Task | null
  onClose: () => void
}

export function TaskDetailsDialog({ task, onClose }: TaskDetailsDialogProps) {
  const userId = useUserId()
  const projects = (useProjects() ?? []).filter((p) => !p.archived)
  const taskTagIds = useTaskTagIds()
  const [tagIds, setTagIds] = useState<string[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { title: '', description: '', priority: 'none', dueAt: null, projectId: null },
  })

  useEffect(() => {
    if (!task) return
    form.reset({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      dueAt: task.dueAt,
      projectId: task.projectId,
    })
    setTagIds([...(taskTagIds?.get(task.id) ?? [])])
    // taskTagIds is intentionally omitted: reset only when a different task opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  if (!task) return null

  const onSubmit = form.handleSubmit(async (values) => {
    await updateTask(task.id, {
      title: values.title,
      description: values.description.trim() ? values.description : null,
      priority: values.priority,
      dueAt: values.dueAt,
      projectId: values.projectId,
    })
    await setTaskTags(task.id, userId, tagIds)
    onClose()
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle className="sr-only">Edit task</DialogTitle>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex items-center gap-3 pr-8">
            <Checkbox
              checked={task.completed}
              onCheckedChange={(checked) => void setTaskCompleted(task.id, checked === true)}
              aria-label={task.completed ? 'Mark as not done' : 'Mark as done'}
            />
            <Input
              {...form.register('title')}
              aria-label="Task title"
              className="border-none bg-transparent text-base font-medium focus-visible:outline-none"
            />
          </div>
          {form.formState.errors.title ? (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.title.message}
            </p>
          ) : null}
          <Textarea
            {...form.register('description')}
            placeholder="Add a description…"
            aria-label="Task description"
            rows={4}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Due date</span>
              <Input
                type="date"
                value={isoToDateInput(form.watch('dueAt'))}
                onChange={(e) => form.setValue('dueAt', dateInputToIso(e.target.value))}
                aria-label="Due date"
              />
              <div className="mt-1.5 flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-xs"
                  onClick={() =>
                    form.setValue('dueAt', dateInputToIso(isoToDateInput(new Date().toISOString())))
                  }
                >
                  Today
                </Button>
                {form.watch('dueAt') ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 text-xs text-muted-foreground"
                    onClick={() => form.setValue('dueAt', null)}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Priority</span>
              <NativeSelect {...form.register('priority')} aria-label="Priority">
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </NativeSelect>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted-foreground">Project</span>
              <NativeSelect
                value={form.watch('projectId') ?? ''}
                onChange={(e) => form.setValue('projectId', e.target.value || null)}
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
          <TagPicker selectedIds={tagIds} onChange={setTagIds} />
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => {
                void deleteTaskWithUndo(task.id, task.title)
                onClose()
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
