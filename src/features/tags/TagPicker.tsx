import { useState } from 'react'
import { Plus, Tag as TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { createTag } from '@/db/repo/tags'
import { useTags } from '@/features/data/hooks'
import { useUserId } from '@/features/auth/AuthProvider'
import type { Tag } from '@/domain/types'

type TagPickerProps = {
  selectedIds: string[]
  onChange: (tagIds: string[]) => void
}

/** Multi-select tag menu with inline tag creation. */
export function TagPicker({ selectedIds, onChange }: TagPickerProps) {
  const tags = useTags() ?? []
  const userId = useUserId()
  const [newName, setNewName] = useState('')

  const toggle = (tag: Tag) => {
    onChange(
      selectedIds.includes(tag.id)
        ? selectedIds.filter((id) => id !== tag.id)
        : [...selectedIds, tag.id],
    )
  }

  const addTag = async () => {
    const name = newName.trim()
    if (!name) return
    const tag = await createTag({ userId, name })
    setNewName('')
    if (!selectedIds.includes(tag.id)) onChange([...selectedIds, tag.id])
  }

  const selected = tags.filter((t) => selectedIds.includes(t.id))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Edit tags">
          <TagIcon className="h-3.5 w-3.5" aria-hidden />
          {selected.length ? (
            <span className="flex flex-wrap gap-1">
              {selected.map((t) => (
                <Badge key={t.id} variant="default">
                  {t.name}
                </Badge>
              ))}
            </span>
          ) : (
            'Tags'
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-2">
        {tags.length ? (
          <div className="max-h-48 space-y-1 overflow-y-auto" role="group" aria-label="Tags">
            {tags.map((tag) => (
              <label
                key={tag.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selectedIds.includes(tag.id)}
                  onChange={() => toggle(tag)}
                />
                {tag.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="px-2 py-1 text-sm text-muted-foreground">No tags yet</p>
        )}
        <DropdownMenuSeparator />
        <form
          className="flex gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            void addTag()
          }}
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New tag"
            aria-label="New tag name"
            className="h-8"
            onKeyDown={(e) => e.stopPropagation()}
          />
          <Button type="submit" size="sm" variant="secondary" aria-label="Create tag">
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
