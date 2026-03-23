<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useFriends } from '../composables/useFriends'
import { useNotify } from '../composables/useNotify'
import { useDestructiveDialog } from '../composables/useDestructiveDialog'
import type { UserSearchResult } from '../types/friend'

const {
  friends, pendingRequests, pendingCount, loading,
  fetchFriends, fetchPendingRequests, fetchPendingCount,
  searchUsers, sendRequest, respondToRequest, removeFriend,
} = useFriends()
const { notify } = useNotify()
const { confirmDestructive } = useDestructiveDialog()

const searchQuery = ref('')
const searchResults = ref<UserSearchResult[]>([])
const searchLoading = ref(false)
const showResults = ref(false)

function hideResultsDelayed() {
  setTimeout(() => { showResults.value = false }, 200)
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(searchQuery, (q) => {
  clearTimeout(debounceTimer)
  if (q.trim().length < 2) {
    searchResults.value = []
    showResults.value = false
    return
  }
  debounceTimer = setTimeout(async () => {
    searchLoading.value = true
    try {
      searchResults.value = await searchUsers(q)
      showResults.value = true
    } catch {
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }, 300)
})

async function handleSendRequest(userId: number) {
  try {
    const result = await sendRequest(userId)
    if (result.message === 'Friend request accepted') {
      notify('Friend added!')
      await fetchFriends()
      await fetchPendingCount()
    } else {
      notify('Friend request sent!')
    }
    // Update search result status
    const user = searchResults.value.find(u => u.id === userId)
    if (user) user.friendshipStatus = result.message === 'Friend request accepted' ? 'accepted' : 'pending_sent'
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to send request', 'error')
  }
}

async function handleRespond(friendshipId: number, action: 'accept' | 'reject') {
  try {
    await respondToRequest(friendshipId, action)
    notify(action === 'accept' ? 'Friend added!' : 'Request declined')
    await fetchPendingRequests()
    await fetchPendingCount()
    if (action === 'accept') await fetchFriends()
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to respond', 'error')
  }
}

async function handleRemove(friendshipId: number, name: string) {
  const confirmed = await confirmDestructive({
    title: 'Remove friend',
    message: `Remove ${name} from your friends? They won't be able to see your collection anymore.`,
    confirmLabel: 'Remove',
  })
  if (!confirmed) return
  try {
    await removeFriend(friendshipId)
    notify('Friend removed')
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Failed to remove friend', 'error')
  }
}

onMounted(() => {
  fetchFriends()
  fetchPendingRequests()
  fetchPendingCount()
})
</script>

<template>
  <main class="max-w-7xl mx-auto px-4 py-6">
    <h1 class="text-3xl font-bold text-text-primary mb-6">Friends</h1>

    <!-- Search -->
    <div class="relative mb-8">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search users by name..."
          class="w-full sm:w-80 h-10 pl-10 pr-4 rounded-xl bg-surface-light border border-surface-lighter text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors text-sm"
          @focus="searchResults.length > 0 && (showResults = true)"
          @blur="hideResultsDelayed"
        />
        <div v-if="searchLoading" class="absolute right-3 top-1/2 -translate-y-1/2">
          <div class="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      </div>

      <!-- Search Results Dropdown -->
      <div
        v-if="showResults && searchResults.length > 0"
        class="absolute z-10 mt-1 w-full sm:w-80 bg-surface-light border border-surface-lighter rounded-xl shadow-lg overflow-hidden"
      >
        <div
          v-for="user in searchResults"
          :key="user.id"
          class="flex items-center gap-3 px-4 py-3 border-b border-surface-lighter last:border-b-0 hover:bg-surface-lighter/50"
        >
          <img
            v-if="user.picture"
            :src="user.picture"
            :alt="user.name"
            class="w-8 h-8 rounded-full object-cover flex-shrink-0"
            referrerpolicy="no-referrer"
          />
          <div v-else class="w-8 h-8 rounded-full bg-accent/20 text-accent-light flex items-center justify-center text-xs font-medium flex-shrink-0">
            {{ user.name?.charAt(0)?.toUpperCase() || '?' }}
          </div>
          <span class="flex-1 text-sm text-text-primary truncate">{{ user.name }}</span>
          <button
            v-if="user.friendshipStatus === 'none'"
            class="px-3 py-1 rounded-lg text-xs font-medium bg-accent hover:bg-accent-light text-white transition-colors"
            @mousedown.prevent="handleSendRequest(user.id)"
          >
            Add
          </button>
          <button
            v-else-if="user.friendshipStatus === 'pending_received'"
            class="px-3 py-1 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-colors"
            @mousedown.prevent="handleSendRequest(user.id)"
          >
            Accept
          </button>
          <span v-else-if="user.friendshipStatus === 'pending_sent'" class="text-xs text-text-muted">Pending</span>
          <span v-else-if="user.friendshipStatus === 'accepted'" class="text-xs text-green-500">Friends</span>
        </div>
      </div>
      <div
        v-else-if="showResults && searchQuery.trim().length >= 2 && !searchLoading"
        class="absolute z-10 mt-1 w-full sm:w-80 bg-surface-light border border-surface-lighter rounded-xl shadow-lg px-4 py-3"
      >
        <p class="text-sm text-text-muted">No users found</p>
      </div>
    </div>

    <!-- Pending Requests -->
    <section v-if="pendingRequests.length > 0" class="mb-8">
      <h2 class="text-lg font-semibold text-text-primary mb-3">
        Pending Requests
        <span class="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white text-xs font-bold">{{ pendingCount }}</span>
      </h2>
      <div class="flex flex-col rounded-2xl bg-surface-light border border-surface-lighter overflow-hidden" style="box-shadow: var(--shadow-card)">
        <div
          v-for="request in pendingRequests"
          :key="request.id"
          class="flex items-center gap-4 px-4 py-3 border-b border-surface-lighter last:border-b-0"
        >
          <img
            v-if="request.picture"
            :src="request.picture"
            :alt="request.name"
            class="w-10 h-10 rounded-full object-cover flex-shrink-0"
            referrerpolicy="no-referrer"
          />
          <div v-else class="w-10 h-10 rounded-full bg-accent/20 text-accent-light flex items-center justify-center text-sm font-medium flex-shrink-0">
            {{ request.name?.charAt(0)?.toUpperCase() || '?' }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-text-primary truncate">{{ request.name }}</p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent hover:bg-accent-light text-white transition-colors"
              @click="handleRespond(request.id, 'accept')"
            >
              Accept
            </button>
            <button
              class="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface-lighter transition-colors"
              @click="handleRespond(request.id, 'reject')"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
    </div>

    <!-- Friends List -->
    <section v-else-if="friends.length > 0">
      <h2 class="text-lg font-semibold text-text-primary mb-3">Your Friends</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="friend in friends"
          :key="friend.friendshipId"
          class="card-elevated flex flex-col rounded-2xl bg-surface-light border border-surface-lighter p-4"
        >
          <div class="flex items-center gap-3 mb-4">
            <img
              v-if="friend.picture"
              :src="friend.picture"
              :alt="friend.name"
              class="w-12 h-12 rounded-full object-cover flex-shrink-0"
              referrerpolicy="no-referrer"
            />
            <div v-else class="w-12 h-12 rounded-full bg-accent/20 text-accent-light flex items-center justify-center text-lg font-medium flex-shrink-0">
              {{ friend.name?.charAt(0)?.toUpperCase() || '?' }}
            </div>
            <h3 class="text-base font-semibold text-text-primary truncate">{{ friend.name }}</h3>
          </div>
          <div class="flex gap-2 mt-auto">
            <RouterLink
              :to="`/friends/${friend.userId}/collection`"
              class="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-center bg-surface-lighter hover:bg-surface-lighter/80 text-text-primary transition-colors no-underline"
            >
              Collection
            </RouterLink>
            <RouterLink
              :to="`/friends/${friend.userId}/wishlist`"
              class="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-center bg-surface-lighter hover:bg-surface-lighter/80 text-text-primary transition-colors no-underline"
            >
              Wishlist
            </RouterLink>
            <button
              class="p-2 rounded-lg text-text-muted hover:text-negative hover:bg-negative/10 transition-colors flex-shrink-0"
              title="Remove friend"
              @click="handleRemove(friend.friendshipId, friend.name)"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Empty state -->
    <div v-else-if="!loading && pendingRequests.length === 0" class="text-center py-20">
      <svg class="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <p class="text-text-secondary mb-2">No friends yet</p>
      <p class="text-text-muted text-sm">Search for users by name to add them as friends</p>
    </div>
  </main>
</template>
