import { expect, test } from '@playwright/test'
import { addTask, signIn } from './helpers'

test('searches across tasks with the / shortcut and filters', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/inbox')
  await addTask(page, 'Renew passport')
  await addTask(page, 'Unrelated chore')

  // Move focus out of the quick-add input — shortcuts are (correctly)
  // suppressed while an input is focused.
  await page.getByRole('heading', { name: 'Inbox' }).click()
  await page.keyboard.press('/')
  const box = page.getByRole('searchbox')
  await expect(box).toBeVisible()
  await box.fill('passport')
  await expect(
    page.getByRole('list', { name: 'Search results' }).getByText('Renew passport'),
  ).toBeVisible()
  await expect(
    page.getByRole('list', { name: 'Search results' }).getByText('Unrelated chore'),
  ).toHaveCount(0)

  // Type filter: notes only → the task disappears from results.
  await page.getByLabel('Type filter').selectOption('note')
  await expect(page.getByText('No results')).toBeVisible()

  // Escape closes the dialog.
  await page.keyboard.press('Escape')
  await expect(box).toHaveCount(0)
})

test('keyboard shortcut N opens the new-task dialog, inputs are protected', async ({ page }) => {
  await signIn(page)
  await page.keyboard.press('n')
  await expect(page.getByRole('heading', { name: 'New task' })).toBeVisible()
  // Typing "n" inside the title field must not re-trigger the shortcut.
  await page.getByLabel('Task title').fill('night run')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'New task' })).toHaveCount(0)
})
