import { Router } from 'express'
import { z } from 'zod'

import { authenticate, requirePermission } from '../auth/middleware.js'
import { PERMISSIONS } from '../config/permissions.js'
import { publishEvent, publishPlan, publishState } from '../lib/bus.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { audit } from '../models/AuditLog.js'
import { CityPlan } from '../models/CityPlan.js'
import { DeviceState, patchDeviceState } from '../models/DeviceState.js'
import { dispatchActuator } from '../services/actuators.js'
import { setTrafficMode, trafficSnapshot } from '../services/trafficEngine.js'

const router = Router()
router.use(authenticate)

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function requirePlan() {
  const plan = await CityPlan.findOne({ key: 'default' })
  if (!plan) throw new HttpError(404, 'Plan de ville non initialisé (lancer le seed)', 'no_plan')
  return plan
}

function findComponent(layout, id) {
  return (layout.components ?? []).find((c) => c.id === id) ?? null
}

/**
 * Un composant est « connecté » s'il pilote au moins quelque chose sur la
 * maquette : barrière, feu, lampadaire, bâtiment hébergeant un SI ou doté
 * d'au moins une lumière. Sinon c'est du décor : aucun widget ne doit le
 * compter comme opérationnel.
 */
export function isConnected(component) {
  if (!component) return false
  if (['barrier', 'traffic-light', 'lamp'].includes(component.kind)) return true
  if (component.kind === 'building') {
    return component.si === true || (component.lights?.length ?? 0) > 0
  }
  return false
}

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

/** Plan complet + état runtime — un seul appel au chargement du dashboard. */
router.get(
  '/plan',
  requirePermission(PERMISSIONS.CITY_READ),
  asyncHandler(async (_req, res) => {
    const plan = await requirePlan()
    const devices = await DeviceState.find().lean()
    res.json({
      version: plan.version,
      updatedAt: plan.updatedAt,
      layout: plan.layout,
      devices: devices.map((d) => ({
        componentId: d.componentId,
        status: d.status,
        state: d.state ?? {},
      })),
      connected: (plan.layout.components ?? []).filter(isConnected).map((c) => c.id),
      traffic: trafficSnapshot(plan.layout),
    })
  }),
)

/** Remplacement du plan (éditeur de ville). L'accès à l'éditeur vaut droit
 *  de modification : une seule permission `page:editor`. */
router.put(
  '/plan',
  requirePermission(PERMISSIONS.PAGE_EDITOR),
  asyncHandler(async (req, res) => {
    const layout = req.body?.layout
    if (!layout || !Array.isArray(layout.components) || !Array.isArray(layout.roads)) {
      throw new HttpError(400, 'Layout invalide', 'bad_layout')
    }
    const plan = await requirePlan()
    plan.layout = layout
    plan.updatedBy = req.user.username
    plan.markModified('layout')
    await plan.save()

    // Purge l'état runtime des composants disparus.
    const liveIds = new Set(layout.components.map((c) => c.id))
    await DeviceState.deleteMany({ componentId: { $nin: [...liveIds] } })

    await audit({
      action: 'city.plan.update',
      actor: req.user._id,
      actorName: req.user.username,
      ip: req.ip,
    })
    publishPlan({ updatedAt: plan.updatedAt, updatedBy: plan.updatedBy })
    res.json({ ok: true, updatedAt: plan.updatedAt })
  }),
)

/* ------------------------------------------------------------------ */
/* État runtime                                                        */
/* ------------------------------------------------------------------ */

router.get(
  '/state',
  requirePermission(PERMISSIONS.CITY_READ),
  asyncHandler(async (_req, res) => {
    const devices = await DeviceState.find().lean()
    res.json({
      devices: devices.map((d) => ({
        componentId: d.componentId,
        status: d.status,
        state: d.state ?? {},
      })),
    })
  }),
)

/* ------------------------------------------------------------------ */
/* Pilotage (RF-PILOT) — la commande transite par le back, qui relaie  */
/* vers la maquette physique (RF-PILOT-03).                            */
/* ------------------------------------------------------------------ */

router.post(
  '/components/:id/actions/:actionId',
  requirePermission(PERMISSIONS.CITY_PILOT),
  asyncHandler(async (req, res) => {
    const plan = await requirePlan()
    const { id, actionId } = req.params

    // Les feux d'intersection (`<intersection>-f<k>`) sont des composants
    // virtuels synthétisés depuis la géométrie : pilotage via le moteur de feux.
    const feuMatch = /^(.+)-f\d+$/.exec(id)
    const component = findComponent(plan.layout, id)
    if (!component && !feuMatch) throw new HttpError(404, 'Composant introuvable', 'not_found')

    if (!component && feuMatch) {
      const modeSchema = z.enum(['normal', 'orange', 'rouge'])
      const mode = modeSchema.safeParse(req.body?.value ?? actionId.replace('mode-', ''))
      if (!mode.success) throw new HttpError(400, 'Mode de feu invalide', 'bad_mode')
      const snapshot = await setTrafficMode({ feuId: id, mode: mode.data, actorName: req.user.username })
      return res.json({ ok: true, traffic: snapshot })
    }

    if (!isConnected(component)) {
      throw new HttpError(409, 'Composant non connecté : aucun actionneur à piloter', 'not_connected')
    }

    const action = (component.actions ?? []).find((a) => a.id === actionId)
    if (!action) throw new HttpError(404, 'Action inconnue pour ce composant', 'unknown_action')

    // Applique l'effet déclaré dans le plan à l'état runtime.
    let newState
    if (action.effect) {
      newState = { [action.effect.key]: action.effect.value }
      await patchDeviceState(id, { state: newState })
    }

    const result = await dispatchActuator(id, `action.${actionId}`, action.effect ?? {})

    await audit({
      action: 'city.pilot',
      actor: req.user._id,
      actorName: req.user.username,
      target: id,
      meta: { actionId },
      ip: req.ip,
    })
    await publishEvent({
      severity: action.critical ? 'warning' : 'success',
      message: `${component.name || id} : « ${action.label} »${result.ok ? '' : ' (maquette injoignable)'}`,
      componentId: id,
      actorName: req.user.username,
    })
    if (newState) publishState(id, { state: newState })

    res.json({ ok: true, dispatched: result })
  }),
)

/* ------------------------------------------------------------------ */
/* Lumières — un bâtiment peut porter 0..n lumières ; sans lumière ni  */
/* SI, il n'est pas connecté.                                          */
/* ------------------------------------------------------------------ */

const lightsSchema = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string().min(1).max(60),
  }),
)

/** Configure les lumières d'un composant (éditeur / admin équipements). */
router.put(
  '/components/:id/lights',
  requirePermission(PERMISSIONS.PAGE_EDITOR),
  asyncHandler(async (req, res) => {
    const parsed = lightsSchema.safeParse(req.body?.lights)
    if (!parsed.success) throw new HttpError(400, 'Liste de lumières invalide', 'bad_lights')

    const plan = await requirePlan()
    const component = findComponent(plan.layout, req.params.id)
    if (!component) throw new HttpError(404, 'Composant introuvable', 'not_found')

    component.lights = parsed.data
    plan.markModified('layout')
    await plan.save()

    await audit({
      action: 'city.lights.config',
      actor: req.user._id,
      actorName: req.user.username,
      target: req.params.id,
      meta: { count: parsed.data.length },
      ip: req.ip,
    })
    publishPlan({ updatedAt: plan.updatedAt, updatedBy: req.user.username })
    res.json({ ok: true, lights: component.lights, connected: isConnected(component) })
  }),
)

/** Allume/éteint une lumière précise d'un composant. */
router.post(
  '/components/:id/lights/:lightId',
  requirePermission(PERMISSIONS.CITY_PILOT),
  asyncHandler(async (req, res) => {
    const on = req.body?.on
    if (typeof on !== 'boolean') throw new HttpError(400, '`on` booléen requis', 'bad_request')

    const plan = await requirePlan()
    const component = findComponent(plan.layout, req.params.id)
    const light = component?.lights?.find((l) => l.id === req.params.lightId)
    if (!light) throw new HttpError(404, 'Lumière introuvable', 'not_found')

    const stateKey = `light:${light.id}`
    await patchDeviceState(req.params.id, { state: { [stateKey]: on } })
    const result = await dispatchActuator(req.params.id, on ? 'light.on' : 'light.off', {
      lightId: light.id,
    })

    await audit({
      action: 'city.light',
      actor: req.user._id,
      actorName: req.user.username,
      target: `${req.params.id}/${light.id}`,
      meta: { on },
      ip: req.ip,
    })
    await publishEvent({
      severity: 'success',
      message: `${component.name || req.params.id} — ${light.name} : ${on ? 'allumée' : 'éteinte'}${result.ok ? '' : ' (maquette injoignable)'}`,
      componentId: req.params.id,
      actorName: req.user.username,
    })
    publishState(req.params.id, { state: { [stateKey]: on } })

    res.json({ ok: true, dispatched: result })
  }),
)

/* ------------------------------------------------------------------ */
/* Feux de circulation                                                 */
/* ------------------------------------------------------------------ */

router.get(
  '/traffic',
  requirePermission(PERMISSIONS.CITY_READ),
  asyncHandler(async (_req, res) => {
    const plan = await requirePlan()
    res.json(trafficSnapshot(plan.layout))
  }),
)

const trafficModeSchema = z.object({
  intersectionId: z.string().optional(),
  feuId: z.string().optional(),
  mode: z.enum(['normal', 'orange', 'rouge']),
})

router.post(
  '/traffic/mode',
  requirePermission(PERMISSIONS.CITY_PILOT),
  asyncHandler(async (req, res) => {
    const parsed = trafficModeSchema.safeParse(req.body)
    if (!parsed.success || (!parsed.data.intersectionId && !parsed.data.feuId)) {
      throw new HttpError(400, 'intersectionId ou feuId requis, avec un mode valide', 'bad_request')
    }
    const snapshot = await setTrafficMode({ ...parsed.data, actorName: req.user.username })
    await audit({
      action: 'city.traffic.mode',
      actor: req.user._id,
      actorName: req.user.username,
      target: parsed.data.feuId ?? parsed.data.intersectionId,
      meta: { mode: parsed.data.mode },
      ip: req.ip,
    })
    res.json({ ok: true, traffic: snapshot })
  }),
)

export default router
