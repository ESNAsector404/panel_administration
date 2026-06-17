<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Lightbulb, Plus, Trash2 } from 'lucide-vue-next'

import { isCommunicating, useCityStore } from '@/stores/city'
import type { CityComponent } from '@/types/city'

/**
 * Configuration des équipements de la maquette : choix des lumières par
 * bâtiment (0..n). Un bâtiment sans lumière ni SI n'est pas connecté.
 */
const store = useCityStore()
const emit = defineEmits<{ flash: [string] }>()

onMounted(() => store.init())

const filter = ref('')

const buildings = computed(() =>
  store.components
    .filter((c) => c.kind === 'building')
    .filter(
      (c) =>
        !filter.value ||
        (c.name || c.id).toLowerCase().includes(filter.value.toLowerCase()),
    ),
)

function label(c: CityComponent): string {
  return c.name || c.id
}

async function addLight(c: CityComponent) {
  const name = window.prompt(`Nom de la nouvelle lumière pour « ${label(c)} » :`, 'Éclairage')
  if (!name) return
  const lights = [...(c.lights ?? []), { id: `l${Date.now().toString(36)}`, name }]
  await store.configureLights(c.id, lights)
  emit('flash', `Lumière ajoutée à « ${label(c)} ».`)
}

async function removeLight(c: CityComponent, lightId: string) {
  const lights = (c.lights ?? []).filter((l) => l.id !== lightId)
  await store.configureLights(c.id, lights)
  emit('flash', `Lumière retirée de « ${label(c)} ».`)
}
</script>

<template>
  <section class="card panel">
    <header class="panel__head">
      <h2 class="card-title">Équipements — lumières par bâtiment</h2>
      <input v-model="filter" type="search" placeholder="Filtrer…" />
    </header>

    <p class="panel__hint">
      Un bâtiment sans lumière ni SI n'est pas connecté : il n'apparaît dans aucun
      widget de supervision.
    </p>

    <ul class="panel__list">
      <li v-for="c in buildings" :key="c.id">
        <div class="panel__row">
          <div class="panel__id">
            <strong>{{ label(c) }}</strong>
            <span>{{ c.category }}</span>
          </div>
          <div class="panel__badges">
            <span v-if="c.si" class="chip chip--si">SI</span>
            <span class="chip" :class="{ 'chip--ok': isCommunicating(c) }">
              {{ isCommunicating(c) ? 'connecté' : 'non connecté' }}
            </span>
            <button class="panel__add" title="Ajouter une lumière" @click="addLight(c)">
              <Plus :size="14" :stroke-width="2" /> lumière
            </button>
          </div>
        </div>
        <ul v-if="c.lights?.length" class="panel__lights">
          <li v-for="l in c.lights" :key="l.id">
            <Lightbulb :size="14" :stroke-width="2" />
            <span>{{ l.name }}</span>
            <em :class="{ 'is-on': store.states[c.id]?.[`light:${l.id}`] === true }">
              {{ store.states[c.id]?.[`light:${l.id}`] === true ? 'allumée' : 'éteinte' }}
            </em>
            <button title="Supprimer" @click="removeLight(c, l.id)">
              <Trash2 :size="13" :stroke-width="2" />
            </button>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-4) var(--sp-3);
  border-bottom: 1px solid var(--border);
}

.panel__head input {
  background: var(--bg-card-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 12px;
  padding: 7px 10px;
}

.panel__hint {
  padding: var(--sp-3) var(--sp-4);
  font-size: 11px;
  color: var(--text-faint);
  border-bottom: 1px dashed var(--border);
}

.panel__list {
  list-style: none;
  max-height: 60vh;
  overflow-y: auto;
}

.panel__list > li {
  padding: 10px var(--sp-4);
  border-bottom: 1px dashed rgba(36, 32, 49, 0.7);
}

.panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}

.panel__id {
  display: flex;
  flex-direction: column;
}

.panel__id strong {
  font-size: 13px;
  color: var(--text);
}

.panel__id span {
  font-size: 10px;
  color: var(--text-faint);
}

.panel__badges {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}

.chip--ok {
  color: var(--ok);
  border-color: rgba(57, 217, 138, 0.4);
}

.chip--si {
  border-color: rgba(94, 43, 255, 0.55);
  color: var(--primary-300);
  background: var(--primary-soft);
}

.panel__add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-card-2);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--text-dim);
  font-size: 11px;
  padding: 5px 9px;
  cursor: pointer;
}

.panel__add:hover {
  border-color: var(--primary-500);
  color: var(--text);
}

.panel__lights {
  list-style: none;
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.panel__lights li {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  font-size: 12px;
  color: var(--text-dim);
  background: var(--bg-card-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
}

.panel__lights em {
  margin-left: auto;
  font-style: normal;
  font-size: 10px;
  color: var(--text-faint);
}

.panel__lights em.is-on {
  color: var(--ok);
}

.panel__lights button {
  background: transparent;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
}

.panel__lights button:hover {
  color: var(--critical);
}
</style>
