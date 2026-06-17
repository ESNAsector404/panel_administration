import { hash, verify } from '@node-rs/argon2'

/**
 * Paramètres argon2id (RF-AUTH-01). Réglages conformes aux recommandations
 * OWASP : argon2id, mémoire 19 Mio, 2 itérations, parallélisme 1.
 */
const OPTIONS = {
  // 2 = Argon2id dans @node-rs/argon2
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

export function hashPassword(plain) {
  return hash(plain, OPTIONS)
}

export async function verifyPassword(storedHash, plain) {
  try {
    return await verify(storedHash, plain)
  } catch {
    return false
  }
}
