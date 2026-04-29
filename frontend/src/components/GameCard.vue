<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { Game } from '../types/game'
import { useAuth } from '../composables/useAuth'

const { hasFeature } = useAuth()
const props = withDefaults(defineProps<{ game: Game; readonly?: boolean; featured?: boolean }>(), { readonly: false, featured: false })
const emit = defineEmits<{ (e: 'delete', id: number): void }>()

function formatDuration(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'N/A'
  if (min === max || max === null) return `${min} min`
  if (min === null) return `${max} min`
  return `${min}–${max} min`
}

function formatPlayers(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'N/A'
  if (min === max || max === null) return `${min}`
  if (min === null) return `1–${max}`
  return `${min}–${max}`
}
</script>

<template>
  <component
    :is="props.readonly ? 'div' : RouterLink"
    v-bind="props.readonly ? {} : { to: '/games/' + game.id }"
    class="card-tactile group flex flex-col rounded-2xl bg-surface-light border border-surface-lighter p-0 overflow-hidden relative no-underline"
  >

    <!-- Image -->
    <div class="relative overflow-hidden">
      <img v-if="game.image_url" :src="game.image_url" :alt="game.title" :class="['w-full object-cover transition-transform duration-500 group-hover:scale-110', featured ? 'aspect-[16/10]' : 'aspect-[3/4]']" />
      <div v-else :class="['w-full bg-surface-lighter', featured ? 'aspect-[16/10]' : 'aspect-[3/4]']" />
      <!-- Dark overlay at bottom -->
      <div v-if="game.image_url" class="absolute bottom-0 left-0 right-0 h-8 bg-black/50 pointer-events-none" />
      <!-- Play count overlay -->
      <div
        v-if="game.play_count > 0"
        class="absolute bottom-2 left-2.5 flex items-center gap-1 text-white/90 text-[10px] font-medium"
      >
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ game.play_count }}
      </div>
      <!-- AI Rules badge -->
      <div
        v-if="game.rules_url && hasFeature('rules_access')"
        class="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 text-[8px] font-semibold tracking-wide uppercase text-white bg-accent border-2 border-white"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
        AI Rules
      </div>
    </div>

    <div class="flex flex-col flex-1 p-3 sm:p-4">
    <div class="flex items-start justify-between gap-1 mb-2 sm:mb-3">
      <h3 :class="['font-bold text-text-primary leading-snug tracking-tight line-clamp-2 font-display', featured ? 'text-base sm:text-xl' : 'text-sm sm:text-base']">{{ game.title }}</h3>
      <button
        v-if="!props.readonly"
        class="p-1 rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-negative hover:bg-negative/10 transition-all flex-shrink-0"
        title="Delete game"
        @click.prevent="emit('delete', game.id)"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>

    <div class="flex items-center gap-3 mb-2 sm:mb-4 text-xs text-text-muted whitespace-nowrap overflow-hidden">
      <span class="flex items-center gap-1 sm:gap-1.5">
        <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        {{ formatPlayers(game.min_players, game.max_players) }}
      </span>
      <span class="flex items-center gap-1 sm:gap-1.5">
        <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {{ formatDuration(game.min_duration, game.max_duration) }}
      </span>
    </div>

    <div class="flex flex-wrap gap-1 sm:gap-1.5 mt-auto">
      <span v-if="game.is_card_game" class="badge-purple badge-interactive px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold">Card</span>
      <span v-if="game.is_cooperative" class="badge-green badge-interactive px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold">Co-op</span>
      <span v-if="game.plays_in_teams" class="badge-blue badge-interactive px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold">Teams</span>
      <span v-if="game.supports_campaign" class="badge-amber badge-interactive px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold">Campaign</span>
      <span
        v-for="tag in game.tags"
        :key="tag.id"
        class="badge-interactive px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-accent/10 text-accent-light border border-accent/20"
      >
        {{ tag.name }}
      </span>
    </div>
    </div>
  </component>
</template>
