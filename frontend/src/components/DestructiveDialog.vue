<script setup lang="ts">
defineEmits<{ (e: 'confirm'): void; (e: 'cancel'): void }>()

defineProps<{
  title: string
  message: string
  confirmLabel: string
}>()
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60" @click="$emit('cancel')" />
      <div class="relative bg-surface-light rounded-xl shadow-2xl border border-surface-lighter p-6 w-full max-w-sm">
        <!-- Warning icon -->
        <div class="flex justify-center mb-4">
          <div class="w-12 h-12 rounded-full bg-negative/15 flex items-center justify-center">
            <svg class="w-6 h-6 text-negative" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        <h3 class="text-lg font-semibold text-text-primary text-center mb-2">{{ title }}</h3>
        <p class="text-sm text-text-secondary text-center mb-6">{{ message }}</p>

        <div class="flex justify-end gap-3">
          <button
            class="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
            @click="$emit('cancel')"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 rounded-lg text-sm font-medium bg-negative text-white hover:bg-negative/80 transition-colors"
            @click="$emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
