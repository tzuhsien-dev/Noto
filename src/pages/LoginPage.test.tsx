import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/theme'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import { FAKE_PASSWORD, FAKE_USER } from '@/lib/backend/fake'
import { LoginPage } from './LoginPage'

afterEach(() => {
  localStorage.clear()
})

function StatusProbe() {
  const { state } = useAuth()
  return <p data-testid="auth-status">{state.status}</p>
}

function renderLogin() {
  return render(
    <ThemeProvider>
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <MemoryRouter>
            <LoginPage />
            <StatusProbe />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('LoginPage', () => {
  it('validates the email format before submitting', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'whatever')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
  })

  it('shows an invalid-credential error from the backend', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText('Email'), FAKE_USER.email!)
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })

  it('signs in with valid credentials', async () => {
    const user = userEvent.setup()
    renderLogin()
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signedOut')
    })
    await user.type(screen.getByLabelText('Email'), FAKE_USER.email!)
    await user.type(screen.getByLabelText('Password'), FAKE_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signedIn')
    })
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderLogin()
    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('does not show a sign-up button by default', () => {
    renderLogin()
    expect(screen.queryByText('Create account')).not.toBeInTheDocument()
  })
})
