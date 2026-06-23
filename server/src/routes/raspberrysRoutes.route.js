import { Router } from 'express'
import { authenticate, requirePermission } from '../auth/middleware.js'
import { PERMISSIONS } from '../config/permissions.js'

import { asyncHandler } from '../lib/http.js'
import { getConfig, getAllRaspberrys } from '../services/raspberrys.service.js'


const router = Router()
router.use(authenticate)


router.get(
  '/',
  requirePermission(PERMISSIONS.USERS_READ),
  asyncHandler(async (_req, res) => {
    const config = getConfig();
    res.json({ config })
  }),
)
router.get(
  '/components',
  requirePermission(PERMISSIONS.USERS_READ),
  asyncHandler(async (_req, res) => {
    const raspberrys = await getAllRaspberrys();
    res.json({ raspberrys })
  }),
)

export default router
