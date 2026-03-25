import { useAuth, authReady } from './useAuth'

beforeAll(async () => {
  await authReady
})

beforeEach(async () => {
  // Reset user state
  const { user } = useAuth()
  user.value = null
})

describe('useAuth – setUserFromResponse', () => {
  it('should populate user state from a response object', () => {
    const { setUserFromResponse, user, isAuthenticated } = useAuth()
    setUserFromResponse({ sub: 42, email: 'a@b.com', name: 'Alice', picture: 'pic.jpg', emailVerified: true })

    expect(user.value).toMatchObject({ sub: 42, email: 'a@b.com', name: 'Alice', picture: 'pic.jpg', emailVerified: true })
    expect(isAuthenticated.value).toBe(true)
  })

  it('should default picture to empty string if not provided', () => {
    const { setUserFromResponse, user } = useAuth()
    setUserFromResponse({ sub: 1, email: 'a@b.com', name: 'Alice' })
    expect(user.value?.picture).toBe('')
  })
})

describe('useAuth – logout', () => {
  it('should clear user state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    globalThis.fetch = fetchMock

    const { setUserFromResponse, logout, user, isAuthenticated } = useAuth()
    setUserFromResponse({ sub: 1, email: 'a@b.com', name: 'Alice' })
    await logout()

    expect(user.value).toBeNull()
    expect(isAuthenticated.value).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST', credentials: 'include' }))
  })
})

describe('useAuth – updateUser', () => {
  it('should merge partial fields into user', () => {
    const { setUserFromResponse, updateUser, user } = useAuth()
    setUserFromResponse({ sub: 1, email: 'a@b.com', name: 'Alice' })
    updateUser({ picture: 'http://example.com/pic.jpg' })
    expect(user.value?.picture).toBe('http://example.com/pic.jpg')
  })

  it('should do nothing when not logged in', () => {
    const { updateUser, user } = useAuth()
    updateUser({ name: 'Should not crash' })
    expect(user.value).toBeNull()
  })
})

describe('useAuth – verifyEmail', () => {
  it('should set user from verify-email response', async () => {
    const responseData = { user: { sub: 1, email: 'a@b.com', name: 'Alice', picture: '', emailVerified: true } }
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseData), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const { verifyEmail, user } = useAuth()
    await verifyEmail('test-token')

    expect(user.value).toMatchObject({ sub: 1, emailVerified: true })
  })

})

describe('useAuth – resetPassword', () => {
  it('should set user from reset-password response', async () => {
    const responseData = { user: { sub: 1, email: 'a@b.com', name: 'Alice', picture: '', emailVerified: true } }
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseData), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    const { resetPassword, user } = useAuth()
    await resetPassword('reset-token', 'newpassword123')

    expect(user.value).toMatchObject({ sub: 1, emailVerified: true })
  })

})
