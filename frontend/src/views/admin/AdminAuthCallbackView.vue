<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminAuth } from '../../composables/useAdminAuth'

const route = useRoute()
const router = useRouter()
const { setAdminUserFromResponse } = useAdminAuth()

onMounted(async () => {
  const code = route.query.code as string | undefined
  if (!code) {
    router.replace('/admin/login?error=auth_failed')
    return
  }

  try {
    const res = await fetch('/api/admin/auth/exchange-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    if (!res.ok || !data.user) {
      router.replace('/admin/login?error=auth_failed')
      return
    }
    setAdminUserFromResponse(data.user)
    router.replace('/admin/dashboard')
  } catch {
    router.replace('/admin/login?error=auth_failed')
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-surface">
    <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
  </div>
</template>
