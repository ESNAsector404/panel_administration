import { EventEmitter } from 'node:events'

import { CityEvent } from '../models/CityEvent.js'

/**
 * Bus d'événements interne + diffusion temps réel (SSE, RF-DASH-04).
 *
 * Tout ce qui se passe côté back (pilotage, feux, actionneurs, supervision)
 * passe par `publishEvent` : persistance Mongo + push immédiat vers tous les
 * clients SSE connectés.
 */
export const bus = new EventEmitter()
bus.setMaxListeners(100) // ~10 utilisateurs simultanés (RNF-TECH-09), marge large

/** Persiste un événement de supervision et le diffuse aux clients SSE. */
export async function publishEvent({ severity = 'info', message, componentId = null, actorName = null }) {
  let doc = null
  try {
    doc = await CityEvent.create({ severity, message, componentId, actorName })
  } catch (err) {
    console.error('publishEvent: persistance échouée —', err.message)
  }
  bus.emit('sse', {
    type: 'event',
    data: doc
      ? doc.toJSON()
      : { id: String(Date.now()), time: new Date(), severity, message, componentId },
  })
}

/** Diffuse un changement d'état runtime (statut, état interne, lumières). */
export function publishState(componentId, { status, state } = {}) {
  bus.emit('sse', { type: 'state', data: { componentId, status, state } })
}

/** Diffuse la configuration des feux (cycle, modes) après altération. */
export function publishTraffic(data) {
  bus.emit('sse', { type: 'traffic', data })
}

/** Diffuse une mise à jour du plan (édition). */
export function publishPlan(meta) {
  bus.emit('sse', { type: 'plan', data: meta })
}

/** Attache une réponse Express comme client SSE. */
export function attachSse(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(': connected\n\n')

  const onMessage = (msg) => {
    res.write(`event: ${msg.type}\ndata: ${JSON.stringify(msg.data)}\n\n`)
  }
  bus.on('sse', onMessage)

  // keep-alive : évite la fermeture par les proxies
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000)

  req.on('close', () => {
    clearInterval(ping)
    bus.off('sse', onMessage)
  })
}
