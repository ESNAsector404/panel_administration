<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Component } from 'vue'
import { Cable, Lightbulb, Link as LinkIcon, ShieldCheck, Users } from 'lucide-vue-next'

import EquipmentPanel from '@/components/admin/EquipmentPanel.vue'
import InvitationsPanel from '@/components/admin/InvitationsPanel.vue'
import IoPanel from '@/components/admin/IoPanel.vue'
import RoleFormModal from '@/components/admin/RoleFormModal.vue'
import RolesPanel from '@/components/admin/RolesPanel.vue'
import UserFormModal from '@/components/admin/UserFormModal.vue'
import UsersPanel from '@/components/admin/UsersPanel.vue'
import { adminApi } from '@/lib/adminApi'
import { ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { PERMISSION } from '@/types/auth'
import type { ManagedUser, PermissionGroup, Role } from '@/types/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

/* ---------- Sous-menus (deuxième sidebar) ---------- */

interface Section {
  id: string
  label: string
  icon: Component
  permission: string
}

const SECTIONS: Section[] = [
  { id: 'equipements', label: 'Équipements', icon: Lightbulb, permission: PERMISSION.PAGE_EDITOR },
  { id: 'io', label: 'Entrées / Sorties', icon: Cable, permission: PERMISSION.CITY_READ },
  { id: 'utilisateurs', label: 'Utilisateurs', icon: Users, permission: PERMISSION.USERS_READ },
  { id: 'roles', label: 'Rôles & permissions', icon: ShieldCheck, permission: PERMISSION.ROLES_READ },
  { id: 'invitations', label: 'Invitations', icon: LinkIcon, permission: PERMISSION.USERS_MANAGE },
]

const sections = computed(() => SECTIONS.filter((s) => auth.can(s.permission)))

const section = computed(() => {
  const id = String(route.params.section ?? '')
  return sections.value.some((s) => s.id === id) ? id : (sections.value[0]?.id ?? 'utilisateurs')
})

function goTo(id: string) {
  router.push(`/administration/${id}`)
}

/* ---------- Données RBAC partagées ---------- */

const users = ref<ManagedUser[]>([])
const roles = ref<Role[]>([])
const permGroups = ref<PermissionGroup[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

const showUserForm = ref(false)
const showRoleForm = ref(false)

const canManageUsers = computed(() => auth.can(PERMISSION.USERS_MANAGE))
const canManageRoles = computed(() => auth.can(PERMISSION.ROLES_MANAGE))

function flash(msg: string) {
  notice.value = msg
  setTimeout(() => (notice.value = null), 3000)
}

function reportError(err: unknown) {
  error.value = err instanceof ApiError || err instanceof Error ? err.message : 'Erreur inconnue'
  setTimeout(() => (error.value = null), 4000)
}

async function loadAll() {
  loading.value = true
  try {
    const [u, r] = await Promise.all([adminApi.listUsers(), adminApi.listRoles()])
    users.value = u
    roles.value = r
    if (canManageRoles.value) permGroups.value = await adminApi.listPermissions()
  } catch (err) {
    reportError(err)
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

/* ---------- Utilisateurs ---------- */

async function submitUser(data: { username: string; email: string; displayName: string; password: string; roleId: string }) {
  try {
    const created = await adminApi.createUser(data)
    users.value.push(created)
    showUserForm.value = false
    flash(`Compte « ${created.username} » créé.`)
  } catch (err) {
    reportError(err)
  }
}

async function toggleActive(u: ManagedUser) {
  try {
    const updated = await adminApi.updateUser(u.id, { active: !u.active })
    Object.assign(u, updated)
    flash(`Compte « ${u.username} » ${u.active ? 'activé' : 'désactivé'}.`)
  } catch (err) {
    reportError(err)
  }
}

async function changeUserRole(u: ManagedUser, roleId: string) {
  try {
    const updated = await adminApi.updateUser(u.id, { roleId })
    Object.assign(u, updated)
    flash(`Rôle de « ${u.username} » mis à jour.`)
  } catch (err) {
    reportError(err)
    await loadAll()
  }
}

async function resetPassword(u: ManagedUser) {
  const pwd = window.prompt(`Nouveau mot de passe pour « ${u.username} » (≥ 8 caractères) :`)
  if (!pwd) return
  try {
    await adminApi.updateUser(u.id, { password: pwd })
    flash(`Mot de passe de « ${u.username} » réinitialisé.`)
  } catch (err) {
    reportError(err)
  }
}

/* ---------- Rôles ---------- */

async function submitRole(data: { slug: string; name: string; description: string; permissions: string[] }) {
  try {
    const created = await adminApi.createRole(data)
    roles.value.push(created)
    showRoleForm.value = false
    flash(`Rôle « ${created.name} » créé.`)
  } catch (err) {
    reportError(err)
  }
}

async function toggleRolePerm(role: Role, key: string) {
  if (role.permissions.includes('*')) return
  const next = role.permissions.includes(key)
    ? role.permissions.filter((p) => p !== key)
    : [...role.permissions, key]
  try {
    const updated = await adminApi.updateRole(role.id, { permissions: next })
    Object.assign(role, updated)
  } catch (err) {
    reportError(err)
  }
}

async function removeRole(role: Role) {
  if (!window.confirm(`Supprimer le rôle « ${role.name} » ?`)) return
  try {
    await adminApi.deleteRole(role.id)
    roles.value = roles.value.filter((r) => r.id !== role.id)
    flash(`Rôle « ${role.name} » supprimé.`)
  } catch (err) {
    reportError(err)
  }
}
</script>

<template>
  <div class="admin">
    <!-- Deuxième sidebar : sous-menus d'administration -->
    <aside class="admin__nav">
      <h1 class="title-ticking">Administration</h1>
      <ul>
        <li v-for="s in sections" :key="s.id">
          <button
            class="admin__nav-item"
            :class="{ 'is-active': section === s.id }"
            @click="goTo(s.id)"
          >
            <component :is="s.icon" :size="16" :stroke-width="2" />
            <span>{{ s.label }}</span>
          </button>
        </li>
      </ul>
    </aside>

    <div class="admin__content">
      <p v-if="notice" class="admin__flash is-ok">{{ notice }}</p>
      <p v-if="error" class="admin__flash is-err">{{ error }}</p>

      <EquipmentPanel v-if="section === 'equipements'" @flash="flash" />

      <IoPanel v-else-if="section === 'io'" />

      <template v-else-if="section === 'utilisateurs'">
        <p v-if="loading" class="admin__loading">Chargement…</p>
        <UsersPanel
          v-else
          :users="users"
          :roles="roles"
          :can-manage="canManageUsers"
          :self-id="auth.user?.id"
          @create="showUserForm = true"
          @toggle-active="toggleActive"
          @change-role="changeUserRole"
          @reset-password="resetPassword"
        />
      </template>

      <template v-else-if="section === 'roles'">
        <p v-if="loading" class="admin__loading">Chargement…</p>
        <RolesPanel
          v-else
          :roles="roles"
          :perm-groups="permGroups"
          :can-manage="canManageRoles"
          @create="showRoleForm = true"
          @toggle-perm="toggleRolePerm"
          @remove="removeRole"
        />
      </template>

      <InvitationsPanel
        v-else-if="section === 'invitations' && !loading"
        :roles="roles"
        @flash="flash"
        @error="reportError"
      />
    </div>

    <UserFormModal
      v-if="showUserForm"
      :roles="roles"
      @submit="submitUser"
      @cancel="showUserForm = false"
    />

    <RoleFormModal
      v-if="showRoleForm"
      :perm-groups="permGroups"
      @submit="submitRole"
      @cancel="showRoleForm = false"
    />
  </div>
</template>

<style scoped>
.admin {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--sp-4);
  padding: var(--sp-5);
  align-items: start;
}

.admin__nav {
  position: sticky;
  top: var(--sp-5);
  background: var(--bg-raise);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-4) var(--sp-3);
}

.admin__nav h1 {
  font-size: 14px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text);
  padding: 0 var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--border);
  margin-bottom: var(--sp-3);
}

.admin__nav ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin__nav-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-dim);
  font-size: 13px;
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.admin__nav-item:hover {
  color: var(--text);
}

.admin__nav-item.is-active {
  background: var(--bg-card-2);
  color: var(--text);
  font-weight: 600;
}

.admin__content {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  min-width: 0;
}

.admin__flash {
  font-size: 12px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
}

.admin__flash.is-ok {
  color: var(--ok);
  background: var(--ok-soft);
  border: 1px solid rgba(57, 217, 138, 0.4);
}

.admin__flash.is-err {
  color: var(--critical);
  background: var(--critical-soft);
  border: 1px solid rgba(255, 77, 109, 0.4);
}

.admin__loading {
  color: var(--text-faint);
  font-size: 13px;
}

@media (max-width: 1024px) {
  .admin {
    grid-template-columns: 1fr;
  }
  .admin__nav {
    position: static;
  }
}
</style>
