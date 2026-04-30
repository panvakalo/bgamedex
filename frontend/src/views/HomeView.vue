<script setup lang="ts">
import { onMounted, onActivated, ref, computed, watch } from 'vue'

defineOptions({ name: 'HomeView' })
import { useRouter } from 'vue-router'
import { useGames } from '../composables/useGames'
import { usePlayLog } from '../composables/usePlayLog'
import { useNotify } from '../composables/useNotify'
import { useFireworks } from '../composables/useFireworks'
import { useDestructiveDialog } from '../composables/useDestructiveDialog'
import { exportCsv } from '../utils/exportCsv'
import { useTags } from '../composables/useTags'
import type { Game } from '../types/game'
import GameFilters from '../components/GameFilters.vue'
import GameGrid from '../components/GameGrid.vue'
import OnboardingCards from '../components/OnboardingCards.vue'
import AddGameModal from '../components/AddGameModal.vue'
import DatePicker from '../components/DatePicker.vue'

const router = useRouter()
const { allGames, filteredGames, filters, sort, sortDir, loading, error, fetchGames, clearFilters, hasActiveFilters } = useGames()
const { logPlay: logPlayApi } = usePlayLog()
const { tags, fetchTags } = useTags()
const { notify } = useNotify()
const { fire: fireFireworks } = useFireworks()
const { confirmDestructive } = useDestructiveDialog()

const showAddModal = ref(false)
const viewMode = ref<'tiles' | 'list'>('tiles')

// Quick Log Play FAB state
const showFabModal = ref(false)
const fabSearch = ref('')
const fabSelectedGame = ref<Game | null>(null)
const fabDate = ref(new Date().toISOString().slice(0, 10))
const fabLogging = ref(false)

const fabFilteredGames = computed(() => {
  if (!fabSearch.value) return allGames.value
  const q = fabSearch.value.toLowerCase()
  return allGames.value.filter((g) => g.title.toLowerCase().includes(q))
})

function openFabModal() {
  fabSearch.value = ''
  fabSelectedGame.value = null
  fabDate.value = new Date().toISOString().slice(0, 10)
  showFabModal.value = true
}

async function handleFabLog() {
  if (!fabSelectedGame.value) return
  fabLogging.value = true
  try {
    await logPlayApi(fabSelectedGame.value.id, fabDate.value)
    showFabModal.value = false
    notify('Play logged!')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to log play', 'error')
  } finally {
    fabLogging.value = false
  }
}

function onGameAdded(gameId: number) {
  showAddModal.value = false
  fireFireworks()
  router.push(`/games/${gameId}`)
}

async function onDeleteGame(id: number) {
  const confirmed = await confirmDestructive({ title: 'Delete game', message: 'Delete this game from your collection? This cannot be undone.' })
  if (!confirmed) return
  try {
    const res = await fetch(`/api/games/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    fetchGames()
    notify('Game deleted')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to delete game', 'error')
  }
}

// Re-fetch games when tag filter changes (server-side filter)
watch(() => filters.value.tag, (newVal, oldVal) => {
  if (newVal !== oldVal) fetchGames()
})

onMounted(() => {
  fetchGames()
  fetchTags()
})

onActivated(() => {
  // Refresh data in background when returning to this view
  fetchGames()
})
</script>

<template>
  <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <!-- Error state -->
    <div v-if="error" class="mb-6 p-4 rounded-lg bg-negative/10 border border-negative/30 text-negative">
      Failed to load games: {{ error }}
    </div>

    <!-- Branch 1: Initial loading with no cached games -->
    <div v-if="loading && allGames.length === 0" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>

    <!-- Branch 2: Truly empty collection — welcome state -->
    <div v-else-if="allGames.length === 0" class="text-center py-20">
      <svg class="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      <h2 class="text-2xl font-bold text-text-primary mb-2 font-display tracking-tight">Welcome to Bgamedex!</h2>
      <p class="text-text-muted mb-6 font-serif italic">Start building your board game collection</p>
      <button
        class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-light text-white text-sm font-semibold active:scale-[0.97] transition-all shadow-sm hover:shadow-md font-display tracking-wide"
        @click="showAddModal = true"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add your first game
      </button>
    </div>

    <!-- Branch 3: Normal view (has games) -->
    <template v-else>
      <div class="sticky top-0 z-10 -mx-4 sm:-mx-6 mb-6 bg-surface">
        <GameFilters v-model="filters" :has-active-filters="hasActiveFilters" :tags="tags" @clear="clearFilters">
          <template #actions>
            <button
              class="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl border border-surface-lighter text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors"
              title="Export as CSV"
              aria-label="Export as CSV"
              @click="exportCsv(filteredGames, 'bgamedex-collection.csv')"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              class="flex-shrink-0 h-9 flex items-center gap-1.5 px-3 rounded-xl border border-accent bg-accent hover:bg-accent-light text-white text-sm font-medium active:scale-[0.97] transition-all"
              title="Add game"
              @click="showAddModal = true"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span class="hidden sm:inline">Add game</span>
            </button>
          </template>
        </GameFilters>
      </div>

      <OnboardingCards />

      <GameGrid :games="filteredGames" :loading="loading" :total-count="allGames.length" :view-mode="viewMode" :sort="sort" :sort-dir="sortDir" @update:view-mode="viewMode = $event" @update:sort="sort = $event" @update:sort-dir="sortDir = $event" @delete="onDeleteGame" />
    </template>

    <!-- Add Game Modal -->
    <AddGameModal v-if="showAddModal" @close="showAddModal = false" @added="onGameAdded" @wishlisted="showAddModal = false" />

    <!-- Quick Log Play FAB -->
    <button
      class="fab-play fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-positive hover:bg-positive/80 text-white flex items-center justify-center active:scale-95 transition-all"
      title="Quick log play"
      @click="openFabModal"
    >
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>

    <!-- Quick Log Play Modal -->
    <Teleport to="body">
      <div v-if="showFabModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 animate-backdrop-in" @click="showFabModal = false" />
        <div class="relative bg-surface rounded-2xl border border-surface-lighter p-6 w-full max-w-md animate-modal-in" style="box-shadow: var(--shadow-modal)">
          <h3 class="text-lg font-semibold text-text-primary mb-4">Log a Play</h3>

          <!-- Step 1: Pick a game -->
          <div v-if="!fabSelectedGame">
            <input
              v-model="fabSearch"
              type="text"
              placeholder="Search your games..."
              class="w-full px-3 py-2 rounded-lg bg-surface border border-surface-lighter text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 mb-3"
            />
            <div class="max-h-60 overflow-y-auto space-y-1">
              <button
                v-for="g in fabFilteredGames"
                :key="g.id"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-lighter transition-colors text-left"
                @click="fabSelectedGame = g"
              >
                <img
                  v-if="g.image_url"
                  :src="g.image_url"
                  :alt="g.title"
                  class="w-10 h-10 rounded object-cover flex-shrink-0"
                />
                <div v-else class="w-10 h-10 rounded bg-surface-lighter flex-shrink-0" />
                <span class="text-sm text-text-primary truncate">{{ g.title }}</span>
              </button>
              <p v-if="fabFilteredGames.length === 0" class="text-sm text-text-muted text-center py-4">No games found</p>
            </div>
          </div>

          <!-- Step 2: Pick a date and confirm -->
          <div v-else>
            <div class="flex items-center gap-3 mb-4 p-3 rounded-lg bg-surface">
              <img
                v-if="fabSelectedGame.image_url"
                :src="fabSelectedGame.image_url"
                :alt="fabSelectedGame.title"
                class="w-12 h-12 rounded object-cover flex-shrink-0"
              />
              <div v-else class="w-12 h-12 rounded bg-surface-lighter flex-shrink-0" />
              <span class="font-medium text-text-primary">{{ fabSelectedGame.title }}</span>
              <button class="ml-auto text-text-muted hover:text-text-primary text-sm" @click="fabSelectedGame = null">Change</button>
            </div>
            <label class="block text-sm text-text-secondary mb-2">Date</label>
            <DatePicker v-model="fabDate" class="mb-4" />
            <div class="flex justify-end gap-3">
              <button
                class="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
                @click="showFabModal = false"
              >
                Cancel
              </button>
              <button
                :disabled="fabLogging"
                class="px-4 py-2 rounded-xl text-sm font-medium bg-positive text-white hover:bg-positive/80 active:scale-[0.97] transition-all disabled:opacity-50"
                @click="handleFabLog"
              >
                {{ fabLogging ? 'Logging...' : 'Log Play' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>
