/**
 * Seed de la base : réconcilie les rôles système et crée les comptes initiaux
 * (un admin + un opérateur). Idempotent — relançable sans dupliquer.
 *
 * Les identifiants viennent du `.env` (SEED_ADMIN_*, SEED_USER_*). Si un mot de
 * passe n'est pas fourni, un mot de passe aléatoire est généré et affiché une
 * seule fois dans la console.
 *
 *   npm run seed
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { hashPassword } from './auth/password.js'
import { connectDB, disconnectDB } from './config/db.js'
import { env } from './config/env.js'
import { ALL_PERMISSIONS, SYSTEM_ROLES } from './config/permissions.js'
import { CityPlan } from './models/CityPlan.js'
import { Role } from './models/Role.js'
import { User } from './models/User.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Crée le plan de ville par défaut s'il n'existe pas (jamais écrasé). */
async function seedCityPlan() {
  const existing = await CityPlan.findOne({ key: 'default' })
  if (existing) {
    console.log('   • plan de ville déjà présent — inchangé')
    return
  }
  const raw = readFileSync(join(__dirname, 'data', 'chateauval-plan.json'), 'utf8')
  const { layout } = JSON.parse(raw)
  layout.intersectionModes ??= {}
  layout.feuModes ??= {}
  layout.crosswalks ??= []
  await CityPlan.create({ key: 'default', version: 1, layout })
  console.log(`   ✅ plan « Chateauval » importé (${layout.components.length} composants)`)
}

function randomPassword() {
  // 16 octets → mot de passe URL-safe lisible.
  return randomBytes(12).toString('base64url')
}

/** Crée ou met à jour les rôles système (permissions toujours réconciliées). */
async function seedRoles() {
  const bySlug = new Map()
  for (const def of SYSTEM_ROLES) {
    const role = await Role.findOneAndUpdate(
      { slug: def.slug },
      {
        $set: {
          name: def.name,
          description: def.description,
          permissions: def.permissions,
          protected: def.protected,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    bySlug.set(def.slug, role)
    console.log(`   • rôle « ${def.slug} » prêt (${def.permissions.join(', ')})`)
  }

  // Migration : retire des rôles personnalisés les permissions qui ne sont
  // plus au catalogue (ex. anciens `city:edit`, `ctf:*`).
  const known = new Set(['*', ...ALL_PERMISSIONS])
  const customRoles = await Role.find({ protected: { $ne: true } })
  for (const role of customRoles) {
    const cleaned = role.permissions.filter((p) => known.has(p))
    if (cleaned.length !== role.permissions.length) {
      role.permissions = cleaned
      await role.save()
      console.log(`   • rôle « ${role.slug} » : permissions obsolètes retirées`)
    }
  }
  return bySlug
}

/** Crée un compte s'il n'existe pas ; ne réécrit jamais un mot de passe existant. */
async function ensureUser({ username, email, displayName, role, password }) {
  const existing = await User.findOne({ $or: [{ username }, { email: email.toLowerCase() }] })
  if (existing) {
    console.log(`   • compte « ${username} » déjà présent — inchangé`)
    return
  }
  const finalPassword = password || randomPassword()
  await User.create({
    username,
    email,
    displayName,
    passwordHash: await hashPassword(finalPassword),
    role: role._id,
  })
  console.log(`   ✅ compte « ${username} » créé (rôle ${role.slug})`)
  if (!password) {
    console.log(`      ⚠️  mot de passe généré : ${finalPassword}`)
    console.log('         (renseignez-le dans le .env pour le fixer)')
  }
}

async function main() {
  await connectDB()
  console.log('🌱 Seed Sector 404…')

  console.log(' Rôles système :')
  const roles = await seedRoles()

  console.log(' Comptes initiaux :')
  await ensureUser({
    username: env.SEED_ADMIN_USERNAME,
    email: env.SEED_ADMIN_EMAIL,
    displayName: 'Administrateur',
    role: roles.get('admin'),
    password: env.SEED_ADMIN_PASSWORD,
  })
  await ensureUser({
    username: env.SEED_USER_USERNAME,
    email: env.SEED_USER_EMAIL,
    displayName: 'Opérateur',
    role: roles.get('operator'),
    password: env.SEED_USER_PASSWORD,
  })

  console.log(' Plan de ville :')
  await seedCityPlan()

  console.log('✨ Seed terminé.')
  await disconnectDB()
  process.exit(0)
}

main().catch(async (err) => {
  console.error('Échec du seed :', err)
  await disconnectDB()
  process.exit(1)
})
