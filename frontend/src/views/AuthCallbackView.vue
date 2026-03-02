<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const router = useRouter()
const { setToken } = useAuth()

onMounted(async () => {
  const code = route.query.code as string | undefined
  if (!code) {
    router.replace('/login?error=no_token')
    return
  }

  try {
    const res = await fetch('/api/auth/exchange-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    if (!res.ok || !data.token) {
      router.replace('/login?error=auth_failed')
      return
    }
    setToken(data.token)
    router.replace('/')
  } catch {
    router.replace('/login?error=auth_failed')
  }
})
</script>

<template>
  <main class="flex items-center justify-center min-h-[calc(100vh-73px)]">
    <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
  </main>
</template>
