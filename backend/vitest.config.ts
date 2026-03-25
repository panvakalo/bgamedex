import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/seed.ts',
        'src/swagger.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
    },
  },
})
