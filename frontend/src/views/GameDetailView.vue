<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import type { GameDetail } from '../types/game'
import { usePlayLog } from '../composables/usePlayLog'
import { useNotify } from '../composables/useNotify'
import { useDestructiveDialog } from '../composables/useDestructiveDialog'
import RulesChat from '../components/RulesChat.vue'
import DatePicker from '../components/DatePicker.vue'
import TagEditor from '../components/TagEditor.vue'
import { useTags } from '../composables/useTags'

const route = useRoute()
const router = useRouter()
const game = ref<GameDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const deleting = ref(false)
const rulesReady = ref(false)
const rulesSource = ref<'rules' | 'description' | 'unavailable' | 'uploaded' | null>(null)
const preparingRules = ref(false)
const uploadingRules = ref(false)
const rulesFileInput = ref<HTMLInputElement | null>(null)

const { plays, fetchPlays, logPlay: logPlayApi, deletePlay: deletePlayApi } = usePlayLog()
const { tags: allTags, fetchTags, setGameTags } = useTags()
const { notify } = useNotify()
const { confirmDestructive } = useDestructiveDialog()
const showLogModal = ref(false)
const logDate = ref(new Date().toISOString().slice(0, 10))
const loggingPlay = ref(false)

async function handleLogPlay() {
  const gameId = Number(route.params.id)
  loggingPlay.value = true
  try {
    await logPlayApi(gameId, logDate.value)
    await fetchPlays(gameId)
    showLogModal.value = false
    logDate.value = new Date().toISOString().slice(0, 10)
    notify('Play logged!')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to log play', 'error')
  } finally {
    loggingPlay.value = false
  }
}

async function handleDeletePlay(playId: number) {
  const gameId = Number(route.params.id)
  try {
    await deletePlayApi(gameId, playId)
    await fetchPlays(gameId)
    notify('Play deleted')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to delete play', 'error')
  }
}

function formatPlayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function handleAddTag(tagId: number) {
  if (!game.value) return
  const currentIds = game.value.tags.map((t) => t.id)
  game.value.tags = await setGameTags(game.value.id, [...currentIds, tagId])
}

async function handleRemoveTag(tagId: number) {
  if (!game.value) return
  const currentIds = game.value.tags.filter((t) => t.id !== tagId).map((t) => t.id)
  game.value.tags = await setGameTags(game.value.id, currentIds)
}

async function handleCreateTag(name: string) {
  if (!game.value) return
  const currentIds = game.value.tags.map((t) => t.id)
  game.value.tags = await setGameTags(game.value.id, currentIds, [name])
}

async function deleteGame() {
  const confirmed = await confirmDestructive({ title: 'Delete game', message: 'Delete this game from your collection? This cannot be undone.' })
  if (!confirmed) return
  deleting.value = true
  try {
    const res = await fetch(`/api/games/${route.params.id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    notify('Game deleted')
    router.push('/')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to delete game', 'error')
  } finally {
    deleting.value = false
  }
}

async function prepareRules() {
  preparingRules.value = true
  try {
    const res = await fetch(`/api/games/${route.params.id}/prepare-rules`, { method: 'POST', credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      rulesSource.value = data.status === 'ready' ? data.source : 'unavailable'
      // If rules were found and we didn't have a rules_url, update the game ref so "View Rules" appears
      if (data.detail && game.value && !game.value.rules_url) {
        game.value.rules_url = data.detail
      }
    }
  } catch {
    rulesSource.value = 'unavailable'
  } finally {
    preparingRules.value = false
    rulesReady.value = true
  }
}

async function handleRulesUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !game.value) return

  if (file.type !== 'application/pdf') {
    notify('Please select a PDF file', 'error')
    return
  }
  uploadingRules.value = true
  try {
    const formData = new FormData()
    formData.append('pdf', file)
    const res = await fetch(`/api/games/${game.value.id}/upload-rules`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    rulesSource.value = 'uploaded'
    notify('Rules processed successfully!')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to upload rules', 'error')
  } finally {
    uploadingRules.value = false
    if (rulesFileInput.value) rulesFileInput.value.value = ''
  }
}

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

onMounted(async () => {
  try {
    const res = await fetch(`/api/games/${route.params.id}`, { credentials: 'include' })
    if (!res.ok) {
      if (res.status === 404) {
        error.value = 'Game not found'
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
      return
    }
    game.value = await res.json()
    fetchPlays(game.value!.id)
    fetchTags()
    if (game.value!.rules_url || game.value!.description || game.value!.bgg_id) {
      prepareRules()
    } else {
      rulesReady.value = true
      rulesSource.value = 'unavailable'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load game'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="max-w-4xl mx-auto px-4 py-6">
    <!-- Back link -->
    <RouterLink to="/" class="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-light transition-colors mb-6">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to games
    </RouterLink>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>

    <!-- Error / 404 -->
    <div v-else-if="error" class="text-center py-20">
      <p class="text-xl text-text-secondary mb-4">{{ error }}</p>
      <RouterLink to="/" class="text-accent-light hover:underline">Return to game list</RouterLink>
    </div>

    <!-- Game detail -->
    <div v-else-if="game">
      <div class="flex flex-col md:flex-row gap-8 mb-8">
        <!-- Image -->
        <div v-if="game.image_url" class="shrink-0">
          <img
            :src="game.image_url"
            :alt="game.title"
            class="w-full md:w-64 rounded-2xl object-cover"
            style="box-shadow: var(--shadow-card-hover)"
          />
        </div>

        <!-- Info -->
        <div class="flex-1">
          <div class="flex items-start justify-between gap-4 mb-4">
            <h1 class="text-3xl font-bold text-text-primary">{{ game.title }}</h1>
            <button
              :disabled="deleting"
              class="p-2 rounded-lg text-text-muted hover:text-negative hover:bg-negative/10 transition-colors flex-shrink-0 disabled:opacity-50"
              title="Delete game"
              @click="deleteGame"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          <!-- Stats -->
          <div class="flex flex-wrap gap-4 mb-6">
            <div class="flex items-center gap-2 text-text-secondary">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{{ formatPlayers(game.min_players, game.max_players) }} players</span>
            </div>
            <div class="flex items-center gap-2 text-text-secondary">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{{ formatDuration(game.min_duration, game.max_duration) }}</span>
            </div>
          </div>

          <!-- Property tags -->
          <div class="flex flex-wrap gap-2 mb-6">
            <span v-if="game.is_card_game" class="badge-purple px-3 py-1 rounded-full text-sm font-medium">Card Game</span>
            <span v-if="game.is_cooperative" class="badge-green px-3 py-1 rounded-full text-sm font-medium">Co-op</span>
            <span v-if="game.plays_in_teams" class="badge-blue px-3 py-1 rounded-full text-sm font-medium">Teams</span>
            <span v-if="game.supports_campaign" class="badge-amber px-3 py-1 rounded-full text-sm font-medium">Campaign</span>
          </div>

          <!-- Rules buttons -->
          <div class="flex items-center gap-3">
            <a
              v-if="game.rules_url"
              :href="game.rules_url"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/20 text-accent-light hover:bg-accent/30 transition-colors font-medium text-sm"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              View Rules
            </a>

            <span v-if="game.bgg_id && rulesSource === 'uploaded'" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-positive/15 text-positive text-sm font-medium">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Rules uploaded
            </span>
            <button
              v-if="game.bgg_id"
              :disabled="uploadingRules"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/20 text-accent-light hover:bg-accent/30 transition-colors font-medium text-sm disabled:opacity-50"
              @click="rulesFileInput?.click()"
            >
              <svg v-if="!uploadingRules" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <div v-else class="w-4 h-4 border-2 border-accent-light/30 border-t-accent-light rounded-full animate-spin" />
              {{ uploadingRules ? 'Processing rules...' : rulesSource === 'uploaded' ? 'Re-upload Rules PDF' : 'Upload Rules PDF' }}
            </button>
            <input
              ref="rulesFileInput"
              type="file"
              accept="application/pdf"
              class="hidden"
              @change="handleRulesUpload"
            />
          </div>

          <!-- Log Play + Play Count -->
          <div class="flex items-center gap-4 mt-4">
            <button
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-positive/20 text-positive hover:bg-positive/30 transition-colors font-medium text-sm"
              @click="showLogModal = true"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Log Play
            </button>
            <span v-if="plays.length" class="text-sm text-text-secondary">
              {{ plays.length }} play{{ plays.length !== 1 ? 's' : '' }} logged
            </span>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <div class="mb-8">
        <h2 class="text-lg font-semibold text-text-primary mb-3">Tags</h2>
        <TagEditor
          :model-value="game.tags ?? []"
          :all-tags="allTags"
          @add="handleAddTag"
          @remove="handleRemoveTag"
          @create="handleCreateTag"
        />
      </div>

      <!-- Mechanics -->
      <div v-if="game.mechanics?.length" class="mb-8">
        <h2 class="text-lg font-semibold text-text-primary mb-3">Mechanics</h2>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="mechanic in game.mechanics"
            :key="mechanic"
            class="px-3 py-1 rounded-full text-sm bg-surface-lighter text-text-secondary border border-surface-lighter"
          >
            {{ mechanic }}
          </span>
        </div>
      </div>

      <!-- Description -->
      <div v-if="game.description" class="mb-8">
        <h2 class="text-lg font-semibold text-text-primary mb-3">About</h2>
        <p class="text-text-secondary leading-relaxed whitespace-pre-line">{{ game.description }}</p>
      </div>

      <!-- Play History -->
      <div v-if="plays.length" class="mb-8">
        <h2 class="text-lg font-semibold text-text-primary mb-3">Play History</h2>
        <div class="space-y-2">
          <div
            v-for="play in plays"
            :key="play.id"
            class="flex items-center justify-between p-3 rounded-lg bg-surface border border-surface-lighter"
            style="box-shadow: var(--shadow-card)"
          >
            <span class="text-sm text-text-secondary">{{ formatPlayDate(play.playedAt) }}</span>
            <button
              class="p-1.5 rounded-lg text-text-muted hover:text-negative hover:bg-negative/10 transition-colors"
              title="Delete play"
              @click="handleDeletePlay(play.id)"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Rules Chat -->
      <RulesChat
        :game-id="game.id"
        :game-title="game.title"
        :has-rules="!!game.rules_url || !!game.description || rulesSource === 'uploaded'"
        :preparing="preparingRules"
        :rules-source="rulesSource"
      />
    </div>

    <!-- Log Play Modal -->
    <Teleport to="body">
      <div v-if="showLogModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 animate-backdrop-in" @click="showLogModal = false" />
        <div class="relative bg-surface rounded-2xl border border-surface-lighter p-6 w-full max-w-sm animate-modal-in" style="box-shadow: var(--shadow-modal)">
          <h3 class="text-lg font-semibold text-text-primary mb-4">Log Play</h3>
          <label class="block text-sm text-text-secondary mb-2">Date</label>
          <DatePicker v-model="logDate" class="mb-4" />
          <div class="flex justify-end gap-3">
            <button
              class="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
              @click="showLogModal = false"
            >
              Cancel
            </button>
            <button
              :disabled="loggingPlay"
              class="px-4 py-2 rounded-xl text-sm font-medium bg-positive text-white hover:bg-positive/80 active:scale-[0.97] transition-all disabled:opacity-50"
              @click="handleLogPlay"
            >
              {{ loggingPlay ? 'Logging...' : 'Log' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>
