import crypto from 'crypto'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthPayload {
  sub: number
  email: string
  name: string
  emailVerified: boolean
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
  return jwt.sign({ ...payload } as unknown as jwt.JwtPayload, getJwtSecret(), { algorithm: 'HS256', expiresIn: '24h' })
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as unknown as AuthPayload
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  try {
    req.user = verifyToken(header.slice(7))
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
