import { NavLink } from 'react-router-dom'
import { FileText, Inbox, Menu, Search, Star } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useUiState } from '@/app/ui-state'
import { cn } from '@/lib/utils'

const TAB_BASE = 'flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px]'

function TabLink({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(TAB_BASE, isActive ? 'text-primary' : 'text-muted-foreground')
      }
    >
      <Icon className="h-5 w-5" aria-hidden />
      {label}
    </NavLink>
  )
}

export function MobileTabBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { setSearchOpen } = useUiState()
  return (
    <nav
      aria-label="Primary"
      className="grid shrink-0 grid-cols-5 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <TabLink to="/today" label="Today" icon={Star} />
      <TabLink to="/inbox" label="Inbox" icon={Inbox} />
      <TabLink to="/notes" label="Notes" icon={FileText} />
      <button
        type="button"
        className={cn(TAB_BASE, 'text-muted-foreground')}
        onClick={() => setSearchOpen(true)}
      >
        <Search className="h-5 w-5" aria-hidden />
        Search
      </button>
      <button type="button" className={cn(TAB_BASE, 'text-muted-foreground')} onClick={onOpenMenu}>
        <Menu className="h-5 w-5" aria-hidden />
        Menu
      </button>
    </nav>
  )
}
