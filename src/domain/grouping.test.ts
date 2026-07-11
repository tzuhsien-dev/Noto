import { describe, expect, it } from 'vitest'
import { OTHER_SECTION_KEY, groupTasksByAreaProject } from './grouping'
import type { Area, Project, Task } from './types'

const NOW = new Date(2026, 6, 10, 12, 0, 0)

let counter = 0
function task(overrides: Partial<Task>): Task {
  counter += 1
  return {
    id: crypto.randomUUID(),
    userId: '00000000-0000-4000-8000-0000000000aa',
    title: `Task ${counter}`,
    description: null,
    completed: false,
    priority: 'none',
    dueAt: null,
    startAt: null,
    projectId: null,
    createdAt: new Date(2026, 0, 1, 0, 0, counter).toISOString(),
    updatedAt: NOW.toISOString(),
    completedAt: null,
    deletedAt: null,
    version: 1,
    ...overrides,
  }
}

function project(overrides: Partial<Project> & { id: string }): Project {
  return {
    userId: '00000000-0000-4000-8000-0000000000aa',
    name: `Project ${overrides.id}`,
    icon: null,
    position: 0,
    areaId: null,
    archived: false,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    version: 1,
    ...overrides,
  }
}

function area(overrides: Partial<Area> & { id: string }): Area {
  return {
    userId: '00000000-0000-4000-8000-0000000000aa',
    name: `Area ${overrides.id}`,
    position: 0,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    version: 1,
    ...overrides,
  }
}

describe('groupTasksByAreaProject', () => {
  it('nests projects under areas, ordered by the given (position) order', () => {
    const work = area({ id: 'work', name: 'Work', position: 0 })
    const life = area({ id: 'life', name: 'Life', position: 1 })
    const pg = project({ id: 'pg', name: 'Pixel Gazer', areaId: 'work', position: 0 })
    const rgd = project({ id: 'rgd', name: 'RGD Layer', areaId: 'work', position: 1 })
    const gym = project({ id: 'gym', name: 'Gym', areaId: 'life', position: 0 })
    const t1 = task({ projectId: 'pg' })
    const t2 = task({ projectId: 'rgd' })
    const t3 = task({ projectId: 'gym' })

    const result = groupTasksByAreaProject([t1, t2, t3], [pg, rgd, gym], [work, life])

    expect(result).toEqual({
      areas: [
        {
          key: 'work',
          label: 'Work',
          projects: [
            { project: pg, tasks: [t1] },
            { project: rgd, tasks: [t2] },
          ],
        },
        { key: 'life', label: 'Life', projects: [{ project: gym, tasks: [t3] }] },
      ],
      noProject: [],
    })
  })

  it('omits empty projects and empty areas', () => {
    const work = area({ id: 'work', name: 'Work' })
    const empty = area({ id: 'empty', name: 'Empty' })
    const pg = project({ id: 'pg', areaId: 'work' })
    const emptyProject = project({ id: 'ep', areaId: 'work' })
    const t1 = task({ projectId: 'pg' })

    const result = groupTasksByAreaProject([t1], [pg, emptyProject], [work, empty])

    expect(result.areas).toEqual([
      { key: 'work', label: 'Work', projects: [{ project: pg, tasks: [t1] }] },
    ])
  })

  it('puts no-area projects into the Other bucket after real areas', () => {
    const work = area({ id: 'work', name: 'Work' })
    const pg = project({ id: 'pg', areaId: 'work' })
    const loose = project({ id: 'loose', name: 'Loose', areaId: null })
    const t1 = task({ projectId: 'pg' })
    const t2 = task({ projectId: 'loose' })

    const result = groupTasksByAreaProject([t1, t2], [pg, loose], [work])

    expect(result.areas).toEqual([
      { key: 'work', label: 'Work', projects: [{ project: pg, tasks: [t1] }] },
      { key: OTHER_SECTION_KEY, label: 'Other', projects: [{ project: loose, tasks: [t2] }] },
    ])
  })

  it('treats a project pointing at an unsynced area as Other', () => {
    const orphan = project({ id: 'orphan', areaId: 'not-synced-yet' })
    const t1 = task({ projectId: 'orphan' })

    const result = groupTasksByAreaProject([t1], [orphan], [])

    expect(result.areas).toEqual([
      { key: OTHER_SECTION_KEY, label: 'Other', projects: [{ project: orphan, tasks: [t1] }] },
    ])
  })

  it('collects tasks with no project into noProject', () => {
    const loose = task({ projectId: null })
    const result = groupTasksByAreaProject([loose], [], [])
    expect(result).toEqual({ areas: [], noProject: [loose] })
  })

  it('routes tasks of archived/unsynced projects to noProject (completeness)', () => {
    const archived = project({ id: 'arch', archived: true })
    const t1 = task({ projectId: 'arch' })
    const t2 = task({ projectId: 'ghost-project-id' })

    const result = groupTasksByAreaProject([t1, t2], [archived], [])

    expect(result).toEqual({ areas: [], noProject: [t1, t2] })
  })

  it('sorts tasks within a project by sortTasks (due date first)', () => {
    const pg = project({ id: 'pg', areaId: 'work' })
    const work = area({ id: 'work', name: 'Work' })
    const later = task({ projectId: 'pg', dueAt: new Date(2026, 6, 15).toISOString() })
    const sooner = task({ projectId: 'pg', dueAt: new Date(2026, 6, 11).toISOString() })

    const result = groupTasksByAreaProject([later, sooner], [pg], [work])

    expect(result.areas).toEqual([
      { key: 'work', label: 'Work', projects: [{ project: pg, tasks: [sooner, later] }] },
    ])
  })

  it('excludes completed and deleted tasks', () => {
    const pg = project({ id: 'pg' })
    const done = task({ projectId: 'pg', completed: true })
    const deleted = task({ projectId: 'pg', deletedAt: NOW.toISOString() })
    const loose = task({ completed: true })

    const result = groupTasksByAreaProject([done, deleted, loose], [pg], [])

    expect(result).toEqual({ areas: [], noProject: [] })
  })
})
