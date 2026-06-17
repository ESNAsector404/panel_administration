<script setup lang="ts">
import type { Status } from '@/types/city'

defineProps<{ status: Status }>()

const LABELS: Record<Status, string> = {
  ok: 'Opérationnel',
  warning: 'Alerte',
  critical: 'Compromis',
  offline: 'Hors ligne',
}
</script>

<template>
  <span class="badge" :class="`badge--${status}`">
    <i class="dot" :class="`dot--${status}`" />
    {{ LABELS[status] }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border: 1px solid;
}

.badge--ok {
  color: var(--ok);
  border-color: rgba(57, 217, 138, 0.4);
  background: var(--ok-soft);
}

.badge--warning {
  color: var(--warn);
  border-color: rgba(255, 176, 32, 0.4);
  background: var(--warn-soft);
}

.badge--critical {
  color: var(--critical);
  border-color: rgba(255, 77, 109, 0.45);
  background: var(--critical-soft);
}

.badge--offline {
  color: var(--offline);
  border-color: rgba(107, 104, 119, 0.5);
  background: var(--offline-soft);
}
</style>
