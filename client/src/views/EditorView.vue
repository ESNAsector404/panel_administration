<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import CityMap from '@/components/city/CityMap.vue'
import { BARRIER_ACTIONS, LAMP_ACTIONS, LIGHT_ACTIONS } from '@/data/city'
import {
  buildingOutline,
  crosswalkStripes,
  INTERSECTION_CONTROL_LABELS,
  INTERSECTION_MODE_LABELS,
  intersectionStopLines,
  pathFrom,
  polygonCentroid,
  ROAD_DEFAULT_WIDTH,
  ROAD_LABELS,
  roadNetworkPaint,
  roadPolyline,
  ZONE_LABELS,
  ZONE_STYLE,
  zoneOutline,
} from '@/lib/cityRender'
import { useCityStore } from '@/stores/city'
import type {
  CityComponent,
  Crosswalk,
  IntersectionControl,
  LightMode,
  Point,
  Road,
  RoadType,
  TreeItem,
  Zone,
  ZoneType,
} from '@/types/city'

const store = useCityStore()

/* ---------------------------------------------
   Outils
--------------------------------------------- */

type Tool =
  | 'select'
  | 'zone'
  | 'building'
  | 'parking'
  | 'road'
  | 'crosswalk'
  | 'feu'
  | 'barriere'
  | 'lamp'
  | 'tree'

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'select', label: 'Sélection' },
  { id: 'building', label: 'Bâtiment' },
  { id: 'parking', label: 'Parking' },
  { id: 'zone', label: 'Zone' },
  { id: 'road', label: 'Route' },
  { id: 'crosswalk', label: 'Passage piéton' },
  { id: 'feu', label: 'Feu tricolore' },
  { id: 'barriere', label: 'Barrière' },
  { id: 'lamp', label: 'Lampadaire' },
  { id: 'tree', label: 'Arbre' },
]

const tool = ref<Tool>('select')
const roadType = ref<RoadType>('standard')
const zoneType = ref<ZoneType>('parc')
const snap = ref(true)

function S(v: number): number {
  return snap.value ? Math.round(v / 10) * 10 : Math.round(v)
}

/**
 * Snap d'un déplacement (delta) : un simple clic (delta nul) ne déplace
 * jamais l'objet, contrairement au snap de la position absolue.
 */
function SD(d: number): number {
  return snap.value ? Math.round(d / 10) * 10 : Math.round(d)
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`
}

/* ---------------------------------------------
   Sélection d'édition
--------------------------------------------- */

type SelKind = 'component' | 'road' | 'zone' | 'crosswalk' | 'tree' | 'intersection'
const sel = ref<{ kind: SelKind; id: string } | null>(null)

const selComponent = computed(() =>
  sel.value?.kind === 'component'
    ? (store.components.find((c) => c.id === sel.value!.id) ?? null)
    : null,
)
const selRoad = computed(() =>
  sel.value?.kind === 'road' ? (store.roads.find((r) => r.id === sel.value!.id) ?? null) : null,
)
const selZone = computed(() =>
  sel.value?.kind === 'zone' ? (store.zones.find((z) => z.id === sel.value!.id) ?? null) : null,
)
const selCrosswalk = computed(() =>
  sel.value?.kind === 'crosswalk'
    ? (store.crosswalks.find((c) => c.id === sel.value!.id) ?? null)
    : null,
)
const selTree = computed(() =>
  sel.value?.kind === 'tree' ? (store.trees.find((t) => t.id === sel.value!.id) ?? null) : null,
)
const selIntersection = computed(() =>
  sel.value?.kind === 'intersection'
    ? (store.intersections.find((i) => i.id === sel.value!.id) ?? null)
    : null,
)

function removeSelected() {
  if (!sel.value) return
  const { kind, id } = sel.value
  if (kind === 'component') store.removeComponent(id)
  else if (kind === 'road') store.removeRoad(id)
  else if (kind === 'zone') store.removeZone(id)
  else if (kind === 'crosswalk') store.removeCrosswalk(id)
  else if (kind === 'intersection') store.setIntersectionControl(id, 'none')
  else store.removeTree(id)
  sel.value = null
}

function roadName(id: string): string {
  return store.roads.find((r) => r.id === id)?.name ?? id
}

/* ---------------------------------------------
   Viewport (pan / zoom / conversion souris → plan)
--------------------------------------------- */

const svgEl = ref<SVGSVGElement | null>(null)

/** Cadrage adapté à l'emprise des plateaux (+ marge pour les boutons d'extension). */
const VB = computed(() => {
  const b = store.bounds
  const m = 180
  return { x: b.x0 - m, y: b.y0 - m, w: b.x1 - b.x0 + 2 * m, h: b.y1 - b.y0 + 2 * m }
})

const view = ref({ scale: 1, x: 0, y: 0 })

function clientToUser(e: { clientX: number; clientY: number }): Point {
  const rect = svgEl.value!.getBoundingClientRect()
  const vb = VB.value
  const sf = Math.min(rect.width / vb.w, rect.height / vb.h)
  const ox = rect.left + (rect.width - vb.w * sf) / 2
  const oy = rect.top + (rect.height - vb.h * sf) / 2
  return { x: (e.clientX - ox) / sf + vb.x, y: (e.clientY - oy) / sf + vb.y }
}

function toPlan(e: { clientX: number; clientY: number }): Point {
  const u = clientToUser(e)
  return { x: (u.x - view.value.x) / view.value.scale, y: (u.y - view.value.y) / view.value.scale }
}

function onWheel(e: WheelEvent) {
  const u = clientToUser(e)
  const v = view.value
  const ns = Math.min(4, Math.max(0.4, v.scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
  const k = ns / v.scale
  view.value = { scale: ns, x: u.x - (u.x - v.x) * k, y: u.y - (u.y - v.y) * k }
}

function resetView() {
  view.value = { scale: 1, x: 0, y: 0 }
}

/* ---------------------------------------------
   Machine à états du glisser
--------------------------------------------- */

type Drag =
  | { mode: 'pan'; start: Point; orig: { x: number; y: number } }
  | { mode: 'move-component'; id: string; start: Point; orig: Point; origPoly: Point[] | null }
  | { mode: 'resize-component'; id: string; start: Point; ow: number; od: number }
  | { mode: 'building-point'; id: string; index: number }
  | { mode: 'move-zone'; id: string; start: Point; orig: Point; origPoly: Point[] | null }
  | { mode: 'resize-zone'; id: string; start: Point; ow: number; od: number }
  | { mode: 'zone-point'; id: string; index: number }
  | { mode: 'move-road'; id: string; start: Point; orig: Point[] }
  | { mode: 'road-point'; id: string; index: number }
  | { mode: 'move-crosswalk'; id: string; start: Point; orig: Point }
  | { mode: 'move-tree'; id: string; start: Point; orig: Point }
  | { mode: 'draw-rect'; start: Point }
  | { mode: 'draw-road'; start: Point }

let drag: Drag | null = null

/** Aperçus de tracé (réactifs pour le rendu). */
const drawRect = ref<{ x: number; y: number; w: number; d: number } | null>(null)
const drawLine = ref<{ a: Point; b: Point } | null>(null)

function onCanvasDown(e: PointerEvent) {
  if (e.button !== 0) return
  svgEl.value?.setPointerCapture(e.pointerId)
  const p = toPlan(e)

  if (tool.value === 'select') {
    drag = { mode: 'pan', start: clientToUser(e), orig: { x: view.value.x, y: view.value.y } }
  } else if (tool.value === 'building' || tool.value === 'zone' || tool.value === 'parking') {
    drag = { mode: 'draw-rect', start: { x: S(p.x), y: S(p.y) } }
    drawRect.value = { x: S(p.x), y: S(p.y), w: 0, d: 0 }
  } else if (tool.value === 'road') {
    drag = { mode: 'draw-road', start: { x: S(p.x), y: S(p.y) } }
    drawLine.value = { a: { x: S(p.x), y: S(p.y) }, b: { x: S(p.x), y: S(p.y) } }
  } else {
    placeAt(p)
  }
}

function onCanvasMove(e: PointerEvent) {
  if (!drag) return
  const p = toPlan(e)

  switch (drag.mode) {
    case 'pan': {
      const u = clientToUser(e)
      view.value.x = drag.orig.x + (u.x - drag.start.x)
      view.value.y = drag.orig.y + (u.y - drag.start.y)
      break
    }
    case 'draw-rect': {
      const x = Math.min(drag.start.x, S(p.x))
      const y = Math.min(drag.start.y, S(p.y))
      drawRect.value = {
        x,
        y,
        w: Math.abs(S(p.x) - drag.start.x),
        d: Math.abs(S(p.y) - drag.start.y),
      }
      break
    }
    case 'draw-road': {
      if (drawLine.value) drawLine.value.b = { x: S(p.x), y: S(p.y) }
      break
    }
    case 'move-component': {
      const c = store.components.find((c) => c.id === (drag as { id: string }).id)
      if (!c) break
      const dx = SD(p.x - drag.start.x)
      const dy = SD(p.y - drag.start.y)
      if (c.footprint) {
        c.footprint.x = drag.orig.x + dx
        c.footprint.y = drag.orig.y + dy
        if (c.poly && drag.origPoly) {
          c.poly = drag.origPoly.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }))
        }
      } else if (c.point) {
        c.point.x = drag.orig.x + dx
        c.point.y = drag.orig.y + dy
      }
      break
    }
    case 'resize-component': {
      const c = store.components.find((c) => c.id === (drag as { id: string }).id)
      if (!c?.footprint) break
      c.footprint.w = Math.max(20, drag.ow + SD(p.x - drag.start.x))
      c.footprint.d = Math.max(20, drag.od + SD(p.y - drag.start.y))
      break
    }
    case 'building-point': {
      const c = store.components.find((c) => c.id === (drag as { id: string }).id)
      if (!c?.poly) break
      c.poly[drag.index] = { x: S(p.x), y: S(p.y) }
      syncFootprint(c)
      break
    }
    case 'move-zone': {
      const z = store.zones.find((z) => z.id === (drag as { id: string }).id)
      if (!z) break
      const dx = SD(p.x - drag.start.x)
      const dy = SD(p.y - drag.start.y)
      z.x = drag.orig.x + dx
      z.y = drag.orig.y + dy
      if (z.poly && drag.origPoly) {
        z.poly = drag.origPoly.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }))
      }
      break
    }
    case 'resize-zone': {
      const z = store.zones.find((z) => z.id === (drag as { id: string }).id)
      if (!z) break
      z.w = Math.max(30, drag.ow + SD(p.x - drag.start.x))
      z.d = Math.max(30, drag.od + SD(p.y - drag.start.y))
      break
    }
    case 'zone-point': {
      const z = store.zones.find((z) => z.id === (drag as { id: string }).id)
      if (!z?.poly) break
      z.poly[drag.index] = { x: S(p.x), y: S(p.y) }
      syncZoneRect(z)
      break
    }
    case 'move-road': {
      const r = store.roads.find((r) => r.id === (drag as { id: string }).id)
      if (!r) break
      const dx = SD(p.x - drag.start.x)
      const dy = SD(p.y - drag.start.y)
      r.points = drag.orig.map((pt, i) => ({
        ...r.points[i],
        x: pt.x + dx,
        y: pt.y + dy,
      }))
      break
    }
    case 'road-point': {
      const r = store.roads.find((r) => r.id === (drag as { id: string }).id)
      if (!r) break
      const prev = r.points[drag.index]
      let target: Point = { x: p.x, y: p.y }
      // Shift : conserve l'angle du segment adjacent en projetant le sommet
      // sur l'axe défini par le sommet voisin (ancre).
      if (e.shiftKey) {
        const anchor = r.points[drag.index === 0 ? 1 : drag.index - 1]
        if (anchor) {
          const ax = prev!.x - anchor.x
          const ay = prev!.y - anchor.y
          const len2 = ax * ax + ay * ay
          if (len2 > 0) {
            const t = ((p.x - anchor.x) * ax + (p.y - anchor.y) * ay) / len2
            target = { x: anchor.x + ax * t, y: anchor.y + ay * t }
          }
        }
      }
      r.points[drag.index] = { ...prev, x: S(target.x), y: S(target.y) }
      break
    }
    case 'move-crosswalk': {
      const c = store.crosswalks.find((c) => c.id === (drag as { id: string }).id)
      if (!c) break
      c.x = drag.orig.x + SD(p.x - drag.start.x)
      c.y = drag.orig.y + SD(p.y - drag.start.y)
      break
    }
    case 'move-tree': {
      const t = store.trees.find((t) => t.id === (drag as { id: string }).id)
      if (!t) break
      t.x = drag.orig.x + SD(p.x - drag.start.x)
      t.y = drag.orig.y + SD(p.y - drag.start.y)
      break
    }
  }
}

function onCanvasUp() {
  if (drag?.mode === 'draw-rect' && drawRect.value) {
    const r = drawRect.value
    if (r.w >= 20 && r.d >= 20) {
      if (tool.value === 'building') createBuilding(r)
      else if (tool.value === 'parking') createParking(r)
      else createZone(r)
    }
  } else if (drag?.mode === 'draw-road' && drawLine.value) {
    const { a, b } = drawLine.value
    if (Math.hypot(b.x - a.x, b.y - a.y) >= 30) createRoad(a, b)
  }
  drag = null
  drawRect.value = null
  drawLine.value = null
}

/* ---------------------------------------------
   Création d'éléments
--------------------------------------------- */

function createBuilding(r: { x: number; y: number; w: number; d: number }) {
  const c: CityComponent = {
    id: uid('bat'),
    name: 'Nouveau bâtiment',
    kind: 'building',
    category: 'Divers',
    footprint: { ...r, h: 40 },
    initialStatus: 'ok',
    metrics: { État: '—' },
    actions: [],
  }
  store.addComponent(c)
  sel.value = { kind: 'component', id: c.id }
  tool.value = 'select'
}

function createParking(r: { x: number; y: number; w: number; d: number }) {
  const c: CityComponent = {
    id: uid('parc'),
    name: 'Nouveau parking',
    kind: 'parking',
    category: 'Mobilité',
    footprint: { ...r, h: 0 },
    initialStatus: 'ok',
    metrics: { Occupation: '0 / 40' },
    actions: [],
  }
  store.addComponent(c)
  sel.value = { kind: 'component', id: c.id }
  tool.value = 'select'
}

function createZone(r: { x: number; y: number; w: number; d: number }) {
  const id = uid('zone')
  store.addZone({ id, type: zoneType.value, ...r })
  sel.value = { kind: 'zone', id }
  tool.value = 'select'
}

function createRoad(a: Point, b: Point) {
  const id = uid('route')
  store.addRoad({
    id,
    name: ROAD_LABELS[roadType.value],
    type: roadType.value,
    width: ROAD_DEFAULT_WIDTH[roadType.value],
    points: [a, b],
  })
  sel.value = { kind: 'road', id }
  tool.value = 'select'
}

function placeAt(p: Point) {
  const x = S(p.x)
  const y = S(p.y)

  if (tool.value === 'crosswalk') {
    const id = uid('cw')
    store.addCrosswalk({ id, x, y, angle: 0, span: 52 })
    sel.value = { kind: 'crosswalk', id }
  } else if (tool.value === 'tree') {
    const id = uid('tree')
    store.addTree({ id, x, y })
    sel.value = { kind: 'tree', id }
  } else if (tool.value === 'feu') {
    const c: CityComponent = {
      id: uid('feu'),
      name: 'Nouveau feu tricolore',
      kind: 'traffic-light',
      category: 'Mobilité',
      point: { x, y },
      initialStatus: 'ok',
      metrics: { Cycle: '90 s', Mode: 'Normal' },
      actions: LIGHT_ACTIONS,
      initialState: { mode: 'normal' },
    }
    store.addComponent(c)
    sel.value = { kind: 'component', id: c.id }
  } else if (tool.value === 'barriere') {
    const c: CityComponent = {
      id: uid('bar'),
      name: 'Nouvelle barrière',
      kind: 'barrier',
      category: 'Mobilité',
      point: { x, y },
      initialStatus: 'ok',
      metrics: { Badgeuse: 'OK' },
      actions: BARRIER_ACTIONS,
      initialState: { open: false },
    }
    store.addComponent(c)
    sel.value = { kind: 'component', id: c.id }
  } else if (tool.value === 'lamp') {
    const c: CityComponent = {
      id: uid('lamp'),
      name: 'Nouveau lampadaire',
      kind: 'lamp',
      category: 'Éclairage public',
      point: { x, y },
      initialStatus: 'ok',
      metrics: { Puissance: '150 W' },
      actions: LAMP_ACTIONS,
      initialState: { on: true },
    }
    store.addComponent(c)
    sel.value = { kind: 'component', id: c.id }
  }
}

/* ---------------------------------------------
   Démarrage des déplacements (outil sélection)
--------------------------------------------- */

function startMoveComponent(c: CityComponent, e: PointerEvent) {
  sel.value = { kind: 'component', id: c.id }
  const orig = c.footprint
    ? { x: c.footprint.x, y: c.footprint.y }
    : { x: c.point!.x, y: c.point!.y }
  drag = {
    mode: 'move-component',
    id: c.id,
    start: toPlan(e),
    orig,
    origPoly: c.poly ? c.poly.map((pt) => ({ ...pt })) : null,
  }
  svgEl.value?.setPointerCapture(e.pointerId)
}

function startResizeComponent(c: CityComponent, e: PointerEvent) {
  if (!c.footprint) return
  drag = {
    mode: 'resize-component',
    id: c.id,
    start: toPlan(e),
    ow: c.footprint.w,
    od: c.footprint.d,
  }
  svgEl.value?.setPointerCapture(e.pointerId)
}

function startBuildingPoint(c: CityComponent, index: number, e: PointerEvent) {
  // Ctrl+clic sur un sommet de bâtiment : retire le point
  if (e.ctrlKey || e.metaKey) {
    removeBuildingVertex(c, index)
    return
  }
  ensurePoly(c)
  sel.value = { kind: 'component', id: c.id }
  drag = { mode: 'building-point', id: c.id, index }
  svgEl.value?.setPointerCapture(e.pointerId)
}

function startMoveZone(id: string, e: PointerEvent) {
  const z = store.zones.find((z) => z.id === id)
  if (!z) return
  sel.value = { kind: 'zone', id }
  drag = {
    mode: 'move-zone',
    id,
    start: toPlan(e),
    orig: { x: z.x, y: z.y },
    origPoly: z.poly ? z.poly.map((pt) => ({ ...pt })) : null,
  }
  svgEl.value?.setPointerCapture(e.pointerId)
}

function startZonePoint(z: Zone, index: number, e: PointerEvent) {
  // Ctrl+clic sur un sommet de zone : retire le point
  if (e.ctrlKey || e.metaKey) {
    removeZoneVertex(z, index)
    return
  }
  sel.value = { kind: 'zone', id: z.id }
  drag = { mode: 'zone-point', id: z.id, index }
  svgEl.value?.setPointerCapture(e.pointerId)
}

function startResizeZone(id: string, e: PointerEvent) {
  const z = store.zones.find((z) => z.id === id)
  if (!z) return
  drag = { mode: 'resize-zone', id, start: toPlan(e), ow: z.w, od: z.d }
  svgEl.value?.setPointerCapture(e.pointerId)
}

function startMoveRoad(id: string, e: PointerEvent) {
  const r = store.roads.find((r) => r.id === id)
  if (!r) return
  sel.value = { kind: 'road', id }
  drag = { mode: 'move-road', id, start: toPlan(e), orig: r.points.map((p) => ({ x: p.x, y: p.y })) }
  svgEl.value?.setPointerCapture(e.pointerId)
}

function startRoadPoint(id: string, index: number, e: PointerEvent) {
  // Ctrl+clic : sélectionne/désélectionne le sommet (pour courber entre sommets)
  if (e.ctrlKey || e.metaKey) {
    sel.value = { kind: 'road', id }
    const next = new Set(selectedVerts.value)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    selectedVerts.value = next
    return
  }
  sel.value = { kind: 'road', id }
  drag = { mode: 'road-point', id, index }
  svgEl.value?.setPointerCapture(e.pointerId)
}

function startMoveCrosswalk(id: string, e: PointerEvent) {
  const c = store.crosswalks.find((c) => c.id === id)
  if (!c) return
  sel.value = { kind: 'crosswalk', id }
  drag = { mode: 'move-crosswalk', id, start: toPlan(e), orig: { x: c.x, y: c.y } }
  svgEl.value?.setPointerCapture(e.pointerId)
}

function startMoveTree(id: string, e: PointerEvent) {
  const t = store.trees.find((t) => t.id === id)
  if (!t) return
  sel.value = { kind: 'tree', id }
  drag = { mode: 'move-tree', id, start: toPlan(e), orig: { x: t.x, y: t.y } }
  svgEl.value?.setPointerCapture(e.pointerId)
}

/* ---------------------------------------------
   Formes de bâtiments (polygones, rotation)
--------------------------------------------- */

function ensurePoly(c: CityComponent): Point[] {
  if (!c.poly || c.poly.length < 3) {
    c.poly = buildingOutline(c).map((p) => ({ ...p }))
  }
  return c.poly
}

function syncFootprint(c: CityComponent) {
  if (!c.poly || !c.footprint) return
  const xs = c.poly.map((p) => p.x)
  const ys = c.poly.map((p) => p.y)
  c.footprint.x = Math.min(...xs)
  c.footprint.y = Math.min(...ys)
  c.footprint.w = Math.max(...xs) - c.footprint.x
  c.footprint.d = Math.max(...ys) - c.footprint.y
}

function rotateBuilding(c: CityComponent, deg: number) {
  const poly = ensurePoly(c)
  const cen = polygonCentroid(poly)
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  c.poly = poly.map((p) => ({
    x: Math.round(cen.x + (p.x - cen.x) * cos - (p.y - cen.y) * sin),
    y: Math.round(cen.y + (p.x - cen.x) * sin + (p.y - cen.y) * cos),
  }))
  syncFootprint(c)
}

/**
 * Rectangle minimal orienté (« rotating calipers » simplifié) englobant le
 * contour : on teste chaque arête comme axe candidat et on garde celle qui
 * minimise l'aire. Permet de « reprendre un rectangle » sans perdre l'angle
 * actuel ni gonfler la taille jusqu'à la bounding box axe-alignée.
 */
function minAreaRect(pts: Point[]): Point[] {
  let best: Point[] | null = null
  let bestArea = Infinity
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % n]!
    let ux = b.x - a.x
    let uy = b.y - a.y
    const len = Math.hypot(ux, uy)
    if (len < 1e-6) continue
    ux /= len
    uy /= len
    // axe perpendiculaire
    const vx = -uy
    const vy = ux
    let minU = Infinity
    let maxU = -Infinity
    let minV = Infinity
    let maxV = -Infinity
    for (const p of pts) {
      const pu = p.x * ux + p.y * uy
      const pv = p.x * vx + p.y * vy
      if (pu < minU) minU = pu
      if (pu > maxU) maxU = pu
      if (pv < minV) minV = pv
      if (pv > maxV) maxV = pv
    }
    const area = (maxU - minU) * (maxV - minV)
    if (area < bestArea) {
      bestArea = area
      // 4 coins reprojetés dans le repère plan
      const corners: [number, number][] = [
        [minU, minV],
        [maxU, minV],
        [maxU, maxV],
        [minU, maxV],
      ]
      best = corners.map(([u, v]) => ({
        x: Math.round(u * ux + v * vx),
        y: Math.round(u * uy + v * vy),
      }))
    }
  }
  return best ?? pts.map((p) => ({ ...p }))
}

/**
 * « Reprendre un rectangle » : si le contour est déjà rectangulaire (4 sommets),
 * on le réduit à son rectangle minimal orienté pour conserver l'angle. Sinon on
 * revient au rectangle axe-aligné du footprint.
 */
function resetBuildingShape(c: CityComponent) {
  if (c.poly && c.poly.length >= 3) {
    c.poly = minAreaRect(c.poly)
    syncFootprint(c)
  } else {
    delete c.poly
  }
}

/** Rectangle axe-aligné : revient au footprint sans rotation (perd l'angle). */
function resetBuildingAxisAligned(c: CityComponent) {
  delete c.poly
}

function addBuildingVertex(c: CityComponent) {
  const poly = ensurePoly(c)
  // insère au milieu de l'arête la plus longue
  let best = 0
  let bestLen = -1
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len > bestLen) {
      bestLen = len
      best = i
    }
  }
  const a = poly[best]!
  const b = poly[(best + 1) % poly.length]!
  poly.splice(best + 1, 0, { x: S((a.x + b.x) / 2), y: S((a.y + b.y) / 2) })
}

function insertBuildingVertexAt(c: CityComponent, e: MouseEvent) {
  const poly = ensurePoly(c)
  const p = toPlan(e)
  let best = 0
  let bestDist = Infinity
  let bestProj: Point = p
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2))
    const proj = { x: a.x + abx * t, y: a.y + aby * t }
    const dist = Math.hypot(p.x - proj.x, p.y - proj.y)
    if (dist < bestDist) {
      bestDist = dist
      best = i
      bestProj = proj
    }
  }
  poly.splice(best + 1, 0, { x: S(bestProj.x), y: S(bestProj.y) })
  sel.value = { kind: 'component', id: c.id }
}

function removeBuildingVertex(c: CityComponent, index: number) {
  if (!c.poly || c.poly.length <= 3) return
  c.poly.splice(index, 1)
  syncFootprint(c)
}

function outlineStr(c: CityComponent): string {
  return buildingOutline(c)
    .map((p) => `${p.x},${p.y}`)
    .join(' ')
}

/* ---------------------------------------------
   Formes de zones (polygones, diagonales)
--------------------------------------------- */

function zoneOutlineStr(z: Zone): string {
  return zoneOutline(z)
    .map((p) => `${p.x},${p.y}`)
    .join(' ')
}

function ensureZonePoly(z: Zone): Point[] {
  if (!z.poly || z.poly.length < 3) {
    z.poly = zoneOutline(z).map((p) => ({ ...p }))
  }
  return z.poly
}

/** Met à jour la bounding box (x/y/w/d) d'après le contour libre. */
function syncZoneRect(z: Zone) {
  if (!z.poly) return
  const xs = z.poly.map((p) => p.x)
  const ys = z.poly.map((p) => p.y)
  z.x = Math.min(...xs)
  z.y = Math.min(...ys)
  z.w = Math.max(...xs) - z.x
  z.d = Math.max(...ys) - z.y
}

function addZoneVertex(z: Zone) {
  const poly = ensureZonePoly(z)
  let best = 0
  let bestLen = -1
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len > bestLen) {
      bestLen = len
      best = i
    }
  }
  const a = poly[best]!
  const b = poly[(best + 1) % poly.length]!
  poly.splice(best + 1, 0, { x: S((a.x + b.x) / 2), y: S((a.y + b.y) / 2) })
}

function insertZoneVertexAt(z: Zone, e: MouseEvent) {
  const poly = ensureZonePoly(z)
  const p = toPlan(e)
  let best = 0
  let bestDist = Infinity
  let bestProj: Point = p
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!
    const b = poly[(i + 1) % poly.length]!
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2))
    const proj = { x: a.x + abx * t, y: a.y + aby * t }
    const dist = Math.hypot(p.x - proj.x, p.y - proj.y)
    if (dist < bestDist) {
      bestDist = dist
      best = i
      bestProj = proj
    }
  }
  poly.splice(best + 1, 0, { x: S(bestProj.x), y: S(bestProj.y) })
  sel.value = { kind: 'zone', id: z.id }
}

function removeZoneVertex(z: Zone, index: number) {
  if (!z.poly || z.poly.length <= 3) return
  z.poly.splice(index, 1)
  syncZoneRect(z)
}

/** Revient à un rectangle droit (perd les diagonales). */
function resetZoneShape(z: Zone) {
  delete z.poly
}

/* ---------------------------------------------
   Sommets de route (insertion, lissage par sommet)
--------------------------------------------- */

/** Insère un sommet sur la route au point double-cliqué (segment le plus proche). */
function insertVertexAt(id: string, e: MouseEvent) {
  const r = store.roads.find((r) => r.id === id)
  if (!r) return
  const p = toPlan(e)
  let best = 0
  let bestDist = Infinity
  let bestProj: Point = p
  for (let i = 0; i < r.points.length - 1; i++) {
    const a = r.points[i]!
    const b = r.points[i + 1]!
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2))
    const proj = { x: a.x + abx * t, y: a.y + aby * t }
    const dist = Math.hypot(p.x - proj.x, p.y - proj.y)
    if (dist < bestDist) {
      bestDist = dist
      best = i
      bestProj = proj
    }
  }
  r.points.splice(best + 1, 0, { x: S(bestProj.x), y: S(bestProj.y) })
  sel.value = { kind: 'road', id }
}

function addRoadVertex() {
  const r = selRoad.value
  if (!r) return
  let best = 0
  let bestLen = -1
  for (let i = 0; i < r.points.length - 1; i++) {
    const len = Math.hypot(
      r.points[i + 1]!.x - r.points[i]!.x,
      r.points[i + 1]!.y - r.points[i]!.y,
    )
    if (len > bestLen) {
      bestLen = len
      best = i
    }
  }
  const mid = {
    x: S((r.points[best]!.x + r.points[best + 1]!.x) / 2),
    y: S((r.points[best]!.y + r.points[best + 1]!.y) / 2),
  }
  r.points.splice(best + 1, 0, mid)
  selectedVerts.value = new Set() // les indices ont changé
}

function removeRoadVertex() {
  const r = selRoad.value
  if (!r || r.points.length <= 2) return
  r.points.splice(Math.floor(r.points.length / 2), 1)
  selectedVerts.value = new Set() // les indices ont changé
}

/** Sommets sélectionnés (Ctrl+clic) sur la route en cours d'édition. */
const selectedVerts = ref<Set<number>>(new Set())

// Ne vide la sélection de sommets que si l'on change réellement d'élément
// (un Ctrl+clic réassigne sel.value sur la même route sans devoir réinitialiser).
watch(
  () => (sel.value ? `${sel.value.kind}:${sel.value.id}` : null),
  () => {
    selectedVerts.value = new Set()
  },
)

/**
 * Courbe (ou casse) la route entre les sommets sélectionnés :
 * tous les sommets intérieurs de la plage [min..max] sont lissés.
 */
function smoothSelection(road: Road, smooth: boolean) {
  const idx = [...selectedVerts.value].sort((a, b) => a - b)
  if (!idx.length) return
  const lo = Math.max(1, idx[0]!)
  const hi = Math.min(road.points.length - 2, idx[idx.length - 1]!)
  for (let i = lo; i <= hi; i++) road.points[i]!.smooth = smooth
}

function setAllSmooth(road: Road, smooth: boolean) {
  road.points.forEach((p, i) => {
    if (i > 0 && i < road.points.length - 1) p.smooth = smooth
  })
}

/* ---------------------------------------------
   Copier / coller
--------------------------------------------- */

let clipboard: { kind: SelKind; data: unknown } | null = null

function jsonClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function copySelected() {
  if (!sel.value) return
  const { kind, id } = sel.value
  let data: unknown = null
  if (kind === 'component') data = store.components.find((c) => c.id === id)
  else if (kind === 'road') data = store.roads.find((r) => r.id === id)
  else if (kind === 'zone') data = store.zones.find((z) => z.id === id)
  else if (kind === 'crosswalk') data = store.crosswalks.find((c) => c.id === id)
  else if (kind === 'tree') data = store.trees.find((t) => t.id === id)
  if (data) clipboard = { kind, data: jsonClone(data) }
}

const KIND_PREFIX: Record<string, string> = {
  building: 'bat',
  parking: 'parc',
  'traffic-light': 'feu',
  barrier: 'bar',
  lamp: 'lamp',
}

function pasteClipboard() {
  if (!clipboard) return
  const OFF = 30

  if (clipboard.kind === 'component') {
    const c = jsonClone(clipboard.data as CityComponent)
    c.id = uid(KIND_PREFIX[c.kind] ?? 'comp')
    c.name = `${c.name} (copie)`
    if (c.footprint) {
      c.footprint.x += OFF
      c.footprint.y += OFF
    }
    if (c.poly) c.poly = c.poly.map((p) => ({ x: p.x + OFF, y: p.y + OFF }))
    if (c.point) {
      c.point.x += OFF
      c.point.y += OFF
    }
    store.addComponent(c)
    sel.value = { kind: 'component', id: c.id }
  } else if (clipboard.kind === 'road') {
    const r = jsonClone(clipboard.data as Road)
    r.id = uid('route')
    r.points = r.points.map((p) => ({ ...p, x: p.x + OFF, y: p.y + OFF }))
    store.addRoad(r)
    sel.value = { kind: 'road', id: r.id }
  } else if (clipboard.kind === 'zone') {
    const z = jsonClone(clipboard.data as Zone)
    z.id = uid('zone')
    z.x += OFF
    z.y += OFF
    store.addZone(z)
    sel.value = { kind: 'zone', id: z.id }
  } else if (clipboard.kind === 'crosswalk') {
    const c = jsonClone(clipboard.data as Crosswalk)
    c.id = uid('cw')
    c.x += OFF
    c.y += OFF
    store.addCrosswalk(c)
    sel.value = { kind: 'crosswalk', id: c.id }
  } else if (clipboard.kind === 'tree') {
    const t = jsonClone(clipboard.data as TreeItem)
    t.id = uid('tree')
    t.x += OFF
    t.y += OFF
    store.addTree(t)
    sel.value = { kind: 'tree', id: t.id }
  }
}

/* ---------------------------------------------
   Import / export / modules
--------------------------------------------- */

const importInput = ref<HTMLInputElement | null>(null)

async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const error = store.importLayout(await file.text())
  if (error) window.alert(error)
  input.value = ''
  sel.value = null
}

/** Emplacements libres adjacents aux plateaux (boutons « + »). */
const moduleAddSpots = computed(() => {
  const occupied = new Set(store.modules.map((m) => `${m.x},${m.y}`))
  const seen = new Set<string>()
  const spots: { x: number; y: number; cx: number; cy: number }[] = []
  for (const m of store.modules) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = m.x + dx
      const ny = m.y + dy
      const key = `${nx},${ny}`
      if (occupied.has(key) || seen.has(key)) continue
      seen.add(key)
      spots.push({
        x: nx,
        y: ny,
        cx: m.x * 1000 + 500 + dx * 600,
        cy: m.y * 1000 + 500 + dy * 600,
      })
    }
  }
  return spots
})

/* ---------------------------------------------
   Clavier & divers
--------------------------------------------- */

/** Vrai tant que Ctrl/⌘ est enfoncé : sert au feedback curseur sur les sommets. */
const ctrlHeld = ref(false)

function onKeyState(e: KeyboardEvent) {
  ctrlHeld.value = e.ctrlKey || e.metaKey
}

function onKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    copySelected()
    return
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    e.preventDefault()
    pasteClipboard()
    return
  }
  if (e.key === 'Delete' || e.key === 'Backspace') removeSelected()
  if (e.key === 'Escape') {
    sel.value = null
    tool.value = 'select'
  }
}

onMounted(() => {
  store.init()
  window.addEventListener('keydown', onKey)
  window.addEventListener('keydown', onKeyState)
  window.addEventListener('keyup', onKeyState)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keydown', onKeyState)
  window.removeEventListener('keyup', onKeyState)
})

function confirmReset() {
  if (window.confirm('Restaurer le plan par défaut ? Vos modifications seront perdues.')) {
    store.resetLayout()
    sel.value = null
  }
}

function num(e: Event): number {
  return Number((e.target as HTMLInputElement).value) || 0
}

/** Modifier X/Y d'un bâtiment dont la forme est libre = translation du contour. */
function patchBuildingPos(c: CityComponent, key: 'x' | 'y', value: number) {
  if (!c.footprint) return
  const delta = value - c.footprint[key]
  c.footprint[key] = value
  if (c.poly) {
    c.poly = c.poly.map((p) => ({ ...p, [key]: p[key] + delta }))
  }
}

/** Modifier X/Y d'une zone à contour libre = translation du contour. */
function patchZonePos(z: Zone, key: 'x' | 'y', value: number) {
  const delta = value - z[key]
  z[key] = value
  if (z.poly) {
    z.poly = z.poly.map((p) => ({ ...p, [key]: p[key] + delta }))
  }
}

const BUILDING_FILL: Record<string, string> = {
  si: '#2e2747',
  house: '#232031',
  default: '#272430',
}

function buildingFill(c: CityComponent): string {
  if (c.si) return BUILDING_FILL.si!
  if (c.category === 'Résidentiel') return BUILDING_FILL.house!
  return BUILDING_FILL.default!
}

function isSelected(kind: SelKind, id: string): boolean {
  return sel.value?.kind === kind && sel.value.id === id
}

const flatBuildings = computed(() =>
  store.components.filter((c) => (c.kind === 'building' || c.kind === 'parking') && c.footprint),
)

const pointComponents = computed(() => store.components.filter((c) => c.point))

/** Peinture du réseau routier (couches fusionnées aux jonctions). */
const roadPaint = computed(() => roadNetworkPaint(store.roads, store.intersections))

/** Lignes d'arrêt au sol (parité visuelle avec la carte). */
const stopLines = computed(() =>
  store.intersections
    .filter((it) => it.control === 'stop')
    .flatMap((it) => intersectionStopLines(it, store.roads)),
)

/** Octogone STOP centré sur l'origine (marqueur d'intersection). */
const OCT_POINTS = Array.from({ length: 8 }, (_, i) => {
  const a = Math.PI / 8 + (i * Math.PI) / 4
  return `${(Math.cos(a) * 6).toFixed(2)},${(Math.sin(a) * 6).toFixed(2)}`
}).join(' ')
</script>

<template>
  <div class="editor">
    <!-- ============ Barre d'outils ============ -->
    <header class="card editor__toolbar">
      <div class="editor__tools">
        <button
          v-for="t in TOOLS"
          :key="t.id"
          class="tool"
          :class="{ active: tool === t.id }"
          @click="tool = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="editor__options">
        <select v-if="tool === 'road'" v-model="roadType" class="editor-select">
          <option value="standard">Route standard</option>
          <option value="pietonne">Voie piétonne</option>
          <option value="tram">2×2 voies + tram</option>
        </select>
        <select v-if="tool === 'zone'" v-model="zoneType" class="editor-select">
          <option v-for="(label, zt) in ZONE_LABELS" :key="zt" :value="zt">{{ label }}</option>
        </select>
        <label class="editor__snap">
          <input v-model="snap" type="checkbox" />
          Magnétisme (10)
        </label>
        <button class="tool" @click="resetView">Recentrer</button>
        <button class="tool" @click="importInput?.click()">Importer JSON</button>
        <button class="tool" @click="store.exportLayout()">Exporter JSON</button>
        <button class="tool tool--danger" @click="confirmReset">Réinitialiser</button>
        <input
          ref="importInput"
          type="file"
          accept="application/json,.json"
          class="editor__file"
          @change="onImportFile"
        />
      </div>
    </header>

    <div class="editor__layout">
      <!-- ============ Canvas 2D ============ -->
      <section class="card editor__canvas-card">
        <header class="editor__canvas-head">
          <h2 class="card-title">Plan 2D — édition</h2>
          <span class="editor__hint">
            {{
              tool === 'select'
                ? 'Glisser = déplacer · double-clic route/bâtiment = + sommet · Ctrl+clic sur les sommets d’une route = sélection pour courber · Ctrl+C/V = copier-coller'
                : tool === 'building' || tool === 'zone' || tool === 'parking'
                  ? 'Tracez un rectangle en glissant'
                  : tool === 'road'
                    ? 'Glissez du point de départ au point d’arrivée'
                    : 'Cliquez sur le plan pour placer l’élément'
            }}
          </span>
        </header>

        <div class="editor__viewport">
          <svg
            ref="svgEl"
            :viewBox="`${VB.x} ${VB.y} ${VB.w} ${VB.h}`"
            class="editor__svg"
            :class="{ 'is-placing': tool !== 'select' }"
            @pointerdown="onCanvasDown"
            @pointermove="onCanvasMove"
            @pointerup="onCanvasUp"
            @pointercancel="onCanvasUp"
            @wheel.prevent="onWheel"
          >
            <g :transform="`translate(${view.x} ${view.y}) scale(${view.scale})`">
              <!-- Plateaux de maquette -->
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

              <!-- Boutons d'extension de la maquette (+1 m × 1 m) -->
              <g
                v-for="spot in moduleAddSpots"
                :key="`spot-${spot.x}-${spot.y}`"
                class="module-add"
                :transform="`translate(${spot.cx} ${spot.cy})`"
                @pointerdown.stop
                @click.stop="store.addModule({ x: spot.x, y: spot.y })"
              >
                <title>Ajouter un plateau de maquette 1 m × 1 m</title>
                <circle r="30" fill="rgba(94,43,255,0.12)" stroke="#8b66ff" stroke-dasharray="6 5" />
                <path d="M -12 0 H 12 M 0 -12 V 12" stroke="#8b66ff" stroke-width="3.5" stroke-linecap="round" />
              </g>

              <!-- Retrait d'un plateau (impossible sur le dernier) -->
              <g
                v-for="(m, i) in store.modules.length > 1 ? store.modules : []"
                :key="'rm' + i"
                class="module-remove"
                :transform="`translate(${m.x * 1000 + 985} ${m.y * 1000 + 15})`"
                @pointerdown.stop
                @click.stop="store.removeModule(m)"
              >
                <title>Retirer ce plateau 1 m × 1 m</title>
                <circle r="17" fill="#1c1925" stroke="rgba(255,77,109,0.6)" stroke-dasharray="4 3" />
                <path d="M -6 -6 L 6 6 M 6 -6 L -6 6" stroke="#ff4d6d" stroke-width="2.5" stroke-linecap="round" />
              </g>

              <g :pointer-events="tool === 'select' ? 'auto' : 'none'">
                <!-- Zones -->
                <template v-for="z in store.zones" :key="z.id">
                  <rect
                    v-if="!z.poly"
                    :x="z.x"
                    :y="z.y"
                    :width="z.w"
                    :height="z.d"
                    :rx="ZONE_STYLE[z.type].rx"
                    :fill="ZONE_STYLE[z.type].fill"
                    :stroke="isSelected('zone', z.id) ? '#8b66ff' : (ZONE_STYLE[z.type].stroke ?? 'none')"
                    :stroke-width="isSelected('zone', z.id) ? 2 : 1"
                    :stroke-dasharray="isSelected('zone', z.id) ? '8 6' : z.type === 'technique' ? '10 8' : undefined"
                    class="grabbable"
                    @pointerdown.stop="startMoveZone(z.id, $event)"
                    @dblclick.stop="insertZoneVertexAt(z, $event)"
                  />
                  <polygon
                    v-else
                    :points="zoneOutlineStr(z)"
                    :fill="ZONE_STYLE[z.type].fill"
                    :stroke="isSelected('zone', z.id) ? '#8b66ff' : (ZONE_STYLE[z.type].stroke ?? 'none')"
                    :stroke-width="isSelected('zone', z.id) ? 2 : 1"
                    :stroke-dasharray="isSelected('zone', z.id) ? '8 6' : z.type === 'technique' ? '10 8' : undefined"
                    stroke-linejoin="round"
                    class="grabbable"
                    @pointerdown.stop="startMoveZone(z.id, $event)"
                    @dblclick.stop="insertZoneVertexAt(z, $event)"
                  />
                </template>

                <!-- Voirie (couches fusionnées aux jonctions) -->
                <g fill="none" stroke-linecap="round" stroke-linejoin="round" pointer-events="none">
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

                <!-- Pistes de clic des routes + contour de sélection -->
                <g fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <template v-for="road in store.roads" :key="road.id">
                    <path
                      :d="pathFrom(roadPolyline(road))"
                      stroke="transparent"
                      :stroke-width="road.width + 14"
                      class="grabbable"
                      pointer-events="stroke"
                      @pointerdown.stop="startMoveRoad(road.id, $event)"
                      @dblclick.stop="insertVertexAt(road.id, $event)"
                    />
                    <path
                      v-if="isSelected('road', road.id)"
                      :d="pathFrom(roadPolyline(road))"
                      stroke="#8b66ff"
                      :stroke-width="road.width + 12"
                      stroke-opacity="0.35"
                      stroke-dasharray="14 10"
                      pointer-events="none"
                    />
                  </template>
                </g>

                <!-- Lignes d'arrêt (intersections « stop ») -->
                <g stroke="#f2f2f2" stroke-opacity="0.35" stroke-width="5" stroke-linecap="round" pointer-events="none">
                  <line v-for="(l, i) in stopLines" :key="i" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" />
                </g>

                <!-- Passages piétons -->
                <g
                  v-for="cw in store.crosswalks"
                  :key="cw.id"
                  :transform="`translate(${cw.x} ${cw.y}) rotate(${cw.angle})`"
                  class="grabbable"
                  @pointerdown.stop="startMoveCrosswalk(cw.id, $event)"
                >
                  <rect
                    :x="-26"
                    :y="-cw.span / 2 - 6"
                    width="52"
                    :height="cw.span + 12"
                    fill="transparent"
                    :stroke="isSelected('crosswalk', cw.id) ? '#8b66ff' : 'none'"
                    stroke-dasharray="6 5"
                  />
                  <line
                    v-for="sy in crosswalkStripes(cw.span)"
                    :key="sy"
                    x1="-21"
                    :y1="sy"
                    x2="21"
                    :y2="sy"
                    stroke="#f2f2f2"
                    stroke-opacity="0.3"
                    stroke-width="4.5"
                  />
                </g>

                <!-- Bâtiments & parkings (vue à plat) -->
                <g v-for="c in flatBuildings" :key="c.id" class="grabbable" @pointerdown.stop="startMoveComponent(c, $event)">
                  <rect
                    v-if="c.kind === 'parking'"
                    :x="c.footprint!.x"
                    :y="c.footprint!.y"
                    :width="c.footprint!.w"
                    :height="c.footprint!.d"
                    rx="6"
                    fill="#15131e"
                    :stroke="isSelected('component', c.id) ? '#8b66ff' : 'rgba(242,242,242,0.12)'"
                    :stroke-width="isSelected('component', c.id) ? 2.5 : 1"
                  />
                  <polygon
                    v-else
                    :points="outlineStr(c)"
                    :fill="buildingFill(c)"
                    :stroke="
                      isSelected('component', c.id)
                        ? '#8b66ff'
                        : c.si
                          ? 'rgba(139,102,255,0.4)'
                          : 'rgba(242,242,242,0.12)'
                    "
                    :stroke-width="isSelected('component', c.id) ? 2.5 : 1"
                    stroke-linejoin="round"
                    @dblclick.stop="insertBuildingVertexAt(c, $event)"
                  />
                  <text
                    v-if="c.category !== 'Résidentiel'"
                    :x="c.footprint!.x + c.footprint!.w / 2"
                    :y="c.footprint!.y + c.footprint!.d / 2 + 5"
                    text-anchor="middle"
                    class="editor__bld-label"
                  >
                    {{ c.name.toUpperCase() }}
                  </text>
                  <!-- poignée de redimensionnement (forme rectangulaire uniquement) -->
                  <rect
                    v-if="isSelected('component', c.id) && !c.poly"
                    :x="c.footprint!.x + c.footprint!.w - 7"
                    :y="c.footprint!.y + c.footprint!.d - 7"
                    width="14"
                    height="14"
                    fill="#8b66ff"
                    stroke="#0a0908"
                    class="handle"
                    @pointerdown.stop="startResizeComponent(c, $event)"
                  />
                  <!-- sommets éditables du contour -->
                  <template v-if="isSelected('component', c.id) && c.poly && c.kind === 'building'">
                    <circle
                      v-for="(pt, i) in c.poly"
                      :key="i"
                      :cx="pt.x"
                      :cy="pt.y"
                      r="8"
                      fill="#8b66ff"
                      stroke="#0a0908"
                      stroke-width="2"
                      class="handle"
                      @pointerdown.stop="startBuildingPoint(c, i, $event)"
                      @dblclick.stop="removeBuildingVertex(c, i)"
                    />
                  </template>
                </g>

                <!-- Éléments ponctuels -->
                <g
                  v-for="c in pointComponents"
                  :key="c.id"
                  :transform="`translate(${c.point!.x} ${c.point!.y})`"
                  class="grabbable"
                  @pointerdown.stop="startMoveComponent(c, $event)"
                >
                  <circle
                    r="16"
                    fill="transparent"
                    :stroke="isSelected('component', c.id) ? '#8b66ff' : 'none'"
                    stroke-dasharray="4 4"
                  />
                  <template v-if="c.kind === 'traffic-light'">
                    <rect x="-6" y="-13" width="12" height="26" rx="3" fill="#14121c" stroke="#332e47" />
                    <circle cy="-7" r="2.6" fill="#ff4d6d" />
                    <circle cy="0" r="2.6" fill="#ffb020" />
                    <circle cy="7" r="2.6" fill="#39d98a" />
                  </template>
                  <template v-else-if="c.kind === 'barrier'">
                    <rect x="-4" y="-9" width="8" height="18" rx="2" fill="#2a2735" stroke="#3a3447" />
                    <line x1="2" y1="0" x2="26" y2="0" stroke="#f2f2f2" stroke-width="4" stroke-linecap="round" />
                    <line x1="6" y1="0" x2="26" y2="0" stroke="#ff4d6d" stroke-width="4" stroke-dasharray="5 6" stroke-linecap="round" />
                  </template>
                  <template v-else>
                    <circle r="5.5" fill="#ffe9b0" />
                    <circle r="10" fill="#ffd98a" opacity="0.15" />
                  </template>
                </g>

                <!-- Arbres -->
                <g
                  v-for="t in store.trees"
                  :key="t.id"
                  :transform="`translate(${t.x} ${t.y})`"
                  class="grabbable"
                  @pointerdown.stop="startMoveTree(t.id, $event)"
                >
                  <circle
                    r="13"
                    fill="#262040"
                    :stroke="isSelected('tree', t.id) ? '#8b66ff' : '#3b3260'"
                    :stroke-width="isSelected('tree', t.id) ? 2 : 1"
                  />
                  <circle cx="-4" cy="-4" r="3" fill="#5e2bff" opacity="0.35" />
                </g>

                <!-- Poignée de redimensionnement de zone (rectangle uniquement) -->
                <rect
                  v-if="selZone && !selZone.poly"
                  :x="selZone.x + selZone.w - 7"
                  :y="selZone.y + selZone.d - 7"
                  width="14"
                  height="14"
                  fill="#8b66ff"
                  stroke="#0a0908"
                  class="handle"
                  @pointerdown.stop="startResizeZone(selZone.id, $event)"
                />

                <!-- Sommets éditables du contour de zone -->
                <template v-if="selZone && selZone.poly">
                  <circle
                    v-for="(pt, i) in selZone.poly"
                    :key="i"
                    :cx="pt.x"
                    :cy="pt.y"
                    r="8"
                    fill="#8b66ff"
                    stroke="#0a0908"
                    stroke-width="2"
                    class="handle"
                    @pointerdown.stop="startZonePoint(selZone, i, $event)"
                    @dblclick.stop="removeZoneVertex(selZone, i)"
                  />
                </template>

                <!-- Sommets de la route sélectionnée -->
                <template v-if="selRoad">
                  <path
                    :d="pathFrom(selRoad.points)"
                    fill="none"
                    stroke="rgba(139,102,255,0.5)"
                    stroke-width="1.5"
                    stroke-dasharray="6 6"
                    pointer-events="none"
                  />
                  <circle
                    v-for="(pt, i) in selRoad.points"
                    :key="i"
                    :cx="pt.x"
                    :cy="pt.y"
                    :r="selectedVerts.has(i) ? 11 : 9"
                    :fill="pt.smooth ? '#8b66ff' : '#1c1925'"
                    :stroke="selectedVerts.has(i) ? '#39d98a' : '#8b66ff'"
                    :stroke-width="selectedVerts.has(i) ? 3.5 : 2.5"
                    :class="ctrlHeld ? 'vertex-pick' : 'vertex-move'"
                    @pointerdown.stop.prevent="startRoadPoint(selRoad.id, i, $event)"
                  />
                </template>

                <!-- Intersections détectées -->
                <g
                  v-for="it in store.intersections"
                  :key="it.id"
                  :transform="`translate(${it.x} ${it.y})`"
                  class="grabbable"
                  @pointerdown.stop="sel = { kind: 'intersection', id: it.id }"
                >
                  <circle
                    r="15"
                    fill="rgba(94,43,255,0.1)"
                    :stroke="
                      isSelected('intersection', it.id)
                        ? '#8b66ff'
                        : it.control === 'stop'
                          ? '#ff4d6d'
                          : it.control === 'feux'
                            ? '#39d98a'
                            : 'rgba(139,102,255,0.45)'
                    "
                    :stroke-width="isSelected('intersection', it.id) ? 2.5 : 1.5"
                    stroke-dasharray="5 4"
                  />
                  <polygon v-if="it.control === 'stop'" :points="OCT_POINTS" fill="#c92a45" stroke="#f2f2f2" />
                  <template v-else-if="it.control === 'feux'">
                    <circle cy="-5" r="2.2" fill="#ff4d6d" />
                    <circle r="2.2" fill="#ffb020" />
                    <circle cy="5" r="2.2" fill="#39d98a" />
                  </template>
                  <circle v-else r="3" fill="#8b66ff" />
                </g>
              </g>

              <!-- Aperçus de tracé -->
              <rect
                v-if="drawRect"
                :x="drawRect.x"
                :y="drawRect.y"
                :width="drawRect.w"
                :height="drawRect.d"
                fill="rgba(94,43,255,0.12)"
                stroke="#8b66ff"
                stroke-dasharray="8 6"
              />
              <line
                v-if="drawLine"
                :x1="drawLine.a.x"
                :y1="drawLine.a.y"
                :x2="drawLine.b.x"
                :y2="drawLine.b.y"
                stroke="#8b66ff"
                stroke-width="6"
                stroke-dasharray="12 8"
                stroke-linecap="round"
              />
            </g>
          </svg>
        </div>
      </section>

      <!-- ============ Colonne latérale ============ -->
      <aside class="editor__side">
        <!-- Inspecteur -->
        <section class="card editor__inspector">
          <header class="editor__inspector-head">
            <h2 class="card-title">Propriétés</h2>
            <button v-if="sel" class="tool tool--danger" @click="removeSelected">Supprimer</button>
          </header>

          <div v-if="selComponent" class="editor__fields">
            <label class="field">
              <span>Nom</span>
              <input :value="selComponent.name" type="text" @input="selComponent!.name = ($event.target as HTMLInputElement).value" />
            </label>
            <label class="field">
              <span>Catégorie</span>
              <input :value="selComponent.category" type="text" @change="selComponent!.category = ($event.target as HTMLInputElement).value" />
            </label>
            <label v-if="selComponent.kind === 'building' || selComponent.kind === 'parking'" class="field field--inline">
              <input
                type="checkbox"
                :checked="selComponent.si === true"
                @change="selComponent!.si = ($event.target as HTMLInputElement).checked"
              />
              <span>Héberge un SI (cible CTF)</span>
            </label>

            <template v-if="selComponent.footprint">
              <div class="field-grid">
                <label class="field"><span>X</span><input type="number" :value="selComponent.footprint.x" @change="patchBuildingPos(selComponent!, 'x', num($event))" /></label>
                <label class="field"><span>Y</span><input type="number" :value="selComponent.footprint.y" @change="patchBuildingPos(selComponent!, 'y', num($event))" /></label>
                <label v-if="!selComponent.poly" class="field"><span>Largeur</span><input type="number" :value="selComponent.footprint.w" @change="selComponent!.footprint!.w = Math.max(20, num($event))" /></label>
                <label v-if="!selComponent.poly" class="field"><span>Profondeur</span><input type="number" :value="selComponent.footprint.d" @change="selComponent!.footprint!.d = Math.max(20, num($event))" /></label>
                <label v-if="selComponent.kind === 'building'" class="field"><span>Hauteur</span><input type="number" :value="selComponent.footprint.h" @change="selComponent!.footprint!.h = Math.max(0, num($event))" /></label>
              </div>

              <template v-if="selComponent.kind === 'building'">
                <div class="field">
                  <span>Rotation</span>
                  <div class="field-row">
                    <button class="tool" @click="rotateBuilding(selComponent!, -90)">−90°</button>
                    <button class="tool" @click="rotateBuilding(selComponent!, -15)">−15°</button>
                    <button class="tool" @click="rotateBuilding(selComponent!, 15)">+15°</button>
                    <button class="tool" @click="rotateBuilding(selComponent!, 90)">+90°</button>
                  </div>
                </div>
                <div class="field">
                  <span>Forme du contour</span>
                  <div class="field-row">
                    <button class="tool" @click="addBuildingVertex(selComponent!)">+ Point</button>
                    <button class="tool" :disabled="!selComponent.poly" @click="resetBuildingShape(selComponent!)">Rectangle</button>
                    <button class="tool" :disabled="!selComponent.poly" @click="resetBuildingAxisAligned(selComponent!)">Rectangle droit</button>
                  </div>
                </div>
                <p class="editor__tip">
                  Double-cliquez sur un mur pour ajouter un point, glissez les points pour créer des
                  murs en diagonale, Ctrl+clic sur un point pour le retirer. « Rectangle » resimplifie
                  le contour en gardant l'angle actuel ; « Rectangle droit » remet d'aplomb.
                </p>
              </template>
            </template>
            <template v-else-if="selComponent.point">
              <div class="field-grid">
                <label class="field"><span>X</span><input type="number" :value="selComponent.point.x" @change="selComponent!.point!.x = num($event)" /></label>
                <label class="field"><span>Y</span><input type="number" :value="selComponent.point.y" @change="selComponent!.point!.y = num($event)" /></label>
              </div>
            </template>
          </div>

          <div v-else-if="selRoad" class="editor__fields">
            <label class="field">
              <span>Nom</span>
              <input :value="selRoad.name ?? ''" type="text" @change="selRoad!.name = ($event.target as HTMLInputElement).value" />
            </label>
            <label class="field">
              <span>Type</span>
              <select :value="selRoad.type" class="editor-select" @change="selRoad!.type = ($event.target as HTMLSelectElement).value as RoadType">
                <option value="standard">Route standard</option>
                <option value="pietonne">Voie piétonne</option>
                <option value="tram">2×2 voies + tram</option>
              </select>
            </label>
            <label class="field">
              <span>Largeur</span>
              <input type="number" :value="selRoad.width" @change="selRoad!.width = Math.max(8, num($event))" />
            </label>
            <label class="field field--inline">
              <input
                type="checkbox"
                :checked="selRoad.dashed !== false"
                @change="selRoad!.dashed = ($event.target as HTMLInputElement).checked"
              />
              <span>Marquage axial (pointillés)</span>
            </label>
            <div class="field">
              <span>Sommets</span>
              <div class="field-row">
                <button class="tool" @click="addRoadVertex">+ Sommet</button>
                <button class="tool" :disabled="selRoad.points.length <= 2" @click="removeRoadVertex">− Sommet</button>
              </div>
            </div>
            <div class="field">
              <span>Courbes — {{ selectedVerts.size }} sommet(s) sélectionné(s) (Ctrl+clic)</span>
              <div class="field-row">
                <button class="tool" :disabled="selectedVerts.size === 0" @click="smoothSelection(selRoad!, true)">
                  Courber entre les sommets
                </button>
                <button class="tool" :disabled="selectedVerts.size === 0" @click="smoothSelection(selRoad!, false)">
                  Casser en angles
                </button>
              </div>
              <div class="field-row">
                <button class="tool" @click="setAllSmooth(selRoad!, true)">Tout lisser</button>
                <button class="tool" @click="setAllSmooth(selRoad!, false)">Tout en angle</button>
              </div>
            </div>
            <p class="editor__tip">
              Ctrl+clic sur les sommets (cerclés de vert) puis « Courber entre les sommets » :
              toute la plage entre le premier et le dernier sélectionné est lissée (sommet plein =
              lissé). Double-clic sur la route = nouveau sommet. Les extrémités restent des angles.
            </p>
          </div>

          <div v-else-if="selIntersection" class="editor__fields">
            <p class="editor__xing">
              {{ roadName(selIntersection.a) }} <span>×</span> {{ roadName(selIntersection.b) }}
            </p>
            <label class="field">
              <span>Contrôle de l'intersection</span>
              <select
                :value="selIntersection.control"
                class="editor-select"
                @change="
                  store.setIntersectionControl(
                    selIntersection!.id,
                    ($event.target as HTMLSelectElement).value as IntersectionControl,
                  )
                "
              >
                <option v-for="(label, c) in INTERSECTION_CONTROL_LABELS" :key="c" :value="c">
                  {{ label }}
                </option>
              </select>
            </label>
            <label v-if="selIntersection.control === 'feux'" class="field">
              <span>Mode des feux</span>
              <select
                :value="selIntersection.mode"
                class="editor-select"
                @change="
                  store.setIntersectionMode(
                    selIntersection!.id,
                    ($event.target as HTMLSelectElement).value as LightMode,
                  )
                "
              >
                <option v-for="(label, m) in INTERSECTION_MODE_LABELS" :key="m" :value="m">
                  {{ label }}
                </option>
              </select>
            </label>
            <p class="editor__tip">
              Détection automatique au croisement de deux routes carrossables. « Stop » peint les
              lignes d'arrêt et pose un panneau ; « Feux » place un feu par approche, à droite du
              sens d'arrivée (conduite à droite). Chaque feu d'approche est un composant pilotable
              (supervisé et commandé depuis le tableau de bord, comme un feu posé à la main).
            </p>
          </div>

          <div v-else-if="selZone" class="editor__fields">
            <label class="field">
              <span>Type de zone</span>
              <select :value="selZone.type" class="editor-select" @change="selZone!.type = ($event.target as HTMLSelectElement).value as ZoneType">
                <option v-for="(label, zt) in ZONE_LABELS" :key="zt" :value="zt">{{ label }}</option>
              </select>
            </label>
            <div class="field-grid">
              <label class="field"><span>X</span><input type="number" :value="selZone.x" @change="patchZonePos(selZone!, 'x', num($event))" /></label>
              <label class="field"><span>Y</span><input type="number" :value="selZone.y" @change="patchZonePos(selZone!, 'y', num($event))" /></label>
              <label v-if="!selZone.poly" class="field"><span>Largeur</span><input type="number" :value="selZone.w" @change="selZone!.w = Math.max(30, num($event))" /></label>
              <label v-if="!selZone.poly" class="field"><span>Profondeur</span><input type="number" :value="selZone.d" @change="selZone!.d = Math.max(30, num($event))" /></label>
            </div>
            <div class="field">
              <span>Forme du contour</span>
              <div class="field-row">
                <button class="tool" @click="addZoneVertex(selZone!)">+ Point</button>
                <button class="tool" :disabled="!selZone.poly" @click="resetZoneShape(selZone!)">Rectangle</button>
              </div>
            </div>
            <p class="editor__tip">
              Double-cliquez sur un bord pour ajouter un point, glissez les points pour créer des
              bords diagonaux (parking en biais…), Ctrl+clic sur un point pour le retirer.
            </p>
          </div>

          <div v-else-if="selCrosswalk" class="editor__fields">
            <div class="field-grid">
              <label class="field"><span>X</span><input type="number" :value="selCrosswalk.x" @change="selCrosswalk!.x = num($event)" /></label>
              <label class="field"><span>Y</span><input type="number" :value="selCrosswalk.y" @change="selCrosswalk!.y = num($event)" /></label>
              <label class="field"><span>Angle (°)</span><input type="number" step="15" :value="selCrosswalk.angle" @change="selCrosswalk!.angle = num($event)" /></label>
              <label class="field"><span>Chaussée</span><input type="number" :value="selCrosswalk.span" @change="selCrosswalk!.span = Math.max(20, num($event))" /></label>
            </div>
            <p class="editor__tip">Angle 0 = traverse une route horizontale, 90 = verticale.</p>
          </div>

          <div v-else-if="selTree" class="editor__fields">
            <div class="field-grid">
              <label class="field"><span>X</span><input type="number" :value="selTree.x" @change="selTree!.x = num($event)" /></label>
              <label class="field"><span>Y</span><input type="number" :value="selTree.y" @change="selTree!.y = num($event)" /></label>
            </div>
          </div>

          <div v-else class="editor__empty">
            <p>
              Aucun élément sélectionné.<br />
              Choisissez un outil pour ajouter des éléments, ou cliquez sur le plan pour modifier
              l'existant. Les cercles pointillés sur les croisements sont les
              <strong>intersections détectées</strong> ; les « + » autour de la maquette ajoutent un
              plateau de 1 m × 1 m.
            </p>
            <p class="editor__tip">
              Ctrl+C / Ctrl+V = copier-coller · Suppr = supprimer · Échap = annuler · sauvegarde
              automatique.
            </p>
          </div>
        </section>

        <!-- Aperçu isométrique en direct -->
        <CityMap class="editor__preview" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  padding: var(--sp-4) var(--sp-5) var(--sp-5);
  position: relative;
  z-index: 1;
}

.editor__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  flex-wrap: wrap;
}

.editor__tools,
.editor__options {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

.tool {
  border: 1px solid var(--border-strong);
  background: var(--bg-card-2);
  color: var(--text-dim);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}

.tool:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--primary-500);
}

.tool.active {
  background: var(--primary-500);
  border-color: var(--primary-500);
  color: var(--s404-light);
}

.tool--danger:hover:not(:disabled) {
  border-color: var(--critical);
  color: var(--critical);
}

.tool:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.editor-select {
  background: var(--bg-card-2);
  border: 1px solid var(--border-strong);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 12px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
}

.editor__snap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
  cursor: pointer;
}

.editor__file {
  display: none;
}

.editor__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: var(--sp-4);
  align-items: start;
}

.editor__canvas-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor__canvas-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-4) var(--sp-4) var(--sp-3);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.editor__hint {
  font-size: 11px;
  color: var(--text-faint);
}

.editor__viewport {
  min-height: 640px;
  background: var(--bg-inset);
}

.editor__svg {
  width: 100%;
  height: 640px;
  display: block;
  cursor: grab;
  /* Empêche la sélection des labels/textes SVG lors du glisser d'un élément. */
  user-select: none;
  -webkit-user-select: none;
}

.editor__svg:active {
  cursor: grabbing;
}

.editor__svg.is-placing {
  cursor: crosshair;
}

.grabbable {
  cursor: move;
}

.handle {
  cursor: nwse-resize;
}

/* Sommets de route : déplaçables, mais sélectionnables (cercle vert) sous Ctrl. */
.vertex-move {
  cursor: grab;
}

.vertex-pick {
  cursor: copy;
}

.module-add {
  cursor: pointer;
}

.module-add:hover circle {
  fill: rgba(94, 43, 255, 0.25);
}

.module-remove {
  cursor: pointer;
}

.module-remove:hover circle {
  fill: rgba(255, 77, 109, 0.18);
}

.editor__bld-label {
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.1em;
  fill: rgba(242, 242, 242, 0.7);
  pointer-events: none;
}

.editor__side {
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 0;
}

.editor__inspector-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-4) var(--sp-3);
  border-bottom: 1px solid var(--border);
}

.editor__fields {
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--text-faint);
}

.field input[type='text'],
.field input[type='number'] {
  background: var(--bg-card-2);
  border: 1px solid var(--border-strong);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 13px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  width: 100%;
}

.field input:focus,
.editor-select:focus {
  outline: none;
  border-color: var(--primary-500);
}

.field--inline {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-dim);
  cursor: pointer;
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-2);
}

.field-row {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}

.editor__tip {
  font-size: 11px;
  color: var(--text-faint);
  font-style: italic;
}

.editor__xing {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.editor__xing span {
  color: var(--primary-300);
  margin: 0 4px;
}

.editor__empty {
  padding: var(--sp-4);
  font-size: 12px;
  color: var(--text-dim);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}

.editor__preview :deep(.city-map__viewport) {
  min-height: 320px;
}

@media (max-width: 1280px) {
  .editor__layout {
    grid-template-columns: 1fr;
  }
}
</style>
