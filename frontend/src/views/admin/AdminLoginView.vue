<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminAuth } from '../../composables/useAdminAuth'

const router = useRouter()
const { login, isAdminAuthenticated } = useAdminAuth()

onMounted(() => {
  if (isAdminAuthenticated.value) {
    router.replace('/admin/dashboard')
  }
})

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    router.push('/admin/dashboard')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Login failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-surface px-4">
    <div class="w-full max-w-sm">
      <h1 class="text-2xl font-bold text-text-primary text-center mb-2">Admin</h1>
      <p class="text-sm text-text-muted text-center mb-6">Sign in to the admin panel</p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div
          v-if="error"
          class="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
        >
          {{ error }}
        </div>

        <div>
          <label for="email" class="block text-sm font-medium text-text-secondary mb-1">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full px-3 py-2 rounded-lg bg-surface-lighter border border-surface-lighter text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
            placeholder="admin@example.com"
          />
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-text-secondary mb-1">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full px-3 py-2 rounded-lg bg-surface-lighter border border-surface-lighter text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-dark transition-colors disabled:opacity-50"
        >
          {{ loading ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>
    </div>
  </div>
</template>
