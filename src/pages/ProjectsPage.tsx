import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Archive, Folder, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, NativeSelect } from '@/components/ui/input'
import { PageContainer, PageHeader } from '@/components/PageHeader'
import { openCountByProject, projectTasks, sortTasks } from '@/domain/filters'
import { toast } from 'sonner'
import { createArea, deleteArea, updateArea } from '@/db/repo/areas'
import { createProject, deleteProject, updateProject } from '@/db/repo/projects'
import { useAreas, useProjects, useTasks } from '@/features/data/hooks'
import { useUserId } from '@/features/auth/AuthProvider'
import { QuickAdd } from '@/features/tasks/QuickAdd'
import { TaskList } from '@/features/tasks/TaskList'
import type { Area, Project } from '@/domain/types'

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
  const areas = useAreas() ?? []
  const [name, setName] = useState(project?.name ?? '')
  const [areaId, setAreaId] = useState(project?.areaId ?? '')

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (project) await updateProject(project.id, { name: trimmed, areaId: areaId || null })
    else await createProject({ userId, name: trimmed, areaId: areaId || null })
    onOpenChange(false)
    setName(project ? trimmed : '')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{project ? 'Edit project' : 'New project'}</DialogTitle>
        <form
          className="mt-3 space-y-3"
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
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Area</span>
            <NativeSelect
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              aria-label="Area"
            >
              <option value="">No area</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <div className="flex justify-end">
            <Button type="submit" disabled={!name.trim()}>
              {project ? 'Save' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AreaFormDialog({
  open,
  onOpenChange,
  area,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  area?: Area
}) {
  const userId = useUserId()
  const [name, setName] = useState(area?.name ?? '')

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (area) await updateArea(area.id, { name: trimmed })
    else await createArea({ userId, name: trimmed })
    onOpenChange(false)
    setName(area ? trimmed : '')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>{area ? 'Rename area' : 'New area'}</DialogTitle>
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
            placeholder="Area name (e.g. Work)"
            aria-label="Area name"
          />
          <Button type="submit" disabled={!name.trim()}>
            {area ? 'Save' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProjectRow({
  project,
  count,
  onEdit,
  onDelete,
}: {
  project: Project
  count: number | undefined
  onEdit: (project: Project) => void
  onDelete: (project: Project) => void
}) {
  return (
    <li className="group flex items-center gap-2 rounded-md border border-border px-3 py-2">
      <Link to={`/projects/${project.id}`} className="min-w-0 flex-1 truncate text-sm">
        {project.name}
      </Link>
      {count ? <Badge>{count} open</Badge> : null}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onEdit(project)}
        aria-label={`Edit ${project.name}`}
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
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => onDelete(project)}
        aria-label={`Delete ${project.name}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
    </li>
  )
}

/** Shared confirm for deleting a project (its tasks move to Trash). */
export function DeleteProjectDialog({
  project,
  onOpenChange,
}: {
  project: Project | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <ConfirmDialog
      open={project !== null}
      onOpenChange={onOpenChange}
      title={`Delete ${project?.name ?? 'project'}?`}
      description="Its tasks move to Trash, where they can be restored (to Inbox)."
      confirmLabel="Delete project"
      onConfirm={() => {
        if (project) {
          void deleteProject(project.id).then((trashed) => {
            toast.success(
              trashed > 0
                ? `Project deleted — ${trashed} task${trashed === 1 ? '' : 's'} moved to Trash`
                : 'Project deleted',
            )
          })
        }
        onOpenChange(false)
      }}
    />
  )
}

export function ProjectsPage() {
  const areas = useAreas() ?? []
  const projects = (useProjects() ?? []).filter((p) => !p.archived)
  const tasks = useTasks() ?? []
  const counts = openCountByProject(tasks)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [areaCreateOpen, setAreaCreateOpen] = useState(false)
  const [areaEditing, setAreaEditing] = useState<Area | null>(null)
  const [areaDeleting, setAreaDeleting] = useState<Area | null>(null)

  const areaIds = new Set(areas.map((a) => a.id))
  const ungrouped = projects.filter((p) => !p.areaId || !areaIds.has(p.areaId))

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setAreaCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New area
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New project
            </Button>
          </div>
        }
      />
      {projects.length === 0 && areas.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No projects"
          description="Group related tasks into projects, and projects into areas like Work or Life."
        />
      ) : (
        <div className="space-y-5">
          {areas.map((area) => (
            <section key={area.id}>
              <div className="mb-1.5 flex items-center gap-1">
                <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {area.name}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setAreaEditing(area)}
                  aria-label={`Rename ${area.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setAreaDeleting(area)}
                  aria-label={`Delete ${area.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
              <ul className="space-y-1">
                {projects
                  .filter((p) => p.areaId === area.id)
                  .map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      count={counts.get(project.id)}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                    />
                  ))}
              </ul>
              {projects.some((p) => p.areaId === area.id) ? null : (
                <p className="text-sm text-muted-foreground">No projects in this area yet.</p>
              )}
            </section>
          ))}
          {ungrouped.length > 0 ? (
            <section>
              {areas.length > 0 ? (
                <h2 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  No area
                </h2>
              ) : null}
              <ul className="space-y-1">
                {ungrouped.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    count={counts.get(project.id)}
                    onEdit={setEditing}
                    onDelete={setDeleting}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
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
      <DeleteProjectDialog project={deleting} onOpenChange={(open) => !open && setDeleting(null)} />
      <AreaFormDialog open={areaCreateOpen} onOpenChange={setAreaCreateOpen} />
      {areaEditing ? (
        <AreaFormDialog
          key={areaEditing.id}
          open
          onOpenChange={(open) => !open && setAreaEditing(null)}
          area={areaEditing}
        />
      ) : null}
      <ConfirmDialog
        open={areaDeleting !== null}
        onOpenChange={(open) => !open && setAreaDeleting(null)}
        title={`Delete ${areaDeleting?.name ?? 'area'}?`}
        description="Projects in this area are kept — they just become ungrouped."
        confirmLabel="Delete area"
        onConfirm={() => {
          if (areaDeleting) void deleteArea(areaDeleting.id)
          setAreaDeleting(null)
        }}
      />
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
