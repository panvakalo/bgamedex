<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const router = useRouter()
const { resetPassword } = useAuth()

const token = ref('')
const password = ref('')
const confirmPassword = ref('')
const status = ref<'form' | 'loading' | 'success' | 'error'>('form')
const errorMessage = ref('')

onMounted(() => {
  const t = route.query.token as string | undefined
  if (!t) {
    status.value = 'error'
    errorMessage.value = 'Missing reset token'
    return
  }
  token.value = t
})

async function handleSubmit() {
  errorMessage.value = ''

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match'
    return
  }

  if (password.value.length < 12) {
    errorMessage.value = 'Password must be at least 12 characters'
    return
  }

  status.value = 'loading'

  try {
    await resetPassword(token.value, password.value)
    status.value = 'success'
    setTimeout(() => router.replace('/'), 2000)
  } catch (e) {
    status.value = 'form'
    errorMessage.value = e instanceof Error ? e.message : 'Reset failed'
  }
}
</script>

<template>
  <main class="flex items-center justify-center min-h-[calc(100vh-73px)]">
    <div class="w-full max-w-sm mx-4">
      <!-- Loading -->
      <template v-if="status === 'loading'">
        <div class="text-center">
          <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p class="text-text-secondary">Resetting your password...</p>
        </div>
      </template>

      <!-- Success -->
      <template v-else-if="status === 'success'">
        <div class="text-center">
          <div class="w-12 h-12 rounded-full bg-positive/20 flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 class="text-xl font-bold text-text-primary mb-2">Password reset!</h1>
          <p class="text-text-secondary">Redirecting you to Bgamedex...</p>
        </div>
      </template>

      <!-- Error (no token) -->
      <template v-else-if="status === 'error'">
        <div class="text-center">
          <div class="w-12 h-12 rounded-full bg-negative/20 flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-negative" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 class="text-xl font-bold text-text-primary mb-2">Invalid reset link</h1>
          <p class="text-text-secondary mb-6">{{ errorMessage }}</p>
          <RouterLink
            to="/login"
            class="px-6 py-2 rounded-lg bg-accent hover:bg-accent-light text-white font-medium transition-colors"
          >
            Back to sign in
          </RouterLink>
        </div>
      </template>

      <!-- Form -->
      <template v-else>
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-text-primary mb-2">Set a new password</h1>
          <p class="text-text-secondary">Enter your new password below.</p>
        </div>

        <div v-if="errorMessage" class="mb-6 px-4 py-3 rounded-lg bg-negative/10 border border-negative/30 text-negative text-sm">
          {{ errorMessage }}
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div>
            <input
              v-model="password"
              type="password"
              placeholder="New password"
              required
              :minlength="12"
              class="w-full px-4 py-3 rounded-lg bg-surface-light border border-surface-lighter text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <div>
            <input
              v-model="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              required
              :minlength="12"
              class="w-full px-4 py-3 rounded-lg bg-surface-light border border-surface-lighter text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <p class="text-xs text-text-muted">Minimum 12 characters</p>
          <button
            type="submit"
            class="w-full py-3 rounded-lg bg-accent hover:bg-accent-light text-white font-medium transition-colors"
          >
            Reset password
          </button>
        </form>

        <p class="text-center text-sm text-text-muted mt-6">
          <RouterLink to="/login" class="text-accent-light hover:underline">Back to sign in</RouterLink>
        </p>
      </template>
    </div>
  </main>
</template>
