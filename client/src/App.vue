<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute } from 'vue-router'

import AppHeader from '@/components/layout/AppHeader.vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'

const route = useRoute()
// La page de login s'affiche en plein écran, sans header ni sidebar.
const blank = computed(() => route.meta.layout === 'blank')

// Quadrillage de fond masqué sur les routes `noGrid` (administration).
watchEffect(() => {
  document.body.classList.toggle('no-grid', route.meta.noGrid === true)
})
</script>

<template>
  <RouterView v-if="blank" />

  <div v-else class="app-shell">
    <AppHeader />
    <div class="app-shell__body">
      <AppSidebar />
      <main class="app-shell__main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-shell__body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.app-shell__main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}
</style>
