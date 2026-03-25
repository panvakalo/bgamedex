<script setup lang="ts">
interface Props {
  size?: 'sm' | 'md'
}

withDefaults(defineProps<Props>(), { size: 'md' })
</script>

<template>
  <div
    class="border-2 border-accent/30 border-t-accent rounded-full animate-spin"
    :class="size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'"
  />
</template>
