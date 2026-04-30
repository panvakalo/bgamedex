<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import logoUrl from '../assets/img/BGameDex-logo.png'

const route = useRoute()
const router = useRouter()
const { login, setUserFromResponse, forgotPassword } = useAuth()

const isRegister = ref(false)
const showForgotPassword = ref(false)
const forgotEmail = ref('')
const forgotLoading = ref(false)
const forgotSuccess = ref(false)
const email = ref('')
const password = ref('')
const name = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)

async function handleForgotPassword() {
  error.value = null
  forgotLoading.value = true
  try {
    await forgotPassword(forgotEmail.value)
    forgotSuccess.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    forgotLoading.value = false
  }
}

function backToLogin() {
  showForgotPassword.value = false
  forgotSuccess.value = false
  forgotEmail.value = ''
  error.value = null
}

const queryError = computed(() => {
  const err = route.query.error as string | undefined
  if (!err) return null
  if (err === 'no_code') return 'Authentication was cancelled'
  if (err === 'auth_failed') return 'Authentication failed. Please try again.'
  return 'An error occurred. Please try again.'
})

const displayError = computed(() => error.value ?? queryError.value)

async function handleSubmit() {
  error.value = null

  if (isRegister.value && password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true

  const endpoint = isRegister.value ? '/api/auth/register' : '/api/auth/login'
  const body: Record<string, string> = { email: email.value, password: password.value }
  if (isRegister.value && name.value.trim()) {
    body.name = name.value.trim()
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      error.value = data.error ?? `HTTP ${res.status}`
      return
    }

    if (data.user) {
      setUserFromResponse(data.user)
      router.replace('/')
    } else {
      // Registration returned a message (e.g. "check your email")
      error.value = null
      successMessage.value = data.message ?? 'Check your email to complete registration'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="flex items-center justify-center min-h-screen relative overflow-hidden">
    <div class="relative w-full max-w-sm mx-4 animate-fade-up">
      <div class="text-center mb-10">
        <img :src="logoUrl" alt="Bgamedex" class="h-28 mx-auto mb-4 animate-float" />
        <h1 class="text-4xl font-extrabold text-text-primary mb-1.5 font-display tracking-tight">
          <span class="text-accent-light">Bgame</span>dex
        </h1>
        <p class="text-text-muted text-sm">Your board game collection</p>
      </div>

      <div class="glass-surface p-6">
        <div v-if="successMessage" class="mb-4 px-3 py-2 bg-positive/10 border-2 border-positive/30 text-positive text-sm">
          {{ successMessage }}
        </div>

        <div v-if="displayError" class="mb-4 px-3 py-2 bg-negative/10 border-2 border-negative/30 text-negative text-sm">
          {{ displayError }}
        </div>

        <!-- Forgot Password form -->
        <template v-if="showForgotPassword">
          <div v-if="forgotSuccess" class="mb-4 px-3 py-2 bg-positive/10 border-2 border-positive/30 text-positive text-sm">
            Check your email for a reset link.
          </div>
          <form v-else class="space-y-4 mb-4" @submit.prevent="handleForgotPassword">
            <p class="text-sm text-text-secondary mb-2">Enter your email and we'll send you a link to reset your password.</p>
            <div>
              <input
                v-model="forgotEmail"
                type="email"
                placeholder="Email"
                required
                class="w-full px-3 py-2.5 bg-surface-light text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <button
              type="submit"
              :disabled="forgotLoading"
              class="w-full py-2.5 bg-accent hover:bg-accent-light text-white font-semibold disabled:opacity-50 border-2 border-accent"
            >
              {{ forgotLoading ? 'Please wait...' : 'Send reset link' }}
            </button>
          </form>
          <p class="text-center text-sm text-text-muted">
            <button class="text-accent-light hover:underline" @click="backToLogin">Back to sign in</button>
          </p>
        </template>

        <!-- Email/Password form -->
        <template v-else>
          <form class="space-y-4 mb-4" @submit.prevent="handleSubmit">
            <div v-if="isRegister">
              <input
                v-model="name"
                type="text"
                placeholder="Name (optional)"
                class="w-full px-3 py-2.5 bg-surface-light text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <div>
              <input
                v-model="email"
                type="email"
                placeholder="Email"
                required
                class="w-full px-3 py-2.5 bg-surface-light text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <div>
              <input
                v-model="password"
                type="password"
                placeholder="Password"
                required
                :minlength="isRegister ? 12 : undefined"
                class="w-full px-3 py-2.5 bg-surface-light text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <div v-if="!isRegister" class="text-right -mt-2">
              <button type="button" class="text-sm text-accent-light hover:underline" @click="showForgotPassword = true; error = null">
                Forgot password?
              </button>
            </div>
            <div v-if="isRegister">
              <input
                v-model="confirmPassword"
                type="password"
                placeholder="Confirm password"
                required
                :minlength="12"
                class="w-full px-3 py-2.5 bg-surface-light text-text-primary placeholder:text-text-muted focus:outline-none"
              />
            </div>
            <button
              type="submit"
              :disabled="loading"
              class="w-full py-2.5 bg-accent hover:bg-accent-light text-white font-semibold disabled:opacity-50 border-2 border-accent"
            >
              {{ loading ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in' }}
            </button>
          </form>

          <p class="text-center text-sm text-text-muted mb-4">
            <template v-if="isRegister">
              Already have an account?
              <button class="text-accent-light hover:underline" @click="isRegister = false; error = null">Sign in</button>
            </template>
            <template v-else>
              Don't have an account?
              <button class="text-accent-light hover:underline" @click="isRegister = true; error = null">Create one</button>
            </template>
          </p>
        </template>

        <!-- Divider -->
        <div class="flex items-center gap-3 mb-4">
          <div class="flex-1 h-0.5 bg-surface-lighter" />
          <span class="text-xs text-text-muted uppercase">or</span>
          <div class="flex-1 h-0.5 bg-surface-lighter" />
        </div>

        <!-- Google button -->
        <button
          class="w-full flex items-center justify-center gap-3 px-6 py-2.5 bg-white text-gray-700 font-medium hover:bg-gray-50 border-2 border-gray-800"
          style="box-shadow: inset 2px 2px 0 0 #f8f8f8, inset -2px -2px 0 0 #c0c0c0"
          @click="login"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  </main>
</template>
</template>
