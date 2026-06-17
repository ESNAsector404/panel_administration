<script setup lang="ts">
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import type { PermissionGroup } from '@/types/auth'

defineProps<{
  permGroups: PermissionGroup[]
}>()

const emit = defineEmits<{
  submit: [data: { slug: string; name: string; description: string; permissions: string[] }]
  cancel: []
}>()

import { reactive } from 'vue'

const form = reactive({
  slug: '',
  name: '',
  description: '',
  permissions: [] as string[],
})

function reset() {
  Object.assign(form, { slug: '', name: '', description: '', permissions: [] })
}

function setPerm(key: string, on: boolean) {
  if (on && !form.permissions.includes(key)) form.permissions.push(key)
  if (!on) form.permissions = form.permissions.filter((p) => p !== key)
}

defineExpose({ reset })
</script>

<template>
  <div class="modal" @click.self="emit('cancel')">
    <form class="card modal__card" @submit.prevent="emit('submit', { ...form, permissions: [...form.permissions] })">
      <h2 class="card-title">Nouveau rôle</h2>
      <label class="field">
        <span>Slug (a-z, tirets)</span>
        <input v-model="form.slug" required pattern="[a-z0-9-]+" placeholder="equipe-bleue" />
      </label>
      <label class="field">
        <span>Nom</span>
        <input v-model="form.name" required />
      </label>
      <label class="field">
        <span>Description</span>
        <input v-model="form.description" />
      </label>
      <div class="field">
        <span>Permissions</span>
        <div class="modal__perms">
          <template v-for="group in permGroups" :key="group.domain">
            <div class="role__group-label">{{ group.domain }}</div>
            <ToggleSwitch
              v-for="p in group.permissions"
              :key="p.key"
              class="perm"
              :model-value="form.permissions.includes(p.key)"
              :label="p.label"
              @update:model-value="setPerm(p.key, $event)"
            />
          </template>
        </div>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn-ghost" @click="emit('cancel')">Annuler</button>
        <button type="submit" class="btn-primary">Créer</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  background: rgba(10, 9, 8, 0.7);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: var(--sp-4);
}

.modal__card {
  width: 100%;
  max-width: 440px;
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  max-height: 90vh;
  overflow-y: auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field > span {
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-faint);
}

select,
.field input {
  background: var(--bg-inset);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 12px;
  padding: 7px 10px;
}

select:focus,
.field input:focus {
  outline: none;
  border-color: var(--primary-500);
}

.modal__perms {
  display: grid;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp-2);
}

.role__group-label {
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

.modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--sp-2);
  margin-top: var(--sp-2);
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
