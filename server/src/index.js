import { createApp } from './app.js'
import { connectDB, disconnectDB } from './config/db.js'
import { env } from './config/env.js'
import { startTrafficEngine, stopTrafficEngine } from './services/trafficEngine.js'

async function main() {
  await connectDB()
  const app = createApp()
  startTrafficEngine()

  const server = app.listen(env.PORT, () => {
    console.log(`🚀 API Sector 404 sur http://localhost:${env.PORT} (${env.NODE_ENV})`)
  })

  const shutdown = async (signal) => {
    console.log(`\n${signal} reçu — arrêt…`)
    stopTrafficEngine()
    server.close(async () => {
      await disconnectDB()
      process.exit(0)
    })
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('Échec du démarrage :', err)
  process.exit(1)
})
