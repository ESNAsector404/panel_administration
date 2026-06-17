import { Router } from 'express'

import { authenticate, requirePermission } from '../auth/middleware.js'
import { PERMISSIONS } from '../config/permissions.js'
import { attachSse } from '../lib/bus.js'
import { asyncHandler } from '../lib/http.js'
import { CityEvent } from '../models/CityEvent.js'

const router = Router()
router.use(authenticate, requirePermission(PERMISSIONS.CITY_READ))

/** Derniers événements (chargement initial du flux). */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 40, 200)
    const events = await CityEvent.find().sort({ createdAt: -1 }).limit(limit)
    res.json({ events: events.map((e) => e.toJSON()) })
  }),
)

/** Flux temps réel (SSE) : événements + états + feux + plan (RF-DASH-04). */
router.get('/stream', (req, res) => attachSse(req, res))

export default router
