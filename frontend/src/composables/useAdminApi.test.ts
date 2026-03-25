vi.mock('../router', () => ({
  default: { push: vi.fn() },
}))

import { useAdminApi } from './useAdminApi'
import { useAdminAuth, adminAuthReady } from './useAdminAuth'

beforeAll(async () => {
  await adminAuthReady
})

beforeEach(async () => {
  const { logout } = useAdminAuth()
  await logout()
  vi.restoreAllMocks()
})

async function loginAdmin() {
  const responseData = { user: { sub: 1, email: 'admin@test.com', name: 'Admin', isAdmin: true } }
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(responseData), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
  const { login } = useAdminAuth()
  await login('admin@test.com', 'pass')
  vi.restoreAllMocks()
}

describe('useAdminApi – adminFetch', () => {
  it('should return parsed JSON on successful request', async () => {
    await loginAdmin()

    const responseData = { users: [{ id: 1 }], total: 1 }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(responseData), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const { adminFetch } = useAdminApi()
    const result = await adminFetch<typeof responseData>('/api/admin/users')
    expect(result).toEqual(responseData)
  })

  it('should include credentials in requests', async () => {
    await loginAdmin()

    const callArgs: [string, RequestInit | undefined][] = []
    globalThis.fetch = vi.fn(((url: string, init?: RequestInit) => {
      callArgs.push([url, init])
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    }) as typeof fetch)

    const { adminFetch } = useAdminApi()
    await adminFetch('/api/admin/test')

    expect(callArgs[0][1]?.credentials).toBe('include')
    const calledHeaders = callArgs[0][1]?.headers as Record<string, string>
    expect(calledHeaders.Authorization).toBeUndefined()
  })

  it('should set Content-Type for requests with a body', async () => {
    await loginAdmin()

    const callArgs: [string, RequestInit | undefined][] = []
    globalThis.fetch = vi.fn(((url: string, init?: RequestInit) => {
      callArgs.push([url, init])
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
    }) as typeof fetch)

    const { adminFetch } = useAdminApi()
    await adminFetch('/api/admin/test', { method: 'POST', body: JSON.stringify({ foo: 1 }) })

    const calledHeaders = callArgs[0][1]?.headers as Record<string, string>
    expect(calledHeaders['Content-Type']).toBe('application/json')
  })

  it('should trigger logout and throw on 401 response', async () => {
    await loginAdmin()

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } }),
    )

    const { adminFetch } = useAdminApi()
    await expect(adminFetch('/api/admin/test')).rejects.toThrow('Admin session expired')

    const { isAdminAuthenticated } = useAdminAuth()
    expect(isAdminAuthenticated.value).toBe(false)
  })

  it('should throw with error message from response body on non-ok status', async () => {
    await loginAdmin()

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
    )

    const { adminFetch } = useAdminApi()
    await expect(adminFetch('/api/admin/users/999')).rejects.toThrow('User not found')
  })

})
