import { Router } from 'express'
import { z } from 'zod'

import { authenticate, requirePermission } from '../auth/middleware.js'
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSIONS } from '../config/permissions.js'
import { asyncHandler, HttpError } from '../lib/http.js'
import { audit } from '../models/AuditLog.js'
import { Role } from '../models/Role.js'
import { User } from '../models/User.js'

const router = Router()
router.use(authenticate)

const permArray = z.array(z.enum([...ALL_PERMISSIONS, '*'])).default([])

const createSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9-]+$/, 'slug invalide (a-z, 0-9, tirets)'),
  name: z.string().min(2).max(48),
  description: z.string().max(160).optional(),
  permissions: permArray,
})

const updateSchema = z.object({
  name: z.string().min(2).max(48).optional(),
  description: z.string().max(160).optional(),
  permissions: permArray.optional(),
})

/** Catalogue des permissions disponibles (pour l'IHM d'admin). */
router.get(
  '/permissions',
  requirePermission(PERMISSIONS.ROLES_READ),
  (_req, res) => {
    res.json({ groups: PERMISSION_GROUPS })
  },
)

/** GET /api/roles — liste des rôles. */
router.get(
  '/',
  requirePermission(PERMISSIONS.ROLES_READ),
  asyncHandler(async (_req, res) => {
    const roles = await Role.find().sort({ createdAt: 1 })
    res.json({ roles })
  }),
)

/** POST /api/roles — création d'un rôle personnalisé (RF-AUTH-04). */
router.post(
  '/',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Données invalides', 'bad_request')
    }
    const { slug, name, description, permissions } = parsed.data

    if (await Role.findOne({ slug })) {
      throw new HttpError(409, 'Un rôle avec ce slug existe déjà', 'conflict')
    }

    const role = await Role.create({ slug, name, description: description ?? '', permissions })
    await audit({
      action: 'roles.create',
      actor: req.user._id,
      actorName: req.user.username,
      target: role.slug,
      ip: req.ip,
    })
    res.status(201).json({ role })
  }),
)

/** PATCH /api/roles/:id — modification des permissions (RF-AUTH-04). */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Données invalides', 'bad_request')
    }
    const role = await Role.findById(req.params.id)
    if (!role) throw new HttpError(404, 'Rôle introuvable', 'not_found')

    const { name, description, permissions } = parsed.data
    if (name !== undefined) role.name = name
    if (description !== undefined) role.description = description
    if (permissions !== undefined) {
      // Le rôle admin garde toujours le wildcard pour ne pas se verrouiller.
      role.permissions = role.slug === 'admin' ? ['*'] : permissions
    }
    await role.save()

    await audit({
      action: 'roles.update',
      actor: req.user._id,
      actorName: req.user.username,
      target: role.slug,
      ip: req.ip,
    })
    res.json({ role })
  }),
)

/** DELETE /api/roles/:id — suppression d'un rôle non protégé et inutilisé. */
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  asyncHandler(async (req, res) => {
    const role = await Role.findById(req.params.id)
    if (!role) throw new HttpError(404, 'Rôle introuvable', 'not_found')
    if (role.protected) throw new HttpError(400, 'Rôle système non supprimable', 'protected')

    const inUse = await User.countDocuments({ role: role._id })
    if (inUse > 0) {
      throw new HttpError(409, `Rôle attribué à ${inUse} utilisateur(s)`, 'in_use')
    }

    await role.deleteOne()
    await audit({
      action: 'roles.delete',
      actor: req.user._id,
      actorName: req.user.username,
      target: role.slug,
      ip: req.ip,
    })
    res.json({ ok: true })
  }),
)

export default router
