import mongoose from 'mongoose'

import { env } from './env.js'

let memoryServer = null

/**
 * Connexion MongoDB partagée (Mongoose gère le pool).
 *
 * Si `MONGODB_URI` vaut `memory`, une instance MongoDB en mémoire est démarrée
 * via `mongodb-memory-server` — pratique pour une démo sans installer Mongo
 * (données éphémères, reseed au démarrage). En production, fournir une vraie URI.
 */
export async function connectDB() {
  mongoose.set('strictQuery', true)

  let uri = env.MONGODB_URI
  if (uri === 'memory') {
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    memoryServer = await MongoMemoryServer.create()
    uri = memoryServer.getUri()
    console.log('🧪 MongoDB en mémoire (démo — données éphémères)')
  }

  await mongoose.connect(uri)
  console.log('✅ MongoDB connecté')
  return mongoose.connection
}

export async function disconnectDB() {
  await mongoose.disconnect()
  if (memoryServer) await memoryServer.stop()
}
