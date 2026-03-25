// Stub fetch before any module loads to prevent ECONNREFUSED from module-level fetch calls
// (e.g., useAuth.ts and useAdminAuth.ts call fetch('/api/auth/me') at import time)
const noop = () => Promise.resolve(new Response('{}', { status: 401 }))
if (!globalThis.fetch || typeof globalThis.fetch !== 'function' || !(globalThis.fetch as any).__mocked) {
  globalThis.fetch = Object.assign(vi.fn(noop), { __mocked: true })
}
