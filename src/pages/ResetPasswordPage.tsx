import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/AuthProvider'
import { BackendError } from '@/lib/backend/types'

/**
 * Landing page for the Supabase password-recovery link. The link signs the
 * user in with a temporary session; this page sets the new password.
 */
export function ResetPasswordPage() {
  const { state, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await updatePassword(password)
      navigate('/today')
    } catch (err) {
      setError(err instanceof BackendError ? err.message : 'Could not update the password.')
    } finally {
      setSubmitting(false)
    }
  }

  if (state.status === 'signedOut') {
    return (
      <div className="flex min-h-full items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-muted-foreground">
            This reset link is invalid or has expired. Request a new one from the sign-in page.
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form
        className="w-full max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <h1 className="text-xl font-semibold">Set a new password</h1>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          aria-label="New password"
          autoComplete="new-password"
          autoFocus
        />
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat new password"
          aria-label="Repeat new password"
          autoComplete="new-password"
        />
        {error ? (
          <p
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Update password
        </Button>
      </form>
    </div>
  )
}
