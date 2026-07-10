import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/app/theme'
import { UiStateProvider } from '@/app/ui-state'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import { db } from '@/db/database'

/** Renders children only once the fake session is signed in. */
function AuthGate({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  if (state.status !== 'signedIn') return <p>auth-loading</p>
  return <>{children}</>
}

export function renderWithProviders(ui: ReactNode, { route = '/' }: { route?: string } = {}) {
  // Pre-seed the fake backend session so protected components can render.
  localStorage.setItem('noto-fake-session', '1')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UiStateProvider>
            <MemoryRouter initialEntries={[route]}>
              <AuthGate>{ui}</AuthGate>
              <Toaster />
            </MemoryRouter>
          </UiStateProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

export async function resetDb(): Promise<void> {
  await Promise.all(db.tables.map((table) => table.clear()))
}
