import { Router } from 'express'
import { z } from 'zod'

import { authenticate, requirePermission } from '../auth/middleware.js'
import { hashPassword } from '../auth/password.js'
import { PERMISSIONS } from '../config/permissions.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { audit } from '../models/AuditLog.js'
import { Role } from '../models/Role.js'
import { User } from '../models/User.js'

const router = Router()
router.use(authenticate)

const createSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().email(),
  displayName: z.string().max(64).optional(),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum'),
  roleId: z.string().min(1),
})

const updateSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().max(64).optional(),
  roleId: z.string().min(1).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
})

/** GET /api/users — liste des comptes. */
router.get(
  '/',
  requirePermission(PERMISSIONS.USERS_READ),
  asyncHandler(async (_req, res) => {
    const users = await User.find().populate('role').sort({ createdAt: 1 })
    res.json({ users })
  }),
)

/** POST /api/users — création d'un compte (RF-AUTH-03). */
router.post(
  '/',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Données invalides', 'bad_request')
    }
    const { username, email, displayName, password, roleId } = parsed.data

    const role = await Role.findById(roleId)
    if (!role) throw new HttpError(400, 'Rôle inconnu', 'bad_role')

    const exists = await User.findOne({ $or: [{ username }, { email: email.toLowerCase() }] })
    if (exists) throw new HttpError(409, "Nom d'utilisateur ou email déjà pris", 'conflict')

    const user = await User.create({
      username,
      email,
      displayName: displayName ?? '',
      passwordHash: await hashPassword(password),
      role: role._id,
    })
    await user.populate('role')

    await audit({
      action: 'users.create',
      actor: req.user._id,
      actorName: req.user.username,
      target: user.username,
      ip: req.ip,
    })
    res.status(201).json({ user })
  }),
)

/** PATCH /api/users/:id — modification / désactivation (RF-AUTH-03). */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_MANAGE),
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Données invalides', 'bad_request')
    }
    const user = await User.findById(req.params.id)
    if (!user) throw new HttpError(404, 'Utilisateur introuvable', 'not_found')

    const { email, displayName, roleId, active, password } = parsed.data

    // Garde-fou : un admin ne peut pas se désactiver / se rétrograder lui-même.
    if (String(user._id) === String(req.user._id) && (active === false || roleId)) {
      throw new HttpError(400, 'Action interdite sur votre propre compte', 'self_lock')
    }

    if (email !== undefined) user.email = email
    if (displayName !== undefined) user.displayName = displayName
    if (active !== undefined) user.active = active
    if (roleId) {
      const role = await Role.findById(roleId)
      if (!role) throw new HttpError(400, 'Rôle inconnu', 'bad_role')
      user.role = role._id
    }
    if (password) {
      user.passwordHash = await hashPassword(password)
    }
    // Désactivation ou reset mot de passe → invalide les sessions existantes.
    if (active === false || password) {
      user.tokenVersion += 1
    }

    await user.save()
    await user.populate('role')

    await audit({
      action: 'users.update',
      actor: req.user._id,
      actorName: req.user.username,
      target: user.username,
      meta: { active, roleChanged: Boolean(roleId), passwordReset: Boolean(password) },
      ip: req.ip,
    })
    res.json({ user })
  }),
)

export default router
