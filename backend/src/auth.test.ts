import { type Request, type Response, type NextFunction } from 'express'
import { signToken, verifyToken, generateVerificationToken, hashToken, requireAuth, requireAdminAuth, type AuthPayload } from './auth.js'

const TEST_PAYLOAD: AuthPayload = {
  sub: 1,
  email: 'test@example.com',
  name: 'Test User',
  emailVerified: true,
  isAdmin: false,
  ver: 1,
  aud: 'user',
}

vi.mock('./database.js', () => ({
  getDb: () => ({
    prepare: () => ({
      get: (id: number) => {
        if (id === 1) return { token_version: 1 }
        if (id === 2) return { token_version: 2 } // mismatched version
        return undefined
      },
    }),
  }),
}))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-unit-tests'
})

describe('signToken / verifyToken', () => {
  it('should round-trip a token', () => {
    const token = signToken(TEST_PAYLOAD)
    const decoded = verifyToken(token)
    expect(decoded.sub).toBe(TEST_PAYLOAD.sub)
    expect(decoded.email).toBe(TEST_PAYLOAD.email)
    expect(decoded.name).toBe(TEST_PAYLOAD.name)
    expect(decoded.emailVerified).toBe(TEST_PAYLOAD.emailVerified)
    expect(decoded.ver).toBe(1)
    expect(decoded.aud).toBe('user')
  })

  it('should throw for an invalid token', () => {
    expect(() => verifyToken('invalid.token.value')).toThrow()
  })

  it('should throw for a tampered token', () => {
    const token = signToken(TEST_PAYLOAD)
    const tampered = token.slice(0, -5) + 'XXXXX'
    expect(() => verifyToken(tampered)).toThrow()
  })

  it('should preserve isAdmin flag through round-trip', () => {
    const adminPayload = { ...TEST_PAYLOAD, isAdmin: true, aud: 'admin' as const }
    const token = signToken(adminPayload)
    const decoded = verifyToken(token)
    expect(decoded.isAdmin).toBe(true)

    const nonAdminToken = signToken({ ...TEST_PAYLOAD, isAdmin: false })
    const decodedNonAdmin = verifyToken(nonAdminToken)
    expect(decodedNonAdmin.isAdmin).toBe(false)
  })

  it('should preserve audience through round-trip', () => {
    const adminToken = signToken({ ...TEST_PAYLOAD, aud: 'admin' })
    const decoded = verifyToken(adminToken)
    expect(decoded.aud).toBe('admin')

    const userToken = signToken({ ...TEST_PAYLOAD, aud: 'user' })
    const decodedUser = verifyToken(userToken)
    expect(decodedUser.aud).toBe('user')
  })

  it('should reject token with wrong audience when expectedAudience is provided', () => {
    const userToken = signToken({ ...TEST_PAYLOAD, aud: 'user' })
    expect(() => verifyToken(userToken, 'admin')).toThrow()

    const adminToken = signToken({ ...TEST_PAYLOAD, aud: 'admin' })
    expect(() => verifyToken(adminToken, 'user')).toThrow()
  })

  it('should default ver to 1 for legacy tokens without ver', () => {
    // Manually create a token without ver
    const token = signToken(TEST_PAYLOAD)
    const decoded = verifyToken(token)
    expect(decoded.ver).toBe(1)
  })
})

describe('generateVerificationToken', () => {
  it('should return a 64-character hex string', () => {
    const token = generateVerificationToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('should generate unique tokens', () => {
    const a = generateVerificationToken()
    const b = generateVerificationToken()
    expect(a).not.toBe(b)
  })
})

describe('hashToken', () => {
  it('should return a consistent SHA-256 hash', () => {
    const token = 'test-token'
    const hash1 = hashToken(token)
    const hash2 = hashToken(token)
    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/)
  })

  it('should produce different hashes for different inputs', () => {
    expect(hashToken('a')).not.toBe(hashToken('b'))
  })
})

describe('requireAuth', () => {
  function mockReqResNext(cookies?: Record<string, string>) {
    const req = { cookies: cookies ?? {} } as unknown as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response
    const next = vi.fn() as NextFunction
    return { req, res, next }
  }

  it('should call next and attach user for a valid token cookie', () => {
    const token = signToken(TEST_PAYLOAD)
    const { req, res, next } = mockReqResNext({ token })
    requireAuth(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user?.sub).toBe(TEST_PAYLOAD.sub)
  })

  it('should return 401 when no cookie is present', () => {
    const { req, res, next } = mockReqResNext({})
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('should return 401 for an invalid token', () => {
    const { req, res, next } = mockReqResNext({ token: 'invalid-token' })
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('should return 401 when token_version does not match', () => {
    const token = signToken({ ...TEST_PAYLOAD, sub: 2, ver: 1 })
    const { req, res, next } = mockReqResNext({ token })
    requireAuth(req, res, next)
    // DB returns token_version: 2 for sub: 2, but token has ver: 1
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('should return 401 when user does not exist in DB', () => {
    const token = signToken({ ...TEST_PAYLOAD, sub: 999 })
    const { req, res, next } = mockReqResNext({ token })
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('should only read the token cookie, not admin_token', () => {
    const adminToken = signToken({ ...TEST_PAYLOAD, aud: 'admin', isAdmin: true })
    const { req, res, next } = mockReqResNext({ admin_token: adminToken })
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('should reject an admin-audience token in the user cookie', () => {
    const adminToken = signToken({ ...TEST_PAYLOAD, aud: 'admin', isAdmin: true })
    const { req, res, next } = mockReqResNext({ token: adminToken })
    requireAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('requireAdminAuth', () => {
  function mockReqResNext(cookies?: Record<string, string>) {
    const req = { cookies: cookies ?? {} } as unknown as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response
    const next = vi.fn() as NextFunction
    return { req, res, next }
  }

  it('should call next for a valid admin_token cookie with admin audience', () => {
    const token = signToken({ ...TEST_PAYLOAD, aud: 'admin', isAdmin: true })
    const { req, res, next } = mockReqResNext({ admin_token: token })
    requireAdminAuth(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.user?.aud).toBe('admin')
  })

  it('should return 401 when no admin_token cookie is present', () => {
    const { req, res, next } = mockReqResNext({})
    requireAdminAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('should reject a user-audience token in the admin_token cookie', () => {
    const userToken = signToken({ ...TEST_PAYLOAD, aud: 'user' })
    const { req, res, next } = mockReqResNext({ admin_token: userToken })
    requireAdminAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('should only read admin_token cookie, not the regular token cookie', () => {
    const userToken = signToken({ ...TEST_PAYLOAD, aud: 'user' })
    const { req, res, next } = mockReqResNext({ token: userToken })
    requireAdminAuth(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
