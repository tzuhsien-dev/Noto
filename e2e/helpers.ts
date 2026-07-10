import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

declare global {
  interface Window {
    __notoFakeBackend?: { failPushes: boolean }
  }
}

export const DEMO_EMAIL = 'demo@noto.local'
export const DEMO_PASSWORD = 'noto-demo-password'

export async function signIn(page: Page): Promise<void> {
  await page.goto('/#/login')
  await page.getByLabel('Email').fill(DEMO_EMAIL)
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
}

export async function addTask(page: Page, title: string): Promise<void> {
  const input = page.getByLabel('Add a task').first()
  await input.fill(title)
  await input.press('Enter')
  await expect(page.getByText(title)).toBeVisible()
}

export async function waitForSynced(page: Page): Promise<void> {
  await expect(page.locator('[data-sync-status]').first()).toHaveText(/Synced/, {
    timeout: 10_000,
  })
}

/** Toggle simulated server outage in the fake backend. */
export async function setServerDown(page: Page, down: boolean): Promise<void> {
  await page.evaluate((value) => {
    window.__notoFakeBackend!.failPushes = value
  }, down)
}
