import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { env } from './config/env.js'
import { HttpError } from './lib/http.js'
import authRoutes from './routes/auth.routes.js'
import cityRoutes from './routes/city.routes.js'
import eventsRoutes from './routes/events.routes.js'
import invitationsRoutes from './routes/invitations.routes.js'
import meRoutes from './routes/me.routes.js'
import rolesRoutes from './routes/roles.routes.js'
import usersRoutes from './routes/users.routes.js'
import raspberrysRoutes from './routes/raspberrys.route.js'

export function createApp() {
  const app = express()

  // Derrière un reverse-proxy (cluster K8s) : req.ip correct pour le rate-limit.
  app.set('trust proxy', 1)

  app.use(helmet())
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true, // cookies cross-origin (front ↔ api)
    }),
  )
  app.use(express.json({ limit: '256kb' }))
  app.use(cookieParser())

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '0.1.0' }))

  app.use('/api/auth', authRoutes)
  app.use('/api/me', meRoutes)
  app.use('/api/users', usersRoutes)
  app.use('/api/roles', rolesRoutes)
  app.use('/api/city', cityRoutes)
  app.use('/api/events', eventsRoutes)
  app.use('/api/invitations', invitationsRoutes)
  app.use('/api/raspberrys', raspberrysRoutes)

  // 404 API
  app.use((_req, _res, next) => next(new HttpError(404, 'Ressource introuvable', 'not_found')))

  // Gestion centralisée des erreurs.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status ?? 500
    if (status >= 500) console.error(err)
    res.status(status).json({
      error: err.message ?? 'Erreur serveur',
      code: err.code ?? null,
    })
  })

  return app
}
