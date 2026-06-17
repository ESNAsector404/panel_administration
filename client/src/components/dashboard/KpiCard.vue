<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'ok' | 'warning' | 'critical'
  /** Mini-historique pour la sparkline (valeurs arbitraires). */
  spark?: number[]
}>()

const sparkPoints = computed(() => {
  const data = props.spark ?? []
  if (data.length < 2) return ''
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  return data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / range) * 24}`)
    .join(' ')
})
</script>

<template>
  <article class="card kpi" :class="`kpi--${tone ?? 'default'}`">
    <header>
      <span class="card-title">{{ label }}</span>
    </header>
    <div class="kpi__row">
      <strong class="kpi__value title-ticking">{{ value }}</strong>
      <svg v-if="sparkPoints" class="kpi__spark" viewBox="0 0 100 30" preserveAspectRatio="none">
        <polyline :points="sparkPoints" fill="none" stroke-width="2" />
      </svg>
    </div>
    <span v-if="hint" class="kpi__hint">{{ hint }}</span>
  </article>
</template>

<style scoped>
.kpi {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  position: relative;
  overflow: hidden;
}

/* Liseré d'accent en haut de carte */
.kpi::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--primary-500), transparent 70%);
}

.kpi--ok::before {
  background: linear-gradient(90deg, var(--ok), transparent 70%);
}
.kpi--warning::before {
  background: linear-gradient(90deg, var(--warn), transparent 70%);
}
.kpi--critical::before {
  background: linear-gradient(90deg, var(--critical), transparent 70%);
}

.kpi__row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--sp-3);
}

.kpi__value {
  font-size: 30px;
  line-height: 1;
  color: var(--text);
}

.kpi--warning .kpi__value {
  color: var(--warn);
}

.kpi--critical .kpi__value {
  color: var(--critical);
}

.kpi__spark {
  width: 92px;
  height: 30px;
  flex: none;
}

.kpi__spark polyline {
  stroke: var(--primary-300);
}

.kpi--ok .kpi__spark polyline {
  stroke: var(--ok);
}
.kpi--warning .kpi__spark polyline {
  stroke: var(--warn);
}
.kpi--critical .kpi__spark polyline {
  stroke: var(--critical);
}

.kpi__hint {
  font-size: 11px;
  color: var(--text-faint);
}
</style>
