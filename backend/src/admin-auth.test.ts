import { type Request, type Response, type NextFunction } from 'express'
import { requireAdmin } from './admin-auth.js'

vi.mock('./database.js', () => ({
  getDb: () => ({
    prepare: () => ({
      get: (id: number) => {
        if (id === 1) return { is_admin: 1 }
        if (id === 2) return { is_admin: 0 }
        return undefined
      },
    }),
  }),
}))

function mockReqResNext(user?: Partial<Request['user']>) {
  const req = { user } as unknown as Request
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  const next = vi.fn() as NextFunction
  return { req, res, next }
}

describe('requireAdmin', () => {
  it('should call next when user is an admin with admin audience and DB confirms', () => {
    const { req, res, next } = mockReqResNext({ sub: 1, email: 'a@b.com', name: 'Admin', emailVerified: true, isAdmin: true, ver: 1, aud: 'admin' })
    requireAdmin(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('should return 403 when user is not an admin', () => {
    const { req, res, next } = mockReqResNext({ sub: 2, email: 'u@b.com', name: 'User', emailVerified: true, isAdmin: false, ver: 1, aud: 'user' })
    requireAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' })
    expect(next).not.toHaveBeenCalled()
  })

  it('should return 403 when req.user is undefined', () => {
    const { req, res, next } = mockReqResNext(undefined)
    requireAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('should return 403 when JWT says admin but DB says not admin (demoted)', () => {
    const { req, res, next } = mockReqResNext({ sub: 2, email: 'u@b.com', name: 'Demoted', emailVerified: true, isAdmin: true, ver: 1, aud: 'admin' })
    requireAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' })
    expect(next).not.toHaveBeenCalled()
  })

  it('should return 403 when user no longer exists in DB', () => {
    const { req, res, next } = mockReqResNext({ sub: 999, email: 'gone@b.com', name: 'Gone', emailVerified: true, isAdmin: true, ver: 1, aud: 'admin' })
    requireAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('should return 403 when token has user audience even if isAdmin is true', () => {
    const { req, res, next } = mockReqResNext({ sub: 1, email: 'a@b.com', name: 'Admin', emailVerified: true, isAdmin: true, ver: 1, aud: 'user' })
    requireAdmin(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
