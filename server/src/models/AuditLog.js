import mongoose from 'mongoose'

const { Schema, model } = mongoose

/**
 * Journal d'audit : qui, quoi, quand (RF-AUTH-05 / RNF-SEC).
 * Toute action sensible (connexion, pilotage, gestion de comptes/rôles) y est
 * tracée.
 */
const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: 'anonyme' },
    action: { type: String, required: true }, // ex. 'auth.login', 'users.create'
    target: { type: String, default: '' }, // identifiant lisible de la cible
    meta: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    success: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

auditLogSchema.index({ createdAt: -1 })

auditLogSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id
    delete ret._id
    return ret
  },
})

export const AuditLog = model('AuditLog', auditLogSchema)

/** Helper de journalisation (best-effort : n'interrompt jamais la requête). */
export async function audit(entry) {
  try {
    await AuditLog.create(entry)
  } catch (err) {
    console.error('audit log failed:', err.message)
  }
}
