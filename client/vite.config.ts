import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')

  // Unique source de vérité : VITE_API_URL. On en extrait le chemin de base
  // (ex. '/api') à proxifier en dev et l'origine (ex. http://localhost:4000)
  // vers laquelle relayer. Une URL relative ('/api') désactive le proxy
  // (same-origin direct).
  const apiUrl = env.VITE_API_URL || '/api'
  const isAbsolute = /^https?:\/\//i.test(apiUrl)
  const apiBasePath = isAbsolute ? new URL(apiUrl).pathname : apiUrl
  const apiOrigin = isAbsolute ? new URL(apiUrl).origin : null

  return {
    plugins: [
      vue(),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    server: {
      // L'API back-end (Express) est relayée en dev pour rester en same-origin
      // (cookies httpOnly sans CORS). La cible est dérivée de VITE_API_URL : pas
      // de proxy si l'URL est relative (front et API déjà same-origin).
      proxy: apiOrigin
        ? {
            [apiBasePath]: {
              target: apiOrigin,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  }
})
