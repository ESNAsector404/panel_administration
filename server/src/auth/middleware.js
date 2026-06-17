import { permissionGrants } from '../config/permissions.js'
import { HttpError } from '../lib/http.js'
import { User } from '../models/User.js'
import { ACCESS_COOKIE, verifyAccessToken } from './tokens.js'

/**
 * Authentifie la requête à partir du cookie d'access token. Charge l'utilisateur
 * et son rôle (permissions) sur `req.user`. Rejette si absent/invalide/inactif.
 */
export async function authenticate(req, _res, next) {
  try {
    const token = req.cookies?.[ACCESS_COOKIE]
    if (!token) throw new HttpError(401, 'Non authentifié', 'no_token')

    let payload
    try {
      payload = verifyAccessToken(token)
    } catch {
      throw new HttpError(401, 'Session expirée', 'token_invalid')
    }

    const user = await User.findById(payload.sub).populate('role')
    if (!user || !user.active) {
      throw new HttpError(401, 'Compte introuvable ou désactivé', 'account_unavailable')
    }

    req.user = user
    req.permissions = user.role?.permissions ?? []
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Exige une ou plusieurs permissions (toutes requises). Le contrôle est
 * toujours côté serveur (RNF-SEC) — le front ne fait que masquer.
 */
export function requirePermission(...required) {
  return (req, _res, next) => {
    const granted = req.permissions ?? []
    const ok = required.every((perm) => permissionGrants(granted, perm))
    if (!ok) return next(new HttpError(403, 'Permission insuffisante', 'forbidden'))
    next()
  }
}
