import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

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
  ],
})

function isTokenExpired(jwt: string): boolean {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    if (!payload.exp) return false
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

router.beforeEach((to) => {
  if (to.path === '/login' || to.path === '/auth/callback' || to.path === '/auth/verify' || to.path === '/auth/reset-password') return
  const token = localStorage.getItem('token')
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    return { path: '/login' }
  }
})

export default router
