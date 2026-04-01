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
import logoUrl from './assets/img/BGamedex-logo.png'
import Fireworks from './components/Fireworks.vue'
import DestructiveDialog from './components/DestructiveDialog.vue'

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
  {
    to: '/',
    label: 'Games',
    // Dice icon
    icon: 'M21 16.811c0 .556-.296.92-.584 1.088l-5.432 3.14a1.171 1.171 0 01-1.168 0l-5.432-3.14c-.288-.167-.584-.532-.584-1.088V10.59c0-.556.296-.92.584-1.088l5.432-3.14a1.171 1.171 0 011.168 0l5.432 3.14c.288.167.584.532.584 1.088v6.222z',
    exact: true,
  },
  {
    to: '/stats',
    label: 'Stats',
    // Bar chart icon
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  },
  {
    to: '/collection-value',
    label: 'Value',
    // Currency/tag icon
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    to: '/wishlist',
    label: 'Wishlist',
    // Heart icon
    icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  },
  {
    to: '/friends',
    label: 'Friends',
    // People icon
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
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
        <img :src="logoUrl" alt="Bgamedex" class="max-h-10 max-w-12 object-contain drop-shadow-sm" />
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
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
          </svg>
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
          <svg v-if="theme === 'dark'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
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
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span class="absolute left-full ml-2 px-2 py-1 rounded-md bg-surface-lighter text-text-primary text-xs whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none transition-all duration-150">
            Sign out
          </span>
        </button>
      </div>
    </aside>

    <!-- Mobile top bar -->
    <header
      v-if="isAuthenticated && user && !isAdminRoute"
      class="sticky top-0 z-20 md:hidden bg-surface/80 backdrop-blur-md border-b border-surface-lighter"
    >
      <div class="flex items-center justify-between px-4 py-3">
        <RouterLink to="/" class="flex items-center gap-2">
          <img :src="logoUrl" alt="Bgamedex" class="h-8 drop-shadow-sm" />
          <span class="text-xl font-bold text-text-primary tracking-tight font-display"><span class="text-accent-light">Bgame</span>dex</span>
        </RouterLink>
        <button
          class="flex items-center justify-center w-9 h-9 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-lighter transition-colors"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <!-- Hamburger / Close -->
          <svg v-if="!mobileMenuOpen" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
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
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
          </svg>
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
            <svg v-if="theme === 'dark'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
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
        <svg class="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
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
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- PWA install banner -->
    <div
      v-if="canInstall"
      class="bg-accent/10 border-b border-accent/20 px-4 py-2.5 text-sm text-accent-light flex items-center justify-between gap-3"
      :class="isAuthenticated && user && !isAdminRoute ? 'md:ml-16' : ''"
    >
      <div class="flex items-center gap-2 min-w-0">
        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
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
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
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
