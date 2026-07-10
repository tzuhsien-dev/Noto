import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

test('creates a note, auto-saves, and renders Markdown preview', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/notes')
  await page.locator('[data-new-note]').click()

  await page.getByLabel('Note title').fill('Groceries')
  await page.getByLabel('Note content').fill('# Shopping\n\n- apples\n- **bread**')

  // Auto-save is debounced; the editor shows the persisted timestamp label.
  await page.waitForTimeout(1200)
  await page.goto('/#/notes')
  await expect(page.getByText('Groceries')).toBeVisible()

  // Reopen and check the preview renders Markdown as elements (no raw text).
  await page.getByText('Groceries').click()
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByRole('heading', { name: 'Shopping' })).toBeVisible()
  await expect(page.locator('strong', { hasText: 'bread' })).toBeVisible()
})

test('checklist items can be added and toggled', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/notes')
  await page.locator('[data-new-note]').click()
  await page.getByLabel('Note title').fill('Trip prep')

  const newItem = page.getByLabel('Add checklist item')
  await newItem.fill('Pack charger')
  await newItem.press('Enter')
  await page.getByRole('checkbox', { name: 'Toggle Pack charger' }).click()
  await expect(page.getByRole('checkbox', { name: 'Toggle Pack charger' })).toBeChecked()
})
