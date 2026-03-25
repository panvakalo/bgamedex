import { ref, computed } from 'vue'

import router from '../router'

interface AdminUser {
  sub: number
  email: string
  name: string
  isAdmin: boolean
}

const adminUser = ref<AdminUser | null>(null)
const adminInitializing = ref(true)

let adminAuthPromise: Promise<void> | null = null

function initAdminAuth(): Promise<void> {
  if (adminAuthPromise) return adminAuthPromise

  adminAuthPromise = fetch('/api/admin/auth/me', { credentials: 'include' })
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json()
        adminUser.value = data.user
      }
    })
    .catch(() => { /* no session */ })
    .finally(() => {
      adminInitializing.value = false
    })

  return adminAuthPromise
}

// Lazy: only resolves when actually awaited (i.e. when navigating to admin routes)
export const adminAuthReady = {
  then(resolve: (v: void) => unknown, reject?: (e: unknown) => unknown) {
    return initAdminAuth().then(resolve, reject)
  },
} as Promise<void>

const isAdminAuthenticated = computed(() => !!adminUser.value)

export function useAdminAuth() {
  async function login(email: string, password: string): Promise<void> {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Login failed')

    if (!data.user?.isAdmin) throw new Error('Invalid response from server')
    adminUser.value = data.user
  }

  function setAdminUserFromResponse(data: { sub: number; email: string; name: string; isAdmin: boolean }) {
    adminUser.value = data
  }

  function loginWithGoogle() {
    window.location.href = '/api/admin/auth/google'
  }

  async function logout() {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' })
    } catch { /* best-effort */ }
    adminUser.value = null
    router.push('/admin/login')
  }

  return { adminUser, isAdminAuthenticated, adminInitializing, login, loginWithGoogle, setAdminUserFromResponse, logout }
}
