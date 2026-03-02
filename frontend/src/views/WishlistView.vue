<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useWishlist } from '../composables/useWishlist'
import { useNotify } from '../composables/useNotify'
import { useDestructiveDialog } from '../composables/useDestructiveDialog'

const { wishlist, loading, error, fetchWishlist, moveToCollection, removeFromWishlist } = useWishlist()
const { notify } = useNotify()
const { confirmDestructive } = useDestructiveDialog()

type SortOption = 'alpha' | 'added' | 'duration'
type SortDir = 'asc' | 'desc'

const viewMode = ref<'tiles' | 'list'>('tiles')
const sort = ref<SortOption>('alpha')
const sortDir = ref<SortDir>('asc')
const search = ref('')

const sortOptions: { value: SortOption; label: string; defaultDir: SortDir }[] = [
  { value: 'alpha', label: 'A–Z', defaultDir: 'asc' },
  { value: 'added', label: 'Date added', defaultDir: 'desc' },
  { value: 'duration', label: 'Duration', defaultDir: 'asc' },
]

function onSortChange(value: SortOption) {
  sort.value = value
  const opt = sortOptions.find((o) => o.value === value)
  if (opt) sortDir.value = opt.defaultDir
}

const sortedGames = computed(() => {
  let filtered = wishlist.value
  if (search.value) {
    const q = search.value.toLowerCase()
    filtered = filtered.filter((g) => g.title.toLowerCase().includes(q))
  }

  const sorted = [...filtered]
  const dir = sortDir.value === 'asc' ? 1 : -1
  switch (sort.value) {
    case 'alpha':
      sorted.sort((a, b) => dir * a.title.localeCompare(b.title))
      break
    case 'added':
      sorted.sort((a, b) => dir * (a.id - b.id))
      break
    case 'duration':
      sorted.sort((a, b) => dir * ((a.min_duration ?? Infinity) - (b.min_duration ?? Infinity)))
      break
  }
  return sorted
})

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

async function handleMoveToCollection(gameId: number) {
  try {
    await moveToCollection(gameId)
    notify('Game moved to collection!')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to move game', 'error')
  }
}

async function handleRemove(gameId: number) {
  const confirmed = await confirmDestructive({ title: 'Remove from wishlist', message: 'Remove this game from your wishlist? This cannot be undone.' })
  if (!confirmed) return
  try {
    await removeFromWishlist(gameId)
    notify('Game removed from wishlist')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to remove game', 'error')
  }
}

onMounted(fetchWishlist)
</script>

<template>
  <main class="max-w-7xl mx-auto px-4 py-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-text-primary">Wishlist</h1>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-20">
      <p class="text-xl text-text-secondary">{{ error }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="wishlist.length === 0" class="text-center py-20">
      <svg class="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
      <p class="text-text-secondary mb-4">Your wishlist is empty</p>
      <RouterLink to="/" class="text-accent-light hover:underline">Add games from your collection page</RouterLink>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Search + toolbar -->
      <div class="flex items-center gap-2 mb-4">
        <div class="relative flex-1 lg:flex-none">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="search"
            type="text"
            placeholder="Search wishlist..."
            class="w-full lg:w-48 h-9 pl-10 pr-4 rounded-lg bg-surface-lighter border border-surface-lighter text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
          />
        </div>
      </div>

      <!-- Sort + view toggle bar -->
      <div class="flex items-center justify-between mb-4">
        <p class="text-text-muted text-sm">
          {{ sortedGames.length }}<span v-if="sortedGames.length !== wishlist.length"> of {{ wishlist.length }}</span> games
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
              @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
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
              @click="viewMode = 'tiles'"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </button>
            <button
              :class="['p-1.5 rounded-md transition-colors', viewMode === 'list' ? 'bg-surface-light text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary']"
              title="List view"
              @click="viewMode = 'list'"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Tiles view -->
      <div v-if="viewMode === 'tiles'" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
        <div
          v-for="game in sortedGames"
          :key="game.id"
          class="group flex flex-col rounded-xl bg-surface-light border border-surface-lighter p-3 sm:p-5 transition-all hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5"
        >
          <!-- Image -->
          <RouterLink :to="'/games/' + game.id" class="no-underline">
            <div class="relative mb-2 sm:mb-3 -mx-3 -mt-3 sm:-mx-5 sm:-mt-5 overflow-hidden rounded-t-xl">
              <img v-if="game.image_url" :src="game.image_url" :alt="game.title" class="w-full aspect-[4/3] object-cover" />
              <div v-else class="w-full aspect-[4/3] bg-surface-lighter flex items-center justify-center text-text-muted">
                <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>

            <h3 class="text-sm sm:text-lg font-semibold text-text-primary leading-tight line-clamp-2 mb-2 sm:mb-3">{{ game.title }}</h3>
          </RouterLink>

          <div class="flex items-center gap-3 mb-2 sm:mb-4 text-xs sm:text-sm text-text-secondary whitespace-nowrap overflow-hidden">
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

          <!-- Actions -->
          <div class="flex gap-2 mt-auto">
            <button
              class="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium bg-accent hover:bg-accent-light text-white transition-colors"
              @click="handleMoveToCollection(game.id)"
            >
              Add to Collection
            </button>
            <button
              class="p-1.5 sm:p-2 rounded-lg text-text-muted hover:text-negative hover:bg-negative/10 transition-colors"
              title="Remove from wishlist"
              @click="handleRemove(game.id)"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- List view -->
      <div v-else class="flex flex-col rounded-xl bg-surface-light border border-surface-lighter overflow-hidden">
        <div
          v-for="game in sortedGames"
          :key="game.id"
          class="group flex items-center gap-4 px-4 py-3 border-b border-surface-lighter last:border-b-0 hover:bg-surface-lighter/50 transition-colors"
        >
          <RouterLink :to="'/games/' + game.id" class="flex items-center gap-4 flex-1 min-w-0 no-underline">
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
          </RouterLink>
          <button
            class="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent-light text-white transition-colors hidden sm:block"
            @click="handleMoveToCollection(game.id)"
          >
            Add to Collection
          </button>
          <button
            class="flex-shrink-0 sm:hidden px-2 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent-light text-white transition-colors"
            @click="handleMoveToCollection(game.id)"
          >
            Add
          </button>
          <button
            class="p-1 rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-negative hover:bg-negative/10 transition-all flex-shrink-0"
            title="Remove from wishlist"
            @click="handleRemove(game.id)"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </template>
  </main>
</template>
