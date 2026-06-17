import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import { PERMISSION } from '@/types/auth'

// Toutes les vues sont lazy-loadées : le bundle initial reste léger et le
// premier affichage de chaque page est immédiat (RNF-TECH-09).
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, layout: 'blank' },
    },
    {
      path: '/invitation/:token',
      name: 'invite',
      component: () => import('@/views/InviteView.vue'),
      meta: { public: true, layout: 'blank' },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { permission: PERMISSION.PAGE_DASHBOARD },
    },
    {
      path: '/editeur',
      name: 'editor',
      component: () => import('@/views/EditorView.vue'),
      meta: { permission: PERMISSION.PAGE_EDITOR },
    },
    {
      path: '/compte',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
    },
    {
      path: '/administration/:section?',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { permission: PERMISSION.PAGE_ADMIN, noGrid: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

/**
 * Garde globale : exige une session authentifiée et, le cas échéant, la
 * permission déclarée sur la route. Le contrôle réel reste côté serveur ; ceci
 * n'est qu'un garde-fou de navigation (le front masque, il ne sécurise pas).
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Résout la session une seule fois (rechargement de page).
  if (auth.loading) await auth.fetchMe()

  if (to.meta.public) {
    // Déjà connecté → pas de page de login.
    if (auth.isAuthenticated && to.name === 'login') return { name: 'dashboard' }
    return true
  }

  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  const required = to.meta.permission as string | undefined
  if (required && !auth.can(required)) {
    // Repli : dashboard si autorisé, sinon la page compte (toujours accessible)
    // pour éviter une boucle de redirection.
    if (to.name !== 'dashboard' && auth.can(PERMISSION.PAGE_DASHBOARD)) {
      return { name: 'dashboard' }
    }
    return to.name === 'profile' ? true : { name: 'profile' }
  }

  return true
})

export default router
