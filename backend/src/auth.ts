import crypto from 'crypto'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getDb } from './database.js'

export interface AuthPayload {
  sub: number
  email: string
  name: string
  emailVerified: boolean
  isAdmin: boolean
  ver: number
  aud: 'user' | 'admin'
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return secret
}

export function signToken(payload: AuthPayload): string {
  const { aud, ...rest } = payload
  return jwt.sign({ ...rest }, getJwtSecret(), { algorithm: 'HS256', expiresIn: '24h', audience: aud })
}

export function verifyToken(token: string, expectedAudience?: 'user' | 'admin'): AuthPayload {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    ...(expectedAudience ? { audience: expectedAudience } : {}),
  }) as jwt.JwtPayload & AuthPayload
  const { sub, email, name, emailVerified, isAdmin, ver, aud } = decoded
  return { sub, email, name, emailVerified, isAdmin, ver: ver ?? 1, aud: (aud as 'user' | 'admin') ?? 'user' }
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Valid bcrypt hash used as fallback to prevent timing-based user enumeration
export const DUMMY_BCRYPT_HASH = '$2b$12$IzmRNb4c69gjgFu76bcqoe6MqoW3yu1VLNbHS9nGW4.gqZC3GsUxi'

const COOKIE_MAX_AGE = 24 * 60 * 60 * 1000

export function setAuthCookie(res: Response, token: string): void {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie('token', { path: '/' })
}

export function setAdminCookie(res: Response, token: string): void {
  res.cookie('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: COOKIE_MAX_AGE,
  })
}

export function clearAdminCookie(res: Response): void {
  res.clearCookie('admin_token', { path: '/api/admin' })
}

function authenticateFromCookie(req: Request, res: Response, next: NextFunction, cookieName: string, expectedAudience: 'user' | 'admin'): void {
  const token = req.cookies?.[cookieName]
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    const payload = verifyToken(token, expectedAudience)
    const db = getDb()
    const row = db.prepare('SELECT token_version FROM users WHERE id = ?').get(payload.sub) as { token_version: number } | undefined
    if (!row || payload.ver !== row.token_version) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  authenticateFromCookie(req, res, next, 'token', 'user')
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  authenticateFromCookie(req, res, next, 'admin_token', 'admin')
}
