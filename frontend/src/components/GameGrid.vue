<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { Game } from '../types/game'
import type { SortOption, SortDir } from '../composables/useGames'
import GameCard from './GameCard.vue'

const props = withDefaults(defineProps<{
  games: Game[]
  loading: boolean
  totalCount: number
  viewMode: 'tiles' | 'list'
  sort: SortOption
  sortDir: SortDir
  readonly?: boolean
}>(), { readonly: false })

const emit = defineEmits<{
  (e: 'update:viewMode', value: 'tiles' | 'list'): void
  (e: 'update:sort', value: SortOption): void
  (e: 'update:sortDir', value: SortDir): void
  (e: 'delete', id: number): void
}>()

const sortOptions: { value: SortOption; label: string; defaultDir: SortDir }[] = [
  { value: 'alpha', label: 'A–Z', defaultDir: 'asc' },
  { value: 'added', label: 'Date added', defaultDir: 'desc' },
  { value: 'most-played', label: 'Most played', defaultDir: 'desc' },
  { value: 'duration', label: 'Duration', defaultDir: 'asc' },
]

function onSortChange(value: SortOption) {
  emit('update:sort', value)
  const opt = sortOptions.find((o) => o.value === value)
  if (opt) emit('update:sortDir', opt.defaultDir)
}

function formatPlayers(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'N/A'
  if (min === max || max === null) return `${min}`
  if (min === null) return `1–${max}`
  return `${min}–${max}`
}

function formatDuration(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'N/A'
  if (min === max || max === null) return `${min} min`
  if (min === null) return `${max} min`
  return `${min}–${max} min`
}
</script>

<template>
  <div v-if="loading && games.length === 0" class="flex items-center justify-center py-20">
    <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>

  <div v-else-if="!loading && games.length === 0" class="text-center py-20">
    <p class="text-text-muted text-lg">No games match your filters</p>
    <p class="text-text-muted/60 text-sm mt-1">Try adjusting your criteria</p>
  </div>

  <template v-else>
    <div class="flex items-center justify-between mb-4">
      <p class="text-text-muted text-sm" style="font-family: var(--font-body)">
        <span class="text-2xl font-extrabold text-text-primary stats-number" style="font-family: var(--font-display)">{{ games.length }}</span>
        <span v-if="games.length !== totalCount"> of <span class="font-bold stats-number">{{ totalCount }}</span></span>
        <span class="ml-0.5" style="font-family: var(--font-serif); font-style: italic">games</span>
      </p>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1">
          <select
            :value="sort"
            class="h-8 px-2 pr-7 rounded-lg bg-surface-lighter border border-surface-lighter text-text-secondary text-sm focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
            style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E&quot;); background-repeat: no-repeat; background-position: right 0.5rem center;"
            @change="onSortChange(($event.target as HTMLSelectElement).value as SortOption)"
          >
            <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <button
            class="h-8 w-8 flex items-center justify-center rounded-lg border border-surface-lighter text-text-muted hover:text-text-primary hover:border-text-muted transition-colors"
            :title="sortDir === 'asc' ? 'Ascending' : 'Descending'"
            @click="$emit('update:sortDir', sortDir === 'asc' ? 'desc' : 'asc')"
          >
            <svg class="w-4 h-4 transition-transform" :class="sortDir === 'desc' && 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
          </button>
        </div>
      <div class="flex items-center gap-1 bg-surface-lighter rounded-lg p-0.5">
        <button
          :class="['p-1.5 rounded-md transition-colors', viewMode === 'tiles' ? 'bg-surface-light text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary']"
          title="Tile view"
          @click="$emit('update:viewMode', 'tiles')"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        </button>
        <button
          :class="['p-1.5 rounded-md transition-colors', viewMode === 'list' ? 'bg-surface-light text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary']"
          title="List view"
          @click="$emit('update:viewMode', 'list')"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
        </button>
      </div>
      </div>
    </div>

    <!-- Tiles view -->
    <div
      v-if="viewMode === 'tiles'"
      :key="`${games.length}-${games[0]?.id}`"
      class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
    >
      <GameCard
        v-for="(game, index) in games"
        :key="game.id"
        :game="game"
        :readonly="props.readonly"
        class="animate-card-enter"
        :style="{ animationDelay: `${Math.min(index, 12) * 40}ms` }"
        @delete="$emit('delete', $event)"
      />
    </div>

    <!-- List view -->
    <div v-else class="flex flex-col rounded-2xl bg-surface-light border border-surface-lighter overflow-hidden" style="box-shadow: var(--shadow-card)">
      <component
        :is="props.readonly ? 'div' : RouterLink"
        v-for="game in games"
        :key="game.id"
        v-bind="props.readonly ? {} : { to: '/games/' + game.id }"
        class="group flex items-center gap-4 px-4 py-3 border-b border-surface-lighter last:border-b-0 hover:bg-surface-lighter/50 transition-colors no-underline"
      >
        <img
          v-if="game.image_url"
          :src="game.image_url"
          :alt="game.title"
          class="w-10 h-10 rounded-lg object-cover flex-shrink-0"
        />
        <div v-else class="w-10 h-10 rounded-lg bg-surface-lighter flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <h3 class="text-sm font-medium text-text-primary truncate">{{ game.title }}</h3>
          <div class="flex items-center gap-3 mt-0.5">
            <span class="text-xs text-text-muted">{{ formatPlayers(game.min_players, game.max_players) }} players</span>
            <span class="text-xs text-text-muted">{{ formatDuration(game.min_duration, game.max_duration) }}</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-1 flex-shrink-0">
          <span v-if="game.is_card_game" class="badge-purple px-1.5 py-0.5 rounded-full text-[10px] font-medium">Card</span>
          <span v-if="game.is_cooperative" class="badge-green px-1.5 py-0.5 rounded-full text-[10px] font-medium">Co-op</span>
          <span v-if="game.plays_in_teams" class="badge-blue px-1.5 py-0.5 rounded-full text-[10px] font-medium">Teams</span>
          <span v-if="game.supports_campaign" class="badge-amber px-1.5 py-0.5 rounded-full text-[10px] font-medium">Campaign</span>
          <span
            v-for="tag in game.tags"
            :key="tag.id"
            class="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent-light border border-accent/20"
          >
            {{ tag.name }}
          </span>
        </div>
        <div v-if="game.rules_url" class="flex-shrink-0">
          <span class="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase text-white bg-gradient-to-r from-accent to-purple-500">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            AI
          </span>
        </div>
        <button
          v-if="!props.readonly"
          class="p-1 rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-negative hover:bg-negative/10 transition-all flex-shrink-0"
          title="Delete game"
          @click.prevent="$emit('delete', game.id)"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </component>
    </div>
  </template>
</template>
