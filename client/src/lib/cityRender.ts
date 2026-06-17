import type {
  CityComponent,
  IntersectionControl,
  LightMode,
  Point,
  Road,
  RoadIntersection,
  ZoneType,
} from '@/types/city'

/**
 * Géométrie et styles partagés entre la carte (iso/2D) et l'éditeur.
 * La voirie est peinte en « niveaux » globaux (tous les contours, puis
 * tous les asphaltes, puis les marquages…) pour que les routes fusionnent
 * proprement aux intersections au lieu de se chevaucher.
 */

export function pathFrom(points: Point[]): string {
  if (!points.length) return ''
  const [first, ...rest] = points as [Point, ...Point[]]
  return `M ${first.x} ${first.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ')
}

/* ---------------------------------------------
   Polyligne effective d'une route
   (lissage Hermite uniquement aux sommets `smooth`)
--------------------------------------------- */

export function roadPolyline(road: Road): Point[] {
  const pts = road.points
  const n = pts.length
  const hasSmooth = pts.some((p, i) => i > 0 && i < n - 1 && p.smooth)
  if (n < 3 || !hasSmooth) return pts

  const tangentAt = (i: number, fallback: Point): Point => {
    const p = pts[i]!
    if (p.smooth && i > 0 && i < n - 1) {
      return { x: (pts[i + 1]!.x - pts[i - 1]!.x) / 2, y: (pts[i + 1]!.y - pts[i - 1]!.y) / 2 }
    }
    return fallback
  }

  const out: Point[] = [{ x: pts[0]!.x, y: pts[0]!.y }]
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i]!
    const p1 = pts[i + 1]!
    const chord = { x: p1.x - p0.x, y: p1.y - p0.y }
    const m0 = tangentAt(i, chord)
    const m1 = tangentAt(i + 1, chord)
    if (!pts[i]!.smooth && !pts[i + 1]!.smooth) {
      out.push({ x: p1.x, y: p1.y })
      continue
    }
    for (let s = 1; s <= 8; s++) {
      const t = s / 8
      const t2 = t * t
      const t3 = t2 * t
      const h00 = 2 * t3 - 3 * t2 + 1
      const h10 = t3 - 2 * t2 + t
      const h01 = -2 * t3 + 3 * t2
      const h11 = t3 - t2
      out.push({
        x: h00 * p0.x + h10 * m0.x + h01 * p1.x + h11 * m1.x,
        y: h00 * p0.y + h10 * m0.y + h01 * p1.y + h11 * m1.y,
      })
    }
  }
  return out
}

/** Décale une polyligne perpendiculairement (approximation par moyenne des normales). */
export function offsetPolyline(points: Point[], offset: number): Point[] {
  const n = points.length
  if (n < 2) return points
  const segNormals: Point[] = []
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1]!.x - points[i]!.x
    const dy = points[i + 1]!.y - points[i]!.y
    const len = Math.hypot(dx, dy) || 1
    segNormals.push({ x: dy / len, y: -dx / len })
  }
  return points.map((p, i) => {
    const a = segNormals[Math.max(0, i - 1)]!
    const b = segNormals[Math.min(segNormals.length - 1, i)]!
    let nx = a.x + b.x
    let ny = a.y + b.y
    const len = Math.hypot(nx, ny) || 1
    nx /= len
    ny /= len
    return { x: p.x + nx * offset, y: p.y + ny * offset }
  })
}

/* ---------------------------------------------
   Peinture du réseau routier
--------------------------------------------- */

export interface RoadPaint {
  d: string
  stroke?: string
  width?: number
  dash?: string
  opacity?: number
  fill?: string
}

const ASPHALT = '#17151f'

function circlePath(x: number, y: number, r: number): string {
  return `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`
}

/**
 * Couches de peinture de tout le réseau, dans l'ordre :
 * contours → asphaltes → marquages → patchs de jonction → plateforme tram.
 */
export function roadNetworkPaint(
  roads: Road[],
  intersections: RoadIntersection[] = [],
): RoadPaint[] {
  const out: RoadPaint[] = []
  const polys = new Map(roads.map((r) => [r.id, roadPolyline(r)]))
  const dOf = (r: Road) => pathFrom(polys.get(r.id)!)

  // 1. contours (casing)
  for (const r of roads) {
    out.push(
      r.type === 'pietonne'
        ? { d: dOf(r), stroke: '#232030', width: r.width + 6 }
        : { d: dOf(r), stroke: '#211e2b', width: r.width + 10 },
    )
  }

  // 2. asphaltes — fusionnent aux intersections
  for (const r of roads) {
    out.push(
      r.type === 'pietonne'
        ? { d: dOf(r), stroke: '#1b1824', width: r.width }
        : { d: dOf(r), stroke: ASPHALT, width: r.width },
    )
  }

  // 3. marquages (désactivables par route)
  for (const r of roads) {
    if (r.dashed === false) continue
    if (r.type === 'pietonne') {
      out.push({ d: dOf(r), stroke: '#f2f2f2', width: 2, dash: '2 10', opacity: 0.18 })
    } else if (r.type === 'tram') {
      const poly = polys.get(r.id)!
      const off = r.width * 0.27
      out.push({ d: pathFrom(offsetPolyline(poly, off)), stroke: '#f2f2f2', width: 2, dash: '12 14', opacity: 0.12 })
      out.push({ d: pathFrom(offsetPolyline(poly, -off)), stroke: '#f2f2f2', width: 2, dash: '12 14', opacity: 0.12 })
    } else {
      out.push({ d: dOf(r), stroke: '#5e2bff', width: 2, dash: '16 20', opacity: 0.32 })
    }
  }

  // 4. patchs de jonction : effacent les marquages dans l'emprise du croisement
  for (const it of intersections) {
    out.push({ d: circlePath(it.x, it.y, Math.max(it.wa, it.wb) / 2), fill: ASPHALT })
  }

  // 5. plateforme + rails de tram (continuent à travers les jonctions)
  for (const r of roads) {
    if (r.type !== 'tram') continue
    out.push({ d: dOf(r), stroke: '#232038', width: 18 })
    out.push({ d: dOf(r), stroke: '#4a4366', width: 9 })
    out.push({ d: dOf(r), stroke: '#1d1a30', width: 5 })
  }

  return out
}

export const ZONE_STYLE: Record<ZoneType, { fill: string; stroke?: string; rx: number }> = {
  parc: { fill: '#14121d', rx: 18 },
  eau: { fill: '#181a2e', stroke: '#2c3050', rx: 36 },
  quartier: { fill: '#13111c', rx: 10 },
  esplanade: { fill: '#111016', rx: 10 },
  technique: { fill: '#16131f', stroke: 'rgba(94,43,255,0.35)', rx: 8 },
}

export const ZONE_LABELS: Record<ZoneType, string> = {
  parc: 'Parc',
  eau: 'Eau',
  quartier: 'Quartier',
  esplanade: 'Esplanade',
  technique: 'Zone technique',
}

export const ROAD_LABELS: Record<Road['type'], string> = {
  standard: 'Route',
  pietonne: 'Voie piétonne',
  tram: 'Avenue 2×2 + tram',
}

export const ROAD_DEFAULT_WIDTH: Record<Road['type'], number> = {
  standard: 52,
  pietonne: 16,
  tram: 74,
}

/** Ordonnées des bandes d'un passage piéton (centré sur 0). */
export function crosswalkStripes(span: number): number[] {
  const step = 11
  const count = Math.max(3, Math.floor(span / step))
  const start = -((count - 1) / 2) * step
  return Array.from({ length: count }, (_, i) => start + i * step)
}

/* ---------------------------------------------
   Contour d'un bâtiment (rectangle ou polygone libre)
--------------------------------------------- */

export function buildingOutline(c: CityComponent): Point[] {
  if (c.poly && c.poly.length >= 3) return c.poly
  const fp = c.footprint
  if (!fp) return []
  return [
    { x: fp.x, y: fp.y },
    { x: fp.x + fp.w, y: fp.y },
    { x: fp.x + fp.w, y: fp.y + fp.d },
    { x: fp.x, y: fp.y + fp.d },
  ]
}

/** Contour d'une zone : polygone libre s'il existe, sinon rectangle x/y/w/d. */
export function zoneOutline(z: {
  x: number
  y: number
  w: number
  d: number
  poly?: Point[]
}): Point[] {
  if (z.poly && z.poly.length >= 3) return z.poly
  return [
    { x: z.x, y: z.y },
    { x: z.x + z.w, y: z.y },
    { x: z.x + z.w, y: z.y + z.d },
    { x: z.x, y: z.y + z.d },
  ]
}

export function polygonCentroid(pts: Point[]): Point {
  const n = pts.length || 1
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / n,
    y: pts.reduce((s, p) => s + p.y, 0) / n,
  }
}

/* ---------------------------------------------
   Intersections entre routes carrossables
--------------------------------------------- */

/** Distance d'un point à une polyligne. */
export function distToPolyline(p: Point, pts: Point[]): number {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2))
    const dx = p.x - (a.x + abx * t)
    const dy = p.y - (a.y + aby * t)
    best = Math.min(best, Math.hypot(dx, dy))
  }
  return best
}

/**
 * Détecte les croisements et jonctions en T entre routes carrossables
 * (les voies piétonnes sont ignorées). Clé stable : `idA|idB|n`.
 */
export function computeIntersections(
  roads: Road[],
  controls: Record<string, IntersectionControl> = {},
  modes: Record<string, LightMode> = {},
): RoadIntersection[] {
  const drivable = roads.filter((r) => r.type !== 'pietonne')
  const result: RoadIntersection[] = []

  for (let i = 0; i < drivable.length; i++) {
    for (let j = i + 1; j < drivable.length; j++) {
      const ra = drivable[i]!
      const rb = drivable[j]!
      const pa = roadPolyline(ra)
      const pb = roadPolyline(rb)
      const hits: { x: number; y: number; ta: Point; tb: Point }[] = []

      for (let si = 0; si < pa.length - 1; si++) {
        const a1 = pa[si]!
        const a2 = pa[si + 1]!
        for (let sj = 0; sj < pb.length - 1; sj++) {
          const b1 = pb[sj]!
          const b2 = pb[sj + 1]!
          const dax = a2.x - a1.x
          const day = a2.y - a1.y
          const dbx = b2.x - b1.x
          const dby = b2.y - b1.y
          const den = dax * dby - day * dbx
          if (Math.abs(den) < 1e-6) continue // segments parallèles
          const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / den
          const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / den
          const eps = 0.02
          if (t < -eps || t > 1 + eps || u < -eps || u > 1 + eps) continue
          const x = a1.x + dax * t
          const y = a1.y + day * t
          // regroupe les doublons (croisement pile sur un sommet)
          if (hits.some((h) => Math.hypot(h.x - x, h.y - y) < 28)) continue
          const la = Math.hypot(dax, day) || 1
          const lb = Math.hypot(dbx, dby) || 1
          hits.push({
            x,
            y,
            ta: { x: dax / la, y: day / la },
            tb: { x: dbx / lb, y: dby / lb },
          })
        }
      }

      hits.forEach((h, k) => {
        const id = `${ra.id}|${rb.id}|${k}`
        result.push({
          id,
          x: h.x,
          y: h.y,
          a: ra.id,
          b: rb.id,
          ta: h.ta,
          tb: h.tb,
          wa: ra.width,
          wb: rb.width,
          control: controls[id] ?? 'none',
          mode: modes[id] ?? 'normal',
        })
      })
    }
  }

  return result
}

export interface MarkingLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface Approach {
  /** Sens d'arrivée des véhicules vers le croisement. */
  dir: Point
  /** Largeur de la route empruntée. */
  own: number
  /** Largeur de la route croisée. */
  other: number
}

/** Approches réellement couvertes par une route (gère les jonctions en T). */
function approachesOf(it: RoadIntersection, roads: Road[]): Approach[] {
  const byId = new Map(roads.map((r) => [r.id, r]))
  const out: Approach[] = []
  const sides = [
    { t: it.ta, own: it.wa, other: it.wb, road: byId.get(it.a) },
    { t: it.tb, own: it.wb, other: it.wa, road: byId.get(it.b) },
  ]
  for (const { t, own, other, road } of sides) {
    if (!road) continue
    const poly = roadPolyline(road)
    for (const s of [1, -1]) {
      const dir = { x: t.x * s, y: t.y * s }
      const back = {
        x: it.x - dir.x * (other / 2 + 13),
        y: it.y - dir.y * (other / 2 + 13),
      }
      if (distToPolyline(back, poly) > own / 2) continue
      out.push({ dir, own, other })
    }
  }
  return out
}

/** Lignes d'arrêt peintes au sol (intersection « stop »). */
export function intersectionStopLines(it: RoadIntersection, roads: Road[]): MarkingLine[] {
  return approachesOf(it, roads).map(({ dir, own, other }) => {
    const cx = it.x - dir.x * (other / 2 + 13)
    const cy = it.y - dir.y * (other / 2 + 13)
    const nx = -dir.y
    const ny = dir.x
    const half = own / 2 - 5
    return {
      x1: cx - nx * half,
      y1: cy - ny * half,
      x2: cx + nx * half,
      y2: cy + ny * half,
    }
  })
}

/**
 * Positions des feux tricolores d'une intersection « feux » :
 * conduite à droite (France) → un feu par approche, posé avant le
 * croisement sur le bord droit du sens d'arrivée.
 */
export function intersectionFeuxPositions(it: RoadIntersection, roads: Road[]): Point[] {
  return approachesOf(it, roads).map(({ dir, own, other }) => {
    // bord droit du sens d'arrivée (repère écran, y vers le bas)
    const rx = -dir.y
    const ry = dir.x
    return {
      x: it.x - dir.x * (other / 2 + 14) + rx * (own / 2 + 10),
      y: it.y - dir.y * (other / 2 + 14) + ry * (own / 2 + 10),
    }
  })
}

/**
 * Feux d'une intersection « feux », chacun avec son id stable `${it.id}-f${k}`.
 * Un feu = un composant pilotable (une sortie physique côté maquette).
 */
export function intersectionFeux(
  it: RoadIntersection,
  roads: Road[],
): { id: string; index: number; pos: Point }[] {
  return intersectionFeuxPositions(it, roads).map((pos, index) => ({
    id: `${it.id}-f${index}`,
    index,
    pos,
  }))
}

/** Coin « avant droit » de la première approche (panneau STOP). */
export function intersectionStopSignPosition(it: RoadIntersection, roads: Road[]): Point | null {
  const positions = intersectionFeuxPositions(it, roads)
  return positions[0] ?? null
}

export const INTERSECTION_CONTROL_LABELS: Record<IntersectionControl, string> = {
  none: 'Aucun contrôle',
  stop: 'Stop',
  feux: 'Feux tricolores',
}

export const INTERSECTION_MODE_LABELS: Record<LightMode, string> = {
  normal: 'Cycle normal',
  orange: 'Orange clignotant',
  rouge: 'Forcé au rouge',
}