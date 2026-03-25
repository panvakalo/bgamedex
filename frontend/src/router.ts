import { createRouter, createWebHistory } from 'vue-router'

import HomeView from './views/HomeView.vue'
import { useAuth, authReady } from './composables/useAuth'
import { useAdminAuth, adminAuthReady } from './composables/useAdminAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/games/:id', component: () => import('./views/GameDetailView.vue') },
    { path: '/stats', component: () => import('./views/StatsView.vue') },
    { path: '/collection-value', component: () => import('./views/CollectionValueView.vue') },
    { path: '/wishlist', component: () => import('./views/WishlistView.vue') },
    { path: '/friends', component: () => import('./views/FriendsView.vue') },
    { path: '/friends/:userId/collection', component: () => import('./views/FriendCollectionView.vue') },
    { path: '/friends/:userId/wishlist', component: () => import('./views/FriendWishlistView.vue') },
    { path: '/account', component: () => import('./views/AccountView.vue') },
    { path: '/login', component: () => import('./views/LoginView.vue') },
    { path: '/auth/callback', component: () => import('./views/AuthCallbackView.vue') },
    { path: '/auth/verify', component: () => import('./views/VerifyEmailView.vue') },
    { path: '/auth/reset-password', component: () => import('./views/ResetPasswordView.vue') },
    { path: '/admin/login', component: () => import('./views/admin/AdminLoginView.vue'), meta: { admin: true } },
    {
      path: '/admin',
      component: () => import('./components/admin/AdminLayout.vue'),
      meta: { admin: true, requiresAdminAuth: true },
      children: [
        { path: '', redirect: '/admin/dashboard' },
        { path: 'dashboard', component: () => import('./views/admin/AdminDashboardView.vue') },
        { path: 'users', component: () => import('./views/admin/AdminUsersView.vue') },
        { path: 'users/:id', component: () => import('./views/admin/AdminUserDetailView.vue') },
        { path: 'analytics', component: () => import('./views/admin/AdminAnalyticsView.vue') },
        { path: 'system', component: () => import('./views/admin/AdminSystemView.vue') },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  // Admin routes — separate auth flow
  if (to.matched.some((r) => r.meta.admin)) {
    if (to.path === '/admin/login') return
    if (!to.matched.some((r) => r.meta.requiresAdminAuth)) return
    await adminAuthReady
    const { isAdminAuthenticated } = useAdminAuth()
    if (!isAdminAuthenticated.value) return { path: '/admin/login' }
    return
  }

  // Regular app routes
  if (to.path === '/login' || to.path === '/auth/callback' || to.path === '/auth/verify' || to.path === '/auth/reset-password') return
  await authReady
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated.value) return { path: '/login' }
})

export default router
