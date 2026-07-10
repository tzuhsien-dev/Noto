import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { ThemeProvider } from './theme'
import { UiStateProvider } from './ui-state'
import { AppLayout } from './layout/AppLayout'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import { ConfigErrorPage } from '@/pages/ConfigErrorPage'
import { LoginPage } from '@/pages/LoginPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { NoteEditorPage } from '@/pages/NoteEditorPage'
import { NotesPage } from '@/pages/NotesPage'
import { ArchivePage } from '@/pages/ArchivePage'
import { ProjectDetailPage, ProjectsPage } from '@/pages/ProjectsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TagDetailPage, TagsPage } from '@/pages/TagsPage'
import { TrashPage } from '@/pages/TrashPage'
import {
  AllTasksPage,
  CompletedPage,
  InboxPage,
  TodayPage,
  UpcomingPage,
} from '@/pages/TaskViewsPage'

const queryClient = new QueryClient()

function FullScreenSpinner() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  if (state.status === 'loading') return <FullScreenSpinner />
  if (state.status === 'unconfigured') return <ConfigErrorPage />
  if (state.status === 'signedOut') return <Navigate to="/login" replace />
  return <>{children}</>
}

function LoginRoute() {
  const { state } = useAuth()
  if (state.status === 'loading') return <FullScreenSpinner />
  if (state.status === 'unconfigured') return <ConfigErrorPage />
  if (state.status === 'signedIn') return <Navigate to="/today" replace />
  return <LoginPage />
}

export function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <UiStateProvider>
              <HashRouter>
                <Routes>
                  <Route path="/login" element={<LoginRoute />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route
                    element={
                      <RequireAuth>
                        <AppLayout />
                      </RequireAuth>
                    }
                  >
                    <Route path="/" element={<Navigate to="/today" replace />} />
                    <Route path="/today" element={<TodayPage />} />
                    <Route path="/inbox" element={<InboxPage />} />
                    <Route path="/upcoming" element={<UpcomingPage />} />
                    <Route path="/all" element={<AllTasksPage />} />
                    <Route path="/completed" element={<CompletedPage />} />
                    <Route path="/notes" element={<NotesPage variant="all" />} />
                    <Route path="/notes/pinned" element={<NotesPage variant="pinned" />} />
                    <Route path="/notes/:noteId" element={<NoteEditorPage />} />
                    <Route path="/archive" element={<ArchivePage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
                    <Route path="/tags" element={<TagsPage />} />
                    <Route path="/tags/:tagId" element={<TagDetailPage />} />
                    <Route path="/trash" element={<TrashPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/today" replace />} />
                  </Route>
                </Routes>
              </HashRouter>
              <Toaster position="bottom-center" />
            </UiStateProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
