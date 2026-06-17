<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { User, Lock } from 'lucide-vue-next'

import CityScene from '@/components/city/CityScene.vue'
import logoUrl from '@/assets/img/visual_identity/logo-dark-bg@4x.png'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const identifier = ref('')
const password = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

async function onSubmit() {
  error.value = null
  submitting.value = true
  try {
    await auth.login(identifier.value.trim(), password.value)
    const redirect = (route.query.redirect as string) || '/'
    await router.replace(redirect)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Connexion impossible'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login">
    <!-- ============ Visuel ISO (gauche ~65 %) ============ -->
    <aside class="login__stage" aria-hidden="true">
      <!-- Grille de fond (derrière le plan de la ville) -->
      <div class="login__grid" />

      <CityScene class="login__scene" />

      <!-- Fade violet qui remonte depuis le bas -->
      <div class="login__fade" />

      <div class="login__tagline">
        <span class="login__framework title-ticking">the city attack framework</span>
        <span class="login__sub">hack’n visualize your actions</span>
      </div>
    </aside>

    <!-- ============ Formulaire (droite ~35 %) ============ -->
    <section class="login__panel">
      <div class="login__panel-inner">
        <header class="login__head">
          <img :src="logoUrl" alt="Sector 404" class="login__logo" />
        </header>

        <form class="login__form" @submit.prevent="onSubmit">
          <label class="field">
            <span class="field__label">Identifiant ou email</span>
            <div class="field__control">
              <User class="field__icon" :size="16" :stroke-width="2" />
              <input
                v-model="identifier"
                type="text"
                autocomplete="username"
                required
                autofocus
                placeholder="admin"
              />
            </div>
          </label>

          <label class="field">
            <span class="field__label">Mot de passe</span>
            <div class="field__control">
              <Lock class="field__icon" :size="16" :stroke-width="2" />
              <input
                v-model="password"
                type="password"
                autocomplete="current-password"
                required
                placeholder="••••••••"
              />
            </div>
          </label>

          <p v-if="error" class="login__error">{{ error }}</p>

          <button class="login__submit" type="submit" :disabled="submitting">
            {{ submitting ? 'Connexion…' : 'Se connecter' }}
          </button>
        </form>

        <footer class="login__footer">
          <!-- <span>MVP 0.1 — ESNA Bretagne</span> -->
        </footer>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 65fr 35fr;
  background: var(--bg);
}

/* ---------- Scène ISO (gauche) ---------- */
.login__stage {
  position: relative;
  overflow: hidden;
  background: var(--bg);
  border-right: 1px solid var(--border);
}

/* Grille de fond — derrière le plan de la ville. */
.login__grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(94, 43, 255, 0.08) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(94, 43, 255, 0.08) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(120% 100% at 50% 30%, #000 35%, transparent 80%);
}

.login__scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* Maquette zoomée et légèrement remontée pour laisser place au fade. */
  transform: translateY(-2%) scale(1.45);
}

/* Fade violet : remonte du bas vers le haut (cf. page5). */
.login__fade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    to top,
    rgba(94, 43, 255, 0.55) 0%,
    rgba(94, 43, 255, 0.28) 22%,
    rgba(94, 43, 255, 0.08) 42%,
    transparent 65%
  );
}

.login__tagline {
  position: absolute;
  left: var(--sp-6);
  bottom: var(--sp-6);
  display: flex;
  flex-direction: column;
  gap: 4px;
  pointer-events: none;
}

.login__framework {
  font-size: 18px;
  letter-spacing: 0.04em;
  color: var(--text);
}

.login__sub {
  font-family: var(--font-body);
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--text-dim);
}

/* ---------- Panneau formulaire (droite) ---------- */
.login__panel {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  padding: var(--sp-6) var(--sp-5);
  /* Fond sobre, opaque : masque le quadrillage global (body::before). */
  background: var(--bg-raise);
}

.login__panel-inner {
  width: 100%;
  max-width: 340px;
}

.login__head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: var(--sp-6);
}

.login__logo {
  height: 132px;
  width: auto;
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.field__label {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.field__control {
  position: relative;
  display: flex;
  align-items: center;
}

.field__icon {
  position: absolute;
  left: 12px;
  color: var(--text-faint);
  pointer-events: none;
  transition: color 0.15s;
}

.field input {
  width: 100%;
  padding: 11px 13px 11px 38px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--bg-inset);
  color: var(--text);
  font-size: 13px;
  font-family: var(--font-body);
  transition: all 0.15s;
}

.field input:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 3px var(--primary-soft);
}

.field__control:focus-within .field__icon {
  color: var(--primary-300);
}

.login__error {
  font-size: 12px;
  color: var(--critical);
  background: var(--critical-soft);
  border: 1px solid rgba(255, 77, 109, 0.4);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
}

.login__submit {
  margin-top: var(--sp-1);
  padding: 12px;
  border: 1px solid var(--primary-500);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--primary-500), var(--primary-700));
  color: var(--s404-light);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-body);
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all 0.15s;
}

.login__submit:hover:not(:disabled) {
  box-shadow: 0 0 16px var(--primary-glow);
}

.login__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login__footer {
  margin-top: var(--sp-6);
}

.login__footer span {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-faint);
}

/* ---------- Responsive : la scène passe en fond ---------- */
@media (max-width: 860px) {
  .login {
    grid-template-columns: 1fr;
  }
  .login__stage {
    position: fixed;
    inset: 0;
    border-right: none;
    opacity: 0.35;
  }
  .login__tagline {
    display: none;
  }
  .login__panel {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    background: transparent;
  }
}
</style>
