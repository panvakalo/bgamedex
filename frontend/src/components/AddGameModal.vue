<script setup lang="ts">
import { ref, watch } from 'vue'
import type { BggSearchResult } from '../types/game'
import { useNotify } from '../composables/useNotify'

const emit = defineEmits<{ (e: 'close'): void; (e: 'added', gameId: number): void; (e: 'wishlisted'): void }>()
const { notify } = useNotify()

const query = ref('')
const results = ref<BggSearchResult[]>([])
const loading = ref(false)
const adding = ref(false)
const error = ref<string | null>(null)
const selectedResult = ref<BggSearchResult | null>(null)
const thumbnailUrl = ref<string | null>(null)
const loadingThumbnail = ref(false)
const identifyingPhoto = ref(false)
const identifiedName = ref<string | null>(null)
const photoInputRef = ref<HTMLInputElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(query, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  error.value = null
  identifiedName.value = null

  if (!val.trim()) {
    results.value = []
    loading.value = false
    return
  }

  loading.value = true
  debounceTimer = setTimeout(() => searchBgg(val.trim()), 300)
})

async function searchBgg(q: string) {
  try {
    const res = await fetch(`/api/games/search-bgg?q=${encodeURIComponent(q)}`, { credentials: 'include' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    results.value = await res.json()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Search failed'
    results.value = []
  } finally {
    loading.value = false
  }
}

async function identifyFromPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  identifyingPhoto.value = true
  identifiedName.value = null
  error.value = null
  results.value = []
  query.value = ''

  try {
    const formData = new FormData()
    formData.append('photo', file)
    const res = await fetch('/api/games/identify-from-photo', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    const data = await res.json()
    identifiedName.value = data.identifiedName
    results.value = data.results
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to identify game'
  } finally {
    identifyingPhoto.value = false
    input.value = ''
  }
}

async function selectResult(result: BggSearchResult) {
  selectedResult.value = result
  error.value = null
  thumbnailUrl.value = null
  loadingThumbnail.value = true
  try {
    const res = await fetch(`/api/games/bgg-thumbnail/${result.bggId}`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      thumbnailUrl.value = data.thumbnailUrl
    }
  } catch {
    // Thumbnail is non-critical, silently ignore
  } finally {
    loadingThumbnail.value = false
  }
}

function backToSearch() {
  selectedResult.value = null
  thumbnailUrl.value = null
  error.value = null
}

async function addGame(status: 'collection' | 'wishlist') {
  if (!selectedResult.value) return
  adding.value = true
  error.value = null
  try {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ bggId: selectedResult.value.bggId, status }),
    })
    if (res.status === 409) {
      const data = await res.json()
      error.value = data.error
      return
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const game = await res.json()
    if (status === 'collection') {
      notify('Game added to collection!')
      emit('added', game.id)
    } else {
      notify('Game added to wishlist!')
      emit('wishlisted')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to add game'
  } finally {
    adding.value = false
  }
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[10vh] animate-backdrop-in"
    @click="onBackdropClick"
  >
    <div class="w-full max-w-lg mx-4 rounded-2xl bg-surface-light border border-surface-lighter overflow-hidden animate-modal-in" style="box-shadow: var(--shadow-modal)">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-surface-lighter">
        <h2 class="text-lg font-semibold text-text-primary">Add Board Game</h2>
        <button
          class="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-lighter transition-colors"
          @click="emit('close')"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Choice step: Collection or Wishlist -->
      <div v-if="selectedResult && !adding">
        <div class="px-5 py-4">
          <button
            class="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
            @click="backToSearch"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to search
          </button>
          <div class="flex gap-4 mb-4">
            <div class="w-24 h-24 flex-shrink-0 rounded-lg bg-surface border border-surface-lighter overflow-hidden">
              <img
                v-if="thumbnailUrl"
                :src="thumbnailUrl"
                :alt="selectedResult.name"
                class="w-full h-full object-cover"
              />
              <div v-else-if="loadingThumbnail" class="w-full h-full flex items-center justify-center">
                <div class="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
              <div v-else class="w-full h-full flex items-center justify-center text-text-muted">
                <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-base font-semibold text-text-primary">
                {{ selectedResult.name }}
              </p>
              <p v-if="selectedResult.yearPublished" class="text-sm text-text-muted">{{ selectedResult.yearPublished }}</p>
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="mb-4 px-4 py-2.5 rounded-lg bg-negative/10 border border-negative/30 text-negative text-sm">
            {{ error }}
          </div>

          <div class="grid grid-cols-2 gap-3">
            <button
              class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-lighter bg-surface hover:border-accent/50 hover:bg-accent/5 transition-colors cursor-pointer"
              @click="addGame('collection')"
            >
              <svg class="w-8 h-8 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span class="text-sm font-medium text-text-primary">Add to Collection</span>
            </button>
            <button
              class="flex flex-col items-center gap-2 p-4 rounded-xl border border-surface-lighter bg-surface hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors cursor-pointer"
              @click="addGame('wishlist')"
            >
              <svg class="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <span class="text-sm font-medium text-text-primary">Add to Wishlist</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Search step -->
      <template v-else-if="!selectedResult">
        <!-- Search input -->
        <div class="px-5 py-4">
          <div class="flex gap-2">
            <div class="relative flex-1">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                v-model="query"
                type="text"
                placeholder="Search BoardGameGeek..."
                class="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-surface-lighter text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                autofocus
              />
            </div>
            <button
              class="flex items-center justify-center w-10 h-10 rounded-lg bg-surface border border-surface-lighter text-text-muted hover:text-text-primary hover:border-accent/50 transition-colors"
              title="Identify game from photo"
              :disabled="identifyingPhoto"
              @click="photoInputRef?.click()"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </button>
            <input
              ref="photoInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              class="hidden"
              @change="identifyFromPhoto"
            />
          </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="mx-5 mb-3 px-4 py-2.5 rounded-lg bg-negative/10 border border-negative/30 text-negative text-sm">
          {{ error }}
        </div>

        <!-- Identified name badge -->
        <div v-if="identifiedName" class="mx-5 mb-3 px-3 py-2 rounded-lg bg-accent/10 border border-accent/30 text-sm text-accent-light flex items-center gap-2">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Identified: <span class="font-medium">{{ identifiedName }}</span>
        </div>

        <!-- Results -->
        <div class="max-h-80 overflow-y-auto">
          <!-- Loading -->
          <div v-if="loading || identifyingPhoto" class="flex items-center justify-center py-8 gap-2">
            <div class="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span v-if="identifyingPhoto" class="text-sm text-text-muted">Identifying game...</span>
          </div>

          <!-- Empty state -->
          <div v-else-if="(query.trim() || identifiedName) && !results.length && !error" class="py-8 text-center text-text-muted text-sm">
            No games found
          </div>

          <!-- Results list -->
          <button
            v-for="result in results"
            :key="result.bggId"
            :disabled="adding"
            class="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-surface-lighter transition-colors disabled:opacity-50 border-t border-surface-lighter first:border-t-0"
            @click="selectResult(result)"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-text-primary truncate">{{ result.name }}</div>
              <div v-if="result.yearPublished" class="text-xs text-text-muted">{{ result.yearPublished }}</div>
            </div>
            <svg class="w-4 h-4 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </template>

      <!-- Adding indicator -->
      <div v-if="adding" class="px-5 py-3 border-t border-surface-lighter flex items-center gap-2 text-sm text-text-muted">
        <div class="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        Adding game...
      </div>
    </div>
  </div>
</template>
