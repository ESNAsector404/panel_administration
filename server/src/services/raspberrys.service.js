import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_TIMEOUT_MS = 2000;

/**
 * @typedef {{ id: string, name: string, host: string }} RaspberryConfig
 * @typedef {{ raspberrys: RaspberryConfig[] }} Config
 * @typedef {{ status: 'online', components: object }} PiOnline
 * @typedef {{ status: 'offline', components: {}, error: string }} PiOffline
 * @typedef {PiOnline | PiOffline} PiResult
 */

/**
 * Charge la configuration depuis le fichier YAML.
 * Le chemin peut être surchargé via la variable d'environnement CONFIG_PATH.
 * @returns {Config}
 */
export function getConfig() {
  const configPath =
    process.env.CONFIG_PATH ??
    path.join(__dirname, '../config/raspberrys.yaml');

  try {
    const file = fs.readFileSync(configPath, 'utf8');
    return YAML.parse(file);
  } catch (error) {
    console.error('Error reading config file:', error);
    throw error;
  }
}

/**
 * Effectue un fetch avec un timeout en millisecondes.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeout
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Vérifie que le endpoint /health répond correctement.
 * Lève une erreur si le statut HTTP n'est pas ok.
 * @param {string} host
 */
async function checkHealth(host) {
  const res = await fetchWithTimeout(`${host}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed for ${host}: ${res.status} ${res.statusText}`);
  }
}

/**
 * Interroge un Raspberry Pi et retourne son état.
 * @param {string} host
 * @returns {Promise<PiResult>}
 */
async function getPI(host) {
  try {
    await checkHealth(host);

    const res = await fetchWithTimeout(`${host}/conf`);
    if (!res.ok) {
      throw new Error(`Failed to fetch config from ${host}: ${res.statusText}`);
    }

    const conf = await res.json();
    return {
      status: 'online',
      components: conf || {},
    };
  } catch (e) {
    return {
      status: 'offline',
      components: {},
      error: e.name === 'AbortError' ? `Timeout (>${DEFAULT_TIMEOUT_MS}ms)` : e.message,
    };
  }
}

/**
 * Interroge tous les Raspberry Pi en parallèle et retourne leurs états.
 * @returns {Promise<Record<string, PiResult>>}
 */
export async function getAllRaspberrys() {
  const config = getConfig();

  const entries = await Promise.all(
    config.raspberrys.map(async ({ id, host }) => [id, await getPI(host)])
  );

  return Object.fromEntries(entries);
}