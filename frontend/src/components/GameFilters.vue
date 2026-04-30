<script setup lang="ts">
import { ref } from 'vue'
import type { GameFilters } from '../types/game'
import type { TagWithCount } from '../composables/useTags'

const filters = defineModel<GameFilters>({ required: true })

defineEmits<{ (e: 'clear'): void }>()

defineProps<{ hasActiveFilters: boolean; tags: TagWithCount[] }>()

const showFilters = ref(false)

interface TriStateToggle {
  key: keyof Pick<GameFilters, 'isCardGame' | 'isCooperative' | 'playsInTeams' | 'supportsCampaign'>
  label: string
}

const toggles: TriStateToggle[] = [
  { key: 'isCardGame', label: 'Cards' },
  { key: 'isCooperative', label: 'Co-op' },
  { key: 'playsInTeams', label: 'Teams' },
  { key: 'supportsCampaign', label: 'Campaign' },
]

function cycleTriState(key: TriStateToggle['key']) {
  const current = filters.value[key]
  if (current === null) filters.value[key] = true
  else if (current === true) filters.value[key] = false
  else filters.value[key] = null
}

function triStateClass(value: boolean | null): string {
  if (value === true) return 'bg-positive/20 text-positive border-positive/40'
  if (value === false) return 'bg-negative/20 text-negative border-negative/40'
  return 'bg-surface-lighter/50 text-text-muted border-surface-lighter hover:border-text-muted'
}

function triStateDot(value: boolean | null): string {
  if (value === true) return 'bg-positive'
  if (value === false) return 'bg-negative'
  return ''
}

function parseNumInput(e: Event): number | null {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '')
  ;(e.target as HTMLInputElement).value = raw
  return raw ? Number(raw) : null
}
</script>

<template>
  <div>
    <!-- Top row: filter toggle + actions -->
    <div class="glass-surface flex items-center gap-3 px-4 py-2.5 rounded-xl">
      <!-- Filter toggle button -->
      <button
        class="flex-shrink-0 relative h-9 flex items-center gap-1.5 px-3 rounded-lg border border-surface-lighter text-text-muted hover:text-text-primary hover:border-text-muted transition-colors"
        title="Toggle filters"
        @click="showFilters = !showFilters"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
        </svg>
        <span class="text-sm hidden sm:inline">Filters</span>
        <span
          v-if="hasActiveFilters"
          class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent animate-dot-pulse"
        />
      </button>

      <div class="flex-1" />

      <!-- Actions slot (e.g. Add button) -->
      <slot name="actions" />
    </div>

    <!-- Expanded filters panel -->
    <div
      v-if="showFilters"
      class="mt-3 p-3 rounded-xl glass-surface animate-panel-down space-y-3"
    >
      <!-- Search -->
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="filters.search"
          type="text"
          placeholder="Filter by name..."
          class="w-full h-10 pl-10 pr-4 rounded-xl bg-surface-light/80 border border-surface-lighter text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm shadow-inner"
        />
      </div>

      <!-- Filters row -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Players -->
        <div class="flex items-center gap-1.5">
          <label class="text-xs font-medium text-text-secondary uppercase tracking-wider">Players</label>
          <input
            :value="filters.players ?? ''"
            type="text"
            inputmode="numeric"
            placeholder="Any"
            class="w-16 h-9 px-2 rounded-lg bg-surface-lighter border border-surface-lighter text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm text-center"
            @input="filters.players = parseNumInput($event)"
          />
        </div>

        <!-- Duration -->
        <div class="flex items-center gap-1.5">
          <label class="text-xs font-medium text-text-secondary uppercase tracking-wider">Time</label>
          <input
            :value="filters.duration ?? ''"
            type="text"
            inputmode="numeric"
            placeholder="Any"
            class="w-16 h-9 px-2 rounded-lg bg-surface-lighter border border-surface-lighter text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm text-center"
            @input="filters.duration = parseNumInput($event)"
          />
        </div>

        <!-- Tag -->
        <div v-if="tags.length" class="flex items-center gap-1.5">
          <label class="text-xs font-medium text-text-secondary uppercase tracking-wider">Tag</label>
          <select
            :value="filters.tag ?? ''"
            class="h-9 px-2 pr-7 rounded-lg bg-surface-lighter border border-surface-lighter text-text-primary text-sm focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
            style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E&quot;); background-repeat: no-repeat; background-position: right 0.5rem center;"
            @change="filters.tag = Number(($event.target as HTMLSelectElement).value) || null"
          >
            <option value="">Any</option>
            <option v-for="tag in tags" :key="tag.id" :value="tag.id">{{ tag.name }}</option>
          </select>
        </div>

        <!-- Tri-state toggles -->
        <button
          v-for="toggle in toggles"
          :key="toggle.key"
          :class="[
            'h-9 px-2.5 rounded-lg border text-sm font-medium transition-all cursor-pointer select-none whitespace-nowrap flex items-center gap-1.5',
            triStateClass(filters[toggle.key]),
          ]"
          :style="filters[toggle.key] === true ? { background: 'rgba(22,163,74,0.25)' } : undefined"
          @click="cycleTriState(toggle.key)"
        >
          <span v-if="filters[toggle.key] !== null" :class="['w-1.5 h-1.5 rounded-full shrink-0', triStateDot(filters[toggle.key]), filters[toggle.key] !== null && 'animate-dot-pulse']" />
          {{ toggle.label }}
        </button>

        <!-- Clear -->
        <button
          v-if="hasActiveFilters"
          class="h-9 px-3 rounded-lg border border-surface-lighter text-text-muted text-sm hover:text-text-primary hover:border-text-muted transition-all cursor-pointer"
          @click="$emit('clear')"
        >
          Clear all
        </button>
      </div>
    </div>
  </div>
</template>
