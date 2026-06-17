import { Router } from 'express'
import { z } from 'zod'

import { authenticate } from '../auth/middleware.js'
import { hashPassword, verifyPassword } from '../auth/password.js'
import { setAuthCookies } from '../auth/tokens.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { publicUser } from '../lib/serialize.js'
import { audit } from '../models/AuditLog.js'
import { User } from '../models/User.js'

/**
 * Espace utilisateur : chacun peut modifier ses propres informations
 * (nom affiché, email) et son mot de passe — sans permission d'admin.
 */
const router = Router()
router.use(authenticate)

const profileSchema = z.object({
  displayName: z.string().trim().max(60).optional(),
  email: z.string().email().optional(),
})

router.patch(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'Données invalides', 'bad_request')
    const { displayName, email } = parsed.data

    if (email && email.toLowerCase() !== req.user.email) {
      const conflict = await User.findOne({ email: email.toLowerCase() })
      if (conflict) throw new HttpError(409, 'Email déjà utilisé', 'email_conflict')
      req.user.email = email
    }
    if (displayName !== undefined) req.user.displayName = displayName

    await req.user.save()
    await audit({
      action: 'me.update',
      actor: req.user._id,
      actorName: req.user.username,
      ip: req.ip,
    })
    res.json({ user: publicUser(req.user) })
  }),
)

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
})

router.post(
  '/password',
  asyncHandler(async (req, res) => {
    const parsed = passwordSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, 'Mot de passe actuel requis, nouveau ≥ 8 caractères', 'bad_request')
    }

    const user = await User.findById(req.user._id).select('+passwordHash').populate('role')
    const ok = await verifyPassword(user.passwordHash, parsed.data.currentPassword)
    if (!ok) throw new HttpError(401, 'Mot de passe actuel incorrect', 'wrong_password')

    user.passwordHash = await hashPassword(parsed.data.newPassword)
    // Invalide les refresh tokens existants, puis re-pose une session fraîche.
    user.tokenVersion += 1
    await user.save()
    setAuthCookies(res, user)

    await audit({
      action: 'me.password',
      actor: user._id,
      actorName: user.username,
      ip: req.ip,
    })
    res.json({ ok: true })
  }),
)

export default router
