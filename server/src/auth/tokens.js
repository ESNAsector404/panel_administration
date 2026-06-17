import jwt from 'jsonwebtoken'

import { env, isProd } from '../config/env.js'

export const ACCESS_COOKIE = 's404_at'
export const REFRESH_COOKIE = 's404_rt'

/**
 * Options de cookie communes — sécurité maximale (RNF-SEC) :
 *  - httpOnly : inaccessible au JS → pas de vol par XSS.
 *  - sameSite strict : protège contre le CSRF (le cookie n'est pas envoyé
 *    en cross-site).
 *  - secure : HTTPS uniquement (activé via COOKIE_SECURE en prod).
 */
function baseCookie(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  }
}

export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), type: 'access' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL },
  )
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: String(user._id), type: 'refresh', ver: user.tokenVersion },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.REFRESH_TOKEN_TTL },
  )
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET)
  if (payload.type !== 'access') throw new Error('mauvais type de jeton')
  return payload
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET)
  if (payload.type !== 'refresh') throw new Error('mauvais type de jeton')
  return payload
}

/** Pose les deux cookies de session sur la réponse. */
export function setAuthCookies(res, user) {
  res.cookie(ACCESS_COOKIE, signAccessToken(user), baseCookie(15 * 60 * 1000))
  res.cookie(REFRESH_COOKIE, signRefreshToken(user), baseCookie(7 * 24 * 60 * 60 * 1000))
}

export function clearAuthCookies(res) {
  const opts = { ...baseCookie(0) }
  delete opts.maxAge
  res.clearCookie(ACCESS_COOKIE, opts)
  res.clearCookie(REFRESH_COOKIE, opts)
}
