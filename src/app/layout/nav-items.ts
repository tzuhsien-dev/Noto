import {
  Archive,
  CalendarDays,
  CheckCircle2,
  FileText,
  Flag,
  Folder,
  Inbox,
  Layers,
  Pin,
  Settings,
  Star,
  Tag,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

export const TASK_NAV: NavItem[] = [
  { to: '/today', label: 'Today', icon: Star },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/upcoming', label: 'Upcoming', icon: CalendarDays },
  { to: '/priority', label: 'Priority', icon: Flag },
  { to: '/all', label: 'All Tasks', icon: Layers },
  { to: '/completed', label: 'Completed', icon: CheckCircle2 },
]

export const NOTE_NAV: NavItem[] = [
  { to: '/notes', label: 'Notes', icon: FileText },
  { to: '/notes/pinned', label: 'Pinned', icon: Pin },
]

export const ORG_NAV: NavItem[] = [
  { to: '/projects', label: 'Projects', icon: Folder },
  { to: '/tags', label: 'Tags', icon: Tag },
  { to: '/archive', label: 'Archive', icon: Archive },
  { to: '/trash', label: 'Trash', icon: Trash2 },
  { to: '/settings', label: 'Settings', icon: Settings },
]
