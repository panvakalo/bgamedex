<script setup lang="ts">
import { useNotify } from '../composables/useNotify'

const { notifications, dismiss } = useNotify()
</script>

<template>
  <div class="fixed top-20 right-4 z-50 flex flex-col gap-2 w-80">
    <TransitionGroup
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-x-full opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-full opacity-0"
    >
      <div
        v-for="n in notifications"
        :key="n.id"
        class="flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg bg-surface"
        :class="n.type === 'success' ? 'border-positive/30' : 'border-negative/30'"
      >
        <!-- Icon -->
        <svg
          v-if="n.type === 'success'"
          class="w-5 h-5 text-positive flex-shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <svg
          v-else
          class="w-5 h-5 text-negative flex-shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
        </svg>

        <!-- Message -->
        <span
          class="flex-1 text-sm"
          :class="n.type === 'success' ? 'text-positive' : 'text-negative'"
        >
          {{ n.message }}
        </span>

        <!-- Dismiss -->
        <button
          class="p-0.5 rounded text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
          @click="dismiss(n.id)"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
