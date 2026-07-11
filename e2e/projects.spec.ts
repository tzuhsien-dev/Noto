import { expect, test } from '@playwright/test'
import { addTask, signIn } from './helpers'

test('deleting a project moves its tasks to Trash', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/projects')

  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByLabel('Project name').fill('Doomed project')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('link', { name: 'Doomed project' }).first().click()
  await addTask(page, 'Task inside doomed project')

  await page.goto('/#/projects')
  await page.getByRole('button', { name: 'Delete Doomed project' }).click()
  await page.getByRole('button', { name: 'Delete project' }).click()

  await expect(page.getByText('1 task moved to Trash')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Doomed project' })).toHaveCount(0)

  await page.goto('/#/trash')
  await expect(page.getByText('Task inside doomed project')).toBeVisible()
})
