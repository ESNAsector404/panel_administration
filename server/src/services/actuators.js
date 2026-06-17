import { env } from '../config/env.js'
import { publishEvent } from '../lib/bus.js'

/**
 * Pont vers la maquette physique : chaque commande validée par le back-end est
 * relayée en HTTP vers le contrôleur des actionneurs (Raspberry Pi / baie
 * technique). Le front ne parle JAMAIS directement au matériel (RF-PILOT-03).
 *
 * Sans ACTUATOR_BASE_URL configurée, le dispatch est en mode « débranché » :
 * la commande est acceptée et journalisée, mais rien n'est envoyé (dev local).
 */
const TIMEOUT_MS = 3000

/**
 * Envoie une commande à la maquette. Best-effort : un échec matériel ne casse
 * pas la requête utilisateur, il est signalé dans le flux d'événements.
 *
 * @param {string} componentId composant ciblé (id du plan)
 * @param {string} command     ex. 'light.on', 'barrier.open', 'traffic.mode'
 * @param {object} payload     paramètres (ex. { lightId, value })
 * @returns {Promise<{sent: boolean, ok: boolean}>}
 */
export async function dispatchActuator(componentId, command, payload = {}) {
  if (!env.ACTUATOR_BASE_URL) {
    return { sent: false, ok: true } // mode débranché (pas de maquette)
  }
  try {
    const res = await fetch(`${env.ACTUATOR_BASE_URL}/actuators/${encodeURIComponent(componentId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, payload }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { sent: true, ok: true }
  } catch (err) {
    await publishEvent({
      severity: 'warning',
      message: `Maquette injoignable pour « ${componentId} » (${command}) : ${err.message}`,
      componentId,
    })
    return { sent: true, ok: false }
  }
}
