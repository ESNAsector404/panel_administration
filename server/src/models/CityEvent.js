import mongoose from 'mongoose'

const { Schema, model } = mongoose

/**
 * Flux d'événements de supervision (RF-DASH-03). Alimenté par le back-end
 * (pilotage, moteur de feux, actionneurs, anomalies) et diffusé en temps réel
 * via SSE — plus aucune simulation côté front.
 */
const cityEventSchema = new Schema(
  {
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'critical'],
      default: 'info',
    },
    message: { type: String, required: true },
    componentId: { type: String, default: null },
    actorName: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

cityEventSchema.index({ createdAt: -1 })

cityEventSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id)
    ret.time = ret.createdAt
    delete ret._id
    delete ret.createdAt
    return ret
  },
})

export const CityEvent = model('CityEvent', cityEventSchema)
