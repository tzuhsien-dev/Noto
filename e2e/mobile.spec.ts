import { expect, test } from '@playwright/test'
import { addTask, signIn } from './helpers'

test('mobile layout: tab bar and drawer navigation work', async ({ page }) => {
  await signIn(page)

  // The desktop sidebar is hidden; primary views live in the bottom tab bar,
  // the long tail only in the drawer.
  const tabBar = page.getByRole('navigation', { name: 'Primary' })
  await expect(tabBar).toBeVisible()
  await expect(page.getByRole('link', { name: 'Upcoming' })).toBeHidden()

  // Tab bar navigation.
  await tabBar.getByRole('link', { name: 'Inbox' }).click()
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()

  await addTask(page, 'Mobile-created task')

  // Drawer covers the long tail and closes on navigation.
  await page.getByRole('button', { name: 'Open menu' }).click()
  const drawer = page.getByRole('dialog', { name: 'Navigation menu' })
  await drawer.getByRole('link', { name: 'Upcoming' }).click()
  await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible()
  await expect(drawer).toBeHidden()

  // Note editor is reachable via the Notes tab and usable on a small screen.
  await tabBar.getByRole('link', { name: 'Notes' }).click()
  await page.locator('[data-new-note]').click()
  await expect(page.getByLabel('Note content')).toBeVisible()
})

test('mobile: completing a task can be undone from the toast', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/inbox')
  await addTask(page, 'Fat finger target')
  await page.getByRole('checkbox', { name: 'Mark Fat finger target as done' }).click()
  await expect(page.getByText('Task completed')).toBeVisible()
  await expect(page.getByRole('button', { name: /Fat finger target/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: /Fat finger target/ })).toBeVisible()
})

test('mobile: tab bar stays pinned when content overflows', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/inbox')
  const input = page.getByLabel('Add a task').first()
  for (let i = 1; i <= 25; i++) {
    await input.fill(`Filler task ${i}`)
    await input.press('Enter')
  }
  await expect(page.getByRole('button', { name: /Filler task 25/ })).toBeVisible()
  // The list scrolls inside <main>; the window itself must not scroll and the
  // tab bar must stay pinned inside the viewport.
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeInViewport()
  const windowScrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight,
  )
  expect(windowScrollable).toBe(false)
})

test('mobile: search tab opens the search dialog', async ({ page }) => {
  await signIn(page)
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('button', { name: 'Search' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible()
})
