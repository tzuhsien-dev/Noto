import type { Note, Project, Tag, Task } from './types'

export type SearchTypeFilter = 'all' | 'task' | 'note'

export type SearchFilters = {
  type: SearchTypeFilter
  projectId: string | null
  tagId: string | null
  /** null = both, true = completed only, false = open only. */
  completed: boolean | null
}

export const defaultSearchFilters: SearchFilters = {
  type: 'all',
  projectId: null,
  tagId: null,
  completed: null,
}

export type SearchResult =
  | { kind: 'task'; task: Task }
  | { kind: 'note'; note: Note }
  | { kind: 'project'; project: Project }
  | { kind: 'tag'; tag: Tag }

export type SearchInput = {
  tasks: Task[]
  notes: Note[]
  projects: Project[]
  tags: Tag[]
  taskTagIds: Map<string, Set<string>>
  noteTagIds: Map<string, Set<string>>
}

function matches(query: string, ...fields: (string | null)[]): boolean {
  return fields.some((f) => f !== null && f.toLowerCase().includes(query))
}

export function search(
  input: SearchInput,
  rawQuery: string,
  filters: SearchFilters,
): SearchResult[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return []
  const results: SearchResult[] = []
  const hasEntityFilter =
    filters.projectId !== null || filters.tagId !== null || filters.completed !== null

  if (filters.type !== 'note') {
    for (const task of input.tasks) {
      if (task.deletedAt) continue
      if (filters.completed !== null && task.completed !== filters.completed) continue
      if (filters.projectId !== null && task.projectId !== filters.projectId) continue
      if (filters.tagId !== null && !input.taskTagIds.get(task.id)?.has(filters.tagId)) continue
      if (matches(query, task.title, task.description)) results.push({ kind: 'task', task })
    }
  }

  if (filters.type !== 'task') {
    for (const note of input.notes) {
      if (note.deletedAt) continue
      if (filters.projectId !== null || filters.completed !== null) continue
      if (filters.tagId !== null && !input.noteTagIds.get(note.id)?.has(filters.tagId)) continue
      if (matches(query, note.title, note.content)) results.push({ kind: 'note', note })
    }
  }

  if (filters.type === 'all' && !hasEntityFilter) {
    for (const project of input.projects) {
      if (matches(query, project.name)) results.push({ kind: 'project', project })
    }
    for (const tag of input.tags) {
      if (matches(query, tag.name)) results.push({ kind: 'tag', tag })
    }
  }

  return results
}
