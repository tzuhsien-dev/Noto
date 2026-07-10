import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Folder, ListChecks, SearchIcon, Tag as TagIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input, NativeSelect } from '@/components/ui/input'
import {
  defaultSearchFilters,
  search,
  type SearchFilters,
  type SearchResult,
} from '@/domain/search'
import {
  useNotes,
  useNoteTagIds,
  useProjects,
  useTags,
  useTasks,
  useTaskTagIds,
} from '@/features/data/hooks'
import { useUiState } from '@/app/ui-state'

const DEBOUNCE_MS = 200

export function SearchDialog() {
  const { searchOpen, setSearchOpen } = useUiState()
  const navigate = useNavigate()
  const tasks = useTasks()
  const notes = useNotes()
  const projects = useProjects()
  const tags = useTags()
  const taskTagIds = useTaskTagIds()
  const noteTagIds = useNoteTagIds()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filters, setFilters] = useState<SearchFilters>(defaultSearchFilters)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!searchOpen) {
      setQuery('')
      setDebouncedQuery('')
      setFilters(defaultSearchFilters)
    }
  }, [searchOpen])

  const results = useMemo(
    () =>
      search(
        {
          tasks: tasks ?? [],
          notes: notes ?? [],
          projects: projects ?? [],
          tags: tags ?? [],
          taskTagIds: taskTagIds ?? new Map(),
          noteTagIds: noteTagIds ?? new Map(),
        },
        debouncedQuery,
        filters,
      ).slice(0, 50),
    [tasks, notes, projects, tags, taskTagIds, noteTagIds, debouncedQuery, filters],
  )

  const open = (result: SearchResult) => {
    setSearchOpen(false)
    switch (result.kind) {
      case 'task':
        navigate(result.task.completed ? '/completed' : '/all')
        break
      case 'note':
        navigate(`/notes/${result.note.id}`)
        break
      case 'project':
        navigate(`/projects/${result.project.id}`)
        break
      case 'tag':
        navigate(`/tags/${result.tag.id}`)
        break
    }
  }

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="top-[15%] translate-y-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="relative pr-8">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            autoFocus
            role="searchbox"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, notes, projects, tags…"
            aria-label="Search"
            className="pl-9"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <NativeSelect
            aria-label="Type filter"
            className="h-8 text-xs"
            value={filters.type}
            onChange={(e) =>
              setFilters({ ...filters, type: e.target.value as SearchFilters['type'] })
            }
          >
            <option value="all">All types</option>
            <option value="task">Tasks</option>
            <option value="note">Notes</option>
          </NativeSelect>
          <NativeSelect
            aria-label="Status filter"
            className="h-8 text-xs"
            value={filters.completed === null ? 'any' : filters.completed ? 'done' : 'open'}
            onChange={(e) =>
              setFilters({
                ...filters,
                completed: e.target.value === 'any' ? null : e.target.value === 'done',
              })
            }
          >
            <option value="any">Any status</option>
            <option value="open">Open</option>
            <option value="done">Completed</option>
          </NativeSelect>
          <NativeSelect
            aria-label="Project filter"
            className="h-8 text-xs"
            value={filters.projectId ?? ''}
            onChange={(e) => setFilters({ ...filters, projectId: e.target.value || null })}
          >
            <option value="">Any project</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Tag filter"
            className="h-8 text-xs"
            value={filters.tagId ?? ''}
            onChange={(e) => setFilters({ ...filters, tagId: e.target.value || null })}
          >
            <option value="">Any tag</option>
            {(tags ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <ul className="mt-3 max-h-[45dvh] space-y-0.5 overflow-y-auto" aria-label="Search results">
          {debouncedQuery.trim() && results.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-muted-foreground">No results</li>
          ) : null}
          {results.map((result) => {
            const key =
              result.kind === 'task'
                ? result.task.id
                : result.kind === 'note'
                  ? result.note.id
                  : result.kind === 'project'
                    ? result.project.id
                    : result.tag.id
            const label =
              result.kind === 'task'
                ? result.task.title
                : result.kind === 'note'
                  ? result.note.title || 'Untitled note'
                  : result.kind === 'project'
                    ? result.project.name
                    : result.tag.name
            const Icon =
              result.kind === 'task'
                ? ListChecks
                : result.kind === 'note'
                  ? FileText
                  : result.kind === 'project'
                    ? Folder
                    : TagIcon
            return (
              <li key={`${result.kind}-${key}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => open(result)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{label}</span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize">
                    {result.kind}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
