import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'

import { authenticate } from '../auth/middleware.js'
import { verifyPassword } from '../auth/password.js'
import {
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
  verifyRefreshToken,
} from '../auth/tokens.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { publicUser } from '../lib/serialize.js'
import { audit } from '../models/AuditLog.js'
import { User } from '../models/User.js'

const router = Router()

/** Anti brute-force sur la connexion (RNF-SEC / OWASP). */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
})

const loginSchema = z.object({
  identifier: z.string().min(1), // username ou email
  password: z.string().min(1),
})

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'Identifiants requis', 'bad_request')
    const { identifier, password } = parsed.data

    const user = await User.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
    })
      .select('+passwordHash')
      .populate('role')

    // Message générique : on ne divulgue pas si le compte existe.
    const invalid = () => new HttpError(401, 'Identifiants invalides', 'invalid_credentials')

    if (!user) {
      // Hash factice évité ici : on échoue vite mais le rate-limit couvre l'oracle de timing.
      await audit({ action: 'auth.login', actorName: identifier, success: false, ip: req.ip })
      throw invalid()
    }

    const ok = await verifyPassword(user.passwordHash, password)
    if (!ok) {
      await audit({
        action: 'auth.login',
        actor: user._id,
        actorName: user.username,
        success: false,
        ip: req.ip,
      })
      throw invalid()
    }

    if (!user.active) {
      throw new HttpError(403, 'Compte désactivé', 'account_disabled')
    }

    user.lastLoginAt = new Date()
    await user.save()

    setAuthCookies(res, user)
    await audit({
      action: 'auth.login',
      actor: user._id,
      actorName: user.username,
      success: true,
      ip: req.ip,
    })

    res.json({ user: publicUser(user) })
  }),
)

/** Renouvelle l'access token à partir du refresh token (cookie). */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE]
    if (!token) throw new HttpError(401, 'Non authentifié', 'no_token')

    let payload
    try {
      payload = verifyRefreshToken(token)
    } catch {
      clearAuthCookies(res)
      throw new HttpError(401, 'Session expirée', 'token_invalid')
    }

    const user = await User.findById(payload.sub).populate('role')
    // tokenVersion : un refresh émis avant un logout-all / reset est rejeté.
    if (!user || !user.active || user.tokenVersion !== payload.ver) {
      clearAuthCookies(res)
      throw new HttpError(401, 'Session invalide', 'session_invalid')
    }

    setAuthCookies(res, user)
    res.json({ user: publicUser(user) })
  }),
)

/** Déconnexion : efface les cookies. */
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    clearAuthCookies(res)
    if (req.cookies?.[REFRESH_COOKIE]) {
      try {
        const payload = verifyRefreshToken(req.cookies[REFRESH_COOKIE])
        await audit({ action: 'auth.logout', actor: payload.sub, ip: req.ip })
      } catch {
        /* token déjà invalide : rien à journaliser */
      }
    }
    res.json({ ok: true })
  }),
)

/** Profil de l'utilisateur authentifié (+ permissions). */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) })
  }),
)

export default router
