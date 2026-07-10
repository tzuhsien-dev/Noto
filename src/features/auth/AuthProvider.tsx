import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { clearLocalData } from '@/db/database'
import { getBackend } from '@/lib/backend'
import { stopSyncEngine } from '@/sync/engine'
import type { BackendClient, BackendUser } from '@/lib/backend/types'

export type AuthState =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: BackendUser }

type AuthContextValue = {
  state: AuthState
  backend: BackendClient | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<'signedIn' | 'confirmEmail'>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const backendRef = useRef<BackendClient | null>(null)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    void (async () => {
      const backend = await getBackend()
      if (cancelled) return
      if (!backend) {
        setState({ status: 'unconfigured' })
        return
      }
      backendRef.current = backend
      unsubscribe = backend.onAuthStateChange((user) => {
        setState(user ? { status: 'signedIn', user } : { status: 'signedOut' })
      })
      try {
        const user = await backend.getSessionUser()
        if (!cancelled) setState(user ? { status: 'signedIn', user } : { status: 'signedOut' })
      } catch {
        // Session restore failed (e.g. expired refresh token) — sign-in page.
        if (!cancelled) setState({ status: 'signedOut' })
      }
    })()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const backend = backendRef.current
    if (!backend) throw new Error('Backend not configured')
    const user = await backend.signInWithPassword(email, password)
    setState({ status: 'signedIn', user })
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const backend = backendRef.current
    if (!backend) throw new Error('Backend not configured')
    const user = await backend.signUpWithPassword(email, password)
    if (user) {
      setState({ status: 'signedIn', user })
      return 'signedIn' as const
    }
    return 'confirmEmail' as const
  }, [])

  const signOut = useCallback(async () => {
    const backend = backendRef.current
    stopSyncEngine()
    try {
      await backend?.signOut()
    } finally {
      // Local sensitive state is cleared even if the network call fails.
      await clearLocalData()
      setState({ status: 'signedOut' })
    }
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const backend = backendRef.current
    if (!backend) throw new Error('Backend not configured')
    await backend.requestPasswordReset(email)
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    const backend = backendRef.current
    if (!backend) throw new Error('Backend not configured')
    await backend.updatePassword(newPassword)
  }, [])

  const value = useMemo(
    () => ({
      state,
      backend: backendRef.current,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [state, signIn, signUp, signOut, requestPasswordReset, updatePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** The signed-in user's id; only usable inside RequireAuth-protected routes. */
export function useUserId(): string {
  const { state } = useAuth()
  if (state.status !== 'signedIn') throw new Error('useUserId requires a signed-in user')
  return state.user.id
}
