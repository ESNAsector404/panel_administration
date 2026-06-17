/** Types partagés du domaine authentification / RBAC (miroir de l'API). */

export interface AuthUser {
  id: string
  username: string
  email: string
  displayName: string
  active: boolean
  lastLoginAt: string | null
  role: { id: string; slug: string; name: string } | null
  permissions: string[]
}

export interface Role {
  id: string
  slug: string
  name: string
  description: string
  permissions: string[]
  protected: boolean
  createdAt?: string
}

export interface ManagedUser {
  id: string
  username: string
  email: string
  displayName: string
  active: boolean
  lastLoginAt: string | null
  role: Role | null
}

export interface Invitation {
  id: string
  token: string
  role: { id?: string; slug?: string; name?: string } | null
  email: string
  note: string
  invitedBy: { username?: string } | null
  expiresAt: string
  usedAt: string | null
  usedBy: { username?: string } | null
  createdAt?: string
}

export interface PermissionGroup {
  domain: string
  permissions: { key: string; label: string }[]
}

/** Permissions connues (miroir de `server/src/config/permissions.js`). */
export const PERMISSION = {
  PAGE_DASHBOARD: 'page:dashboard',
  PAGE_EDITOR: 'page:editor',
  PAGE_ADMIN: 'page:admin',
  CITY_READ: 'city:read',
  CITY_PILOT: 'city:pilot',
  AUDIT_READ: 'audit:read',
  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',
  ROLES_READ: 'roles:read',
  ROLES_MANAGE: 'roles:manage',
} as const

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION]
