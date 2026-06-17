<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

import logoUrl from '@/assets/img/visual_identity/logo-dark-bg@4x.png'
import { CITY_INFO } from '@/data/city'

const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => (now.value = new Date()), 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function fmt(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour12: false })
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__brand">
      <img :src="logoUrl" alt="Sector 404" class="app-header__logo" />
      <div class="app-header__title">
        <h1 class="title-ticking">Sector 404</h1>
        <span>The city attack framework</span>
      </div>
    </div>

    <div class="app-header__meta">
      <span class="chip">
        <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
          <path
            d="M5 1a3 3 0 0 1 3 3c0 2-3 5-3 5S2 6 2 4a3 3 0 0 1 3-3Z"
            stroke="#8b66ff"
            stroke-width="1.2"
          />
        </svg>
        {{ CITY_INFO.name }} · {{ CITY_INFO.region }} · {{ CITY_INFO.coords }}
      </span>

      <span class="chip chip--live">
        <i class="dot dot--ok pulse" />
        LIVE
      </span>

      <span class="chip app-header__clock title-ticking">{{ fmt(now) }}</span>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: var(--header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-4);
  padding: 0 var(--sp-5);
  border-bottom: 1px solid var(--border);
  background: var(--bg-raise);
  position: sticky;
  top: 0;
  z-index: 20;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
}

.app-header__logo {
  height: 38px;
  width: auto;
}

.app-header__title h1 {
  font-size: 17px;
  line-height: 1.1;
  color: var(--text);
}

.app-header__title span {
  font-size: 11px;
  color: var(--text-faint);
  letter-spacing: 0.06em;
}

.app-header__meta {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.chip--live {
  border-color: rgba(57, 217, 138, 0.4);
  color: var(--ok);
  font-family: var(--font-title);
  letter-spacing: 0.18em;
  font-size: 10px;
}

.app-header__clock {
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--text);
  min-width: 92px;
  justify-content: center;
}

@media (max-width: 1100px) {
  .app-header__meta .chip:first-child {
    display: none;
  }
}
</style>
