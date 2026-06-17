<script setup lang="ts">
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import type { PermissionGroup, Role } from '@/types/auth'

defineProps<{
  roles: Role[]
  permGroups: PermissionGroup[]
  canManage: boolean
}>()

const emit = defineEmits<{
  create: []
  togglePerm: [role: Role, key: string]
  remove: [role: Role]
}>()

function roleHasPerm(role: Role, key: string): boolean {
  return role.permissions.includes('*') || role.permissions.includes(key)
}
</script>

<template>
  <section class="card admin__panel">
    <header class="admin__panel-head">
      <h2 class="card-title">Rôles ({{ roles.length }})</h2>
      <button v-if="canManage" class="btn-primary" @click="emit('create')">
        + Nouveau rôle
      </button>
    </header>

    <div class="roles">
      <article v-for="role in roles" :key="role.id" class="role">
        <header class="role__head">
          <div>
            <h3>
              {{ role.name }}
              <span class="role__slug">{{ role.slug }}</span>
              <span v-if="role.protected" class="tag">système</span>
            </h3>
            <p class="muted">{{ role.description || '—' }}</p>
          </div>
          <button
            v-if="canManage && !role.protected"
            class="btn-ghost is-danger"
            @click="emit('remove', role)"
          >
            Supprimer
          </button>
        </header>

        <div v-if="role.permissions.includes('*')" class="role__wildcard">
          Accès total (toutes les permissions)
        </div>
        <div v-else class="role__perms">
          <template v-for="group in permGroups" :key="group.domain">
            <div class="role__group-label">{{ group.domain }}</div>
            <ToggleSwitch
              v-for="p in group.permissions"
              :key="p.key"
              class="perm"
              :model-value="roleHasPerm(role, p.key)"
              :disabled="!canManage"
              :label="p.label"
              @update:model-value="emit('togglePerm', role, p.key)"
            />
          </template>
          <p v-if="!permGroups.length" class="muted">
            Permissions visibles avec le droit « roles:read ».
          </p>
        </div>
      </article>
    </div>
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

.roles {
  display: grid;
  gap: var(--sp-4);
}

.role {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card-2);
  padding: var(--sp-4);
}

.role__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--sp-3);
  margin-bottom: var(--sp-3);
}

.role__head h3 {
  font-size: 14px;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.role__slug {
  font-family: var(--font-title);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-faint);
}

.role__wildcard {
  font-size: 12px;
  color: var(--primary-300);
  background: var(--primary-soft);
  border: 1px solid rgba(94, 43, 255, 0.4);
  border-radius: var(--radius-sm);
  padding: 8px 11px;
}

.role__perms {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px var(--sp-4);
}

.role__group-label {
  grid-column: 1 / -1;
  font-family: var(--font-title);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint);
  margin-top: var(--sp-2);
}

.perm {
  align-items: flex-start;
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

.btn-ghost.is-danger:hover {
  color: var(--critical);
  border-color: var(--critical);
}
</style>
