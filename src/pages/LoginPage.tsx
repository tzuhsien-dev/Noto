import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { loginFormSchema } from '@/domain/schemas'
import { useAuth } from '@/features/auth/AuthProvider'
import { BackendError } from '@/lib/backend/types'

type FormValues = z.infer<typeof loginFormSchema>
type Mode = 'signIn' | 'signUp' | 'forgot'

const signupEnabled = import.meta.env.VITE_ENABLE_SIGNUP === 'true'

function errorMessage(error: unknown): string {
  if (!navigator.onLine) return 'You appear to be offline. Connect to the internet to sign in.'
  if (error instanceof BackendError) return error.message
  return 'Something went wrong. Please try again.'
}

export function LoginPage() {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('signIn')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      if (mode === 'signUp') {
        const result = await signUp(values.email, values.password)
        if (result === 'confirmEmail') {
          setInfo('Check your inbox to confirm your email, then sign in.')
          setMode('signIn')
        }
      } else {
        await signIn(values.email, values.password)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  })

  const onForgot = async () => {
    const email = form.getValues('email')
    const parsed = z.email().safeParse(email)
    if (!parsed.success) {
      setError('Enter your email address first, then tap “Forgot password” again.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setInfo('If an account exists for that address, a reset link is on its way.')
      setMode('signIn')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-semibold">Noto</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Notes &amp; todos, on every device.
        </p>
        <form onSubmit={onSubmit} className="space-y-3" aria-label="Sign in form" noValidate>
          <div>
            <Input
              {...form.register('email')}
              type="email"
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              autoFocus
            />
            {form.formState.errors.email ? (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div>
            <div className="relative">
              <Input
                {...form.register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                aria-label="Password"
                autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
            {form.formState.errors.password ? (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          {error ? (
            <p
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="rounded-md bg-accent px-3 py-2 text-sm" role="status">
              {info}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {mode === 'signUp' ? 'Create account' : 'Sign in'}
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            className="text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => void onForgot()}
            disabled={submitting}
          >
            Forgot password?
          </button>
          {signupEnabled ? (
            <button
              type="button"
              className="text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
            >
              {mode === 'signUp' ? 'Have an account? Sign in' : 'Create account'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
