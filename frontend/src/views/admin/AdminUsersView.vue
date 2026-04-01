<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'

import { useAdminApi } from '../../composables/useAdminApi'
import BaseSpinner from '../../components/BaseSpinner.vue'
import AdminDataTable from '../../components/admin/AdminDataTable.vue'
import AdminUserBadges from '../../components/admin/AdminUserBadges.vue'
import { formatShortDate } from '../../utils/format'
import type { AdminUser, AdminUserListResponse } from '../../types/admin'

const router = useRouter()
const { adminFetch } = useAdminApi()

const users = ref<AdminUser[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(25)
const sortBy = ref('created_at')
const sortDir = ref<'asc' | 'desc'>('desc')
const search = ref('')
const loading = ref(true)
const error = ref('')

let debounceTimer: ReturnType<typeof setTimeout>

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'gameCount', label: 'Games', sortable: true },
  { key: 'playCount', label: 'Plays', sortable: true },
  { key: 'createdAt', label: 'Created', sortable: true },
  { key: 'badges', label: '', sortable: false },
]

// Map frontend keys to backend sort fields
const sortKeyMap: Record<string, string> = {
  name: 'name',
  email: 'email',
  gameCount: 'game_count',
  playCount: 'play_count',
  createdAt: 'created_at',
}

async function fetchUsers() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(pageSize.value),
      sort: sortKeyMap[sortBy.value] || sortBy.value,
      dir: sortDir.value,
    })
    if (search.value.trim()) params.set('q', search.value.trim())

    const data = await adminFetch<AdminUserListResponse>(`/api/admin/users?${params}`)
    users.value = data.users
    total.value = data.total
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load users'
  } finally {
    loading.value = false
  }
}

function handleSort(key: string) {
  if (sortBy.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = key
    sortDir.value = 'asc'
  }
  page.value = 1
  fetchUsers()
}

function handleRowClick(row: AdminUser) {
  router.push(`/admin/users/${row.id}`)
}

function handleSearch() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    fetchUsers()
  }, 300)
}

function prevPage() {
  if (page.value > 1) {
    page.value--
    fetchUsers()
  }
}

function nextPage() {
  if (page.value * pageSize.value < total.value) {
    page.value++
    fetchUsers()
  }
}

watch(search, handleSearch)
onMounted(fetchUsers)
onBeforeUnmount(() => clearTimeout(debounceTimer))

const formatDate = formatShortDate
</script>

<template>
  <main class="max-w-6xl mx-auto px-4 py-6">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-text-primary">Users</h1>
      <span class="text-sm text-text-muted">{{ total }} total</span>
    </div>

    <!-- Search -->
    <div class="mb-4">
      <input
        v-model="search"
        type="text"
        placeholder="Search by name or email..."
        class="w-full max-w-sm px-3 py-2 rounded-lg bg-surface-lighter border border-surface-lighter text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading && !users.length" class="flex justify-center py-20">
      <BaseSpinner />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-20">
      <p class="text-xl text-text-secondary">{{ error }}</p>
    </div>

    <template v-else>
      <AdminDataTable
        :columns="columns"
        :rows="users"
        :sort-by="sortBy"
        :sort-dir="sortDir"
        @sort="handleSort"
        @row-click="handleRowClick"
      >
        <template #cell-name="{ row }">
          <div class="flex items-center gap-2">
            <img
              v-if="row.picture"
              :src="row.picture"
              class="w-7 h-7 rounded-full object-cover"
              referrerpolicy="no-referrer"
            />
            <div v-else class="w-7 h-7 rounded-full bg-accent/20 text-accent-light flex items-center justify-center text-xs font-medium">
              {{ row.name?.charAt(0)?.toUpperCase() || '?' }}
            </div>
            <span class="font-medium truncate">{{ row.name }}</span>
          </div>
        </template>

        <template #cell-email="{ row }">
          <span class="text-text-secondary truncate">{{ row.email }}</span>
        </template>

        <template #cell-createdAt="{ row }">
          <span class="text-text-muted text-xs">{{ formatDate(row.createdAt) }}</span>
        </template>

        <template #cell-badges="{ row }">
          <div class="flex items-center gap-1.5">
            <AdminUserBadges
              :is-admin="row.isAdmin"
              :google-id="row.googleId"
              :has-password="row.hasPassword"
              :email-verified="row.emailVerified"
            />
            <span
              v-if="row.features?.includes('rules_access')"
              class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-400"
              title="Rules Access"
            >Rules</span>
          </div>
        </template>
      </AdminDataTable>

      <!-- Pagination -->
      <div v-if="total > pageSize" class="flex items-center justify-between mt-4">
        <p class="text-sm text-text-muted">
          Showing {{ (page - 1) * pageSize + 1 }}–{{ Math.min(page * pageSize, total) }} of {{ total }}
        </p>
        <div class="flex gap-2">
          <button
            :disabled="page <= 1"
            class="px-3 py-1.5 rounded-lg text-sm bg-surface-lighter text-text-primary hover:bg-accent/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            @click="prevPage"
          >
            Previous
          </button>
          <button
            :disabled="page * pageSize >= total"
            class="px-3 py-1.5 rounded-lg text-sm bg-surface-lighter text-text-primary hover:bg-accent/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            @click="nextPage"
          >
            Next
          </button>
        </div>
      </div>
    </template>
  </main>
</template>
