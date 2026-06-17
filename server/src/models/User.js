import mongoose from 'mongoose'

const { Schema, model } = mongoose

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      match: [/^[a-zA-Z0-9._-]+$/, "nom d'utilisateur invalide"],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: { type: String, default: '', trim: true },
    // Hash argon2id — jamais le mot de passe en clair (RF-AUTH-01).
    passwordHash: { type: String, required: true, select: false },
    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    // Compte désactivé : interdit la connexion sans supprimer l'historique
    // (RF-AUTH-03).
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    // Invalidation des refresh tokens : tout token émis avant cette date est
    // rejeté (logout-all, changement de mot de passe, désactivation).
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
)

userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id
    delete ret._id
    delete ret.passwordHash
    return ret
  },
})

export const User = model('User', userSchema)
