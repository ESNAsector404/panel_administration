<script setup lang="ts">
import type { Role } from '@/types/auth'

const props = defineProps<{
  roles: Role[]
}>()

const emit = defineEmits<{
  submit: [data: { username: string; email: string; displayName: string; password: string; roleId: string }]
  cancel: []
}>()

import { reactive } from 'vue'

const form = reactive({
  username: '',
  email: '',
  displayName: '',
  password: '',
  roleId: props.roles[0]?.id ?? '',
})

function reset() {
  Object.assign(form, {
    username: '',
    email: '',
    displayName: '',
    password: '',
    roleId: props.roles[0]?.id ?? '',
  })
}

defineExpose({ reset })
</script>

<template>
  <div class="modal" @click.self="emit('cancel')">
    <form class="card modal__card" @submit.prevent="emit('submit', { ...form })">
      <h2 class="card-title">Nouveau compte</h2>
      <label class="field">
        <span>Nom d'utilisateur</span>
        <input v-model="form.username" required minlength="3" />
      </label>
      <label class="field">
        <span>Email</span>
        <input v-model="form.email" type="email" required />
      </label>
      <label class="field">
        <span>Nom affiché (optionnel)</span>
        <input v-model="form.displayName" />
      </label>
      <label class="field">
        <span>Mot de passe (≥ 8 caractères)</span>
        <input v-model="form.password" type="password" required minlength="8" />
      </label>
      <label class="field">
        <span>Rôle</span>
        <select v-model="form.roleId" required>
          <option v-for="r in roles" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>
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
