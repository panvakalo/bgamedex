import { test, expect } from '@playwright/test'
import { registerUser, uniqueEmail } from './helpers'

const PASSWORD = 'testpass123'

test.describe('Authentication', () => {
  test('register new user → redirects to home, shows user name', async ({ page }) => {
    const name = 'Test User'
    const email = uniqueEmail()

    await page.goto('/login')

    // Switch to register mode
    await page.getByRole('button', { name: 'Create one' }).click()

    // Fill form
    await page.getByPlaceholder('Name (optional)').fill(name)
    await page.getByPlaceholder('Email').fill(email)
    await page.getByPlaceholder('Password').fill(PASSWORD)

    // Submit
    await page.getByRole('button', { name: 'Create account' }).click()

    // Should redirect to home
    await expect(page).toHaveURL('/')

    // User name should appear in header
    await expect(page.getByText(name)).toBeVisible()
  })

  test('login with existing user → redirects to home', async ({ page, request }) => {
    const email = uniqueEmail()
    const name = 'Login Tester'
    await registerUser(request, { email, password: PASSWORD, name })

    await page.goto('/login')

    await page.getByPlaceholder('Email').fill(email)
    await page.getByPlaceholder('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByText(name)).toBeVisible()
  })

  test('invalid login → shows error message', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder('Email').fill('nonexistent@test.com')
    await page.getByPlaceholder('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page.getByText('Invalid email or password')).toBeVisible()
  })

  test('duplicate registration → shows error', async ({ page, request }) => {
    const email = uniqueEmail()
    await registerUser(request, { email, password: PASSWORD, name: 'First' })

    await page.goto('/login')
    await page.getByRole('button', { name: 'Create one' }).click()

    await page.getByPlaceholder('Email').fill(email)
    await page.getByPlaceholder('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('An account with this email already exists')).toBeVisible()
  })

  test('logout → redirects to login page', async ({ page, request }) => {
    const email = uniqueEmail()
    await registerUser(request, { email, password: PASSWORD, name: 'Logout Tester' })

    // Login via UI
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(email)
    await page.getByPlaceholder('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page).toHaveURL('/')

    // Sign out
    await page.getByRole('button', { name: 'Sign out' }).click()

    await expect(page).toHaveURL('/login')
  })

  test('unauthenticated visit to / → redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/login')
  })
})
