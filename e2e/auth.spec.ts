import { expect, test } from '@playwright/test'
import { DEMO_EMAIL, signIn } from './helpers'

test('rejects invalid credentials with a clear error', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByLabel('Email').fill(DEMO_EMAIL)
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Invalid email or password')).toBeVisible()
  // No sign-up button in the default configuration.
  await expect(page.getByText('Create account')).toHaveCount(0)
})

test('signs in and lands on Today', async ({ page }) => {
  await signIn(page)
  await expect(page.locator('[data-sync-status]').first()).toBeVisible()
})

test('restores the session across a reload', async ({ page }) => {
  await signIn(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByLabel('Email')).toHaveCount(0)
})

test('signs out from Settings and returns to the login page', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/settings')
  await page.locator('[data-sign-out]').click()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  // Session is gone after a reload too.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})
