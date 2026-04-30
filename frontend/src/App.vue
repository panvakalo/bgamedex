<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import { useAuth } from './composables/useAuth'
import { useFriends } from './composables/useFriends'
import { useFireworks } from './composables/useFireworks'
import { useDestructiveDialog } from './composables/useDestructiveDialog'
import { useTheme } from './composables/useTheme'
import { useSSE } from './composables/useSSE'
import { usePwaInstall } from './composables/usePwaInstall'
import NotificationList from './components/NotificationList.vue'
import logoUrl from './assets/img/BGameDex-logo_minimal.png'
import Fireworks from './components/Fireworks.vue'
import DestructiveDialog from './components/DestructiveDialog.vue'
import PixelDragon from './components/PixelDragon.vue'
import PixelIcon from './components/PixelIcon.vue'

const auth = useAuth()
const route = useRoute()
const { theme, toggle: toggleTheme } = useTheme()
const { pendingCount, fetchPendingCount } = useFriends()

const { user, isAuthenticated, logout, resendVerification } = auth

useSSE()
const { canInstall, install: installPwa, dismiss: dismissInstall } = usePwaInstall()

watchEffect(() => {
  if (isAuthenticated.value) {
    fetchPendingCount()
  }
})
const bannerDismissed = ref(false)
const resendLoading = ref(false)
const resendSent = ref(false)

const showVerificationBanner = computed(() =>
  isAuthenticated.value && user.value?.emailVerified === false && !bannerDismissed.value
)

async function handleResend() {
  resendLoading.value = true
  try {
    await resendVerification()
    resendSent.value = true
  } catch { /* silent */ }
  resendLoading.value = false
}
const userPicture = computed(() => user.value?.picture)
const { active: fireworksActive, done: fireworksDone } = useFireworks()
const { dialog: destructiveDialog, onConfirm, onCancel } = useDestructiveDialog()

const isAdminRoute = computed(() => route.path.startsWith('/admin'))
const mobileMenuOpen = ref(false)

const navItems = [
  { to: '/', label: 'Games', iconId: 'dice', exact: true },
  { to: '/stats', label: 'Stats', iconId: 'chart' },
  { to: '/collection-value', label: 'Value', iconId: 'coin' },
  { to: '/wishlist', label: 'Wishlist', iconId: 'heart' },
  { to: '/friends', label: 'Friends', iconId: 'people' },
]

function isActive(item: typeof navItems[number]): boolean {
  if (item.exact) return route.path === item.to
  return route.path.startsWith(item.to)
}
</script>

<template>
  <div class="min-h-screen bg-surface">
    <!-- Sidebar (desktop) -->
    <aside
      v-if="isAuthenticated && user && !isAdminRoute"
      class="sidebar-surface fixed inset-y-0 left-0 z-20 hidden md:flex flex-col w-16 border-r border-surface-lighter"
    >
      <!-- Logo -->
      <RouterLink to="/" class="flex items-center justify-center h-16 hover:opacity-80 transition-opacity">
        <img :src="logoUrl" alt="Bgamedex" class="max-h-10 max-w-12 object-contain" />
      </RouterLink>

      <!-- Nav items -->
      <nav class="flex-1 flex flex-col items-center gap-1 px-2 pt-2">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="group relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
          :class="isActive(item)
            ? 'bg-accent/15 text-accent-light'
            : 'text-text-muted hover:text-text-primary hover:bg-surface-lighter'"
        >
          <PixelIcon :name="item.iconId" :size="18" />
          <!-- Pending friend requests badge -->
          <span
            v-if="item.to === '/friends' && pendingCount > 0"
            class="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none"
          >
            {{ pendingCount > 9 ? '9+' : pendingCount }}
          </span>
          <!-- Tooltip -->
          <span class="absolute left-full ml-2 px-2 py-1 rounded-md bg-surface-lighter text-text-primary text-xs whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-150">
            {{ item.label }}
          </span>
        </RouterLink>
      </nav>

      <!-- Bottom actions -->
      <div class="flex flex-col items-center gap-2 px-2 pb-4">
        <button
          class="flex items-center justify-center w-10 h-10 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-lighter transition-colors"
          title="Toggle theme"
          @click="toggleTheme"
        >
          <PixelIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="18" />
        </button>
        <RouterLink
          to="/account"
          class="flex items-center justify-center w-10 h-10 rounded-xl hover:bg-surface-lighter transition-colors"
          :class="route.path === '/account' ? 'ring-2 ring-accent' : ''"
        >
          <img
            v-if="userPicture"
            :src="userPicture"
            :alt="user.name"
            class="w-8 h-8 rounded-full object-cover"
            referrerpolicy="no-referrer"
          />
          <div v-else class="w-8 h-8 rounded-full bg-accent/20 text-accent-light flex items-center justify-center text-xs font-medium">
            {{ user.name?.charAt(0)?.toUpperCase() || '?' }}
          </div>
        </RouterLink>
        <button
          class="group relative flex items-center justify-center w-10 h-10 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-lighter transition-colors"
          title="Sign out"
          @click="logout().then(() => $router.push('/login'))"
        >
          <PixelIcon name="logout" :size="18" />
          <span class="absolute left-full ml-2 px-2 py-1 rounded-md bg-surface-lighter text-text-primary text-xs whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-150">
            Sign out
          </span>
        </button>
      </div>
    </aside>

    <!-- Mobile top bar -->
    <header
      v-if="isAuthenticated && user && !isAdminRoute"
      class="sticky top-0 z-20 md:hidden bg-surface border-b-4 border-text-primary"
    >
      <div class="flex items-center justify-between px-4 py-3">
        <RouterLink to="/" class="flex items-center gap-2">
          <img :src="logoUrl" alt="Bgamedex" class="h-8" />
          <span class="text-xl font-bold text-text-primary tracking-tight font-display"><span class="text-accent-light">Bgame</span>dex</span>
        </RouterLink>
        <button
          class="flex items-center justify-center w-9 h-9 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-lighter transition-colors"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <PixelIcon :name="mobileMenuOpen ? 'close' : 'menu'" :size="18" />
        </button>
      </div>

      <!-- Mobile dropdown menu -->
      <nav v-if="mobileMenuOpen" class="border-t border-surface-lighter bg-surface px-4 py-3 space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
          :class="isActive(item)
            ? 'bg-accent/15 text-accent-light font-medium'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-lighter'"
          @click="mobileMenuOpen = false"
        >
          <PixelIcon :name="item.iconId" :size="18" />
          {{ item.label }}
          <span
            v-if="item.to === '/friends' && pendingCount > 0"
            class="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-none"
          >
            {{ pendingCount > 9 ? '9+' : pendingCount }}
          </span>
        </RouterLink>

        <div class="border-t border-surface-lighter my-2" />

        <RouterLink
          to="/account"
          class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-secondary hover:text-text-primary hover:bg-surface-lighter transition-colors"
          @click="mobileMenuOpen = false"
        >
          <img
            v-if="userPicture"
            :src="userPicture"
            :alt="user.name"
            class="w-5 h-5 rounded-full object-cover"
            referrerpolicy="no-referrer"
          />
          <div v-else class="w-5 h-5 rounded-full bg-accent/20 text-accent-light flex items-center justify-center text-[10px] font-medium">
            {{ user.name?.charAt(0)?.toUpperCase() || '?' }}
          </div>
          Account
        </RouterLink>

        <div class="flex items-center justify-between px-3 py-2.5">
          <button
            class="flex items-center gap-3 text-sm text-text-muted hover:text-text-primary transition-colors"
            @click="toggleTheme"
          >
            <PixelIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="18" />
            {{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}
          </button>
          <button
            class="text-sm text-text-muted hover:text-text-primary transition-colors"
            @click="logout().then(() => $router.push('/login'))"
          >
            Sign out
          </button>
        </div>
      </nav>
    </header>

    <!-- Email verification banner -->
    <div
      v-if="showVerificationBanner"
      class="bg-amber-100 dark:bg-amber-500/15 border-b border-amber-300 dark:border-amber-500/30 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3"
      :class="isAuthenticated && user && !isAdminRoute ? 'md:ml-16' : ''"
    >
      <div class="flex items-center gap-2 min-w-0">
        <PixelIcon name="mail" :size="14" class="shrink-0 text-amber-600 dark:text-amber-400" />
        <span>Please verify your email address.</span>
        <button
          v-if="!resendSent"
          :disabled="resendLoading"
          class="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline underline-offset-2 disabled:opacity-50 shrink-0"
          @click="handleResend"
        >
          {{ resendLoading ? 'Sending...' : 'Resend email' }}
        </button>
        <span v-else class="text-amber-700 dark:text-amber-300 shrink-0">Sent!</span>
      </div>
      <button
        class="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 shrink-0"
        title="Dismiss"
        @click="bannerDismissed = true"
      >
        <PixelIcon name="close" :size="14" />
      </button>
    </div>

    <!-- PWA install banner -->
    <div
      v-if="canInstall"
      class="bg-accent/10 border-b border-accent/20 px-4 py-2.5 text-sm text-accent-light flex items-center justify-between gap-3"
      :class="isAuthenticated && user && !isAdminRoute ? 'md:ml-16' : ''"
    >
      <div class="flex items-center gap-2 min-w-0">
        <PixelIcon name="download" :size="14" class="shrink-0" />
        <span>Install Bgamedex for a better experience</span>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          class="px-3 py-1 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-light transition-colors"
          @click="installPwa"
        >
          Install
        </button>
        <button
          class="text-text-muted hover:text-text-primary transition-colors"
          title="Dismiss"
          @click="dismissInstall"
        >
          <PixelIcon name="close" :size="14" />
        </button>
      </div>
    </div>

    <!-- Main content area -->
    <div :class="isAuthenticated && user && !isAdminRoute ? 'md:ml-16' : ''">
      <RouterView v-slot="{ Component }">
        <KeepAlive include="HomeView">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </div>

    <PixelDragon />
    <NotificationList />
    <Fireworks v-if="fireworksActive" @done="fireworksDone" />
    <DestructiveDialog
      v-if="destructiveDialog.open"
      :title="destructiveDialog.title"
      :message="destructiveDialog.message"
      :confirm-label="destructiveDialog.confirmLabel"
      @confirm="onConfirm"
      @cancel="onCancel"
    />
  </div>
</template>
