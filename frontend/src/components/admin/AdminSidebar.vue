<script setup lang="ts">
import { useRoute } from 'vue-router'
import { adminNavItems } from './adminNavItems'

const route = useRoute()

function isActive(item: typeof adminNavItems[number]): boolean {
  return route.path.startsWith(item.to)
}
</script>

<template>
  <nav class="flex flex-col items-center gap-1 px-2 pt-2">
    <RouterLink
      v-for="item in adminNavItems"
      :key="item.to"
      :to="item.to"
      class="group relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
      :class="isActive(item)
        ? 'bg-accent/15 text-accent-light'
        : 'text-text-muted hover:text-text-primary hover:bg-surface-lighter'"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
      </svg>
      <!-- Tooltip -->
      <span class="absolute left-full ml-2 px-2 py-1 rounded-md bg-surface-lighter text-text-primary text-xs whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-150">
        {{ item.label }}
      </span>
    </RouterLink>
  </nav>
</template>
