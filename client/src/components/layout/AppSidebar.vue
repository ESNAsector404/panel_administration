<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Component } from 'vue'

import {
  LayoutDashboard,
  PencilRuler,
  Shield,
  Activity,
  SlidersHorizontal,
  ScrollText,
  HelpCircle,
  UserCog,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-vue-next'

import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { PERMISSION } from '@/types/auth'

interface NavItem {
  id: string
  label: string
  icon: Component
  to?: string
  soon?: boolean
  permission?: string
}

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const collapsed = computed(() => ui.sidebarCollapsed)

/** Section principale : accès réguliers. */
const NAV: NavItem[] = [
  {
    id: 'overview',
    label: "Vue d'ensemble",
    to: '/',
    permission: PERMISSION.PAGE_DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    id: 'editor',
    label: 'Éditeur de ville',
    to: '/editeur',
    permission: PERMISSION.PAGE_EDITOR,
    icon: PencilRuler,
  },
  {
    id: 'admin',
    label: 'Administration',
    to: '/administration',
    permission: PERMISSION.PAGE_ADMIN,
    icon: Shield,
  },
  // Modules à venir : déjà filtrés par les permissions fonctionnelles
  // correspondantes (contrôlables dans Rôles & permissions).
  { id: 'supervision', label: 'Supervision', soon: true, icon: Activity, permission: PERMISSION.CITY_READ },
  { id: 'pilotage', label: 'Pilotage', soon: true, icon: SlidersHorizontal, permission: PERMISSION.CITY_PILOT },
  { id: 'journal', label: 'Journal', soon: true, icon: ScrollText, permission: PERMISSION.AUDIT_READ },
]

const items = computed(() => NAV.filter((item) => !item.permission || auth.can(item.permission)))

const userMenuOpen = ref(false)

/** Initiales pour l'avatar (Ticking, 2 lettres). */
const initials = computed(() => {
  const name = (auth.user?.displayName || auth.user?.username || '??').trim()
  const parts = name.split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? (parts[0]![0] ?? '') + (parts[1]![0] ?? '') : name.slice(0, 2)
  return letters.toUpperCase() || '??'
})

async function onLogout() {
  userMenuOpen.value = false
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <nav class="sidebar" :class="{ 'is-collapsed': collapsed }">
    <!-- ============ Section 1 : navigation principale ============ -->
    <ul class="sidebar__nav">
      <li v-for="item in items" :key="item.id">
        <RouterLink
          v-if="item.to"
          :to="item.to"
          class="sidebar__link"
          active-class="is-active"
          :title="collapsed ? item.label : undefined"
        >
          <component :is="item.icon" class="sidebar__icon" :size="18" :stroke-width="2" />
          <span class="sidebar__label">{{ item.label }}</span>
        </RouterLink>
        <button
          v-else
          class="sidebar__link is-soon"
          type="button"
          :title="`${item.label} — à venir`"
        >
          <component :is="item.icon" class="sidebar__icon" :size="18" :stroke-width="2" />
          <span class="sidebar__label">{{ item.label }}</span>
          <span class="sidebar__soon">WIP</span>
        </button>
      </li>
    </ul>

    <!-- ============ Section 2 : compte, aide, profil ============ -->
    <div class="sidebar__bottom">
      <ul class="sidebar__nav">
        <li>
          <RouterLink to="/compte" class="sidebar__link" active-class="is-active" title="Mon compte">
            <UserCog class="sidebar__icon" :size="18" :stroke-width="2" />
            <span class="sidebar__label">Mon compte</span>
          </RouterLink>
        </li>
        <li>
          <button class="sidebar__link is-soon" type="button" title="Aide — à venir">
            <HelpCircle class="sidebar__icon" :size="18" :stroke-width="2" />
            <span class="sidebar__label">Aide</span>
          </button>
        </li>
      </ul>

      <!-- Badge profil + menu déconnexion -->
      <div v-if="auth.user" class="sidebar__user-wrap">
        <div v-if="userMenuOpen" class="sidebar__menu">
          <RouterLink
            v-if="auth.isAdmin"
            to="/administration"
            class="sidebar__menu-item"
            @click="userMenuOpen = false"
          >
            <Shield :size="15" :stroke-width="2" />
            Administration
          </RouterLink>
          <button class="sidebar__menu-item is-danger" type="button" @click="onLogout">
            <LogOut :size="15" :stroke-width="2" />
            Se déconnecter
          </button>
        </div>

        <button
          class="sidebar__user"
          type="button"
          :aria-expanded="userMenuOpen"
          :title="collapsed ? auth.user.username : undefined"
          @click="userMenuOpen = !userMenuOpen"
        >
          <div class="sidebar__avatar title-ticking">{{ initials }}</div>
          <div class="sidebar__user-info">
            <strong>{{ auth.user.username }}</strong>
            <span>{{ auth.user.role?.name ?? 'Utilisateur' }}</span>
          </div>
        </button>
      </div>

      <!-- Bouton de repli -->
      <button
        class="sidebar__collapse"
        type="button"
        :title="collapsed ? 'Déplier la barre' : 'Replier la barre'"
        @click="ui.toggleSidebar()"
      >
        <PanelLeftOpen v-if="collapsed" class="sidebar__icon" :size="18" :stroke-width="2" />
        <PanelLeftClose v-else class="sidebar__icon" :size="18" :stroke-width="2" />
        <span class="sidebar__label">Replier</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  flex: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-3);
  border-right: 1px solid var(--border);
  /* Fond opaque : ne laisse jamais transparaître le quadrillage global. */
  background: var(--bg-raise);
  transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  /* Collée sous le header et limitée à la hauteur du viewport : la section basse
     (compte/aide/profil) reste visible même quand le contenu de page déborde. */
  position: sticky;
  top: var(--header-h);
  align-self: flex-start;
  height: calc(100vh - var(--header-h));
  overflow-x: hidden;
  overflow-y: auto;
}

.sidebar.is-collapsed {
  width: var(--sidebar-w-slim);
}

.sidebar__nav {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.sidebar__link {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-dim);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-body);
  letter-spacing: 0.02em;
  transition:
    color 0.15s,
    background 0.15s;
  text-align: left;
}

.sidebar__icon {
  flex: none;
}

.sidebar__link:hover {
  color: var(--text);
  background: var(--bg-card-2);
}

/* Sélection : plus de liseré violet à gauche, juste un fond/texte appuyés. */
.sidebar__link.is-active {
  color: var(--s404-light);
  background: var(--bg-card-2);
}

.sidebar__link.is-active .sidebar__icon {
  color: var(--text);
}

.sidebar__link.is-soon {
  cursor: not-allowed;
  opacity: 0.55;
}

/* ----- Animation du texte (slide + fondu au repli) ----- */
.sidebar__label {
  white-space: nowrap;
  transition:
    opacity 0.18s ease,
    transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar.is-collapsed .sidebar__label {
  opacity: 0;
  transform: translateX(-10px);
  pointer-events: none;
}

.sidebar__soon {
  margin-left: auto;
  font-size: 9px;
  font-family: var(--font-title);
  letter-spacing: 0.1em;
  color: var(--text-faint);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 7px;
  transition:
    opacity 0.18s ease,
    transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar.is-collapsed .sidebar__soon {
  opacity: 0;
  transform: translateX(-10px);
  pointer-events: none;
}

/* ----- Section basse ----- */
.sidebar__bottom {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--border);
}

/* ----- Badge profil ----- */
.sidebar__user-wrap {
  position: relative;
}

.sidebar__user {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-card-2);
  color: var(--text);
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
  text-align: left;
}

.sidebar__user:hover {
  border-color: var(--border-strong);
  background: var(--bg-card);
}

.sidebar__avatar {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
  font-size: 11px;
  color: var(--s404-light);
  background: linear-gradient(135deg, var(--primary-500), var(--primary-700));
  box-shadow: 0 0 14px var(--primary-glow);
}

.sidebar__user-info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  min-width: 0;
  transition:
    opacity 0.18s ease,
    transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar__user-info strong {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar__user-info span {
  font-size: 10px;
  color: var(--text-faint);
}

.sidebar.is-collapsed .sidebar__user-info {
  opacity: 0;
  transform: translateX(-10px);
  pointer-events: none;
}

/* ----- Menu compte ----- */
.sidebar__menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 40;
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: var(--sp-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar.is-collapsed .sidebar__menu {
  left: 0;
  right: auto;
  min-width: 190px;
}

.sidebar__menu-item {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  font-family: var(--font-body);
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}

.sidebar__menu-item:hover {
  background: var(--bg-card-2);
  color: var(--text);
}

.sidebar__menu-item.is-danger:hover {
  background: var(--critical-soft);
  color: var(--critical);
}

/* ----- Bouton de repli ----- */
.sidebar__collapse {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-faint);
  font-size: 12px;
  font-family: var(--font-body);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;
  text-align: left;
}

.sidebar__collapse:hover {
  color: var(--text);
  background: var(--bg-card-2);
}
</style>
