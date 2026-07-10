import { expect, test } from '@playwright/test'
import { addTask, setServerDown, signIn, waitForSynced } from './helpers'

test('shows the offline indicator and keeps local data readable', async ({ context, page }) => {
  await signIn(page)
  await page.goto('/#/inbox')
  await addTask(page, 'Offline visible task')
  await waitForSynced(page)

  await context.setOffline(true)
  await expect(page.locator('[data-sync-status]').first()).toHaveText(/Offline/)

  // Cached data stays readable while offline (client-side navigation).
  await page.goto('/#/all')
  await expect(page.getByText('Offline visible task')).toBeVisible()

  // Offline edits are accepted and queue up.
  await addTask(page, 'Written while offline')

  await context.setOffline(false)
  await waitForSynced(page)
  await expect(page.getByText('Written while offline')).toBeVisible()
})

test('keeps changes pending during a server outage and retries', async ({ page }) => {
  await signIn(page)
  await page.goto('/#/inbox')
  await waitForSynced(page)

  await setServerDown(page, true)
  await addTask(page, 'Stuck behind outage')

  // The mutation stays queued and the UI reports the failure.
  await expect(page.locator('[data-sync-status]').first()).toHaveText(/Sync error|pending/, {
    timeout: 10_000,
  })
  await page.goto('/#/settings')
  await expect(page.locator('[data-pending-count]')).toHaveText(/[1-9]/)

  // Server comes back; manual retry drains the queue. Nothing was lost.
  await setServerDown(page, false)
  await page.locator('[data-retry-sync]').click()
  await waitForSynced(page)
  await expect(page.locator('[data-pending-count]')).toHaveText('0')
  await page.goto('/#/inbox')
  await expect(page.getByText('Stuck behind outage')).toBeVisible()
})
