# Bgamedex

A board game collection manager. Track your games, log plays, manage wishlists, and see your collection's value.

## Tech Stack

- **Backend:** Express.js, TypeScript, SQLite (better-sqlite3)
- **Frontend:** Vue 3, TypeScript, Vite, Tailwind CSS v4
- **Deployment:** Fly.io (Docker, persistent volume for SQLite)

## Project Structure

```
bgamedex/
├── backend/
│   ├── data/games.json          # Seed data
│   └── src/
│       ├── index.ts             # Express server (API + static file serving)
│       ├── database.ts          # SQLite schema + connection
│       ├── auth.ts              # JWT authentication
│       ├── seed.ts              # Populate DB from games.json
│       └── routes/              # API route handlers
├── frontend/
│   └── src/
│       ├── App.vue              # Main layout with sidebar navigation
│       ├── views/               # Page components
│       ├── composables/         # Vue composables
│       ├── components/          # Reusable UI components
│       └── types/               # TypeScript interfaces
├── Dockerfile                   # Multi-stage build (frontend + backend)
└── fly.toml                     # Fly.io deployment config
```

## Local Development

### Prerequisites

- Node.js 22+
- npm

### Setup

```bash
# Install all dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Seed the database (first time only)
npm run seed
```

### Run

```bash
npm run dev
```

This starts both servers concurrently:
- **Backend:** http://localhost:3000 (Express API)
- **Frontend:** http://localhost:4200 (Vite dev server, proxies `/api/*` to backend)

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start backend + frontend concurrently |
| `npm run seed` | Populate SQLite from `backend/data/games.json` |
| `npm run build` | Build frontend for production |

## Deployment (Fly.io)

The app is deployed on [Fly.io](https://fly.io) as a single Docker container. In production, Express serves both the API and the Vue frontend static files. SQLite is stored on a persistent volume.

### Deploy

```bash
fly deploy
```

The Dockerfile handles the multi-stage build:
1. Builds the Vue frontend (`npm run build`)
2. Installs backend production dependencies
3. Copies everything into a slim Node.js image
4. On first boot, auto-seeds the database if it doesn't exist

### Fly.io Configuration

- **Region:** Amsterdam (`ams`)
- **Machine:** shared-cpu-1x, 1GB RAM
- **Volume:** 1GB persistent disk mounted at `/data` (stores `bgamedex.db`)
- **Auto-stop:** Machine stops when idle, wakes on incoming request (first request after idle takes a few seconds)

### Set Secrets

```bash
fly secrets set JWT_SECRET="$(openssl rand -hex 32)"
fly secrets set ALLOWED_ORIGINS="https://bgamedex-red-wildflower-3387.fly.dev"
fly secrets set GOOGLE_CLIENT_ID="your-google-client-id"
fly secrets set GOOGLE_CLIENT_SECRET="your-google-client-secret"
fly secrets set GOOGLE_REDIRECT_URI="https://bgamedex-red-wildflower-3387.fly.dev/api/auth/google/callback"
fly secrets set FRONTEND_URL="https://bgamedex-red-wildflower-3387.fly.dev"
fly secrets set ANTHROPIC_API_KEY="your-anthropic-api-key"
```

### Re-seed the Database in Production

If you update `backend/data/games.json` and want to re-seed:

```bash
fly ssh console -C "rm /data/bgamedex.db"
fly deploy
```

### Useful Fly Commands

```bash
fly status                  # App status and machine info
fly logs                    # Stream live logs
fly ssh console             # SSH into the running machine
fly volumes list            # List persistent volumes
```

## API

### Swagger Documentation

Interactive API docs available at `/api/docs` (both locally and in production).
