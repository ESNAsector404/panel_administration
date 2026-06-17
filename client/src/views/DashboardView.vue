<script setup lang="ts">
import { computed, onMounted } from 'vue'

import CityMap from '@/components/city/CityMap.vue'
import DetailPanel from '@/components/dashboard/DetailPanel.vue'
import EventsFeed from '@/components/dashboard/EventsFeed.vue'
import FranceLocator from '@/components/dashboard/FranceLocator.vue'
import KpiCard from '@/components/dashboard/KpiCard.vue'
import { useCityStore } from '@/stores/city'

const store = useCityStore()

onMounted(() => store.init())

const alertTone = computed(() => {
  const hasCritical = Object.values(store.statuses).includes('critical')
  if (hasCritical) return 'critical' as const
  return store.kpis.alerts > 0 ? ('warning' as const) : ('ok' as const)
})
</script>

<template>
  <div class="dashboard">
    <section class="dashboard__kpis">
      <KpiCard
        label="Composants en ligne"
        :value="`${store.kpis.online} / ${store.kpis.total}`"
        hint="SI, barrières & feux communicants"
        tone="ok"
        :spark="[
          store.kpis.total,
          store.kpis.total,
          store.kpis.total - 1,
          store.kpis.total,
          store.kpis.online,
        ]"
      />
      <KpiCard
        label="Alertes actives"
        :value="String(store.kpis.alerts)"
        hint="composants supervisés en alerte"
        :tone="alertTone"
        :spark="[0, 1, 1, 2, 1, 2, 3, store.kpis.alerts]"
      />
<KpiCard
        label="Latence réseau SI"
        value="23 ms"
        hint="passerelle API ↔ microservices"
        :spark="[18, 21, 19, 24, 31, 26, 22, 23]"
      />
    </section>

    <div class="dashboard__main">
      <CityMap class="dashboard__map" />

      <aside class="dashboard__side">
        <DetailPanel />
        <FranceLocator />
        <EventsFeed />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  position: relative;
  z-index: 1;
}

.dashboard__kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-4);
}

.dashboard__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--sp-4);
  align-items: start;
}

.dashboard__map {
  min-height: 620px;
}

.dashboard__side {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
}

@media (max-width: 1280px) {
  .dashboard__kpis {
    grid-template-columns: repeat(2, 1fr);
  }
  .dashboard__main {
    grid-template-columns: 1fr;
  }
  .dashboard__map {
    min-height: 520px;
  }
}
</style>
