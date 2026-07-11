import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

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
