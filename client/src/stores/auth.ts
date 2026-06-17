import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { api, ApiError } from '@/lib/api'
import type { AuthUser, Permission } from '@/types/auth'

/**
 * Store d'authentification : porte l'utilisateur courant et ses permissions.
 * La session vit dans des cookies httpOnly côté navigateur — ce store ne stocke
 * jamais de token, seulement l'identité résolue par `/auth/me`.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  /** `true` tant que la session initiale n'a pas été résolue (évite un flash). */
  const loading = ref(true)

  const isAuthenticated = computed(() => user.value !== null)
  const permissions = computed<string[]>(() => user.value?.permissions ?? [])

  /** L'utilisateur possède-t-il la permission (gère les wildcards) ? */
  function can(perm: Permission | string): boolean {
    const granted = permissions.value
    if (granted.includes('*')) return true
    if (granted.includes(perm)) return true
    const domain = perm.split(':')[0]
    return granted.includes(`${domain}:*`)
  }

  /** Tout admin (wildcard) ou détenteur d'une permission d'administration. */
  const isAdmin = computed(() => can('users:manage') || can('roles:manage'))

  /** Résout la session au démarrage de l'app (cookie présent ou non). */
  async function fetchMe(): Promise<void> {
    loading.value = true
    try {
      const { user: me } = await api.get<{ user: AuthUser }>('/auth/me')
      user.value = me
    } catch {
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(identifier: string, password: string): Promise<void> {
    try {
      const { user: me } = await api.post<{ user: AuthUser }>('/auth/login', {
        identifier,
        password,
      })
      user.value = me
    } catch (err) {
      if (err instanceof ApiError) throw new Error(err.message)
      throw err
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } finally {
      user.value = null
    }
  }

  return {
    user,
    loading,
    isAuthenticated,
    isAdmin,
    permissions,
    can,
    fetchMe,
    login,
    logout,
  }
})
