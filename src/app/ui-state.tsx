import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type UiState = {
  newTaskOpen: boolean
  setNewTaskOpen: (open: boolean) => void
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
}

const UiStateContext = createContext<UiState | null>(null)

export function UiStateProvider({ children }: { children: ReactNode }) {
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const value = useMemo(
    () => ({ newTaskOpen, setNewTaskOpen, searchOpen, setSearchOpen }),
    [newTaskOpen, searchOpen],
  )
  return <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>
}

export function useUiState(): UiState {
  const ctx = useContext(UiStateContext)
  if (!ctx) throw new Error('useUiState must be used within UiStateProvider')
  return ctx
}
