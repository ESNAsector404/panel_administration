import { api } from '@/lib/api'
import type { Invitation, ManagedUser, PermissionGroup, Role } from '@/types/auth'

/** Appels API de l'IHM d'administration (RBAC). */
export const adminApi = {
  listUsers: () => api.get<{ users: ManagedUser[] }>('/users').then((r) => r.users),
  createUser: (body: {
    username: string
    email: string
    displayName?: string
    password: string
    roleId: string
  }) => api.post<{ user: ManagedUser }>('/users', body).then((r) => r.user),
  updateUser: (
    id: string,
    body: Partial<{
      email: string
      displayName: string
      roleId: string
      active: boolean
      password: string
    }>,
  ) => api.patch<{ user: ManagedUser }>(`/users/${id}`, body).then((r) => r.user),

  listRoles: () => api.get<{ roles: Role[] }>('/roles').then((r) => r.roles),
  listPermissions: () =>
    api.get<{ groups: PermissionGroup[] }>('/roles/permissions').then((r) => r.groups),
  createRole: (body: {
    slug: string
    name: string
    description?: string
    permissions: string[]
  }) => api.post<{ role: Role }>('/roles', body).then((r) => r.role),
  updateRole: (
    id: string,
    body: Partial<{ name: string; description: string; permissions: string[] }>,
  ) => api.patch<{ role: Role }>(`/roles/${id}`, body).then((r) => r.role),
  deleteRole: (id: string) => api.del<{ ok: true }>(`/roles/${id}`),

  /* --- Invitations (lien transmis manuellement) --- */
  listInvitations: () =>
    api.get<{ invitations: Invitation[] }>('/invitations').then((r) => r.invitations),
  createInvitation: (body: { roleId: string; email?: string; note?: string }) =>
    api.post<{ invitation: Invitation }>('/invitations', body).then((r) => r.invitation),
  revokeInvitation: (id: string) => api.del<{ ok: true }>(`/invitations/${id}`),
}
