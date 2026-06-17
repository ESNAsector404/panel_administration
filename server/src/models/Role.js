import mongoose from 'mongoose'

import { ALL_PERMISSIONS } from '../config/permissions.js'

const { Schema, model } = mongoose

const roleSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'slug invalide (a-z, 0-9, tirets)'],
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    permissions: {
      type: [String],
      default: [],
      // `*` est autorisé (super-rôle) en plus du catalogue connu.
      validate: {
        validator: (perms) => perms.every((p) => p === '*' || ALL_PERMISSIONS.includes(p)),
        message: 'Permission inconnue',
      },
    },
    // Rôle système : non supprimable, slug non modifiable.
    protected: { type: Boolean, default: false },
  },
  { timestamps: true },
)

roleSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id
    delete ret._id
    return ret
  },
})

export const Role = model('Role', roleSchema)
