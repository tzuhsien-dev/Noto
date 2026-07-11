import { isOpen, sortTasks } from './filters'
import type { Area, Project, Task } from './types'

export type ProjectGroup = { project: Project; tasks: Task[] }

export type AreaSection = {
  /** area.id for real areas, or '__other__' for the no-area bucket. */
  key: string
  label: string
  projects: ProjectGroup[]
}

export type AllTasksGroups = {
  /** Real areas in position order, followed by the "Other" (no-area) bucket. */
  areas: AreaSection[]
  /** Open tasks with no resolvable (visible) project. */
  noProject: Task[]
}

export const OTHER_SECTION_KEY = '__other__'

/**
 * Group open tasks by area → project for the All Tasks view. Mirrors the
 * sidebar's grouping (see AppLayout): archived projects are hidden, projects
 * pointing at a not-yet-synced area fall into the "Other" bucket, and empty
 * areas/projects are omitted. Every open task appears exactly once — tasks
 * whose project is archived/unsynced (or absent) land in `noProject`.
 *
 * `projects` and `areas` are expected pre-sorted by position (useProjects/useAreas).
 */
export function groupTasksByAreaProject(
  tasks: Task[],
  projects: Project[],
  areas: Area[],
): AllTasksGroups {
  const visibleProjects = projects.filter((p) => !p.archived)
  const areaIds = new Set(areas.map((a) => a.id))
  const visibleIds = new Set(visibleProjects.map((p) => p.id))

  const byProject = new Map<string, Task[]>()
  const noProject: Task[] = []
  for (const task of tasks) {
    if (!isOpen(task)) continue
    if (task.projectId && visibleIds.has(task.projectId)) {
      const bucket = byProject.get(task.projectId)
      if (bucket) bucket.push(task)
      else byProject.set(task.projectId, [task])
    } else {
      noProject.push(task)
    }
  }

  const projectGroup = (project: Project): ProjectGroup | null => {
    const projectTasks = byProject.get(project.id)
    if (!projectTasks || projectTasks.length === 0) return null
    return { project, tasks: sortTasks(projectTasks) }
  }

  const sections: AreaSection[] = []
  for (const area of areas) {
    const groups = visibleProjects
      .filter((p) => p.areaId === area.id)
      .map(projectGroup)
      .filter((g): g is ProjectGroup => g !== null)
    if (groups.length > 0) {
      sections.push({ key: area.id, label: area.name, projects: groups })
    }
  }

  const otherGroups = visibleProjects
    .filter((p) => !p.areaId || !areaIds.has(p.areaId))
    .map(projectGroup)
    .filter((g): g is ProjectGroup => g !== null)
  if (otherGroups.length > 0) {
    sections.push({ key: OTHER_SECTION_KEY, label: 'Other', projects: otherGroups })
  }

  return { areas: sections, noProject: sortTasks(noProject) }
}
