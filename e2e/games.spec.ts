import { test, expect } from '@playwright/test'
import { seedAuth, addGameViaDb, uniqueEmail } from './helpers'

const PASSWORD = 'testpass123'

test.describe('Game management', () => {
  test('seeded games appear in grid', async ({ page, request }) => {
    const token = await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Gamer',
    })

    addGameViaDb(token, { title: 'Catan' })
    addGameViaDb(token, { title: 'Wingspan' })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Catan')).toBeVisible()
    await expect(page.getByText('Wingspan')).toBeVisible()
  })

  test('clicking a game navigates to detail page', async ({ page, request }) => {
    const token = await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Detail Viewer',
    })

    const game = addGameViaDb(token, { title: 'Azul' })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await page.getByText('Azul').click()

    await expect(page).toHaveURL(`/games/${game.id}`)
    await expect(page.getByRole('heading', { name: 'Azul' })).toBeVisible()
  })

  test('delete game from detail page → returns to home, game gone', async ({ page, request }) => {
    const token = await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Deleter',
    })

    const game = addGameViaDb(token, { title: 'Game To Delete' })

    await page.goto(`/games/${game.id}`)
    await page.waitForLoadState('networkidle')

    page.on('dialog', (dialog) => dialog.accept())

    await page.getByTitle('Delete game').click()

    await expect(page).toHaveURL('/')
    await expect(page.getByText('Game To Delete')).not.toBeVisible()
  })

  test('search filter → only matching games shown', async ({ page, request }) => {
    const token = await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Searcher',
    })

    addGameViaDb(token, { title: 'Ticket to Ride' })
    addGameViaDb(token, { title: 'Pandemic' })
    addGameViaDb(token, { title: 'Patchwork' })

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Ticket to Ride')).toBeVisible()
    await expect(page.getByText('Pandemic')).toBeVisible()
    await expect(page.getByText('Patchwork')).toBeVisible()

    await page.getByPlaceholder('Search games...').fill('Pan')

    await expect(page.getByText('Pandemic')).toBeVisible()
    await expect(page.getByText('Ticket to Ride')).not.toBeVisible()
  })

  test('empty state when no games', async ({ page, request }) => {
    await seedAuth(page, request, {
      email: uniqueEmail(),
      password: PASSWORD,
      name: 'Empty User',
    })

    await expect(page.getByText('No games match your filters')).toBeVisible()
  })
})
