/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Unique URL de l'API : appels front (apiFetch + SSE) et cible du proxy dev
   * (Vite en dérive l'origine). URL relative ('/api') = same-origin direct.
   */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
