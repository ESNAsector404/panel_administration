<script setup lang="ts">
import { computed, onMounted } from 'vue'

import StatusBadge from '@/components/ui/StatusBadge.vue'
import { isCommunicating, useCityStore } from '@/stores/city'

/**
 * Entrées / sorties : vue technique des composants connectés à la maquette,
 * avec leur état runtime (sorties pilotées) tel que vu par le back-end.
 */
const store = useCityStore()

onMounted(() => store.init())

const KIND_LABEL: Record<string, string> = {
  building: 'Bâtiment',
  parking: 'Parking',
  'traffic-light': 'Feu tricolore',
  barrier: 'Barrière',
  lamp: 'Lampadaire',
}

const rows = computed(() =>
  [...store.components.filter(isCommunicating), ...store.feuComponents].map((c) => {
    const state = store.states[c.id] ?? {}
    const outputs: string[] = []
    for (const [k, v] of Object.entries(state)) {
      if (k.startsWith('light:')) {
        const light = c.lights?.find((l) => `light:${l.id}` === k)
        outputs.push(`${light?.name ?? k} = ${v === true ? 'ON' : 'OFF'}`)
      } else {
        outputs.push(`${k} = ${String(v)}`)
      }
    }
    // lumières déclarées mais jamais pilotées : sortie OFF par défaut
    for (const l of c.lights ?? []) {
      if (!(`light:${l.id}` in state)) outputs.push(`${l.name} = OFF`)
    }
    return {
      id: c.id,
      name: c.name || c.id,
      kind: KIND_LABEL[c.kind] ?? c.kind,
      status: store.statusOf(c.id),
      outputs,
    }
  }),
)
</script>

<template>
  <section class="card panel">
    <header class="panel__head">
      <h2 class="card-title">Entrées / Sorties</h2>
      <span class="chip">{{ rows.length }} connectés</span>
    </header>

    <table class="panel__table">
      <thead>
        <tr>
          <th>Composant</th>
          <th>Type</th>
          <th>État</th>
          <th>Sorties pilotées</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td class="is-strong">{{ row.name }}</td>
          <td>{{ row.kind }}</td>
          <td><StatusBadge :status="row.status" /></td>
          <td>
            <span v-if="!row.outputs.length" class="is-faint">—</span>
            <code v-for="o in row.outputs" :key="o" class="io">{{ o }}</code>
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
  vertical-align: top;
}

.is-strong {
  color: var(--text);
}

.is-faint {
  color: var(--text-faint);
}

.io {
  display: inline-block;
  background: var(--bg-card-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 10px;
  padding: 2px 7px;
  margin: 0 4px 4px 0;
  color: var(--text-dim);
}
</style>
