import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Menu, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createNote } from '@/db/repo/notes'
import { openCountByProject } from '@/domain/filters'
import { useAreas, useProjects, useTasks } from '@/features/data/hooks'
import { useUserId } from '@/features/auth/AuthProvider'
import { NewTaskDialog } from '@/features/tasks/NewTaskDialog'
import { SearchDialog } from '@/features/search/SearchDialog'
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useUiState } from '@/app/ui-state'
import { startSyncEngine, stopSyncEngine } from '@/sync/engine'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'
import { MobileTabBar } from './MobileTabBar'
import { NOTE_NAV, ORG_NAV, TASK_NAV, type NavItem } from './nav-items'
import { SyncStatusChip } from './SyncStatusChip'

function NavLinkItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/notes'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm',
          isActive ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-accent/60',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      {item.label}
    </NavLink>
  )
}

function ProjectLink({
  project,
  count,
  onNavigate,
}: {
  project: { id: string; name: string }
  count: number | undefined
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={`/projects/${project.id}`}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm',
          isActive ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-accent/60',
        )
      }
    >
      <span className="min-w-0 truncate">{project.name}</span>
      {count ? <Badge className="ml-auto">{count}</Badge> : null}
    </NavLink>
  )
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const areas = useAreas() ?? []
  const projects = (useProjects() ?? []).filter((p) => !p.archived)
  const tasks = useTasks() ?? []
  const counts = openCountByProject(tasks)
  const areaIds = new Set(areas.map((a) => a.id))
  const grouped = areas
    .map((area) => ({ area, projects: projects.filter((p) => p.areaId === area.id) }))
    .filter((group) => group.projects.length > 0)
  // Projects without an area (or pointing at one not yet synced) stay flat.
  const ungrouped = projects.filter((p) => !p.areaId || !areaIds.has(p.areaId))

  const navProps = onNavigate === undefined ? {} : { onNavigate }
  return (
    <nav className="flex flex-col gap-4 p-3" aria-label="Main navigation">
      <div className="space-y-0.5">
        {TASK_NAV.map((item) => (
          <NavLinkItem key={item.to} item={item} {...navProps} />
        ))}
      </div>
      <div className="space-y-0.5">
        <p className="px-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Notes
        </p>
        {NOTE_NAV.map((item) => (
          <NavLinkItem key={item.to} item={item} {...navProps} />
        ))}
      </div>
      {grouped.map(({ area, projects: areaProjects }) => (
        <div key={area.id} className="space-y-0.5">
          <p className="px-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {area.name}
          </p>
          {areaProjects.map((project) => (
            <ProjectLink
              key={project.id}
              project={project}
              count={counts.get(project.id)}
              {...navProps}
            />
          ))}
        </div>
      ))}
      {ungrouped.length > 0 ? (
        <div className="space-y-0.5">
          {grouped.length > 0 ? (
            <p className="px-2.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Other
            </p>
          ) : null}
          {ungrouped.map((project) => (
            <ProjectLink
              key={project.id}
              project={project}
              count={counts.get(project.id)}
              {...navProps}
            />
          ))}
        </div>
      ) : null}
      <div className="space-y-0.5">
        {ORG_NAV.map((item) => (
          <NavLinkItem key={item.to} item={item} {...navProps} />
        ))}
      </div>
    </nav>
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  )
}

export function AppLayout() {
  const { setNewTaskOpen, setSearchOpen } = useUiState()
  const navigate = useNavigate()
  const userId = useUserId()
  const { backend } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // One sync engine per signed-in session; StrictMode double-mounts are
  // handled by the cleanup stopping the previous instance.
  useEffect(() => {
    if (!backend) return undefined
    startSyncEngine(backend, userId)
    return stopSyncEngine
  }, [backend, userId])

  // Global shortcuts: N (task), Shift+N (note), / (search).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableTarget(event.target)) return
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        if (event.shiftKey) {
          void createNote({ userId }).then((note) => navigate(`/notes/${note.id}`))
        } else {
          setNewTaskOpen(true)
        }
      } else if (event.key === '/') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, setNewTaskOpen, setSearchOpen, userId])

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border md:block">
        <div className="flex items-center gap-2 px-4 pt-4">
          <span className="text-lg font-semibold">Noto</span>
        </div>
        <NavContent />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent aria-describedby={undefined}>
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="text-lg font-semibold">Noto</span>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close menu">
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </SheetClose>
          </div>
          <NavContent onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-3 pt-[env(safe-area-inset-top)] md:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </Button>
          <SyncStatusChip />
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-5 w-5" aria-hidden />
            </Button>
            <Button size="sm" onClick={() => setNewTaskOpen(true)} data-new-task>
              <Plus className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">New task</span>
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="min-h-0 flex-1 overflow-y-auto pb-4 md:pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <Outlet />
        </main>

        <MobileTabBar onOpenMenu={() => setDrawerOpen(true)} />
      </div>

      <NewTaskDialog />
      <SearchDialog />
    </div>
  )
}
