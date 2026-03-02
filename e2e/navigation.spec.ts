import { test, expect } from '@playwright/test'
import { seedAuth, addGameViaDb, uniqueEmail } from './helpers'

const PASSWORD = 'testpass123'

test.describe('Navigation & layout', () => {
  test('header shows Bgamedex logo, Stats link, and user name when authenticated', async ({
    page,
    request,
  }) => {
    await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Nav User',
    })

    // Logo
    await expect(page.locator('header').getByText('Bgamedex')).toBeVisible()

    // Stats link
    await expect(page.locator('header a[href="/stats"]')).toBeVisible()

    // User name in header
    await expect(page.locator('header').getByText('Nav User')).toBeVisible()

    // Sign out button
    await expect(page.locator('header').getByRole('button', { name: 'Sign out' })).toBeVisible()
  })

  test('Stats link navigates to /stats', async ({ page, request }) => {
    await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Stats Nav',
    })

    await page.locator('header a[href="/stats"]').click()

    await expect(page).toHaveURL('/stats')
    await expect(page.getByText('Play Statistics')).toBeVisible()
  })

  test('back link on game detail returns to home', async ({ page, request }) => {
    const token = await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Back Nav',
    })

    const game = addGameViaDb(token, { title: 'Scythe' })

    await page.goto(`/games/${game.id}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('link', { name: 'Back to games' }).click()

    await expect(page).toHaveURL('/')
  })

  test('route guard: direct visit to /games/1 without token → redirects to login', async ({
    page,
  }) => {
    await page.goto('/games/1')
    await expect(page).toHaveURL('/login')
  })
})
