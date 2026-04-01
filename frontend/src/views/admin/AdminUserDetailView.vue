<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAdminAuth } from '../../composables/useAdminAuth'
import { useAdminApi } from '../../composables/useAdminApi'
import { useDestructiveDialog } from '../../composables/useDestructiveDialog'
import BaseSpinner from '../../components/BaseSpinner.vue'
import AdminSummaryCard from '../../components/admin/AdminSummaryCard.vue'
import AdminUserBadges from '../../components/admin/AdminUserBadges.vue'
import { formatLongDate } from '../../utils/format'
import type { AdminUser } from '../../types/admin'

const route = useRoute()
const router = useRouter()
const { adminUser: currentAdmin } = useAdminAuth()
const { adminFetch } = useAdminApi()
const { confirmDestructive } = useDestructiveDialog()

const user = ref<AdminUser | null>(null)
const loading = ref(true)
const loadError = ref('')
const toggleError = ref('')
const toggleLoading = ref(false)
const deleteLoading = ref(false)
const deleteError = ref('')

const isSelf = computed(() => user.value && currentAdmin.value && user.value.id === currentAdmin.value.sub)
const featureLoading = ref<string | null>(null)

const KNOWN_FEATURES = [
  { key: 'rules_access', label: 'Rules Access', description: 'AI rules chat, search, and PDF upload' },
] as const

async function toggleFeature(feature: string, enabled: boolean) {
  if (!user.value) return
  featureLoading.value = feature
  try {
    const result = enabled
      ? await adminFetch<{ features: string[] }>(`/api/admin/users/${user.value.id}/features`, {
          method: 'POST',
          body: JSON.stringify({ feature }),
        })
      : await adminFetch<{ features: string[] }>(`/api/admin/users/${user.value.id}/features/${feature}`, {
          method: 'DELETE',
        })
    user.value = { ...user.value, features: result.features }
  } catch (e) {
    toggleError.value = e instanceof Error ? e.message : 'Failed to update feature'
  } finally {
    featureLoading.value = null
  }
}

onMounted(async () => {
  try {
    user.value = await adminFetch<AdminUser>(`/api/admin/users/${route.params.id}`)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : 'Failed to load user'
  } finally {
    loading.value = false
  }
})

async function toggleAdmin() {
  if (!user.value) return

  const action = user.value.isAdmin ? 'Remove Admin' : 'Make Admin'
  const message = user.value.isAdmin
    ? 'Removing privileges will prevent this user from accessing the admin panel.'
    : 'Promoting will grant this user full access to the admin panel.'

  const confirmed = await confirmDestructive({ title: `${action}?`, message, confirmLabel: action })
  if (!confirmed) return

  toggleLoading.value = true
  toggleError.value = ''
  try {
    await adminFetch(`/api/admin/users/${user.value.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isAdmin: !user.value.isAdmin }),
    })
    user.value = { ...user.value, isAdmin: !user.value.isAdmin }
  } catch (e) {
    toggleError.value = e instanceof Error ? e.message : 'Failed to update user'
  } finally {
    toggleLoading.value = false
  }
}

async function deleteUser() {
  if (!user.value || isSelf.value) return

  const confirmed = await confirmDestructive({
    title: 'Delete User?',
    message: `This will permanently delete ${user.value.name}'s account and all their data (${user.value.gameCount} games, ${user.value.playCount} plays). This cannot be undone.`,
    confirmLabel: 'Delete User',
  })
  if (!confirmed) return

  deleteLoading.value = true
  deleteError.value = ''
  try {
    await adminFetch(`/api/admin/users/${user.value.id}`, { method: 'DELETE' })
    router.replace('/admin/users')
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete user'
  } finally {
    deleteLoading.value = false
  }
}

const formatDate = formatLongDate
</script>

<template>
  <main class="max-w-3xl mx-auto px-4 py-6">
    <!-- Back link -->
    <RouterLink
      to="/admin/users"
      class="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-light transition-colors mb-6"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to users
    </RouterLink>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <BaseSpinner />
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="text-center py-20">
      <p class="text-xl text-text-secondary">{{ loadError }}</p>
    </div>

    <template v-else-if="user">
      <!-- User info header -->
      <div class="flex items-center gap-4 mb-8">
        <img
          v-if="user.picture"
          :src="user.picture"
          :alt="user.name"
          class="w-16 h-16 rounded-full object-cover"
          referrerpolicy="no-referrer"
        />
        <div v-else class="w-16 h-16 rounded-full bg-accent/20 text-accent-light flex items-center justify-center text-2xl font-medium">
          {{ user.name?.charAt(0)?.toUpperCase() || '?' }}
        </div>

        <div class="flex-1 min-w-0">
          <h1 class="text-2xl font-bold text-text-primary truncate">{{ user.name }}</h1>
          <p class="text-text-secondary truncate">{{ user.email }}</p>
          <p class="text-xs text-text-muted mt-0.5">Joined {{ formatDate(user.createdAt) }}</p>
        </div>

        <AdminUserBadges
          class="shrink-0"
          size="md"
          :is-admin="user.isAdmin"
          :google-id="user.googleId"
          :has-password="user.hasPassword"
          :email-verified="user.emailVerified"
        />
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <AdminSummaryCard label="Games" :value="user.gameCount" />
        <AdminSummaryCard label="Plays" :value="user.playCount" />
        <AdminSummaryCard label="Friends" :value="user.friendCount" />
        <AdminSummaryCard label="Wishlist" :value="user.wishlistCount" />
      </div>

      <!-- Admin toggle -->
      <section class="rounded-xl border border-surface-lighter p-5" style="box-shadow: var(--shadow-card)">
        <h2 class="text-lg font-semibold text-text-primary mb-2">Admin Privileges</h2>

        <div v-if="isSelf" class="text-sm text-text-muted">
          You cannot modify your own admin status.
        </div>

        <template v-else>
          <!-- Inline error -->
          <div
            v-if="toggleError"
            class="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            {{ toggleError }}
          </div>

          <p class="text-sm text-text-secondary mb-4">
            {{ user.isAdmin
              ? 'This user has admin access. Removing privileges will prevent them from accessing the admin panel.'
              : 'This user does not have admin access. Promoting them will grant full access to the admin panel.'
            }}
          </p>

          <button
            :disabled="toggleLoading"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            :class="user.isAdmin
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
              : 'bg-accent/15 text-accent-light hover:bg-accent/25'"
            @click="toggleAdmin"
          >
            {{ toggleLoading ? 'Updating...' : user.isAdmin ? 'Remove Admin' : 'Make Admin' }}
          </button>
        </template>
      </section>

      <!-- Feature Access -->
      <section class="rounded-xl border border-surface-lighter p-5 mt-6" style="box-shadow: var(--shadow-card)">
        <h2 class="text-lg font-semibold text-text-primary mb-4">Feature Access</h2>
        <div class="space-y-3">
          <div
            v-for="feat in KNOWN_FEATURES"
            :key="feat.key"
            class="flex items-center justify-between"
          >
            <div>
              <span class="text-sm font-medium text-text-primary">{{ feat.label }}</span>
              <p class="text-xs text-text-muted">{{ feat.description }}</p>
            </div>
            <button
              :disabled="featureLoading === feat.key"
              class="relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
              :class="user.features.includes(feat.key) ? 'bg-accent' : 'bg-surface-lighter'"
              @click="toggleFeature(feat.key, !user.features.includes(feat.key))"
            >
              <span
                class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                :class="user.features.includes(feat.key) ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>
        </div>
      </section>

      <!-- Delete User -->
      <section class="rounded-xl border border-red-500/20 p-5 mt-6">
        <h2 class="text-lg font-semibold text-text-primary mb-2">Danger Zone</h2>

        <div v-if="isSelf" class="text-sm text-text-muted">
          You cannot delete your own account.
        </div>

        <template v-else>
          <div
            v-if="deleteError"
            class="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            {{ deleteError }}
          </div>

          <p class="text-sm text-text-secondary mb-4">
            Permanently delete this user and all their data. This action cannot be undone.
          </p>

          <button
            :disabled="deleteLoading"
            class="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            @click="deleteUser"
          >
            {{ deleteLoading ? 'Deleting...' : 'Delete User' }}
          </button>
        </template>
      </section>
    </template>
  </main>
</template>
