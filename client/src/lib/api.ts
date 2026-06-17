/**
 * Petit client HTTP pour l'API Sector 404.
 *
 * - `credentials: 'include'` : envoie les cookies de session (httpOnly).
 * - Refresh automatique transparent : sur un 401, on tente un `/auth/refresh`
 *   une fois puis on rejoue la requête. Évite que l'access token court (15 min)
 *   ne casse l'expérience.
 */

export class ApiError extends Error {
  status: number
  code: string | null
  constructor(status: number, message: string, code: string | null = null) {
    super(message)
    this.status = status
    this.code = code
  }
}

/**
 * Base des appels API, configurable via `.env` (VITE_API_URL).
 * `/api` par défaut : same-origin via le proxy Vite en dev, le reverse-proxy
 * en prod. Exportée pour les usages hors `apiFetch` (EventSource SSE).
 */
export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

const BASE = API_BASE

let refreshing: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  // Un seul refresh concurrent partagé entre les requêtes en vol.
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Désactive le refresh auto (utilisé par les routes d'auth elles-mêmes). */
  noRetry?: boolean
}

async function raw(path: string, opts: RequestOptions): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await raw(path, opts)

  if (res.status === 401 && !opts.noRetry) {
    const ok = await tryRefresh()
    if (ok) res = await raw(path, opts)
  }

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json().catch(() => null) : null

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Erreur ${res.status}`, data?.code ?? null)
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown, noRetry = false) =>
    apiFetch<T>(path, { method: 'POST', body, noRetry }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
}
