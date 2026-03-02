import { defineConfig } from '@playwright/test'
import path from 'path'
import os from 'os'

const testDbPath = path.join(os.tmpdir(), 'bgamedex-e2e-test.db')

// Make DB_PATH available to test helpers (addGameViaDb)
process.env.DB_PATH = testDbPath

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'npx tsx src/index.ts',
      cwd: path.join(__dirname, 'backend'),
      port: 3000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        DB_PATH: testDbPath,
        JWT_SECRET: 'test-secret-e2e',
        PORT: '3000',
      },
    },
    {
      command: 'npx vite',
      cwd: path.join(__dirname, 'frontend'),
      port: 4200,
      reuseExistingServer: false,
    },
  ],
})
