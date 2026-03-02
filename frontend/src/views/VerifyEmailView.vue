<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const router = useRouter()
const { verifyEmail } = useAuth()

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorMessage = ref('')

onMounted(async () => {
  const token = route.query.token as string | undefined

  if (!token) {
    status.value = 'error'
    errorMessage.value = 'Missing verification token'
    return
  }

  try {
    await verifyEmail(token)
    status.value = 'success'
    setTimeout(() => router.replace('/'), 2000)
  } catch (e) {
    status.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Verification failed'
  }
})
</script>

<template>
  <main class="flex items-center justify-center min-h-[calc(100vh-73px)]">
    <div class="w-full max-w-sm mx-4 text-center">
      <!-- Loading -->
      <template v-if="status === 'loading'">
        <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-4" />
        <p class="text-text-secondary">Verifying your email...</p>
      </template>

      <!-- Success -->
      <template v-else-if="status === 'success'">
        <div class="w-12 h-12 rounded-full bg-positive/20 flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 class="text-xl font-bold text-text-primary mb-2">Email verified!</h1>
        <p class="text-text-secondary">Redirecting you to Bgamedex...</p>
      </template>

      <!-- Error -->
      <template v-else>
        <div class="w-12 h-12 rounded-full bg-negative/20 flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-negative" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 class="text-xl font-bold text-text-primary mb-2">Verification failed</h1>
        <p class="text-text-secondary mb-6">{{ errorMessage }}</p>
        <div class="flex gap-3 justify-center">
          <RouterLink
            to="/"
            class="px-6 py-2 rounded-lg bg-accent hover:bg-accent-light text-white font-medium transition-colors"
          >
            Go to Bgamedex
          </RouterLink>
          <RouterLink
            to="/login"
            class="px-6 py-2 rounded-lg bg-surface-light border border-surface-lighter text-text-secondary hover:text-text-primary transition-colors"
          >
            Sign in
          </RouterLink>
        </div>
      </template>
    </div>
  </main>
</template>
