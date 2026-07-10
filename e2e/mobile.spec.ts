import { expect, test } from '@playwright/test'
import { addTask, signIn } from './helpers'

test('mobile layout: drawer navigation and task creation work', async ({ page }) => {
  await signIn(page)

  // The desktop sidebar is hidden; the drawer opens from the menu button.
  await expect(page.getByRole('link', { name: 'Inbox' })).toBeHidden()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('link', { name: 'Inbox' }).click()
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()

  await addTask(page, 'Mobile-created task')

  // Note editor is reachable and usable on a small screen.
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('link', { name: 'Notes', exact: true }).click()
  await page.locator('[data-new-note]').click()
  await expect(page.getByLabel('Note content')).toBeVisible()
})
