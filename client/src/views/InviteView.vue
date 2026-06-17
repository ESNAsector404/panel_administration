<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { api, ApiError } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import type { AuthUser } from '@/types/auth'

/**
 * Création de compte via un lien d'invitation (token à usage unique généré
 * par un administrateur et transmis manuellement).
 */
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = String(route.params.token ?? '')

const checking = ref(true)
const invalid = ref(false)
const roleName = ref('')

const username = ref('')
const email = ref('')
const displayName = ref('')
const password = ref('')
const password2 = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

onMounted(async () => {
  try {
    const res = await api.get<{ valid: boolean; email: string; roleName: string }>(
      `/invitations/check/${token}`,
    )
    email.value = res.email
    roleName.value = res.roleName
  } catch {
    invalid.value = true
  } finally {
    checking.value = false
  }
})

async function submit() {
  error.value = null
  if (password.value !== password2.value) {
    error.value = 'Les deux mots de passe ne correspondent pas.'
    return
  }
  submitting.value = true
  try {
    const { user } = await api.post<{ user: AuthUser }>('/invitations/register', {
      token,
      username: username.value,
      email: email.value,
      displayName: displayName.value || undefined,
      password: password.value,
    })
    auth.user = user
    router.replace('/')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Erreur inconnue'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="invite">
    <section class="card invite__card">
      <h1 class="title-ticking">Créer votre compte</h1>

      <p v-if="checking" class="invite__hint">Vérification de l'invitation…</p>

      <template v-else-if="invalid">
        <p class="invite__error">Ce lien d'invitation est invalide, déjà utilisé ou expiré.</p>
        <RouterLink to="/login" class="invite__link">← Retour à la connexion</RouterLink>
      </template>

      <form v-else @submit.prevent="submit">
        <p class="invite__hint">
          Vous avez été invité·e à rejoindre la supervision Sector 404
          <template v-if="roleName"> avec le rôle <strong>{{ roleName }}</strong></template>.
        </p>

        <label>
          Nom d'utilisateur
          <input v-model="username" type="text" minlength="3" maxlength="32" required autocomplete="username" />
        </label>
        <label>
          Email
          <input v-model="email" type="email" required autocomplete="email" />
        </label>
        <label>
          Nom affiché (optionnel)
          <input v-model="displayName" type="text" maxlength="60" />
        </label>
        <label>
          Mot de passe (≥ 8 caractères)
          <input v-model="password" type="password" minlength="8" required autocomplete="new-password" />
        </label>
        <label>
          Confirmer le mot de passe
          <input v-model="password2" type="password" minlength="8" required autocomplete="new-password" />
        </label>

        <p v-if="error" class="invite__error">{{ error }}</p>

        <button type="submit" class="btn-primary" :disabled="submitting">
          {{ submitting ? 'Création…' : 'Créer le compte' }}
        </button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.invite {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-5);
}

.invite__card {
  width: 100%;
  max-width: 420px;
  padding: var(--sp-5);
}

.invite__card h1 {
  font-size: 18px;
  color: var(--text);
  margin-bottom: var(--sp-4);
}

form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.invite__hint {
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: var(--sp-2);
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
  background: var(--primary-500);
  border: none;
  color: var(--s404-light);
  border-radius: var(--radius-sm);
  font-size: 13px;
  padding: 10px 18px;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
}

.btn-primary:hover:not(:disabled) {
  box-shadow: 0 0 12px var(--primary-glow);
}

.invite__error {
  font-size: 12px;
  color: var(--critical);
}

.invite__link {
  font-size: 12px;
  color: var(--primary-300);
}
</style>
