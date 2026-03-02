import { ref, computed } from 'vue'

interface User {
  sub: number
  email: string
  name: string
  picture: string
  emailVerified: boolean
}

interface JwtPayload {
  sub: number
  email: string
  name: string
  emailVerified?: boolean
  exp?: number
}

function decodeToken(jwt: string): Omit<User, 'picture'> | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null

    const payload = JSON.parse(atob(parts[1])) as JwtPayload

    if (!payload.sub || !payload.email) return null

    // Reject expired tokens
    if (payload.exp && payload.exp * 1000 < Date.now()) return null

    return { sub: payload.sub, email: payload.email, name: payload.name, emailVerified: !!payload.emailVerified }
  } catch {
    return null
  }
}

function isTokenExpired(jwt: string): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1])) as JwtPayload
    if (!payload.exp) return false
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

const token = ref<string | null>(null)
const user = ref<User | null>(null)

async function fetchProfile() {
  if (!token.value) return
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token.value}` },
    })
    if (res.status === 401) {
      // Token rejected by server — force logout
      token.value = null
      user.value = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      return
    }
    if (!res.ok) return
    const data = await res.json()
    if (user.value) {
      user.value = { ...user.value, picture: data.picture ?? '', emailVerified: !!data.emailVerified }
      localStorage.setItem('user', JSON.stringify(user.value))
    }
  } catch { /* silent */ }
}

// Initialize from stored token
const savedToken = localStorage.getItem('token')
if (savedToken && !isTokenExpired(savedToken)) {
  token.value = savedToken
  const decoded = decodeToken(savedToken)
  const saved = localStorage.getItem('user')
  if (decoded && saved) {
    try { user.value = { picture: '', ...JSON.parse(saved), ...decoded } } catch { user.value = { ...decoded, picture: '' } }
  } else {
    user.value = decoded ? { ...decoded, picture: '' } : null
  }
  fetchProfile()
} else if (savedToken) {
  // Expired token — clean up
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

const isAuthenticated = computed(() => !!token.value && !!user.value)

export function useAuth() {
  function setToken(jwt: string) {
    const decoded = decodeToken(jwt)
    if (!decoded) return // Reject malformed tokens

    token.value = jwt
    user.value = { ...decoded, picture: '', emailVerified: decoded.emailVerified }
    localStorage.setItem('token', jwt)
    fetchProfile()
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  function getAuthHeaders(): Record<string, string> {
    const t = token.value
    if (!t) return {}
    // Check expiration before using
    if (isTokenExpired(t)) {
      logout()
      return {}
    }
    return { Authorization: `Bearer ${t}` }
  }

  function login() {
    window.location.href = '/api/auth/google'
  }

  function updateUser(fields: Partial<User>) {
    if (user.value) {
      user.value = { ...user.value, ...fields }
      localStorage.setItem('user', JSON.stringify(user.value))
    }
  }

  async function verifyEmail(verificationToken: string): Promise<void> {
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verificationToken }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Verification failed')
    if (data.token) setToken(data.token)
  }

  async function resendVerification(): Promise<void> {
    const res = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Failed to resend')
  }

  async function forgotPassword(email: string): Promise<void> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Request failed')
  }

  async function resetPassword(resetToken: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: resetToken, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Reset failed')
    if (data.token) setToken(data.token)
  }

  return { token, user, isAuthenticated, setToken, logout, getAuthHeaders, login, updateUser, verifyEmail, resendVerification, forgotPassword, resetPassword }
}
