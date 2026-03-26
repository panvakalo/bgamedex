<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

const STORAGE_KEY = 'bgamedex-onboarding-dismissed'
const dismissed = ref(localStorage.getItem(STORAGE_KEY) === 'true')

function dismiss() {
  localStorage.setItem(STORAGE_KEY, 'true')
  dismissed.value = true
}

interface Card {
  title: string
  description: string
  icon: string
  to?: string
}

const cards: Card[] = [
  {
    title: 'Ask AI about rules',
    description: 'Get instant answers about any game\'s rules',
    icon: 'sparkle',
  },
  {
    title: 'Track your plays',
    description: 'Log sessions and see your play history',
    icon: 'play',
    to: '/stats',
  },
  {
    title: 'Build your wishlist',
    description: 'Save games you want to try next',
    icon: 'star',
    to: '/wishlist',
  },
  {
    title: 'Connect with friends',
    description: 'Find friends and share your collection',
    icon: 'users',
    to: '/friends',
  },
]
</script>

<template>
  <div v-if="!dismissed" class="mb-6">
    <div class="flex items-center justify-between mb-3">
      <p class="text-sm text-text-muted">Discover what you can do</p>
      <button
        class="text-xs text-text-muted hover:text-text-secondary transition-colors"
        @click="dismiss"
      >
        Dismiss
      </button>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <component
        :is="card.to ? RouterLink : 'div'"
        v-for="card in cards"
        :key="card.title"
        :to="card.to"
        class="bg-surface-light border border-surface-lighter rounded-xl p-3 flex items-start gap-3"
        :class="card.to ? 'hover:border-text-muted transition-colors' : ''"
      >
        <!-- Sparkle icon -->
        <div v-if="card.icon === 'sparkle'" class="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>

        <!-- Play icon -->
        <div v-else-if="card.icon === 'play'" class="w-8 h-8 rounded-lg bg-positive/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4 text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <!-- Star icon -->
        <div v-else-if="card.icon === 'star'" class="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>

        <!-- Users icon -->
        <div v-else-if="card.icon === 'users'" class="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>

        <div class="min-w-0">
          <p class="text-sm font-medium text-text-primary">{{ card.title }}</p>
          <p class="text-xs text-text-muted mt-0.5">{{ card.description }}</p>
        </div>
      </component>
    </div>
  </div>
</template>
