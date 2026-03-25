<script setup lang="ts">
interface Props {
  label: string
  value: string | number
}
defineProps<Props>()
</script>

<template>
  <div class="bg-surface rounded-xl border border-surface-lighter p-6 text-center" style="box-shadow: var(--shadow-card)">
    <p class="text-4xl font-bold text-accent-light">{{ value }}</p>
    <p class="text-sm text-text-secondary mt-1">{{ label }}</p>
  </div>
</template>
