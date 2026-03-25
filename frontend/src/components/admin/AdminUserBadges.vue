<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  isAdmin?: boolean
  googleId?: string | null
  hasPassword?: boolean
  emailVerified?: boolean
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  isAdmin: false,
  googleId: null,
  hasPassword: false,
  emailVerified: false,
  size: 'sm',
})

const badgeClass = computed(() => props.size === 'md'
  ? 'inline-block px-2 py-1 rounded text-xs font-medium'
  : 'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium'
)
</script>

<template>
  <div class="flex items-center gap-1.5" :class="size === 'sm' ? 'justify-end' : ''">
    <span v-if="isAdmin" :class="[badgeClass, 'bg-accent/15 text-accent-light']">Admin</span>
    <span v-if="googleId" :class="[badgeClass, 'bg-blue-500/15 text-blue-400']">Google</span>
    <span v-else-if="hasPassword" :class="[badgeClass, 'bg-surface-lighter text-text-muted']">Email</span>
    <span v-if="emailVerified" :class="[badgeClass, 'bg-green-500/15 text-green-400']">Verified</span>
    <span v-else :class="[badgeClass, 'bg-amber-500/15 text-amber-400']">Unverified</span>
  </div>
</template>
