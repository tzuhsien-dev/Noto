import { expect, test } from '@playwright/test'
import { addTask, signIn, waitForSynced } from './helpers'

test('creates a task from quick add', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/inbox')
  await addTask(page, 'Buy oat milk')
  await waitForSynced(page)
})

test('completes a task and finds it under Completed', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/inbox')
  await addTask(page, 'File expenses')
  await page.getByRole('checkbox', { name: 'Mark File expenses as done' }).click()
  await expect(page.getByText('File expenses')).toHaveCount(0)
  await page.goto('/#/completed')
  await expect(page.getByText('File expenses')).toBeVisible()
})

test('deletes a task and undoes it from the toast', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/inbox')
  await addTask(page, 'Temporary task')
  await page.getByRole('button', { name: /Temporary task/ }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Task deleted')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: /Temporary task/ })).toBeVisible()
})

test('data survives a reload (IndexedDB persistence)', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/inbox')
  await addTask(page, 'Persistent task')
  await waitForSynced(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible()
  await expect(page.getByText('Persistent task')).toBeVisible()
})

test('edits task details (priority, due date)', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/inbox')
  await addTask(page, 'Detailed task')
  await page.getByRole('button', { name: /Detailed task/ }).click()
  await page.getByLabel('Priority').selectOption('high')
  await page.getByLabel('Due date').fill('2030-01-15')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('high')).toBeVisible()
  await expect(page.getByText('Jan 15, 2030')).toBeVisible()
})
