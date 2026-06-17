/**
 * Lecture et validation de la configuration d'environnement.
 *
 * Tous les secrets vivent côté serveur (RNF-TECH-05). Le fichier `.env` n'est
 * jamais committé ; `.env.example` documente les variables attendues.
 */
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI est requis'),

  // Secrets JWT : distincts pour access et refresh (rotation indépendante).
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire ≥ 32 caractères'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET doit faire ≥ 32 caractères'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),

  // Contrôleur des actionneurs de la maquette physique (Raspberry Pi).
  // Optionnel : sans URL, les commandes sont validées mais non relayées (dev).
  ACTUATOR_BASE_URL: z.string().url().optional(),

  // Origine du front autorisée pour CORS + cookies.
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  // Cookies en https only : activer en prod (HTTPS/TLS — RNF-SEC).
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Comptes initiaux créés par le seed.
  SEED_ADMIN_USERNAME: z.string().default('admin'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@sector404.local'),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  SEED_USER_USERNAME: z.string().default('operateur'),
  SEED_USER_EMAIL: z.string().email().default('operateur@sector404.local'),
  SEED_USER_PASSWORD: z.string().min(8).optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Configuration .env invalide :')
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join('.')}: ${issue.message}`)
  }
  process.exit(1)
}

export const env = parsed.data
export const isProd = env.NODE_ENV === 'production'
