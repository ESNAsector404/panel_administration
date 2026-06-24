import { Router } from 'express'
import { authenticate, requirePermission } from '../auth/middleware.js'
import { PERMISSIONS } from '../config/permissions.js'

import { asyncHandler } from '../lib/http.js'
import { getConfig, getAllRaspberrys, ledAction, servoAction } from '../services/raspberrys.service.js'


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

router.get(
  '/components/led/:raspberryId/:ledId/:action',
  requirePermission(PERMISSIONS.USERS_READ),
  asyncHandler(async (_req, res) => {
    const { raspberryId, ledId, action } = _req.params;
    const result = await ledAction(raspberryId, ledId, action);
    res.json({ result });
  }),
)

router.get(
  '/components/servo/:raspberryId/:servoId/:angle',
  requirePermission(PERMISSIONS.USERS_READ),
  asyncHandler(async (_req, res) => {
    const { raspberryId, servoId, angle } = _req.params;
    const result = await servoAction(raspberryId, servoId, angle);
    res.json({ result });
  }),
)

export default router
