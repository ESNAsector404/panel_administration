import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 's404.sidebar.collapsed'

/**
 * État d'interface transverse (préférences de layout).
 * La sidebar est collapsible ; l'état est persisté en localStorage.
 */
export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(localStorage.getItem(STORAGE_KEY) === '1')

  watch(sidebarCollapsed, (v) => {
    localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
  })

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return { sidebarCollapsed, toggleSidebar }
})
