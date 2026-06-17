import { randomBytes } from 'node:crypto'

import mongoose from 'mongoose'

const { Schema, model } = mongoose

/**
 * Invitation à créer un compte : un administrateur génère un lien à usage
 * unique (token aléatoire) qu'il transmet manuellement. Le destinataire crée
 * son compte via /api/auth/register avec ce token.
 */
const invitationSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    /** Email suggéré (informatif, non bloquant). */
    email: { type: String, default: '', lowercase: true, trim: true },
    note: { type: String, default: '', trim: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
)

invitationSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = String(ret._id)
    delete ret._id
    return ret
  },
})

invitationSchema.methods.isUsable = function () {
  return !this.usedAt && this.expiresAt > new Date()
}

export function newInviteToken() {
  return randomBytes(24).toString('base64url')
}

export const Invitation = model('Invitation', invitationSchema)
