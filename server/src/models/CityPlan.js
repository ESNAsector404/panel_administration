import mongoose from 'mongoose'

const { Schema, model } = mongoose

/**
 * Plan de la ville — document unique (clé `default`), source de vérité du
 * layout (composants, voirie, zones, intersections, modules…). Le front ne
 * persiste plus rien en localStorage : l'éditeur lit et écrit ici.
 *
 * Le layout est stocké en Mixed : le modèle de composant est agnostique
 * (cf. cahier des charges §1.3) et évolue sans migration de schéma.
 */
const cityPlanSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'default' },
    version: { type: Number, default: 1 },
    layout: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true, minimize: false },
)

export const CityPlan = model('CityPlan', cityPlanSchema)

/** Charge le plan actif (ou null si la base n'est pas encore seedée). */
export async function getActivePlan() {
  return CityPlan.findOne({ key: 'default' }).lean()
}
