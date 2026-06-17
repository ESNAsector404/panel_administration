import { publishEvent, publishTraffic } from '../lib/bus.js'
import { CityPlan } from '../models/CityPlan.js'
import { dispatchActuator } from './actuators.js'

/**
 * Moteur de feux de circulation — calcul AU BACK-END (source de vérité).
 *
 * Principe : les feux fonctionnent en cycle déterministe ancré sur une époque
 * serveur. Phase A = axe 1 au vert, phase B = axe 2 au vert, avec un temps
 * orange de transition. Le front reçoit { epoch, cycle, modes } et rejoue le
 * même calcul pour l'animation ; le serveur garde l'autorité (modes altérables
 * via l'API, relais des transitions vers la maquette physique).
 *
 * Modes : 'normal' (cycle), 'orange' (clignotant), 'rouge' (tout rouge forcé).
 */

export const DEFAULT_CYCLE = { greenMs: 9000, orangeMs: 3000 }

/** Époque d'ancrage du cycle (démarrage du serveur, stable pour la session). */
const EPOCH = Date.now()

let timer = null
let lastPhases = new Map()

/** Liste les intersections « feux » du layout (avec leur mode courant). */
export function feuxIntersections(layout) {
  const out = []
  for (const [id, control] of Object.entries(layout?.intersections ?? {})) {
    if (control !== 'feux') continue
    out.push({ id, mode: layout.intersectionModes?.[id] ?? 'normal' })
  }
  return out
}

/** Phase courante d'une intersection à l'instant t (calcul déterministe). */
export function phaseAt(t, cycle = DEFAULT_CYCLE) {
  const period = 2 * (cycle.greenMs + cycle.orangeMs)
  const pos = (t - EPOCH) % period
  if (pos < cycle.greenMs) return { phase: 'A', step: 'green', remainingMs: cycle.greenMs - pos }
  if (pos < cycle.greenMs + cycle.orangeMs)
    return { phase: 'A', step: 'orange', remainingMs: cycle.greenMs + cycle.orangeMs - pos }
  if (pos < 2 * cycle.greenMs + cycle.orangeMs)
    return { phase: 'B', step: 'green', remainingMs: 2 * cycle.greenMs + cycle.orangeMs - pos }
  return { phase: 'B', step: 'orange', remainingMs: period - pos }
}

/** Snapshot complet servi au front (GET /api/city/traffic). */
export function trafficSnapshot(layout) {
  return {
    epoch: EPOCH,
    now: Date.now(),
    cycle: layout?.trafficCycle ?? DEFAULT_CYCLE,
    intersections: feuxIntersections(layout).map((it) => ({
      ...it,
      ...phaseAt(Date.now(), layout?.trafficCycle ?? DEFAULT_CYCLE),
    })),
    feuModes: layout?.feuModes ?? {},
  }
}

/**
 * Boucle du moteur : à chaque transition de phase, relaie l'état des feux vers
 * la maquette physique (un feu = une sortie pilotable).
 */
export function startTrafficEngine() {
  if (timer) return
  timer = setInterval(async () => {
    try {
      const plan = await CityPlan.findOne({ key: 'default' }).lean()
      if (!plan) return
      const cycle = plan.layout?.trafficCycle ?? DEFAULT_CYCLE
      for (const it of feuxIntersections(plan.layout)) {
        const current = it.mode === 'normal' ? phaseAt(Date.now(), cycle) : { phase: it.mode, step: it.mode }
        const key = `${it.id}:${current.phase}:${current.step}`
        if (lastPhases.get(it.id) !== key) {
          lastPhases.set(it.id, key)
          await dispatchActuator(it.id, 'traffic.phase', {
            mode: it.mode,
            phase: current.phase,
            step: current.step,
          })
        }
      }
    } catch (err) {
      console.error('trafficEngine:', err.message)
    }
  }, 500)
  console.log('🚦 Moteur de feux démarré (cycle ancré sur le serveur)')
}

export function stopTrafficEngine() {
  if (timer) clearInterval(timer)
  timer = null
  lastPhases = new Map()
}

/**
 * Altère le mode d'une intersection ou d'un feu individuel (API pilotage).
 * Persiste dans le plan puis rediffuse la config aux clients.
 */
export async function setTrafficMode({ intersectionId, feuId, mode, actorName }) {
  const plan = await CityPlan.findOne({ key: 'default' })
  if (!plan) throw new Error('Plan introuvable')
  const layout = plan.layout

  if (intersectionId) {
    layout.intersectionModes ??= {}
    if (mode === 'normal') delete layout.intersectionModes[intersectionId]
    else layout.intersectionModes[intersectionId] = mode
  }
  if (feuId) {
    layout.feuModes ??= {}
    if (mode === 'normal') delete layout.feuModes[feuId]
    else layout.feuModes[feuId] = mode
  }

  plan.markModified('layout')
  await plan.save()

  const target = feuId ?? intersectionId
  await dispatchActuator(target, 'traffic.mode', { mode })
  await publishEvent({
    severity: mode === 'normal' ? 'success' : 'warning',
    message: `Feux « ${target} » : mode « ${mode} »`,
    componentId: target,
    actorName,
  })
  publishTraffic(trafficSnapshot(layout))
  return trafficSnapshot(layout)
}
