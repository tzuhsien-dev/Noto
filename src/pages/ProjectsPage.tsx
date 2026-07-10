import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Archive, Folder, Pencil, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageContainer, PageHeader } from '@/components/PageHeader'
import { openCountByProject, projectTasks, sortTasks } from '@/domain/filters'
import { createProject, updateProject } from '@/db/repo/projects'
import { useProjects, useTasks } from '@/features/data/hooks'
import { useUserId } from '@/features/auth/AuthProvider'
import { QuickAdd } from '@/features/tasks/QuickAdd'
import { TaskList } from '@/features/tasks/TaskList'
import type { Project } from '@/domain/types'

function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project
}) {
  const userId = useUserId()
  const [name, setName] = useState(project?.name ?? '')

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (project) await updateProject(project.id, { name: trimmed })
    else await createProject({ userId, name: trimmed })
    onOpenChange(false)
    setName(project ? trimmed : '')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{project ? 'Rename project' : 'New project'}</DialogTitle>
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
            placeholder="Project name"
            aria-label="Project name"
          />
          <Button type="submit" disabled={!name.trim()}>
            {project ? 'Save' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ProjectsPage() {
  const projects = (useProjects() ?? []).filter((p) => !p.archived)
  const tasks = useTasks() ?? []
  const counts = openCountByProject(tasks)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New project
          </Button>
        }
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No projects"
          description="Group related tasks into projects."
        />
      ) : (
        <ul className="space-y-1">
          {projects.map((project) => (
            <li
              key={project.id}
              className="group flex items-center gap-2 rounded-md border border-border px-3 py-2"
            >
              <Link to={`/projects/${project.id}`} className="min-w-0 flex-1 truncate text-sm">
                {project.name}
              </Link>
              {counts.get(project.id) ? <Badge>{counts.get(project.id)} open</Badge> : null}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditing(project)}
                aria-label={`Rename ${project.name}`}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void updateProject(project.id, { archived: true })}
                aria-label={`Archive ${project.name}`}
              >
                <Archive className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editing ? (
        <ProjectFormDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          project={editing}
        />
      ) : null}
    </PageContainer>
  )
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const projects = useProjects()
  const tasks = useTasks()
  const project = projects?.find((p) => p.id === projectId)

  if (projects && !project) {
    return (
      <PageContainer>
        <EmptyState icon={Folder} title="Project not found" />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader title={project?.name ?? '…'} />
      <QuickAdd projectId={projectId ?? null} />
      <TaskList
        tasks={tasks && projectId ? sortTasks(projectTasks(tasks, projectId)) : undefined}
        emptyTitle="No open tasks in this project"
      />
    </PageContainer>
  )
}
