<script setup lang="ts">
import type { ManagedUser, Role } from '@/types/auth'

defineProps<{
  users: ManagedUser[]
  roles: Role[]
  canManage: boolean
  selfId: string | undefined
}>()

const emit = defineEmits<{
  create: []
  toggleActive: [user: ManagedUser]
  changeRole: [user: ManagedUser, roleId: string]
  resetPassword: [user: ManagedUser]
}>()
</script>

<template>
  <section class="card admin__panel">
    <header class="admin__panel-head">
      <h2 class="card-title">Comptes ({{ users.length }})</h2>
      <button v-if="canManage" class="btn-primary" @click="emit('create')">
        + Nouveau compte
      </button>
    </header>

    <table class="admin__table">
      <thead>
        <tr>
          <th>Utilisateur</th>
          <th>Email</th>
          <th>Rôle</th>
          <th>Statut</th>
          <th>Dernière connexion</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in users" :key="u.id">
          <td>
            <strong>{{ u.username }}</strong>
            <span v-if="u.id === selfId" class="tag">vous</span>
            <div class="muted">{{ u.displayName }}</div>
          </td>
          <td class="muted">{{ u.email }}</td>
          <td>
            <select
              v-if="canManage && u.id !== selfId"
              :value="u.role?.id"
              @change="emit('changeRole', u, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
            <span v-else>{{ u.role?.name ?? '—' }}</span>
          </td>
          <td>
            <span class="badge" :class="u.active ? 'badge--ok' : 'badge--off'">
              {{ u.active ? 'Actif' : 'Désactivé' }}
            </span>
          </td>
          <td class="muted">
            {{ u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('fr-FR') : 'jamais' }}
          </td>
          <td class="admin__row-actions">
            <template v-if="canManage && u.id !== selfId">
              <button class="btn-ghost" @click="emit('resetPassword', u)">Mot de passe</button>
              <button class="btn-ghost" @click="emit('toggleActive', u)">
                {{ u.active ? 'Désactiver' : 'Activer' }}
              </button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.admin__panel {
  padding: var(--sp-4);
}

.admin__panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--sp-4);
}

.admin__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.admin__table th {
  text-align: left;
  font-family: var(--font-title);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint);
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.admin__table td {
  padding: 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  color: var(--text);
}

.admin__row-actions {
  display: flex;
  gap: var(--sp-2);
  justify-content: flex-end;
}

.muted {
  color: var(--text-faint);
  font-size: 11px;
}

.tag {
  margin-left: 6px;
  font-size: 9px;
  font-family: var(--font-title);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary-300);
  background: var(--primary-soft);
  border: 1px solid rgba(94, 43, 255, 0.4);
  border-radius: 999px;
  padding: 1px 7px;
}

.badge {
  font-size: 10px;
  font-family: var(--font-title);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
}

.badge--ok {
  color: var(--ok);
  background: var(--ok-soft);
  border: 1px solid rgba(57, 217, 138, 0.4);
}

.badge--off {
  color: var(--offline);
  background: var(--offline-soft);
  border: 1px solid var(--border-strong);
}

select {
  background: var(--bg-inset);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 12px;
  padding: 7px 10px;
}

select:focus {
  outline: none;
  border-color: var(--primary-500);
}

.btn-primary {
  padding: 8px 14px;
  border: 1px solid var(--primary-500);
  border-radius: var(--radius-sm);
  background: var(--primary-500);
  color: var(--s404-light);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover {
  box-shadow: 0 0 12px var(--primary-glow);
}

.btn-ghost {
  padding: 6px 11px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-card-2);
  color: var(--text-dim);
  font-size: 11px;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-ghost:hover {
  color: var(--text);
  border-color: var(--primary-500);
}
</style>
