<script setup lang="ts">
/**
 * Rendu isométrique *statique* de la ville — sans interaction (ni survol, ni
 * zoom, ni tooltip). Sert de décor (page de login). La logique de projection
 * et d'extrusion est volontairement alignée sur `CityMap.vue`, mais allégée.
 */
import { computed } from 'vue'

import {
  buildingOutline,
  polygonCentroid,
  roadNetworkPaint,
  ZONE_STYLE,
  zoneOutline,
} from '@/lib/cityRender'
import { useCityStore } from '@/stores/city'
import type { CityComponent, Footprint, Status } from '@/types/city'

const store = useCityStore()

const K = Math.sqrt(3) / 2

function P(x: number, y: number, z = 0): [number, number] {
  return [(x - y) * K, (x + y) * 0.5 - z]
}

function pts(list: [number, number][]): string {
  return list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

const groundTransform = `matrix(${K} 0.5 ${-K} 0.5 0 0)`

const viewBox = computed(() => {
  const b = store.bounds
  const x0 = (b.x0 - b.y1) * K - 50
  const x1 = (b.x1 - b.y0) * K + 50
  const y0 = (b.x0 + b.y0) / 2 - 130
  const y1 = (b.x1 + b.y1) / 2 + 60
  return `${x0.toFixed(0)} ${y0.toFixed(0)} ${(x1 - x0).toFixed(0)} ${(y1 - y0).toFixed(0)}`
})

const STATUS_COLOR: Record<Status, string> = {
  ok: '#39d98a',
  warning: '#ffb020',
  critical: '#ff4d6d',
  offline: '#6b6877',
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

interface BuildingRender {
  type: 'building'
  c: CityComponent
  status: Status
  palette: Palette
  top: string
  faces: { points: string; fill: string }[]
  marker: { x: number; y: number } | null
  depth: number
}

interface TreeRender {
  type: 'tree'
  id: string
  x: number
  y: number
  depth: number
}

type RenderItem = BuildingRender | TreeRender

const renderList = computed<RenderItem[]>(() => {
  const items: RenderItem[] = []

  for (const c of store.components) {
    if (c.kind !== 'building' || !c.footprint) continue
    const outline = buildingOutline(c)
    if (outline.length < 3) continue
    const h = c.footprint.h
    const cen = polygonCentroid(outline)
    const palette = c.si ? PALETTES.si! : c.category === 'Résidentiel' ? PALETTES.house! : PALETTES.default!
    const status = store.statusOf(c.id)

    const faces: { points: string; fill: string; depth: number }[] = []
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

    const [cx, cy] = P(cen.x, cen.y, h)
    items.push({
      type: 'building',
      c,
      status,
      palette,
      top: pts(outline.map((p) => P(p.x, p.y, h))),
      faces,
      marker: status === 'ok' ? null : { x: cx, y: cy - 22 },
      depth: cen.x + cen.y,
    })
  }

  for (const t of store.trees) {
    const [x, y] = P(t.x, t.y, 0)
    items.push({ type: 'tree', id: t.id, x, y, depth: t.x + t.y })
  }

  return items.sort((a, b) => a.depth - b.depth)
})

const roadPaint = computed(() => roadNetworkPaint(store.roads, store.intersections))

const parkings = computed(() => store.components.filter((c) => c.kind === 'parking' && c.footprint))

function parkingSlots(fp: Footprint): string {
  const lines: string[] = []
  const step = 24
  for (let sx = fp.x + 18; sx < fp.x + fp.w - 10; sx += step) {
    lines.push(`M ${sx} ${fp.y + 14} v 34`)
    lines.push(`M ${sx} ${fp.y + fp.d - 48} v 34`)
  }
  return lines.join(' ')
}

function zonePoints(z: { x: number; y: number; w: number; d: number; poly?: { x: number; y: number }[] }): string {
  return zoneOutline(z)
    .map((p) => `${p.x},${p.y}`)
    .join(' ')
}
</script>

<template>
  <svg :viewBox="viewBox" class="city-scene" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <!-- ============ SOL ============ -->
    <g :transform="groundTransform">
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
        />
        <polygon
          v-else
          :points="zonePoints(z)"
          :fill="ZONE_STYLE[z.type].fill"
          :stroke="ZONE_STYLE[z.type].stroke ?? 'none'"
          stroke-linejoin="round"
        />
      </template>

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

      <!-- Parkings (dessinés au sol) -->
      <g v-for="p in parkings" :key="p.id">
        <rect
          :x="p.footprint!.x"
          :y="p.footprint!.y"
          :width="p.footprint!.w"
          :height="p.footprint!.d"
          rx="6"
          fill="#15131e"
          stroke="#2a2640"
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
    </g>

    <!-- ============ OBJETS (bâtiments + arbres, tri peintre) ============ -->
    <template v-for="item in renderList" :key="item.type === 'tree' ? item.id : item.c.id">
      <!-- Arbre -->
      <g v-if="item.type === 'tree'" class="tree">
        <line :x1="item.x" :y1="item.y" :x2="item.x" :y2="item.y - 14" stroke="#3a3343" stroke-width="3" />
        <circle :cx="item.x" :cy="item.y - 22" r="13" fill="#262040" stroke="#3b3260" />
        <circle :cx="item.x - 4" :cy="item.y - 26" r="3" fill="#5e2bff" opacity="0.35" />
      </g>

      <!-- Bâtiment -->
      <g v-else>
        <polygon v-for="(f, i) in item.faces" :key="i" :points="f.points" :fill="f.fill" />
        <polygon
          :points="item.top"
          :fill="item.palette.top"
          :stroke="item.palette.edge"
          stroke-width="1"
          stroke-linejoin="round"
        />
        <g v-if="item.marker">
          <circle :cx="item.marker.x" :cy="item.marker.y" r="11" :fill="STATUS_COLOR[item.status]" opacity="0.22" />
          <circle
            :cx="item.marker.x"
            :cy="item.marker.y"
            r="5"
            :fill="STATUS_COLOR[item.status]"
            :class="{ pulse: item.status === 'critical' }"
          />
        </g>
      </g>
    </template>
  </svg>
</template>

<style scoped>
.city-scene {
  width: 100%;
  height: 100%;
  display: block;
}

.ground-letter {
  font-family: var(--font-title);
  font-size: 58px;
  fill: rgba(242, 242, 242, 0.07);
}

.pulse {
  animation: pulse 1.6s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
