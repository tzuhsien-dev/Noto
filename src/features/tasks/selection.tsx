import { useState } from 'react'
import { CheckSquare, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setTasksCompleted } from '@/db/repo/tasks'
import { deleteTasksWithUndo } from './task-actions'

/**
 * Shared bulk-selection state and actions for task lists. Owning this in one
 * place lets both the flat TaskList and the grouped All Tasks view drive a
 * single selection toolbar spanning all their rows.
 */
export function useTaskSelection() {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const completeSelected = () => {
    void setTasksCompleted([...selectedIds], true)
    exitSelection()
  }

  const deleteSelected = () => {
    void deleteTasksWithUndo([...selectedIds])
    exitSelection()
  }

  return {
    selectionMode,
    selectedIds,
    count: selectedIds.size,
    toggleSelected,
    enterSelection: () => setSelectionMode(true),
    exitSelection,
    completeSelected,
    deleteSelected,
  }
}

export type TaskSelection = ReturnType<typeof useTaskSelection>

export function SelectionToolbar({ selection }: { selection: TaskSelection }) {
  return (
    <div className="mb-2 flex min-h-9 items-center justify-end gap-2">
      {selection.selectionMode ? (
        <>
          <span className="mr-auto text-sm text-muted-foreground">{selection.count} selected</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={!selection.count}
            onClick={selection.completeSelected}
          >
            <CheckSquare className="h-4 w-4" aria-hidden /> Complete
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!selection.count}
            onClick={selection.deleteSelected}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={selection.exitSelection}
            aria-label="Cancel selection"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={selection.enterSelection}>
          Select
        </Button>
      )}
    </div>
  )
}
