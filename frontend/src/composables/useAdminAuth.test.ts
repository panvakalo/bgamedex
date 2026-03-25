vi.mock('../router', () => ({
  default: { push: vi.fn() },
}))

import { useAdminAuth, adminAuthReady } from './useAdminAuth'

beforeAll(async () => {
  await adminAuthReady
})

beforeEach(async () => {
  const { logout } = useAdminAuth()
  await logout()
  vi.restoreAllMocks()
})

describe('useAdminAuth – login', () => {
  it('should populate admin state on successful login', async () => {
    const responseData = { user: { sub: 1, email: 'admin@test.com', name: 'Admin', isAdmin: true } }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(responseData), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const { login, adminUser, isAdminAuthenticated } = useAdminAuth()
    await login('admin@test.com', 'password123')

    expect(adminUser.value).toMatchObject({ sub: 1, email: 'admin@test.com', isAdmin: true })
    expect(isAdminAuthenticated.value).toBe(true)
  })

  it('should throw when API returns an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } }),
    )

    const { login } = useAdminAuth()
    await expect(login('bad@test.com', 'wrong')).rejects.toThrow('Invalid credentials')
  })

  it('should reject a response without isAdmin flag', async () => {
    const responseData = { user: { sub: 1, email: 'user@test.com', name: 'User', isAdmin: false } }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(responseData), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const { login } = useAdminAuth()
    await expect(login('user@test.com', 'password')).rejects.toThrow('Invalid response from server')
  })
})

describe('useAdminAuth – logout', () => {
  it('should clear all admin state and call logout endpoint', async () => {
    const responseData = { user: { sub: 1, email: 'admin@test.com', name: 'Admin', isAdmin: true } }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(responseData), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const { login, logout, adminUser, isAdminAuthenticated } = useAdminAuth()
    await login('admin@test.com', 'pass')

    vi.restoreAllMocks()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    await logout()

    expect(adminUser.value).toBeNull()
    expect(isAdminAuthenticated.value).toBe(false)
    const logoutCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('/api/admin/auth/logout'))
    expect(logoutCall).toBeDefined()
    expect(logoutCall![1]).toMatchObject({ method: 'POST', credentials: 'include' })
  })
})
