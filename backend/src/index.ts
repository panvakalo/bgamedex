import 'dotenv/config'
import express from 'express'
import cors from 'cors'
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
import { requireAuth } from './auth.js'

// Validate required environment variables on startup
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

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      frameAncestors: ["'none'"],
    },
  },
}))

// CORS — restrict to known origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:4200']

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600,
}))

// Body size limits
app.use(express.json({ limit: '1mb' }))

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})
app.use('/api', globalLimiter)

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
})

// Stricter rate limit for expensive operations (AI chat, external API calls)
const expensiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

if (process.env.NODE_ENV !== 'production') {
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

// Global error handler — never leak stack traces
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// In production, serve the Vue frontend static files
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
