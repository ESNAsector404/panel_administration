<script setup lang="ts">
import { CITY_INFO } from '@/data/city'

/**
 * Silhouette low-poly de la France métropolitaine, projetée depuis de vraies
 * coordonnées : x = (lon + 5)·26 + 10, y = (51,5 − lat)·40 (viewBox 360×400).
 */
const FRANCE_PATH = [
  'M 201 18', // Dunkerque
  'L 221 36', // Lille
  'L 266 68', // Ardennes
  'L 312 80', // Lorraine NE
  'L 341 116', // Strasbourg
  'L 336 156', // Sud Alsace
  'L 317 204', // Jura
  'L 325 252', // Alpes
  'L 335 312', // Nice
  'L 296 336', // Toulon
  'L 278 328', // Marseille
  'L 241 320', // Montpellier
  'L 219 360', // Perpignan
  'L 153 352', // Pyrénées centrales
  'L 93 324', // Biarritz
  'L 109 276', // Côte landaise / Bordeaux
  'L 109 236', // Royan
  'L 106 212', // La Rochelle
  'L 83 192', // Vendée
  'L 80 168', // Saint-Nazaire
  'L 57 160', // Quiberon
  'L 18 140', // Pointe du Raz
  'L 20 124', // Brest
  'L 49 108', // Côte nord Bretagne
  'L 88 112', // Saint-Malo
  'L 91 72', // Pointe du Cotentin
  'L 111 84', // Cotentin est
  'L 130 86', // Caen
  'L 143 80', // Le Havre
  'L 169 62', // Dieppe
  'L 182 32', // Boulogne
  'Z',
].join(' ')

/** Position de Chateauval (48,061° N · 2,969° O — centre Bretagne). */
const CITY = { x: 63, y: 138 }
</script>

<template>
  <section class="card locator">
    <header class="locator__header">
      <h2 class="card-title">Localisation</h2>
      <span class="chip">FR</span>
    </header>

    <div class="locator__map">
      <svg viewBox="0 0 360 400">
        <path
          :d="FRANCE_PATH"
          fill="rgba(94,43,255,0.08)"
          stroke="#5e2bff"
          stroke-opacity="0.6"
          stroke-width="1.5"
          stroke-linejoin="round"
        />

        <!-- Ligne « circuit » vers l'étiquette -->
        <path
          :d="`M ${CITY.x} ${CITY.y} L 150 230 H 232`"
          stroke="#8b66ff"
          stroke-dasharray="4 5"
          fill="none"
        />

        <circle :cx="CITY.x" :cy="CITY.y" r="12" fill="#5e2bff" opacity="0.2" class="pulse" />
        <circle :cx="CITY.x" :cy="CITY.y" r="4.5" fill="#8b66ff" />

        <g transform="translate(238 218)">
          <rect width="106" height="42" rx="6" fill="#13111b" stroke="#332e47" />
          <text x="12" y="18" class="locator__city">{{ CITY_INFO.name.toUpperCase() }}</text>
          <text x="12" y="32" class="locator__coords">{{ CITY_INFO.coords }}</text>
        </g>
      </svg>
    </div>
  </section>
</template>

<style scoped>
.locator__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-4) var(--sp-4) var(--sp-3);
  border-bottom: 1px solid var(--border);
}

.locator__map {
  padding: var(--sp-3) var(--sp-4) var(--sp-4);
}

.locator__map svg {
  width: 100%;
  display: block;
}

.locator__city {
  font-family: var(--font-title);
  font-size: 12px;
  letter-spacing: 0.12em;
  fill: var(--text);
}

.locator__coords {
  font-family: var(--font-body);
  font-size: 9px;
  letter-spacing: 0.05em;
  fill: var(--text-faint);
}
</style>
