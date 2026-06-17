import mongoose from 'mongoose'

const { Schema, model } = mongoose

/**
 * État runtime d'un composant de la maquette (statut + état interne).
 *
 * - `status` : ok / warning / critical / offline — supervision.
 * - `state`  : clé/valeur libre (barrière ouverte, mode d'un feu,
 *              `light:<id>` pour chaque lumière du composant…).
 *
 * Un composant sans document DeviceState est considéré dans son état initial
 * (déclaré dans le plan).
 */
const deviceStateSchema = new Schema(
  {
    componentId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['ok', 'warning', 'critical', 'offline'],
      default: 'ok',
    },
    state: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false },
)

export const DeviceState = model('DeviceState', deviceStateSchema)

/** Upsert d'une partie de l'état d'un composant. */
export async function patchDeviceState(componentId, { status, state } = {}) {
  const update = {}
  if (status) update.status = status
  if (state) {
    for (const [k, v] of Object.entries(state)) update[`state.${k}`] = v
  }
  return DeviceState.findOneAndUpdate(
    { componentId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean()
}
