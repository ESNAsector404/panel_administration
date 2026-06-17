<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Copy, Link as LinkIcon, Trash2 } from 'lucide-vue-next'

import { adminApi } from '@/lib/adminApi'
import type { Invitation, Role } from '@/types/auth'

const props = defineProps<{ roles: Role[] }>()
const emit = defineEmits<{ error: [unknown]; flash: [string] }>()

const invitations = ref<Invitation[]>([])
const loading = ref(true)

const roleId = ref('')
const email = ref('')
const note = ref('')

onMounted(async () => {
  try {
    invitations.value = await adminApi.listInvitations()
    // pré-sélectionne le premier rôle non super-admin
    roleId.value = props.roles.find((r) => !r.permissions.includes('*'))?.id ?? ''
  } catch (err) {
    emit('error', err)
  } finally {
    loading.value = false
  }
})

function inviteUrl(inv: Invitation): string {
  return `${window.location.origin}/invitation/${inv.token}`
}

function isUsable(inv: Invitation): boolean {
  return !inv.usedAt && new Date(inv.expiresAt) > new Date()
}

async function create() {
  if (!roleId.value) return
  try {
    const inv = await adminApi.createInvitation({
      roleId: roleId.value,
      email: email.value || undefined,
      note: note.value || undefined,
    })
    invitations.value.unshift(inv)
    email.value = ''
    note.value = ''
    await copy(inv)
  } catch (err) {
    emit('error', err)
  }
}

async function copy(inv: Invitation) {
  try {
    await navigator.clipboard.writeText(inviteUrl(inv))
    emit('flash', 'Lien d’invitation copié — à transmettre manuellement.')
  } catch {
    emit('flash', `Lien : ${inviteUrl(inv)}`)
  }
}

async function revoke(inv: Invitation) {
  if (!window.confirm('Révoquer cette invitation ?')) return
  try {
    await adminApi.revokeInvitation(inv.id)
    invitations.value = invitations.value.filter((i) => i.id !== inv.id)
    emit('flash', 'Invitation révoquée.')
  } catch (err) {
    emit('error', err)
  }
}

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
}
</script>

<template>
  <section class="card panel">
    <header class="panel__head">
      <h2 class="card-title">Invitations</h2>
      <span class="chip">{{ invitations.length }}</span>
    </header>

    <form class="panel__form" @submit.prevent="create">
      <select v-model="roleId" required>
        <option v-for="r in roles.filter((x) => !x.permissions.includes('*'))" :key="r.id" :value="r.id">
          {{ r.name }}
        </option>
      </select>
      <input v-model="email" type="email" placeholder="Email (optionnel)" />
      <input v-model="note" type="text" placeholder="Note (optionnel)" />
      <button type="submit" class="btn-primary">
        <LinkIcon :size="16" :stroke-width="2" /> Générer un lien
      </button>
    </form>

    <p v-if="loading" class="panel__hint">Chargement…</p>
    <p v-else-if="!invitations.length" class="panel__hint">
      Aucune invitation. Générez un lien et transmettez-le manuellement.
    </p>

    <table v-else class="panel__table">
      <thead>
        <tr>
          <th>Rôle</th>
          <th>Email</th>
          <th>Expire</th>
          <th>Statut</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="inv in invitations" :key="inv.id">
          <td>{{ inv.role?.name ?? '—' }}</td>
          <td>{{ inv.email || '—' }}</td>
          <td>{{ fmt(inv.expiresAt) }}</td>
          <td>
            <span v-if="inv.usedAt" class="chip">utilisée par {{ inv.usedBy?.username ?? '?' }}</span>
            <span v-else-if="isUsable(inv)" class="chip chip--ok">active</span>
            <span v-else class="chip">expirée</span>
          </td>
          <td class="panel__actions">
            <button v-if="isUsable(inv)" title="Copier le lien" @click="copy(inv)">
              <Copy :size="15" :stroke-width="2" />
            </button>
            <button v-if="!inv.usedAt" title="Révoquer" class="is-danger" @click="revoke(inv)">
              <Trash2 :size="15" :stroke-width="2" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-4) var(--sp-3);
  border-bottom: 1px solid var(--border);
}

.panel__form {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
  padding: var(--sp-4);
  border-bottom: 1px dashed var(--border);
}

.panel__form select,
.panel__form input {
  background: var(--bg-card-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 12px;
  padding: 8px 10px;
  font-family: var(--font-body);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--primary-500);
  border: none;
  color: var(--s404-light);
  border-radius: var(--radius-sm);
  font-size: 12px;
  padding: 8px 14px;
  cursor: pointer;
}

.btn-primary:hover {
  box-shadow: 0 0 12px var(--primary-glow);
}

.panel__hint {
  padding: var(--sp-4);
  font-size: 12px;
  color: var(--text-faint);
}

.panel__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.panel__table th {
  text-align: left;
  font-family: var(--font-title);
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-faint);
  padding: 10px var(--sp-4);
  border-bottom: 1px solid var(--border);
}

.panel__table td {
  padding: 10px var(--sp-4);
  border-bottom: 1px dashed rgba(36, 32, 49, 0.7);
  color: var(--text-dim);
}

.chip--ok {
  color: var(--ok);
  border-color: rgba(57, 217, 138, 0.4);
}

.panel__actions {
  display: flex;
  gap: 6px;
}

.panel__actions button {
  background: var(--bg-card-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text-dim);
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.panel__actions button:hover {
  border-color: var(--primary-500);
  color: var(--text);
}

.panel__actions .is-danger:hover {
  border-color: var(--critical);
  color: var(--critical);
}
</style>
