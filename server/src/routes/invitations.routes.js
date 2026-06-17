import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'

import { authenticate, requirePermission } from '../auth/middleware.js'
import { hashPassword } from '../auth/password.js'
import { setAuthCookies } from '../auth/tokens.js'
import { PERMISSIONS } from '../config/permissions.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { publicUser } from '../lib/serialize.js'
import { audit } from '../models/AuditLog.js'
import { Invitation, newInviteToken } from '../models/Invitation.js'
import { Role } from '../models/Role.js'
import { User } from '../models/User.js'

const router = Router()

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

/* ------------------------------------------------------------------ */
/* Administration des invitations (lien généré, transmis à la main)    */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  roleId: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  note: z.string().max(200).optional(),
})

router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) throw new HttpError(400, 'Données invalides', 'bad_request')

    const role = await Role.findById(parsed.data.roleId)
    if (!role) throw new HttpError(404, 'Rôle introuvable', 'role_not_found')
    // Garde-fou : pas d'invitation donnant un rôle super-admin par lien.
    if (role.permissions.includes('*')) {
      throw new HttpError(403, "Impossible d'inviter directement sur un rôle super-administrateur", 'forbidden_role')
    }

    const invitation = await Invitation.create({
      token: newInviteToken(),
      role: role._id,
      email: parsed.data.email || '',
      note: parsed.data.note || '',
      invitedBy: req.user._id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })

    await audit({
      action: 'invitations.create',
      actor: req.user._id,
      actorName: req.user.username,
      target: role.slug,
      ip: req.ip,
    })
    res.status(201).json({ invitation: invitation.toJSON() })
  }),
)

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  asyncHandler(async (_req, res) => {
    const invitations = await Invitation.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('role', 'slug name')
      .populate('invitedBy', 'username')
      .populate('usedBy', 'username')
    res.json({ invitations: invitations.map((i) => i.toJSON()) })
  }),
)

router.delete(
  '/:id',
  authenticate,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  asyncHandler(async (req, res) => {
    const invitation = await Invitation.findById(req.params.id)
    if (!invitation) throw new HttpError(404, 'Invitation introuvable', 'not_found')
    if (invitation.usedAt) throw new HttpError(409, 'Invitation déjà utilisée', 'already_used')
    await invitation.deleteOne()
    await audit({
      action: 'invitations.revoke',
      actor: req.user._id,
      actorName: req.user.username,
      target: String(invitation._id),
      ip: req.ip,
    })
    res.json({ ok: true })
  }),
)

/* ------------------------------------------------------------------ */
/* Parcours public : validation du lien + création du compte           */
/* ------------------------------------------------------------------ */

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
})

/** Vérifie qu'un token d'invitation est utilisable (page d'inscription). */
router.get(
  '/check/:token',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const invitation = await Invitation.findOne({ token: req.params.token }).populate('role', 'name')
    if (!invitation || !invitation.isUsable()) {
      throw new HttpError(410, 'Invitation invalide ou expirée', 'invite_invalid')
    }
    res.json({ valid: true, email: invitation.email, roleName: invitation.role?.name ?? '' })
  }),
)

const registerSchema = z.object({
  token: z.string().min(1),
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/, "nom d'utilisateur invalide"),
  email: z.string().email(),
  displayName: z.string().max(60).optional(),
  password: z.string().min(8).max(128),
})

/** Crée le compte à partir d'un lien d'invitation, puis connecte l'utilisateur. */
router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Données invalides', 'bad_request')
    }
    const { token, username, email, displayName, password } = parsed.data

    const invitation = await Invitation.findOne({ token })
    if (!invitation || !invitation.isUsable()) {
      throw new HttpError(410, 'Invitation invalide ou expirée', 'invite_invalid')
    }

    const conflict = await User.findOne({ $or: [{ username }, { email: email.toLowerCase() }] })
    if (conflict) throw new HttpError(409, 'Identifiant ou email déjà utilisé', 'conflict')

    const user = await User.create({
      username,
      email,
      displayName: displayName || username,
      passwordHash: await hashPassword(password),
      role: invitation.role,
      lastLoginAt: new Date(),
    })

    invitation.usedAt = new Date()
    invitation.usedBy = user._id
    await invitation.save()

    await user.populate('role')
    setAuthCookies(res, user)
    await audit({
      action: 'invitations.register',
      actor: user._id,
      actorName: user.username,
      ip: req.ip,
    })
    res.status(201).json({ user: publicUser(user) })
  }),
)

export default router
