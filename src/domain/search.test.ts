import { describe, expect, it } from 'vitest'
import { defaultSearchFilters, search, type SearchInput } from './search'
import type { Note, Project, Tag, Task } from './types'

const USER = '00000000-0000-4000-8000-0000000000aa'
const NOW = new Date(2026, 6, 10).toISOString()

function task(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    userId: USER,
    title: '',
    description: null,
    completed: false,
    priority: 'none',
    dueAt: null,
    startAt: null,
    projectId: null,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    deletedAt: null,
    version: 1,
    ...overrides,
  }
}

function note(overrides: Partial<Note>): Note {
  return {
    id: crypto.randomUUID(),
    userId: USER,
    title: '',
    content: '',
    pinned: false,
    archived: false,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    version: 1,
    ...overrides,
  }
}

function makeInput(partial: Partial<SearchInput>): SearchInput {
  return {
    tasks: [],
    notes: [],
    projects: [],
    tags: [],
    taskTagIds: new Map(),
    noteTagIds: new Map(),
    ...partial,
  }
}

describe('search', () => {
  it('returns nothing for an empty query', () => {
    const input = makeInput({ tasks: [task({ title: 'buy milk' })] })
    expect(search(input, '  ', defaultSearchFilters)).toEqual([])
  })

  it('matches task title and description case-insensitively', () => {
    const byTitle = task({ title: 'Buy Milk' })
    const byDesc = task({ title: 'other', description: 'skim MILK please' })
    const miss = task({ title: 'unrelated' })
    const results = search(
      makeInput({ tasks: [byTitle, byDesc, miss] }),
      'milk',
      defaultSearchFilters,
    )
    expect(results).toHaveLength(2)
  })

  it('excludes soft-deleted tasks and notes', () => {
    const input = makeInput({
      tasks: [task({ title: 'milk', deletedAt: NOW })],
      notes: [note({ title: 'milk note', deletedAt: NOW })],
    })
    expect(search(input, 'milk', defaultSearchFilters)).toEqual([])
  })

  it('matches note content, project and tag names', () => {
    const project: Project = {
      id: crypto.randomUUID(),
      userId: USER,
      name: 'Milk Run',
      icon: null,
      position: 0,
      archived: false,
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    }
    const tag: Tag = {
      id: crypto.randomUUID(),
      userId: USER,
      name: 'milky',
      createdAt: NOW,
      updatedAt: NOW,
      version: 1,
    }
    const input = makeInput({
      notes: [note({ content: '# Shopping\nmilk and eggs' })],
      projects: [project],
      tags: [tag],
    })
    const kinds = search(input, 'milk', defaultSearchFilters).map((r) => r.kind)
    expect(kinds.sort()).toEqual(['note', 'project', 'tag'])
  })

  it('applies type, completed, project and tag filters', () => {
    const projectId = crypto.randomUUID()
    const tagId = crypto.randomUUID()
    const open = task({ title: 'milk open' })
    const done = task({ title: 'milk done', completed: true })
    const inProject = task({ title: 'milk project', projectId })
    const tagged = task({ title: 'milk tagged' })
    const taggedNote = note({ title: 'milk note tagged' })
    const plainNote = note({ title: 'milk note' })
    const input = makeInput({
      tasks: [open, done, inProject, tagged],
      notes: [taggedNote, plainNote],
      taskTagIds: new Map([[tagged.id, new Set([tagId])]]),
      noteTagIds: new Map([[taggedNote.id, new Set([tagId])]]),
    })

    expect(search(input, 'milk', { ...defaultSearchFilters, type: 'note' })).toHaveLength(2)
    expect(search(input, 'milk', { ...defaultSearchFilters, completed: true })).toHaveLength(1)
    expect(search(input, 'milk', { ...defaultSearchFilters, projectId })).toHaveLength(1)
    const byTag = search(input, 'milk', { ...defaultSearchFilters, tagId })
    expect(byTag.map((r) => r.kind).sort()).toEqual(['note', 'task'])
  })
})
