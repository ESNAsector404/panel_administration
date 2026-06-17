<script setup lang="ts">
import { computed } from 'vue'

import StatusBadge from '@/components/ui/StatusBadge.vue'
import { useAuthStore } from '@/stores/auth'
import { isCommunicating, useCityStore } from '@/stores/city'
import { PERMISSION } from '@/types/auth'
import type { ComponentAction } from '@/types/city'

const store = useCityStore()
const auth = useAuthStore()

// Le pilotage est filtré selon les permissions (RF-3D-06) ; le serveur reste
// l'autorité finale, le front ne fait que masquer.
const canPilot = computed(() => auth.can(PERMISSION.CITY_PILOT))

const component = computed(() => store.selected)
const status = computed(() => (component.value ? store.statusOf(component.value.id) : 'ok'))

/** Composant connecté à la maquette (sinon : décor, non pilotable). */
const connected = computed(() => (component.value ? isCommunicating(component.value) : false))

/** Lumières du composant + leur état runtime. */
const lights = computed(() => {
  if (!component.value) return []
  const state = store.states[component.value.id] ?? {}
  return (component.value.lights ?? []).map((l) => ({
    ...l,
    on: state[`light:${l.id}`] === true,
  }))
})

function setLight(lightId: string, on: boolean) {
  if (component.value) store.toggleLight(component.value.id, lightId, on)
}

/** Métriques statiques + état interne dynamique (barrière, feu, lampe). */
const liveState = computed<Record<string, string>>(() => {
  if (!component.value) return {}
  const state = store.states[component.value.id] ?? {}
  const rows: Record<string, string> = {}
  if ('open' in state) rows['Position'] = state.open ? 'Ouverte' : 'Fermée'
  if ('mode' in state) rows['Mode actuel'] = String(state.mode)
  if ('on' in state) rows['Alimentation'] = state.on ? 'Allumé' : 'Éteint'
  return rows
})

function run(action: ComponentAction) {
  if (!component.value) return
  if (action.critical && !window.confirm(`Action critique : « ${action.label} ». Confirmer ?`)) {
    return
  }
  store.runAction(component.value, action)
}
</script>

<template>
  <section class="card detail">
    <template v-if="component">
      <header class="detail__header">
        <div>
          <h2 class="detail__name title-ticking">{{ component.name }}</h2>
          <div class="detail__chips">
            <span class="chip">{{ component.category }}</span>
            <span v-if="component.si" class="chip chip--si">SI hébergé</span>
          </div>
        </div>
        <button class="detail__close" title="Fermer" @click="store.select(null)">✕</button>
      </header>

      <div class="detail__body">
        <StatusBadge v-if="connected" :status="status" />
        <p v-else class="detail__locked">
          Composant non connecté — aucun équipement (lumière, SI…) déclaré.
        </p>

        <p v-if="component.description" class="detail__desc">{{ component.description }}</p>

        <dl class="detail__metrics">
          <template v-for="(value, key) in { ...component.metrics, ...liveState }" :key="key">
            <div class="metric">
              <dt>{{ key }}</dt>
              <dd class="title-ticking">{{ value }}</dd>
            </div>
          </template>
        </dl>

        <div v-if="lights.length && canPilot" class="detail__actions">
          <h3 class="card-title">Lumières</h3>
          <button
            v-for="light in lights"
            :key="light.id"
            class="action"
            @click="setLight(light.id, !light.on)"
          >
            {{ light.name }}
            <span class="light-state" :class="{ 'is-on': light.on }">
              {{ light.on ? 'ALLUMÉE' : 'ÉTEINTE' }}
            </span>
          </button>
        </div>

        <div v-if="connected && component.actions.length && canPilot" class="detail__actions">
          <h3 class="card-title">Actions disponibles</h3>
          <button
            v-for="action in component.actions"
            :key="action.id"
            class="action"
            :class="{ 'action--critical': action.critical }"
            @click="run(action)"
          >
            {{ action.label }}
            <span v-if="action.critical" class="action__warn">!</span>
          </button>
          <p class="detail__note">Commandes relayées vers la maquette par le back-end.</p>
        </div>
        <p v-else-if="connected && component.actions.length" class="detail__locked">
          🔒 Pilotage non autorisé pour votre rôle (lecture seule).
        </p>
      </div>
    </template>

    <div v-else class="detail__empty">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4">
        <path d="M24 6 42 15v18L24 42 6 33V15L24 6Z" />
        <path d="M6 15l18 9 18-9M24 24v18" />
      </svg>
      <p>Sélectionnez un élément sur le plan<br />pour afficher son état et ses actions.</p>
    </div>
  </section>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  min-height: 220px;
}

.detail__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-4) var(--sp-3);
  border-bottom: 1px solid var(--border);
}

.detail__name {
  font-size: 15px;
  color: var(--text);
  margin-bottom: 6px;
}

.detail__chips {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

.chip--si {
  border-color: rgba(94, 43, 255, 0.55);
  color: var(--primary-300);
  background: var(--primary-soft);
}

.detail__close {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-faint);
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  flex: none;
  transition: all 0.15s;
}

.detail__close:hover {
  color: var(--text);
  border-color: var(--border-strong);
}

.detail__body {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}

.detail__desc {
  font-size: 12px;
  color: var(--text-dim);
}

.detail__metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-2);
}

.metric {
  background: var(--bg-card-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 10px;
}

.metric dt {
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.metric dd {
  font-size: 13px;
  color: var(--text);
  margin-top: 2px;
}

.detail__actions {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--bg-card-2);
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-body);
  transition: all 0.15s;
  text-align: left;
}

.action:hover {
  border-color: var(--primary-500);
  background: var(--primary-soft);
  box-shadow: 0 0 12px rgba(94, 43, 255, 0.25);
}

.action--critical {
  border-color: rgba(255, 77, 109, 0.4);
}

.action--critical:hover {
  border-color: var(--critical);
  background: var(--critical-soft);
  box-shadow: 0 0 12px rgba(255, 77, 109, 0.25);
}

.action__warn {
  font-family: var(--font-title);
  color: var(--critical);
}

.detail__note {
  font-size: 10px;
  color: var(--text-faint);
  font-style: italic;
}

.light-state {
  font-family: var(--font-title);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: var(--text-faint);
}

.light-state.is-on {
  color: var(--ok);
}

.detail__locked {
  font-size: 11px;
  color: var(--text-dim);
  background: var(--bg-card-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 9px 11px;
}

.detail__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  padding: var(--sp-5);
  color: var(--text-faint);
  text-align: center;
  font-size: 12px;
}

.detail__empty svg {
  width: 42px;
  height: 42px;
  color: var(--primary-600);
}
</style>
