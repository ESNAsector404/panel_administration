import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '../App.vue'
import { useAuthStore } from '../stores/auth'
import DashboardView from '../views/DashboardView.vue'

describe('App', () => {
  it('affiche le shell Sector 404 et le dashboard', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: DashboardView }],
    })
    router.push('/')
    await router.isReady()

    const pinia = createPinia()
    // Session simulée : la sidebar filtre ses entrées selon les permissions.
    const auth = useAuthStore(pinia)
    auth.user = {
      id: 'test',
      username: 'admin',
      email: 'admin@test.local',
      displayName: 'Admin',
      active: true,
      lastLoginAt: null,
      role: { id: 'r', slug: 'admin', name: 'Administrateur' },
      permissions: ['*'],
    }
    auth.loading = false

    const wrapper = mount(App, {
      global: { plugins: [router, pinia] },
    })

    expect(wrapper.text()).toContain('Sector 404')
    expect(wrapper.text()).toContain("Vue d'ensemble")
    expect(wrapper.text()).toContain('Plan de la ville')
  })
})
