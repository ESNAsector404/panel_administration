<script setup lang="ts">
import { computed, ref } from 'vue'

import { CITY_INFO } from '@/data/city'
import {
  buildingOutline,
  crosswalkStripes,
  intersectionStopLines,
  intersectionStopSignPosition,
  polygonCentroid,
  roadNetworkPaint,
  ZONE_STYLE,
  zoneOutline,
} from '@/lib/cityRender'
import { useAuthStore } from '@/stores/auth'
import { isCommunicating, useCityStore } from '@/stores/city'
import { PERMISSION } from '@/types/auth'
import type { CityComponent, ComponentAction, Footprint, Status } from '@/types/city'

const store = useCityStore()
const auth = useAuthStore()

/* ---------------------------------------------
   Projection isométrique
   P(x, y, z) = ((x − y)·cos30, (x + y)·sin30 − z)
--------------------------------------------- */

const K = Math.sqrt(3) / 2
const mode = ref<'iso' | '2d'>('iso')

function P(x: number, y: number, z = 0): [number, number] {
  return mode.value === 'iso' ? [(x - y) * K, (x + y) * 0.5 - z] : [x, y]
}

function pts(list: [number, number][]): string {
  return list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

/** Projection affine du plan au sol : permet de dessiner routes/zones « à plat ». */
const groundTransform = computed(() =>
  mode.value === 'iso' ? `matrix(${K} 0.5 ${-K} 0.5 0 0)` : '',
)

/** Cadrage adapté à l'emprise des plateaux de maquette. */
const viewBox = computed(() => {
  const b = store.bounds
  if (mode.value === 'iso') {
    const x0 = (b.x0 - b.y1) * K - 50
    const x1 = (b.x1 - b.y0) * K + 50
    const y0 = (b.x0 + b.y0) / 2 - 130
    const y1 = (b.x1 + b.y1) / 2 + 60
    return `${x0.toFixed(0)} ${y0.toFixed(0)} ${(x1 - x0).toFixed(0)} ${(y1 - y0).toFixed(0)}`
  }
  return `${b.x0 - 30} ${b.y0 - 30} ${b.x1 - b.x0 + 60} ${b.y1 - b.y0 + 60}`
})

/* ---------------------------------------------
   Couleurs des états (tokens — voir design_system.md)
--------------------------------------------- */

const STATUS_COLOR: Record<Status, string> = {
  ok: '#39d98a',
  warning: '#ffb020',
  critical: '#ff4d6d',
  offline: '#6b6877',
}

const STATUS_LABEL: Record<Status, string> = {
  ok: 'Opérationnel',
  warning: 'Alerte',
  critical: 'Compromis',
  offline: 'Hors ligne',
}

interface Palette {
  top: string
  east: string
  south: string
  edge: string
}

const PALETTES: Record<string, Palette> = {
  si: { top: '#2e2747', east: '#1c182f', south: '#251f3a', edge: 'rgba(139,102,255,0.4)' },
  default: { top: '#272430', east: '#18161f', south: '#201d28', edge: 'rgba(242,242,242,0.1)' },
  house: { top: '#232031', east: '#151320', south: '#1c1927', edge: 'rgba(242,242,242,0.08)' },
}

/* ---------------------------------------------
   Listes de rendu (tri « peintre » : le plus loin d'abord)
--------------------------------------------- */

interface BuildingRender {
  type: 'building'
  c: CityComponent
  status: Status
  palette: Palette
  top: string
  /** Faces latérales visibles (extrusion du contour, murs diagonaux inclus). */
  faces: { points: string; fill: string }[]
  label: { x: number; y: number; text: string } | null
  marker: { x: number; y: number } | null
  depth: number
  dim: boolean
}

interface BillboardRender {
  type: 'billboard'
  c: CityComponent
  status: Status
  x: number
  y: number
  depth: number
  dim: boolean
}

interface TreeRender {
  type: 'tree'
  id: string
  x: number
  y: number
  depth: number
  dim: boolean
}

/** Panneau STOP placé aux abords d'une intersection. */
interface SignRender {
  type: 'sign'
  variant: 'stop'
  id: string
  x: number
  y: number
  depth: number
  dim: boolean
}

type RenderItem = BuildingRender | BillboardRender | TreeRender | SignRender

const NO_LABEL_CATEGORIES = new Set(['Résidentiel'])

const renderList = computed<RenderItem[]>(() => {
  const items: RenderItem[] = []

  // composants réels + feux d'intersection (chaque feu = un composant pilotable)
  for (const c of [...store.components, ...store.feuComponents]) {
    const status = store.statusOf(c.id)

    if (c.kind === 'building' && c.footprint) {
      const outline = buildingOutline(c)
      if (outline.length < 3) continue
      const h = mode.value === 'iso' ? c.footprint.h : 0
      const cen = polygonCentroid(outline)
      const palette = c.si ? PALETTES.si! : c.category === 'Résidentiel' ? PALETTES.house! : PALETTES.default!

      // faces latérales visibles : normale extérieure orientée vers la caméra
      const faces: { points: string; fill: string; depth: number }[] = []
      if (mode.value === 'iso') {
        for (let i = 0; i < outline.length; i++) {
          const a = outline[i]!
          const b = outline[(i + 1) % outline.length]!
          let nx = b.y - a.y
          let ny = -(b.x - a.x)
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
          if (nx * (mid.x - cen.x) + ny * (mid.y - cen.y) < 0) {
            nx = -nx
            ny = -ny
          }
          if (nx + ny <= 0) continue
          faces.push({
            points: pts([P(a.x, a.y, h), P(b.x, b.y, h), P(b.x, b.y, 0), P(a.x, a.y, 0)]),
            fill: nx > ny ? palette.east : palette.south,
            depth: mid.x + mid.y,
          })
        }
        faces.sort((f1, f2) => f1.depth - f2.depth)
      }

      const [cx, cy] = P(cen.x, cen.y, h)
      items.push({
        type: 'building',
        c,
        status,
        palette,
        top: pts(outline.map((p) => P(p.x, p.y, h))),
        faces,
        label: NO_LABEL_CATEGORIES.has(c.category)
          ? null
          : { x: cx, y: cy + 4, text: c.name.toUpperCase() },
        // Marqueur flottant réservé aux alertes : un bâtiment hors ligne
        // (non connecté) reste neutre, sans point.
        marker: status === 'warning' || status === 'critical' ? { x: cx, y: cy - 22 } : null,
        depth: cen.x + cen.y,
        dim: !store.insideModules(cen.x, cen.y),
      })
    } else if (c.point && c.kind !== 'parking') {
      const [x, y] = P(c.point.x, c.point.y, 0)
      items.push({
        type: 'billboard',
        c,
        status,
        x,
        y,
        depth: c.point.x + c.point.y,
        dim: !store.insideModules(c.point.x, c.point.y),
      })
    }
  }

  for (const t of store.trees) {
    const [x, y] = P(t.x, t.y, 0)
    items.push({ type: 'tree', id: t.id, x, y, depth: t.x + t.y, dim: !store.insideModules(t.x, t.y) })
  }

  // signalisation des intersections « stop » (les feux sont rendus comme
  // composants via store.feuComponents, conduite à droite)
  for (const it of store.intersections) {
    if (it.control !== 'stop') continue
    const c = intersectionStopSignPosition(it, store.roads)
    if (!c) continue
    const [x, y] = P(c.x, c.y, 0)
    items.push({
      type: 'sign',
      variant: 'stop',
      id: `${it.id}-sign`,
      x,
      y,
      depth: c.x + c.y,
      dim: !store.insideModules(c.x, c.y),
    })
  }

  return items.sort((a, b) => a.depth - b.depth)
})

/** Peinture du réseau routier (couches fusionnées aux jonctions). */
const roadPaint = computed(() => roadNetworkPaint(store.roads, store.intersections))

/** Lignes d'arrêt peintes au sol (intersections « stop »). */
const stopLines = computed(() =>
  store.intersections
    .filter((it) => it.control === 'stop')
    .flatMap((it) => intersectionStopLines(it, store.roads)),
)

/** Octogone du panneau STOP centré sur (x, y−29). */
function octagonAt(x: number, y: number): string {
  const cy = y - 29
  return Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * Math.PI) / 4
    return `${(x + Math.cos(a) * 8.5).toFixed(1)},${(cy + Math.sin(a) * 8.5).toFixed(1)}`
  }).join(' ')
}

/** Points (plan) du contour libre d'une zone, pour un <polygon> au sol. */
function zonePoints(z: { x: number; y: number; w: number; d: number; poly?: { x: number; y: number }[] }): string {
  return zoneOutline(z)
    .map((p) => `${p.x},${p.y}`)
    .join(' ')
}

/** Parkings : surfaces dessinées au sol (groupe transformé). */
const parkings = computed(() =>
  store.components.filter((c) => c.kind === 'parking' && c.footprint),
)

function parkingSlots(fp: Footprint): string {
  const lines: string[] = []
  const step = 24
  for (let sx = fp.x + 18; sx < fp.x + fp.w - 10; sx += step) {
    lines.push(`M ${sx} ${fp.y + 14} v 34`)
    lines.push(`M ${sx} ${fp.y + fp.d - 48} v 34`)
  }
  return lines.join(' ')
}

/* ---------------------------------------------
   Interactions : sélection, survol, tooltip, pan/zoom
--------------------------------------------- */

const hoveredId = ref<string | null>(null)
const tooltip = ref({ x: 0, y: 0 })
const wrapper = ref<HTMLElement | null>(null)

const hovered = computed(
  () =>
    store.components.find((c) => c.id === hoveredId.value) ??
    store.feuComponents.find((c) => c.id === hoveredId.value) ??
    null,
)

function onMove(e: MouseEvent) {
  const rect = wrapper.value?.getBoundingClientRect()
  if (!rect) return
  tooltip.value = { x: e.clientX - rect.left + 14, y: e.clientY - rect.top + 14 }
}

const scale = ref(1)
const pan = ref({ x: 0, y: 0 })
let dragging = false
let moved = false
let last = { x: 0, y: 0 }

function zoom(factor: number) {
  scale.value = Math.min(3.5, Math.max(0.5, scale.value * factor))
}

function resetView() {
  scale.value = 1
  pan.value = { x: 0, y: 0 }
}

function onWheel(e: WheelEvent) {
  zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12)
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  closeContext()
  dragging = true
  moved = false
  last = { x: e.clientX, y: e.clientY }
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  const dx = e.clientX - last.x
  const dy = e.clientY - last.y
  if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
  pan.value = { x: pan.value.x + dx, y: pan.value.y + dy }
  last = { x: e.clientX, y: e.clientY }
}

function onPointerUp() {
  dragging = false
}

function onBackgroundClick() {
  if (!moved) store.select(null)
}

function clickComponent(c: CityComponent) {
  if (moved) return
  store.select(store.selectedId === c.id ? null : c.id)
}

/* ---------------------------------------------
   Menu contextuel (clic droit sur un élément)
--------------------------------------------- */

const canPilot = computed(() => auth.can(PERMISSION.CITY_PILOT))

const ctxMenu = ref<{ x: number; y: number; component: CityComponent } | null>(null)

/** Lumières du composant ciblé par le menu (avec leur état courant). */
const ctxLights = computed(() => {
  const c = ctxMenu.value?.component
  if (!c) return []
  const state = store.states[c.id] ?? {}
  return (c.lights ?? []).map((l) => ({ ...l, on: state[`light:${l.id}`] === true }))
})

const ctxConnected = computed(() =>
  ctxMenu.value ? isCommunicating(ctxMenu.value.component) : false,
)

function openContext(e: MouseEvent, c: CityComponent) {
  const rect = wrapper.value?.getBoundingClientRect()
  if (!rect) return
  store.select(c.id)
  ctxMenu.value = {
    x: Math.min(e.clientX - rect.left, rect.width - 230),
    y: Math.min(e.clientY - rect.top, rect.height - 200),
    component: c,
  }
}

function closeContext() {
  ctxMenu.value = null
}

function ctxRun(action: ComponentAction) {
  const c = ctxMenu.value?.component
  closeContext()
  if (!c) return
  if (action.critical && !window.confirm(`Action critique : « ${action.label} ». Confirmer ?`)) {
    return
  }
  store.runAction(c, action)
}

function ctxToggleLight(lightId: string, on: boolean) {
  const c = ctxMenu.value?.component
  if (c) store.toggleLight(c.id, lightId, on)
}

function strokeFor(c: CityComponent, status: Status, edge: string): string {
  if (store.selectedId === c.id) return '#8b66ff'
  if (status === 'warning' || status === 'critical') return STATUS_COLOR[status]
  if (hoveredId.value === c.id) return 'rgba(139,102,255,0.8)'
  return edge
}

function strokeWidthFor(c: CityComponent, status: Status): number {
  if (store.selectedId === c.id) return 3
  if (status === 'warning' || status === 'critical') return 2
  if (hoveredId.value === c.id) return 2
  return 1
}

/** État interne (mode feu, barrière ouverte, lampe allumée). */
function stateOf(id: string): Record<string, string | boolean> {
  return store.states[id] ?? {}
}
</script>

<template>
  <section class="card city-map">
    <header class="city-map__header">
      <div class="city-map__titles">
        <h2 class="card-title">Plan de la ville</h2>
        <span class="chip">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M5 1a3 3 0 0 1 3 3c0 2-3 5-3 5S2 6 2 4a3 3 0 0 1 3-3Z"
              stroke="#8b66ff"
              stroke-width="1.2"
            />
          </svg>
          {{ CITY_INFO.name }} · {{ CITY_INFO.region }}
        </span>
      </div>

      <div class="city-map__controls">
        <div class="seg">
          <button :class="{ active: mode === 'iso' }" @click="mode = 'iso'">ISO</button>
          <button :class="{ active: mode === '2d' }" @click="mode = '2d'">2D</button>
        </div>
        <div class="seg">
          <button title="Zoom arrière" @click="zoom(1 / 1.25)">−</button>
          <button title="Zoom avant" @click="zoom(1.25)">+</button>
          <button title="Réinitialiser la vue" @click="resetView()">⟲</button>
        </div>
      </div>
    </header>

    <div
      ref="wrapper"
      class="city-map__viewport"
      @mousemove="onMove"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @contextmenu.prevent="closeContext"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    >
      <svg
        :viewBox="viewBox"
        class="city-map__svg"
        :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }"
        @click="onBackgroundClick"
      >
        <defs>
          <mask id="cm-outside-mask">
            <rect x="-4000" y="-4000" width="9000" height="9000" fill="white" />
            <rect
              v-for="(m, i) in store.modules"
              :key="i"
              :x="m.x * 1000 - 25"
              :y="m.y * 1000 - 25"
              width="1050"
              height="1050"
              rx="28"
              fill="black"
            />
          </mask>
        </defs>

        <!-- ============ SOL (plan 2D projeté) ============ -->
        <g :transform="groundTransform">
          <!-- Plateaux de maquette (1 m × 1 m chacun) -->
          <rect
            v-for="(m, i) in store.modules"
            :key="'plate' + i"
            :x="m.x * 1000 - 25"
            :y="m.y * 1000 - 25"
            width="1050"
            height="1050"
            rx="28"
            fill="#0e0d13"
            stroke="#262333"
          />

          <!-- Zones (parc, eau, quartiers…) -->
          <template v-for="z in store.zones" :key="z.id">
            <rect
              v-if="!z.poly"
              :x="z.x"
              :y="z.y"
              :width="z.w"
              :height="z.d"
              :rx="ZONE_STYLE[z.type].rx"
              :fill="ZONE_STYLE[z.type].fill"
              :stroke="ZONE_STYLE[z.type].stroke ?? 'none'"
              :stroke-dasharray="z.type === 'technique' ? '10 8' : undefined"
            />
            <polygon
              v-else
              :points="zonePoints(z)"
              :fill="ZONE_STYLE[z.type].fill"
              :stroke="ZONE_STYLE[z.type].stroke ?? 'none'"
              :stroke-dasharray="z.type === 'technique' ? '10 8' : undefined"
              stroke-linejoin="round"
            />
          </template>

          <!-- Voirie (couches fusionnées aux jonctions) -->
          <g fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path
              v-for="(layer, i) in roadPaint"
              :key="i"
              :d="layer.d"
              :stroke="layer.stroke"
              :stroke-width="layer.width"
              :stroke-dasharray="layer.dash"
              :stroke-opacity="layer.opacity"
              :fill="layer.fill ?? 'none'"
            />
          </g>

          <!-- Passages piétons -->
          <g
            v-for="cw in store.crosswalks"
            :key="cw.id"
            :transform="`translate(${cw.x} ${cw.y}) rotate(${cw.angle})`"
            stroke="#f2f2f2"
            stroke-opacity="0.16"
            stroke-width="4.5"
          >
            <line v-for="sy in crosswalkStripes(cw.span)" :key="sy" x1="-21" :y1="sy" x2="21" :y2="sy" />
          </g>

          <!-- Lignes d'arrêt (intersections « stop ») -->
          <g stroke="#f2f2f2" stroke-opacity="0.3" stroke-width="5" stroke-linecap="round">
            <line
              v-for="(l, i) in stopLines"
              :key="i"
              :x1="l.x1"
              :y1="l.y1"
              :x2="l.x2"
              :y2="l.y2"
            />
          </g>

          <!-- Parkings (interactifs, dessinés au sol) -->
          <g
            v-for="p in parkings"
            :key="p.id"
            class="clickable"
            @click.stop="clickComponent(p)"
            @contextmenu.prevent.stop="openContext($event, p)"
            @pointerenter="hoveredId = p.id"
            @pointerleave="hoveredId = null"
          >
            <rect
              :x="p.footprint!.x"
              :y="p.footprint!.y"
              :width="p.footprint!.w"
              :height="p.footprint!.d"
              rx="6"
              fill="#15131e"
              :stroke="strokeFor(p, store.statuses[p.id] ?? 'ok', '#2a2640')"
              :stroke-width="strokeWidthFor(p, store.statuses[p.id] ?? 'ok')"
            />
            <path :d="parkingSlots(p.footprint!)" stroke="#f2f2f2" stroke-opacity="0.1" stroke-width="3" fill="none" />
            <text
              :x="p.footprint!.x + p.footprint!.w / 2"
              :y="p.footprint!.y + p.footprint!.d / 2 + 20"
              text-anchor="middle"
              class="ground-letter"
            >
              P
            </text>
          </g>

          <!-- Grisage de tout ce qui dépasse des plateaux -->
          <rect
            x="-4000"
            y="-4000"
            width="9000"
            height="9000"
            fill="#0a0908"
            opacity="0.75"
            mask="url(#cm-outside-mask)"
            pointer-events="none"
          />
        </g>

        <!-- ============ OBJETS (bâtiments, feux, barrières…) ============ -->
        <template
          v-for="item in renderList"
          :key="item.type === 'tree' || item.type === 'sign' ? item.id : item.c.id"
        >
          <!-- Arbre (décor) -->
          <g v-if="item.type === 'tree'" class="tree" pointer-events="none" :opacity="item.dim ? 0.3 : 1">
            <line :x1="item.x" :y1="item.y" :x2="item.x" :y2="item.y - 14" stroke="#3a3343" stroke-width="3" />
            <circle :cx="item.x" :cy="item.y - 22" r="13" fill="#262040" stroke="#3b3260" />
            <circle :cx="item.x - 4" :cy="item.y - 26" r="3" fill="#5e2bff" opacity="0.35" />
          </g>

          <!-- Panneau STOP d'intersection -->
          <g v-else-if="item.type === 'sign'" pointer-events="none" :opacity="item.dim ? 0.3 : 1">
            <line :x1="item.x" :y1="item.y" :x2="item.x" :y2="item.y - 21" stroke="#3a3645" stroke-width="2.5" />
            <polygon :points="octagonAt(item.x, item.y)" fill="#c92a45" stroke="#f2f2f2" stroke-width="1.5" />
            <text :x="item.x" :y="item.y - 27" text-anchor="middle" class="stop-label">STOP</text>
          </g>

          <!-- Bâtiment extrudé (contour libre) -->
          <g
            v-else-if="item.type === 'building'"
            class="clickable"
            :opacity="item.dim ? 0.3 : 1"
            @click.stop="clickComponent(item.c)"
            @contextmenu.prevent.stop="openContext($event, item.c)"
            @pointerenter="hoveredId = item.c.id"
            @pointerleave="hoveredId = null"
          >
            <polygon v-for="(f, i) in item.faces" :key="i" :points="f.points" :fill="f.fill" />
            <polygon
              :points="item.top"
              :fill="item.palette.top"
              :stroke="strokeFor(item.c, item.status, item.palette.edge)"
              :stroke-width="strokeWidthFor(item.c, item.status)"
              stroke-linejoin="round"
            />
            <text v-if="item.label" :x="item.label.x" :y="item.label.y" text-anchor="middle" class="bld-label">
              {{ item.label.text }}
            </text>
            <g v-if="item.marker" pointer-events="none">
              <circle
                :cx="item.marker.x"
                :cy="item.marker.y"
                r="11"
                :fill="STATUS_COLOR[item.status]"
                opacity="0.22"
              />
              <circle
                :cx="item.marker.x"
                :cy="item.marker.y"
                r="5"
                :fill="STATUS_COLOR[item.status]"
                :class="{ pulse: item.status === 'critical' }"
              />
            </g>
          </g>

          <!-- Éléments ponctuels -->
          <g
            v-else
            class="clickable"
            :transform="`translate(${item.x} ${item.y})`"
            :opacity="item.dim ? 0.3 : 1"
            @click.stop="clickComponent(item.c)"
            @contextmenu.prevent.stop="openContext($event, item.c)"
            @pointerenter="hoveredId = item.c.id"
            @pointerleave="hoveredId = null"
          >
            <!-- Feu tricolore -->
            <template v-if="item.c.kind === 'traffic-light'">
              <line x1="0" y1="0" x2="0" y2="-26" stroke="#3a3645" stroke-width="3.5" />
              <rect
                x="-8"
                y="-58"
                width="16"
                height="34"
                rx="4"
                fill="#14121c"
                :stroke="strokeFor(item.c, item.status, '#332e47')"
                :stroke-width="strokeWidthFor(item.c, item.status)"
              />
              <circle
                cx="0"
                cy="-50"
                r="3.6"
                fill="#ff4d6d"
                :opacity="item.status !== 'offline' && stateOf(item.c.id).mode === 'rouge' ? 1 : 0.14"
              />
              <circle
                cx="0"
                cy="-41"
                r="3.6"
                fill="#ffb020"
                :class="{ blink: item.status !== 'offline' && stateOf(item.c.id).mode === 'orange' }"
                :opacity="item.status !== 'offline' && stateOf(item.c.id).mode === 'orange' ? 1 : 0.14"
              />
              <circle
                cx="0"
                cy="-32"
                r="3.6"
                fill="#39d98a"
                :opacity="item.status !== 'offline' && stateOf(item.c.id).mode === 'normal' ? 1 : 0.14"
              />
              <circle cx="0" cy="-40" r="22" fill="transparent" />
            </template>

            <!-- Barrière -->
            <template v-else-if="item.c.kind === 'barrier'">
              <rect x="-4" y="-20" width="8" height="20" rx="2" fill="#2a2735" stroke="#3a3447" />
              <g
                class="barrier-arm"
                :transform="stateOf(item.c.id).open ? 'rotate(-62 0 -16)' : ''"
              >
                <line x1="0" y1="-16" x2="34" y2="-16" stroke="#f2f2f2" stroke-width="4" stroke-linecap="round" />
                <line
                  x1="4"
                  y1="-16"
                  x2="34"
                  y2="-16"
                  stroke="#ff4d6d"
                  stroke-width="4"
                  stroke-linecap="round"
                  stroke-dasharray="6 7"
                />
              </g>
              <circle cx="0" cy="-16" r="3" :fill="STATUS_COLOR[item.status]" />
              <circle cx="10" cy="-14" r="20" fill="transparent" />
            </template>

            <!-- Lampadaire -->
            <template v-else-if="item.c.kind === 'lamp'">
              <line x1="0" y1="0" x2="0" y2="-28" stroke="#3a3645" stroke-width="2.5" />
              <line x1="0" y1="-28" x2="9" y2="-28" stroke="#3a3645" stroke-width="2.5" />
              <circle
                cx="11"
                cy="-27"
                r="4"
                :fill="stateOf(item.c.id).on ? '#ffe9b0' : '#211e2b'"
                :stroke="strokeFor(item.c, item.status, '#3a3645')"
              />
              <circle v-if="stateOf(item.c.id).on" cx="11" cy="-27" r="9" fill="#ffd98a" opacity="0.15" />
              <circle cx="4" cy="-20" r="16" fill="transparent" />
            </template>

            <!-- Marqueur d'état -->
            <g v-if="item.status !== 'ok'" pointer-events="none">
              <circle
                cx="0"
                cy="-68"
                r="4.5"
                :fill="STATUS_COLOR[item.status]"
                :class="{ pulse: item.status === 'critical' }"
              />
            </g>
          </g>
        </template>
      </svg>

      <!-- Légende -->
      <div class="city-map__legend">
        <span><i class="dot dot--ok" /> Opérationnel</span>
        <span><i class="dot dot--warning" /> Alerte</span>
        <span><i class="dot dot--critical" /> Compromis</span>
        <span><i class="dot dot--offline" /> Hors ligne</span>
        <span class="legend-si"><i /> Bâtiment SI</span>
      </div>

      <div class="city-map__coords">{{ CITY_INFO.coords }}</div>

      <!-- Tooltip -->
      <div
        v-if="hovered"
        class="city-map__tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <strong>{{ hovered.name }}</strong>
        <span class="tt-row">
          <i class="dot" :class="`dot--${store.statusOf(hovered.id)}`" />
          {{ STATUS_LABEL[store.statusOf(hovered.id)] }} · {{ hovered.category }}
        </span>
      </div>

      <!-- Menu contextuel : actions disponibles sur l'élément (clic droit) -->
      <div
        v-if="ctxMenu"
        class="ctx-menu"
        :style="{ left: `${ctxMenu.x}px`, top: `${ctxMenu.y}px` }"
        @contextmenu.prevent
        @pointerdown.stop
      >
        <header class="ctx-menu__header">
          <strong>{{ ctxMenu.component.name || 'Élément' }}</strong>
          <span>{{ ctxMenu.component.category }}</span>
        </header>

        <p v-if="!ctxConnected" class="ctx-menu__empty">Non connecté — aucune action.</p>

        <template v-else-if="canPilot">
          <button
            v-for="light in ctxLights"
            :key="light.id"
            class="ctx-menu__item"
            @click="ctxToggleLight(light.id, !light.on)"
          >
            {{ light.on ? 'Éteindre' : 'Allumer' }} — {{ light.name }}
          </button>
          <button
            v-for="action in ctxMenu.component.actions"
            :key="action.id"
            class="ctx-menu__item"
            :class="{ 'is-critical': action.critical }"
            @click="ctxRun(action)"
          >
            {{ action.label }}
          </button>
        </template>
        <p v-else class="ctx-menu__empty">Pilotage non autorisé (lecture seule).</p>

        <button class="ctx-menu__item ctx-menu__item--dim" @click="closeContext()">
          Fermer
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ctx-menu {
  position: absolute;
  z-index: 20;
  min-width: 210px;
  background: rgba(19, 17, 27, 0.97);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 12px var(--primary-glow);
  padding: 4px;
}

.ctx-menu__header {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.ctx-menu__header strong {
  font-size: 12px;
  color: var(--text);
}

.ctx-menu__header span {
  font-size: 10px;
  color: var(--text-faint);
}

.ctx-menu__item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 7px 10px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  font-family: var(--font-body);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.ctx-menu__item:hover {
  background: var(--primary-soft);
  color: var(--text);
}

.ctx-menu__item.is-critical {
  color: var(--critical);
}

.ctx-menu__item--dim {
  color: var(--text-faint);
  border-top: 1px dashed var(--border);
  border-radius: 0;
  margin-top: 4px;
}

.ctx-menu__empty {
  padding: 8px 10px;
  font-size: 11px;
  color: var(--text-faint);
}

.city-map {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.city-map__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-4) var(--sp-3);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.city-map__titles {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.city-map__controls {
  display: flex;
  gap: var(--sp-2);
}

.seg {
  display: inline-flex;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-card-2);
}

.seg button {
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-family: var(--font-title);
  font-size: 11px;
  letter-spacing: 0.08em;
  padding: 6px 12px;
  transition: all 0.15s;
}

.seg button + button {
  border-left: 1px solid var(--border);
}

.seg button:hover {
  color: var(--text);
}

.seg button.active {
  background: var(--primary-500);
  color: var(--s404-light);
}

.city-map__viewport {
  position: relative;
  flex: 1;
  min-height: 480px;
  overflow: hidden;
  cursor: grab;
  background: var(--bg-inset);
}

.city-map__viewport:active {
  cursor: grabbing;
}

.city-map__svg {
  width: 100%;
  height: 100%;
  display: block;
  transform-origin: 50% 50%;
  transition: transform 0.08s linear;
}

.clickable {
  cursor: pointer;
}

.bld-label {
  font-family: var(--font-body);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.12em;
  fill: rgba(242, 242, 242, 0.72);
  pointer-events: none;
  paint-order: stroke;
  stroke: rgba(10, 9, 8, 0.65);
  stroke-width: 3px;
}

.ground-letter {
  font-family: var(--font-title);
  font-size: 58px;
  fill: rgba(242, 242, 242, 0.07);
}

.barrier-arm {
  transition: transform 0.45s ease;
}

.stop-label {
  font-family: var(--font-body);
  font-size: 5.5px;
  font-weight: 900;
  letter-spacing: 0.06em;
  fill: #f2f2f2;
}

.city-map__legend {
  position: absolute;
  left: var(--sp-3);
  bottom: var(--sp-3);
  display: flex;
  gap: var(--sp-3);
  flex-wrap: wrap;
  align-items: center;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-card);
  font-size: 11px;
  color: var(--text-dim);
}

.city-map__legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-si i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: #2e2747;
  border: 1px solid var(--primary-300);
}

.city-map__coords {
  position: absolute;
  right: var(--sp-3);
  bottom: var(--sp-3);
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--text-faint);
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
}

.city-map__tooltip {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background: var(--bg-card-2);
  box-shadow: var(--shadow-card);
  font-size: 12px;
  max-width: 240px;
}

.city-map__tooltip strong {
  font-weight: 700;
  color: var(--text);
}

.tt-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-dim);
  font-size: 11px;
}

.tt-hint {
  color: var(--text-faint);
  font-style: italic;
}
</style>
