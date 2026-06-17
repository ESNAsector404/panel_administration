<script setup lang="ts">
import { ref } from 'vue'

import { api, ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { AuthUser } from '@/types/auth'

/** Espace utilisateur : modification de ses propres informations. */
const auth = useAuthStore()

const displayName = ref(auth.user?.displayName ?? '')
const email = ref(auth.user?.email ?? '')

const currentPassword = ref('')
const newPassword = ref('')
const newPassword2 = ref('')

const notice = ref<string | null>(null)
const error = ref<string | null>(null)

function flash(ok: string | null, err: string | null = null) {
  notice.value = ok
  error.value = err
  setTimeout(() => {
    notice.value = null
    error.value = null
  }, 4000)
}

async function saveProfile() {
  try {
    const { user } = await api.patch<{ user: AuthUser }>('/me', {
      displayName: displayName.value,
      email: email.value,
    })
    auth.user = user
    flash('Profil mis à jour.')
  } catch (err) {
    flash(null, err instanceof ApiError ? err.message : 'Erreur inconnue')
  }
}

async function changePassword() {
  if (newPassword.value !== newPassword2.value) {
    flash(null, 'Les deux mots de passe ne correspondent pas.')
    return
  }
  try {
    await api.post('/me/password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    })
    currentPassword.value = ''
    newPassword.value = ''
    newPassword2.value = ''
    flash('Mot de passe modifié.')
  } catch (err) {
    flash(null, err instanceof ApiError ? err.message : 'Erreur inconnue')
  }
}
</script>

<template>
  <div class="profile">
    <header>
      <h1 class="title-ticking">Mon compte</h1>
      <p>
        Connecté en tant que <strong>{{ auth.user?.username }}</strong>
        <span v-if="auth.user?.role"> — rôle {{ auth.user.role.name }}</span>
      </p>
    </header>

    <p v-if="notice" class="profile__flash is-ok">{{ notice }}</p>
    <p v-if="error" class="profile__flash is-err">{{ error }}</p>

    <section class="card">
      <h2 class="card-title">Informations</h2>
      <form @submit.prevent="saveProfile">
        <label>
          Nom affiché
          <input v-model="displayName" type="text" maxlength="60" />
        </label>
        <label>
          Email
          <input v-model="email" type="email" required />
        </label>
        <button type="submit" class="btn-primary">Enregistrer</button>
      </form>
    </section>

    <section class="card">
      <h2 class="card-title">Mot de passe</h2>
      <form @submit.prevent="changePassword">
        <label>
          Mot de passe actuel
          <input v-model="currentPassword" type="password" required autocomplete="current-password" />
        </label>
        <label>
          Nouveau mot de passe (≥ 8 caractères)
          <input v-model="newPassword" type="password" minlength="8" required autocomplete="new-password" />
        </label>
        <label>
          Confirmer le nouveau mot de passe
          <input v-model="newPassword2" type="password" minlength="8" required autocomplete="new-password" />
        </label>
        <button type="submit" class="btn-primary">Changer le mot de passe</button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.profile {
  max-width: 560px;
  margin: 0 auto;
  padding: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.profile header h1 {
  font-size: 22px;
  color: var(--text);
}

.profile header p {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}

.card {
  padding: var(--sp-4);
}

.card-title {
  margin-bottom: var(--sp-3);
}

form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-faint);
}

input {
  background: var(--bg-card-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 13px;
  padding: 9px 11px;
  font-family: var(--font-body);
}

input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 2px var(--primary-soft);
}

.btn-primary {
  align-self: flex-start;
  background: var(--primary-500);
  border: none;
  color: var(--s404-light);
  border-radius: var(--radius-sm);
  font-size: 12px;
  padding: 9px 18px;
  cursor: pointer;
}

.btn-primary:hover {
  box-shadow: 0 0 12px var(--primary-glow);
}

.profile__flash {
  font-size: 12px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
}

.profile__flash.is-ok {
  color: var(--ok);
  background: var(--ok-soft);
  border: 1px solid rgba(57, 217, 138, 0.4);
}

.profile__flash.is-err {
  color: var(--critical);
  background: var(--critical-soft);
  border: 1px solid rgba(255, 77, 109, 0.4);
}
</style>
