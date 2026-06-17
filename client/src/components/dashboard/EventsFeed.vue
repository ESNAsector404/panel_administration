<script setup lang="ts">
import { useCityStore } from '@/stores/city'
import type { EventSeverity } from '@/types/city'

const store = useCityStore()

const SEVERITY_DOT: Record<EventSeverity, string> = {
  info: 'dot--info',
  success: 'dot--ok',
  warning: 'dot--warning',
  critical: 'dot--critical',
}

function fmt(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour12: false })
}

function focus(componentId?: string) {
  if (componentId) store.select(componentId)
}
</script>

<template>
  <section class="card feed">
    <header class="feed__header">
      <h2 class="card-title">Flux d'événements</h2>
      <span class="chip"><i class="dot dot--ok pulse" /> temps réel</span>
    </header>

    <TransitionGroup name="feed" tag="ul" class="feed__list">
      <li
        v-for="event in store.events"
        :key="event.id"
        :class="{ 'is-linked': event.componentId }"
        @click="focus(event.componentId)"
      >
        <i class="dot" :class="SEVERITY_DOT[event.severity]" />
        <time class="title-ticking">{{ fmt(event.time) }}</time>
        <p>{{ event.message }}</p>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.feed {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.feed__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: var(--sp-4) var(--sp-4) var(--sp-3);
  border-bottom: 1px solid var(--border);
}

.feed__list {
  list-style: none;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  max-height: 320px;
  padding: var(--sp-2) 0;
}

.feed__list li {
  display: grid;
  grid-template-columns: 8px 62px 1fr;
  gap: var(--sp-2);
  align-items: baseline;
  padding: 8px var(--sp-4);
  border-bottom: 1px dashed rgba(36, 32, 49, 0.7);
}

.feed__list li.is-linked {
  cursor: pointer;
}

.feed__list li.is-linked:hover {
  background: var(--primary-soft);
}

.feed__list .dot {
  position: relative;
  top: -1px;
}

.feed__list time {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  white-space: nowrap;
}

.feed__list p {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.45;
}

.feed-enter-active {
  transition: all 0.4s ease;
}

.feed-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
