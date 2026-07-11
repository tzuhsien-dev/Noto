import { expect, test } from '@playwright/test'
import { addTask, signIn } from './helpers'

test('groups projects under an area and ungroups on area delete', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/projects')

  await page.getByRole('button', { name: 'New area' }).click()
  await page.getByLabel('Area name').fill('Work')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Project name').fill('RGD dev')
  await page.getByLabel('Area').selectOption({ label: 'Work' })
  await page.getByRole('button', { name: 'Create' }).click()

  // Projects page groups under the area heading…
  await expect(page.getByRole('heading', { name: 'Work' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'RGD dev' }).first()).toBeVisible()
  // …and the sidebar shows the area group too (desktop sidebar nav).
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByText('Work')).toBeVisible()
  await expect(nav.getByRole('link', { name: 'RGD dev' })).toBeVisible()

  // Deleting the area keeps the project, now ungrouped.
  await page.getByRole('button', { name: 'Delete Work' }).click()
  await page.getByRole('button', { name: 'Delete area' }).click()
  await expect(page.getByRole('heading', { name: 'Work' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'RGD dev' }).first()).toBeVisible()
})

test('All Tasks groups tasks under area → project headings', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/projects')

  await page.getByRole('button', { name: 'New area' }).click()
  await page.getByLabel('Area name').fill('Work')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Project name').fill('RGD Layer')
  await page.getByLabel('Area').selectOption({ label: 'Work' })
  await page.getByRole('button', { name: 'Create' }).click()

  // Add a task inside the project so it belongs to it.
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await nav.getByRole('link', { name: 'RGD Layer' }).click()
  await addTask(page, 'AUTO Dump Tool')

  await page.goto('/#/all')
  await expect(page.getByRole('heading', { name: 'Work', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'RGD Layer', level: 3 })).toBeVisible()

  const row = page.getByRole('button', { name: /AUTO Dump Tool/ })
  await expect(row).toBeVisible()
  // The project badge is redundant inside its own group, so it is hidden.
  await expect(row).not.toContainText('RGD Layer')
  // One selection toolbar for the whole page, not one per group.
  await expect(page.getByRole('button', { name: 'Select' })).toHaveCount(1)
})
