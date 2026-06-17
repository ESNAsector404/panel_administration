import { computed, nextTick, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import { defaultLayout, LIGHT_ACTIONS } from '@/data/city'
import { api, API_BASE } from '@/lib/api'
import {
  computeIntersections,
  INTERSECTION_MODE_LABELS,
  intersectionFeux,
} from '@/lib/cityRender'
import { useAuthStore } from '@/stores/auth'
import type {
  CityComponent,
  CityEvent,
  CityLayout,
  CityModule,
  ComponentAction,
  Crosswalk,
  IntersectionControl,
  LightMode,
  Road,
  RoadIntersection,
  Status,
  TrafficSnapshot,
  TreeItem,
  Zone,
} from '@/types/city'

/**
 * Composant « connecté » : seul type avec lequel le dashboard dialogue
 * réellement (cible supervisée et pilotable, relayée vers la maquette) :
 *  - bâtiments hébergeant un SI ou dotés d'au moins une lumière ;
 *  - barrières, feux tricolores, lampadaires.
 * Un bâtiment sans lumière ni SI est du décor : aucun widget ne le compte
 * comme opérationnel.
 */
export function isCommunicating(c: CityComponent): boolean {
  if (c.kind === 'barrier' || c.kind === 'traffic-light' || c.kind === 'lamp') return true
  if (c.kind === 'building') return c.si === true || (c.lights?.length ?? 0) > 0
  return false
}

/** Champs ajoutés après les premières sauvegardes. */
function migrateLayout(layout: CityLayout): CityLayout {
  layout.intersections ??= {}
  layout.intersectionModes ??= {}
  layout.feuModes ??= {}
  layout.crosswalks ??= []
  layout.modules ??= [{ x: 0, y: 0 }]
  for (const road of layout.roads) {
    // ancien lissage global `curved` → lissage par sommet
    const legacy = road as Road & { curved?: boolean }
    if (legacy.curved) {
      road.points.forEach((p, i) => {
        if (i > 0 && i < road.points.length - 1) p.smooth = true
      })
      delete legacy.curved
    }
  }
  return layout
}

interface PlanResponse {
  version: number
  updatedAt: string
  layout: CityLayout
  devices: { componentId: string; status: Status; state: Record<string, string | boolean> }[]
  connected: string[]
  traffic: TrafficSnapshot
}

export const useCityStore = defineStore('city', () => {
  const auth = useAuthStore()

  /* --- Plan de la ville (source de vérité : API back-end) --- */

  const layout = reactive<CityLayout>(structuredClone(defaultLayout))
  /** `true` tant que le plan serveur n'a pas été chargé. */
  const loading = ref(true)
  /** Erreur de chargement éventuelle (back injoignable). */
  const loadError = ref<string | null>(null)

  const components = computed(() => layout.components)
  const roads = computed(() => layout.roads)
  const zones = computed(() => layout.zones)
  const crosswalks = computed(() => layout.crosswalks)
  const trees = computed(() => layout.trees)

  /** Intersections détectées entre routes carrossables (+ contrôle choisi). */
  const intersections = computed<RoadIntersection[]>(() =>
    computeIntersections(layout.roads, layout.intersections, layout.intersectionModes),
  )

  /** Paramètres de cycle des feux, calculés par le back-end. */
  const traffic = ref<TrafficSnapshot | null>(null)

  /**
   * Feux d'intersection vus comme des composants à part entière : un feu = une
   * sortie pilotable (Raspberry sur la maquette). Ils sont synthétisés depuis la
   * géométrie des intersections « feux » et traversent le même pipeline que les
   * feux posés à la main (supervision, sélection, panneau de détail, pilotage).
   */
  const feuComponents = computed<CityComponent[]>(() => {
    const out: CityComponent[] = []
    for (const it of intersections.value) {
      if (it.control !== 'feux') continue
      const label = `${roadNameOf(it.a)} × ${roadNameOf(it.b)}`
      const feux = intersectionFeux(it, layout.roads)
      feux.forEach((f) => {
        const mode = layout.feuModes?.[f.id] ?? 'normal'
        out.push({
          id: f.id,
          name: `Feu ${label} — ${f.index + 1}`,
          kind: 'traffic-light',
          category: 'Mobilité',
          description: `Feu d'intersection (${label}), approche ${f.index + 1}`,
          point: f.pos,
          initialStatus: 'ok',
          metrics: { Cycle: cycleLabel(), Mode: INTERSECTION_MODE_LABELS[mode] },
          actions: LIGHT_ACTIONS,
          initialState: { mode },
        })
      })
    }
    return out
  })

  function cycleLabel(): string {
    const c = traffic.value?.cycle
    if (!c) return '—'
    return `${Math.round((2 * (c.greenMs + c.orangeMs)) / 1000)} s`
  }

  /** Tous les feux d'intersection indexés par id (lookup rapide). */
  const feuComponentById = computed(() => {
    const map = new Map<string, CityComponent>()
    for (const f of feuComponents.value) map.set(f.id, f)
    return map
  })

  const modules = computed(() => layout.modules)

  /** Emprise totale de la maquette (union des plateaux), en unités plan. */
  const bounds = computed(() => {
    const xs = layout.modules.map((m) => m.x)
    const ys = layout.modules.map((m) => m.y)
    return {
      x0: Math.min(...xs) * 1000 - 25,
      y0: Math.min(...ys) * 1000 - 25,
      x1: (Math.max(...xs) + 1) * 1000 + 25,
      y1: (Math.max(...ys) + 1) * 1000 + 25,
    }
  })

  function insideModules(x: number, y: number): boolean {
    return layout.modules.some(
      (m) =>
        x >= m.x * 1000 - 25 && x <= m.x * 1000 + 1025 && y >= m.y * 1000 - 25 && y <= m.y * 1000 + 1025,
    )
  }

  function addModule(m: CityModule) {
    if (!layout.modules.some((e) => e.x === m.x && e.y === m.y)) {
      layout.modules.push(m)
    }
  }

  /** Retire un plateau (le dernier plateau ne peut pas être supprimé). */
  function removeModule(m: CityModule) {
    if (layout.modules.length <= 1) return
    const i = layout.modules.findIndex((e) => e.x === m.x && e.y === m.y)
    if (i >= 0) layout.modules.splice(i, 1)
  }

  /* --- Persistance du plan : PUT débouncé vers l'API (page:editor) --- */

  /** Coupe la sauvegarde pendant qu'on applique un plan venu du serveur. */
  let applyingRemote = false
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Applique une mutation venue du serveur sans déclencher de re-sauvegarde :
   * le flush des watchers Vue est asynchrone, le verrou doit donc rester posé
   * jusqu'au prochain tick.
   */
  async function applyRemote(fn: () => void) {
    applyingRemote = true
    try {
      fn()
      await nextTick()
    } finally {
      applyingRemote = false
    }
  }

  watch(
    layout,
    () => {
      if (applyingRemote || loading.value) return
      // L'accès à l'éditeur vaut droit de modification du plan.
      if (!auth.can('page:editor')) return
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        api.put('/city/plan', { layout }).catch((err) => {
          console.error('Sauvegarde du plan échouée :', err)
        })
      }, 800)
    },
    { deep: true },
  )

  /* --- État runtime des composants --- */

  const statuses = reactive<Record<string, Status>>({})
  const states = reactive<Record<string, Record<string, string | boolean>>>({})

  function ensureRuntime(c: CityComponent) {
    if (!(c.id in statuses)) statuses[c.id] = c.initialStatus
    if (!(c.id in states)) states[c.id] = { ...(c.initialState ?? {}) }
  }

  layout.components.forEach(ensureRuntime)

  // Maintient l'état runtime (mode courant) des feux d'intersection en phase avec
  // la géométrie : un feu qui apparaît est initialisé, un feu disparu est purgé.
  watch(
    feuComponents,
    (feux, prev) => {
      feux.forEach(ensureRuntime)
      const live = new Set(feux.map((f) => f.id))
      for (const old of prev ?? []) {
        if (!live.has(old.id)) {
          delete states[old.id]
          delete statuses[old.id]
        }
      }
    },
    { immediate: true },
  )

  const selectedId = ref<string | null>(null)
  const events = ref<CityEvent[]>([])

  /* --- Chargement initial + temps réel (SSE) --- */

  let eventSource: EventSource | null = null
  let initialized = false

  /** Charge plan + état + événements depuis l'API et ouvre le flux SSE. */
  async function init(): Promise<void> {
    if (initialized) return
    initialized = true
    loading.value = true
    loadError.value = null
    try {
      const plan = await api.get<PlanResponse>('/city/plan')
      await applyRemote(() => {
        replaceLayout(migrateLayout(plan.layout))
        for (const d of plan.devices) {
          statuses[d.componentId] = d.status
          states[d.componentId] = { ...(states[d.componentId] ?? {}), ...d.state }
        }
        traffic.value = plan.traffic
      })

      const res = await api.get<{ events: (CityEvent & { time: string })[] }>('/events?limit=40')
      events.value = res.events.map((e) => ({ ...e, time: new Date(e.time) }))

      connectStream()
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Back-end injoignable'
      initialized = false
    } finally {
      loading.value = false
    }
  }

  /** Flux temps réel : événements, états, feux, plan (RF-DASH-04). */
  function connectStream() {
    if (eventSource) return
    eventSource = new EventSource(`${API_BASE}/events/stream`, { withCredentials: true })

    eventSource.addEventListener('event', (e) => {
      const data = JSON.parse((e as MessageEvent).data)
      addEvent({ ...data, time: new Date(data.time) })
    })

    eventSource.addEventListener('state', (e) => {
      const { componentId, status, state } = JSON.parse((e as MessageEvent).data)
      if (status) statuses[componentId] = status
      if (state) states[componentId] = { ...(states[componentId] ?? {}), ...state }
    })

    eventSource.addEventListener('traffic', (e) => {
      const snapshot = JSON.parse((e as MessageEvent).data) as TrafficSnapshot
      void applyRemote(() => {
        traffic.value = snapshot
        layout.intersectionModes = {}
        for (const it of snapshot.intersections) {
          if (it.mode !== 'normal') layout.intersectionModes[it.id] = it.mode
        }
        layout.feuModes = { ...snapshot.feuModes }
      })
    })

    eventSource.onerror = () => {
      // EventSource retente automatiquement ; rien à faire.
    }
  }

  function disconnectStream() {
    eventSource?.close()
    eventSource = null
  }

  /* --- Getters --- */

  const selected = computed<CityComponent | null>(() => {
    if (!selectedId.value) return null
    return (
      layout.components.find((c) => c.id === selectedId.value) ??
      feuComponentById.value.get(selectedId.value) ??
      null
    )
  })

  const kpis = computed(() => {
    // Seuls les composants connectés sont supervisés (SI, lumières, barrières,
    // feux). Les bâtiments sans équipement, parkings… ne comptent pas en ligne.
    const monitored = layout.components.filter(isCommunicating)
    const all = [
      ...monitored.map((c) => statuses[c.id] ?? 'offline'),
      ...feuComponents.value.map((c) => statusOf(c.id)),
    ]
    const online = all.filter((s) => s !== 'offline').length
    const alerts = all.filter((s) => s === 'warning' || s === 'critical').length
    return {
      total: all.length,
      online,
      alerts,
      siCount: layout.components.filter((c) => c.si).length,
    }
  })

  /* --- Actions supervision --- */

  function select(id: string | null) {
    selectedId.value = id
  }

  function statusOf(id: string): Status {
    // Un feu d'intersection est toujours « en ligne » : son état piloté est le
    // mode (normal/orange/rouge), pas une panne.
    if (feuComponentById.value.has(id)) return statuses[id] ?? 'ok'
    const c = layout.components.find((x) => x.id === id)
    // Composant non connecté : jamais « opérationnel » pour les widgets.
    if (c && !isCommunicating(c)) return 'offline'
    return statuses[id] ?? 'offline'
  }

  function addEvent(event: CityEvent) {
    events.value = [event, ...events.value].slice(0, 40)
  }

  /**
   * Exécute une action de pilotage : la commande transite par le back-end, qui
   * la relaie vers la maquette physique (RF-PILOT-03). L'effet local est
   * appliqué de façon optimiste ; l'événement de confirmation arrive par SSE.
   */
  async function runAction(component: CityComponent, action: ComponentAction) {
    if (action.effect) {
      states[component.id] = {
        ...states[component.id],
        [action.effect.key]: action.effect.value,
      }
      if (action.effect.key === 'mode' && feuComponentById.value.has(component.id)) {
        layout.feuModes ??= {}
        layout.feuModes[component.id] = action.effect.value as LightMode
      }
    }
    try {
      await api.post(`/city/components/${component.id}/actions/${action.id}`, {
        value: action.effect?.value,
      })
    } catch (err) {
      addEvent({
        id: `local-${Date.now()}`,
        time: new Date(),
        severity: 'warning',
        message: `${component.name} : commande « ${action.label} » refusée (${err instanceof Error ? err.message : 'erreur'})`,
        componentId: component.id,
      })
    }
  }

  /** Allume / éteint une lumière d'un composant (relayé vers la maquette). */
  async function toggleLight(componentId: string, lightId: string, on: boolean) {
    states[componentId] = { ...states[componentId], [`light:${lightId}`]: on }
    try {
      await api.post(`/city/components/${componentId}/lights/${lightId}`, { on })
    } catch (err) {
      states[componentId] = { ...states[componentId], [`light:${lightId}`]: !on }
      console.error('Commande lumière refusée :', err)
    }
  }

  /* --- Édition du plan (éditeur de ville) --- */

  function addComponent(c: CityComponent) {
    layout.components.push(c)
    ensureRuntime(c)
  }

  function removeComponent(id: string) {
    const i = layout.components.findIndex((c) => c.id === id)
    if (i >= 0) layout.components.splice(i, 1)
    delete statuses[id]
    delete states[id]
    if (selectedId.value === id) selectedId.value = null
  }

  function addRoad(r: Road) {
    layout.roads.push(r)
  }

  function removeRoad(id: string) {
    const i = layout.roads.findIndex((r) => r.id === id)
    if (i >= 0) layout.roads.splice(i, 1)
  }

  function addZone(z: Zone) {
    layout.zones.push(z)
  }

  function removeZone(id: string) {
    const i = layout.zones.findIndex((z) => z.id === id)
    if (i >= 0) layout.zones.splice(i, 1)
  }

  function addCrosswalk(cw: Crosswalk) {
    layout.crosswalks.push(cw)
  }

  function removeCrosswalk(id: string) {
    const i = layout.crosswalks.findIndex((c) => c.id === id)
    if (i >= 0) layout.crosswalks.splice(i, 1)
  }

  function addTree(t: TreeItem) {
    layout.trees.push(t)
  }

  function removeTree(id: string) {
    const i = layout.trees.findIndex((t) => t.id === id)
    if (i >= 0) layout.trees.splice(i, 1)
  }

  function setIntersectionControl(id: string, control: IntersectionControl) {
    if (control === 'none') delete layout.intersections[id]
    else layout.intersections[id] = control
    // le mode des feux n'a de sens que pour un contrôle « feux »
    if (control !== 'feux') {
      layout.intersectionModes ??= {}
      delete layout.intersectionModes[id]
    }
  }

  /**
   * Pilote les feux d'une intersection « feux » : le mode est calculé et
   * persisté par le back-end (moteur de feux), qui relaie vers la maquette.
   */
  async function setIntersectionMode(id: string, mode: LightMode) {
    layout.intersectionModes ??= {}
    if (mode === 'normal') delete layout.intersectionModes[id]
    else layout.intersectionModes[id] = mode
    try {
      await api.post('/city/traffic/mode', { intersectionId: id, mode })
    } catch (err) {
      console.error('Commande feux refusée :', err)
    }
  }

  /** Configure la liste des lumières d'un composant (équipements). */
  async function configureLights(componentId: string, lights: { id: string; name: string }[]) {
    const c = layout.components.find((x) => x.id === componentId)
    if (!c) return
    c.lights = lights
    try {
      await api.put(`/city/components/${componentId}/lights`, { lights })
    } catch (err) {
      console.error('Configuration des lumières refusée :', err)
    }
  }

  function roadNameOf(id: string): string {
    return layout.roads.find((r) => r.id === id)?.name ?? id
  }

  /** Remplace tout le plan courant (chargement serveur ou import). */
  function replaceLayout(next: CityLayout) {
    layout.components.splice(0, layout.components.length, ...next.components)
    layout.roads.splice(0, layout.roads.length, ...next.roads)
    layout.zones.splice(0, layout.zones.length, ...next.zones)
    layout.crosswalks.splice(0, layout.crosswalks.length, ...next.crosswalks)
    layout.trees.splice(0, layout.trees.length, ...next.trees)
    layout.modules.splice(0, layout.modules.length, ...next.modules)
    Object.keys(layout.intersections).forEach((k) => delete layout.intersections[k])
    Object.assign(layout.intersections, next.intersections)
    layout.intersectionModes ??= {}
    Object.keys(layout.intersectionModes).forEach((k) => delete layout.intersectionModes![k])
    Object.assign(layout.intersectionModes, next.intersectionModes ?? {})
    layout.feuModes ??= {}
    Object.keys(layout.feuModes).forEach((k) => delete layout.feuModes![k])
    Object.assign(layout.feuModes, next.feuModes ?? {})
    Object.keys(statuses).forEach((k) => delete statuses[k])
    Object.keys(states).forEach((k) => delete states[k])
    layout.components.forEach(ensureRuntime)
    selectedId.value = null
  }

  /** Restaure le plan par défaut (perd les modifications). */
  function resetLayout() {
    replaceLayout(structuredClone(defaultLayout))
  }

  /** Importe un plan exporté en JSON. Retourne une erreur lisible si invalide. */
  function importLayout(json: string): string | null {
    try {
      const parsed = JSON.parse(json) as { version: number; layout: CityLayout }
      if (parsed.version !== 1 || !Array.isArray(parsed.layout?.components)) {
        return 'Fichier invalide : structure de plan non reconnue.'
      }
      replaceLayout(migrateLayout(parsed.layout))
      return null
    } catch {
      return 'Fichier invalide : JSON illisible.'
    }
  }

  /** Télécharge le plan courant en JSON. */
  function exportLayout() {
    const blob = new Blob([JSON.stringify({ version: 1, layout }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'chateauval-plan.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    components,
    roads,
    zones,
    crosswalks,
    trees,
    intersections,
    feuComponents,
    traffic,
    modules,
    bounds,
    loading,
    loadError,
    insideModules,
    addModule,
    removeModule,
    statuses,
    states,
    events,
    selectedId,
    selected,
    kpis,
    init,
    disconnectStream,
    select,
    statusOf,
    runAction,
    toggleLight,
    configureLights,
    addComponent,
    removeComponent,
    addRoad,
    removeRoad,
    addZone,
    removeZone,
    addCrosswalk,
    removeCrosswalk,
    addTree,
    removeTree,
    setIntersectionControl,
    setIntersectionMode,
    resetLayout,
    importLayout,
    exportLayout,
  }
})
