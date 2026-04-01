import { ref, computed } from 'vue'

interface User {
  sub: number
  email: string
  name: string
  picture: string
  emailVerified: boolean
  features: string[]
}

const user = ref<User | null>(null)
const initializing = ref(true)

let authReadyResolve: () => void
export const authReady = new Promise<void>((resolve) => { authReadyResolve = resolve })

fetch('/api/auth/me', { credentials: 'include' })
  .then(async (res) => {
    if (res.ok) {
      const data = await res.json()
      user.value = { sub: data.sub, email: data.email, name: data.name, picture: data.picture ?? '', emailVerified: !!data.emailVerified, features: data.features ?? [] }
    }
  })
  .catch(() => { /* no session */ })
  .finally(() => {
    initializing.value = false
    authReadyResolve()
  })

const isAuthenticated = computed(() => !!user.value)

export function useAuth() {
  function setUserFromResponse(data: { sub: number; email: string; name: string; picture?: string; emailVerified?: boolean; features?: string[] }) {
    user.value = {
      sub: data.sub,
      email: data.email,
      name: data.name,
      picture: data.picture ?? '',
      emailVerified: !!data.emailVerified,
      features: data.features ?? [],
    }
  }

  function hasFeature(name: string): boolean {
    return user.value?.features.includes(name) ?? false
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch { /* best-effort */ }
    user.value = null
  }

  function login() {
    window.location.href = '/api/auth/google'
  }

  function updateUser(fields: Partial<User>) {
    if (user.value) {
      user.value = { ...user.value, ...fields }
    }
  }

  async function verifyEmail(verificationToken: string): Promise<void> {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token: verificationToken }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Verification failed')
    if (data.user) setUserFromResponse(data.user)
  }

  async function resendVerification(): Promise<void> {
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to resend')
  }

  async function forgotPassword(email: string): Promise<void> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Request failed')
  }

  async function resetPassword(resetToken: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token: resetToken, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Reset failed')
    if (data.user) setUserFromResponse(data.user)
  }

  return { user, isAuthenticated, initializing, setUserFromResponse, logout, login, updateUser, hasFeature, verifyEmail, resendVerification, forgotPassword, resetPassword }
}
