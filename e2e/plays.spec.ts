import { test, expect } from '@playwright/test'
import { seedAuth, addGameViaDb, uniqueEmail } from './helpers'

const PASSWORD = 'testpass123'

test.describe('Play logging & stats', () => {
  test('log play from game detail → play count updates, play appears in history', async ({
    page,
    request,
  }) => {
    const token = await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Play Logger',
    })

    const game = addGameViaDb(token, { title: 'Spirit Island' })

    await page.goto(`/games/${game.id}`)
    await page.waitForLoadState('networkidle')

    // Initially no plays logged
    await expect(page.getByText(/play.*logged/i)).not.toBeVisible()

    // Click "Log Play" button
    await page.getByRole('button', { name: 'Log Play' }).click()

    // Modal appears — click "Log" to confirm
    await page.getByRole('button', { name: 'Log', exact: true }).click()

    // Play count should now show
    await expect(page.getByText('1 play logged')).toBeVisible()

    // Play History section should appear
    await expect(page.getByText('Play History')).toBeVisible()
  })

  test('delete play from game detail → play removed, count updates', async ({
    page,
    request,
  }) => {
    const token = await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Play Deleter',
    })

    const game = addGameViaDb(token, { title: 'Root' })

    await page.goto(`/games/${game.id}`)
    await page.waitForLoadState('networkidle')

    // Log a play
    await page.getByRole('button', { name: 'Log Play' }).click()
    await page.getByRole('button', { name: 'Log', exact: true }).click()
    await expect(page.getByText('1 play logged')).toBeVisible()

    // Delete the play
    await page.getByTitle('Delete play').click()

    // Play history and count should disappear
    await expect(page.getByText(/play.*logged/i)).not.toBeVisible()
    await expect(page.getByText('Play History')).not.toBeVisible()
  })

  test('FAB on home → open modal, select game, log play → modal closes', async ({
    page,
    request,
  }) => {
    const token = await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'FAB User',
    })

    addGameViaDb(token, { title: 'Everdell' })

    await page.reload()
    await page.waitForLoadState('networkidle')

    // Click the FAB (Quick log play button)
    await page.getByTitle('Quick log play').click()

    // Modal should appear with game list
    await expect(page.getByText('Log a Play')).toBeVisible()

    // Select the game
    await page.getByRole('button', { name: 'Everdell' }).click()

    // Should show date picker and Log Play button
    await expect(page.getByText('Date')).toBeVisible()

    // Click the "Log Play" button inside the modal (not the FAB)
    await page.getByRole('button', { name: 'Log Play', exact: true }).click()

    // Modal should close
    await expect(page.getByText('Log a Play')).not.toBeVisible()
  })

  test('stats page shows totals after logging plays', async ({ page, request }) => {
    const token = await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Stats Viewer',
    })

    const game = addGameViaDb(token, { title: 'Gloomhaven' })

    // Log two plays via game detail
    await page.goto(`/games/${game.id}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Log Play' }).click()
    await page.getByRole('button', { name: 'Log', exact: true }).click()
    await expect(page.getByText('1 play logged')).toBeVisible()

    await page.getByRole('button', { name: 'Log Play' }).click()
    await page.getByRole('button', { name: 'Log', exact: true }).click()
    await expect(page.getByText('2 plays logged')).toBeVisible()

    // Navigate to stats
    await page.goto('/stats')
    await page.waitForLoadState('networkidle')

    // Check totals
    await expect(page.getByText('Total Plays')).toBeVisible()
    await expect(page.getByText('Games Played')).toBeVisible()

    // Most Played section
    await expect(page.getByText('Most Played')).toBeVisible()
    await expect(page.getByText('Gloomhaven').first()).toBeVisible()

    // Recent Plays section
    await expect(page.getByText('Recent Plays')).toBeVisible()
  })

  test('delete play from stats page → stats update', async ({ page, request }) => {
    const token = await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Stats Deleter',
    })

    const game = addGameViaDb(token, { title: 'Terraforming Mars' })

    // Log a play
    await page.goto(`/games/${game.id}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Log Play' }).click()
    await page.getByRole('button', { name: 'Log', exact: true }).click()
    await expect(page.getByText('1 play logged')).toBeVisible()

    // Go to stats
    await page.goto('/stats')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Terraforming Mars').first()).toBeVisible()

    // Delete play from stats page (recent plays section has delete buttons)
    await page.getByTitle('Delete play').click()

    // Stats should show empty state
    await expect(page.getByText('No plays logged yet')).toBeVisible()
  })

  test('stats page empty state when no plays logged', async ({ page, request }) => {
    await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Empty Stats',
    })

    await page.goto('/stats')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('No plays logged yet')).toBeVisible()
    await expect(page.getByText('Browse your games')).toBeVisible()
  })
})
