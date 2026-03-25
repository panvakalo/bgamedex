import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import swaggerUi from 'swagger-ui-express'
import { swaggerDocument } from './swagger.js'
import gamesRouter from './routes/games.js'
import chatRouter from './routes/chat.js'
import authRouter from './routes/auth.js'
import playsRouter, { statsRouter } from './routes/plays.js'
import tagsRouter from './routes/tags.js'
import pricesRouter from './routes/prices.js'
import friendsRouter from './routes/friends.js'
import adminAuthRouter from './routes/admin/auth.js'
import adminUsersRouter from './routes/admin/users.js'
import adminAnalyticsRouter from './routes/admin/analytics.js'
import adminSystemRouter from './routes/admin/system.js'
import { requireAuth, requireAdminAuth } from './auth.js'
import { requireAdmin } from './admin-auth.js'

const REQUIRED_ENV = ['JWT_SECRET']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`)
    process.exit(1)
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT ?? 3000

// Trust first proxy (Fly.io) so express-rate-limit sees real client IPs
app.set('trust proxy', 1)

// Health check — before CORS/helmet so monitoring tools always reach it
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      styleSrcAttr: ["'unsafe-inline'"],
      frameAncestors: ["'none'"],
    },
  },
}))

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:4200']

app.use(cors({
  origin(origin, callback) {
    // No origin = same-origin request (frontend served by this Express app) — always allow
    if (!origin) {
      callback(null, true)
      return
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  maxAge: 3600,
}))

app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})
app.use('/api', globalLimiter)

app.use((req, res, next) => {
  if (req.hostname === 'www.bgamedex.com') {
    return res.redirect(301, `https://bgamedex.com${req.originalUrl}`)
  }
  next()
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
})

const expensiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
})

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
})

app.use('/api/admin/auth/login', adminAuthLimiter)
app.use('/api/admin/auth', adminAuthRouter)
app.use('/api/admin/users', requireAdminAuth, requireAdmin, adminUsersRouter)
app.use('/api/admin/analytics', requireAdminAuth, requireAdmin, adminAnalyticsRouter)
app.use('/api/admin/system', requireAdminAuth, requireAdmin, adminSystemRouter)

if (process.env.NODE_ENV === 'development') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
}
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/auth/verify-email', authLimiter)
app.use('/api/auth/resend-verification', authLimiter)
app.use('/api/auth/forgot-password', authLimiter)
app.use('/api/auth/reset-password', authLimiter)
app.use('/api/auth/exchange-code', authLimiter)
app.use('/api/auth/google', authLimiter)
app.use('/api/auth', authRouter)
app.use('/api/games', requireAuth, gamesRouter)
app.use('/api/games', requireAuth, expensiveLimiter, chatRouter)
app.use('/api/games', requireAuth, playsRouter)
app.use('/api/tags', requireAuth, tagsRouter)
app.use('/api', requireAuth, statsRouter)
app.use('/api/prices', requireAuth, expensiveLimiter, pricesRouter)
app.use('/api/friends', requireAuth, friendsRouter)

// Global error handler — never leak stack traces
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

const frontendDist = path.join(__dirname, '..', 'public')
app.use(express.static(frontendDist))
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api')) return next()
  res.sendFile(path.join(frontendDist, 'index.html'))
})

if (!process.env.RESEND_API_KEY) {
  console.warn('WARNING: RESEND_API_KEY not set — verification emails will not be sent')
}
if (!process.env.OPENAI_API_KEY) {
  console.warn('WARNING: OPENAI_API_KEY not set — rules chat will not be available')
}

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Bgamedex API running on http://0.0.0.0:${PORT}`)
})
