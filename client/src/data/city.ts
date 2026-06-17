import type { CityComponent, CityEvent, CityLayout, EventSeverity } from '@/types/city'

/**
 * Ville fictive « Chateauval » — Bretagne, France (48.061° N, 2.969° O).
 * Plan déclaré en coordonnées 1000 × 1000.
 *
 * `defaultLayout` est le plan par défaut : il est chargé dans le store,
 * modifiable via l'éditeur de ville et persisté en localStorage.
 * Données 100 % mockées : aucune connexion back-end pour le moment.
 */

export const CITY_INFO = {
  name: 'Chateauval',
  region: 'Bretagne, France',
  coords: '48.061° N · 2.969° O',
}

/* ---------------------------------------------
   Actions réutilisables (déclaratives)
--------------------------------------------- */

export const SI_ACTIONS = [
  { id: 'restart', label: 'Redémarrer le service', effect: { key: 'service', value: 'redémarrage' } },
  { id: 'isolate', label: 'Isoler du réseau SI', critical: true },
  { id: 'audit', label: 'Lancer un audit de logs' },
]

export const LIGHT_ACTIONS = [
  { id: 'cycle-normal', label: 'Repasser en cycle normal', effect: { key: 'mode', value: 'normal' } },
  { id: 'force-orange', label: 'Orange clignotant', effect: { key: 'mode', value: 'orange' } },
  { id: 'force-red', label: 'Forcer au rouge', critical: true, effect: { key: 'mode', value: 'rouge' } },
]

export const BARRIER_ACTIONS = [
  { id: 'open', label: 'Ouvrir la barrière', effect: { key: 'open', value: true } },
  { id: 'close', label: 'Fermer la barrière', effect: { key: 'open', value: false } },
]

export const LAMP_ACTIONS = [
  { id: 'on', label: 'Allumer', effect: { key: 'on', value: true } },
  { id: 'off', label: 'Éteindre', effect: { key: 'on', value: false } },
]

/* ---------------------------------------------
   Composants par défaut
--------------------------------------------- */

const defaultComponents: CityComponent[] = [
  /* --- Bâtiments hébergeant un SI --- */
  {
    id: 'centrale',
    name: 'Centrale électrique',
    kind: 'building',
    category: 'Énergie',
    si: true,
    description: 'Production et distribution électrique de la ville (SCADA).',
    footprint: { x: 30, y: 40, w: 170, d: 150, h: 70 },
    initialStatus: 'ok',
    metrics: {
      Production: '2,4 MW',
      'Charge réseau': '68 %',
      Température: '41 °C',
      Uptime: '99,97 %',
    },
    actions: [
      { id: 'shed', label: 'Délester le quartier Nord', critical: true },
      ...SI_ACTIONS,
    ],
  },
  {
    id: 'usine',
    name: 'Usine',
    kind: 'building',
    category: 'Industrie',
    si: true,
    description: 'Site industriel — automates de production (OT).',
    footprint: { x: 610, y: 50, w: 190, d: 145, h: 55 },
    initialStatus: 'warning',
    metrics: {
      Cadence: '82 %',
      'Température four': '612 °C',
      Vibration: 'Anormale (VIB-04)',
      Uptime: '97,1 %',
    },
    actions: SI_ACTIONS,
  },
  {
    id: 'tribunal',
    name: 'Tribunal',
    kind: 'building',
    category: 'Civique',
    si: true,
    footprint: { x: 270, y: 372, w: 160, d: 72, h: 45 },
    initialStatus: 'ok',
    metrics: { 'Postes connectés': '18', Latence: '12 ms', Uptime: '99,2 %' },
    actions: SI_ACTIONS,
  },
  {
    id: 'banque',
    name: 'Banque',
    kind: 'building',
    category: 'Finance',
    si: true,
    description: 'Agence bancaire — SI sensible.',
    footprint: { x: 505, y: 372, w: 130, d: 72, h: 52 },
    initialStatus: 'critical',
    metrics: {
      Transactions: 'Suspendues',
      IDS: 'Intrusion détectée',
      'Dernier flag': 'il y a 4 min',
      Uptime: '92,4 %',
    },
    actions: SI_ACTIONS,
  },
  {
    id: 'police',
    name: 'Commissariat',
    kind: 'building',
    category: 'Sécurité',
    si: true,
    footprint: { x: 520, y: 480, w: 150, d: 100, h: 45 },
    initialStatus: 'ok',
    metrics: { 'Caméras actives': '12 / 12', Latence: '9 ms', Uptime: '99,8 %' },
    actions: SI_ACTIONS,
  },
  {
    id: 'pompiers',
    name: 'Caserne de pompiers',
    kind: 'building',
    category: 'Secours',
    si: true,
    footprint: { x: 520, y: 660, w: 180, d: 115, h: 40 },
    initialStatus: 'ok',
    metrics: { 'Véhicules prêts': '3 / 3', Alarme: 'Repos', Uptime: '99,9 %' },
    actions: [{ id: 'alarm', label: "Déclencher l'alarme", critical: true }, ...SI_ACTIONS],
  },
  {
    id: 'mairie',
    name: 'Mairie',
    kind: 'building',
    category: 'Civique',
    si: true,
    footprint: { x: 270, y: 645, w: 160, d: 80, h: 50 },
    initialStatus: 'ok',
    metrics: { 'Postes connectés': '24', Latence: '11 ms', Uptime: '99,5 %' },
    actions: SI_ACTIONS,
  },
  {
    id: 'bibliotheque',
    name: 'Bibliothèque',
    kind: 'building',
    category: 'Culture',
    si: true,
    footprint: { x: 270, y: 755, w: 160, d: 70, h: 38 },
    initialStatus: 'ok',
    metrics: { 'Bornes publiques': '6', 'Wi-Fi public': 'Actif', Uptime: '99,1 %' },
    actions: SI_ACTIONS,
  },

  /* --- Commerces & café --- */
  {
    id: 'commerces-ouest',
    name: 'Commerces Ouest',
    kind: 'building',
    category: 'Commerce',
    footprint: { x: 60, y: 380, w: 70, d: 130, h: 28 },
    initialStatus: 'ok',
    metrics: { Boutiques: '5', 'Conso élec.': '8,2 kW' },
    actions: LAMP_ACTIONS,
  },
  {
    id: 'commerces-est-a',
    name: 'Commerces Est A',
    kind: 'building',
    category: 'Commerce',
    footprint: { x: 925, y: 80, w: 55, d: 170, h: 26 },
    initialStatus: 'ok',
    metrics: { Boutiques: '4', 'Conso élec.': '6,1 kW' },
    actions: LAMP_ACTIONS,
  },
  {
    id: 'commerces-est-b',
    name: 'Commerces Est B',
    kind: 'building',
    category: 'Commerce',
    footprint: { x: 925, y: 290, w: 55, d: 170, h: 26 },
    initialStatus: 'ok',
    metrics: { Boutiques: '4', 'Conso élec.': '5,4 kW' },
    actions: LAMP_ACTIONS,
  },
  {
    id: 'cafe',
    name: 'Café de la Place',
    kind: 'building',
    category: 'Commerce',
    footprint: { x: 925, y: 510, w: 55, d: 80, h: 24 },
    initialStatus: 'ok',
    metrics: { Terrasse: 'Ouverte', 'Conso élec.': '2,3 kW' },
    actions: LAMP_ACTIONS,
  },
  {
    id: 'commerces-sud-a',
    name: 'Commerces Sud A',
    kind: 'building',
    category: 'Commerce',
    footprint: { x: 80, y: 925, w: 180, d: 55, h: 26 },
    initialStatus: 'ok',
    metrics: { Boutiques: '6', 'Conso élec.': '7,8 kW' },
    actions: LAMP_ACTIONS,
  },
  {
    id: 'commerces-sud-b',
    name: 'Commerces Sud B',
    kind: 'building',
    category: 'Commerce',
    footprint: { x: 320, y: 925, w: 170, d: 55, h: 26 },
    initialStatus: 'ok',
    metrics: { Boutiques: '5', 'Conso élec.': '6,9 kW' },
    actions: LAMP_ACTIONS,
  },
  {
    id: 'commerces-sud-c',
    name: 'Commerces Sud C',
    kind: 'building',
    category: 'Commerce',
    footprint: { x: 540, y: 925, w: 180, d: 55, h: 26 },
    initialStatus: 'ok',
    metrics: { Boutiques: '6', 'Conso élec.': '8,4 kW' },
    actions: LAMP_ACTIONS,
  },

  /* --- Lotissement (maisons) --- */
  ...(
    [
      [270, 55],
      [355, 35],
      [445, 60],
      [530, 35],
      [285, 175],
      [370, 205],
      [455, 170],
      [545, 205],
    ] as const
  ).map(
    ([x, y], i): CityComponent => ({
      id: `maison-${i + 1}`,
      name: `Maison ${i + 1}`,
      kind: 'building',
      category: 'Résidentiel',
      footprint: { x, y, w: 56, d: 46, h: 26 },
      initialStatus: 'ok',
      metrics: { 'Conso élec.': '1,2 kW', Éclairage: 'Auto' },
      actions: LAMP_ACTIONS,
      initialState: { on: true },
    }),
  ),

  /* --- Parkings --- */
  {
    id: 'parking-ouest',
    name: 'Parking Ouest',
    kind: 'parking',
    category: 'Mobilité',
    footprint: { x: 40, y: 640, w: 170, d: 195, h: 0 },
    initialStatus: 'ok',
    metrics: { Occupation: '34 / 60', Barrière: 'P-O-BAR' },
    actions: [],
  },
  {
    id: 'parking-ne',
    name: 'Parking Nord-Est',
    kind: 'parking',
    category: 'Mobilité',
    footprint: { x: 630, y: 372, w: 170, d: 100, h: 0 },
    initialStatus: 'ok',
    metrics: { Occupation: '58 / 80', Barrière: 'P-NE-BAR' },
    actions: [],
  },

  /* --- Feux tricolores --- */
  {
    id: 'feu-a1',
    name: 'Feu tricolore A1',
    kind: 'traffic-light',
    category: 'Mobilité',
    description: 'Av. de la République × Rue du Centre (N-O)',
    point: { x: 424, y: 282 },
    initialStatus: 'ok',
    metrics: { Cycle: '90 s', Mode: 'Normal' },
    actions: LIGHT_ACTIONS,
    initialState: { mode: 'normal' },
  },
  {
    id: 'feu-a2',
    name: 'Feu tricolore A2',
    kind: 'traffic-light',
    category: 'Mobilité',
    description: 'Av. de la République × Rue du Centre (S-E)',
    point: { x: 488, y: 368 },
    initialStatus: 'ok',
    metrics: { Cycle: '90 s', Mode: 'Normal' },
    actions: LIGHT_ACTIONS,
    initialState: { mode: 'normal' },
  },
  {
    id: 'feu-a3',
    name: 'Feu tricolore A3',
    kind: 'traffic-light',
    category: 'Mobilité',
    description: 'Av. de la République × Boulevard Est',
    point: { x: 826, y: 282 },
    initialStatus: 'offline',
    metrics: { Cycle: '—', Mode: 'Hors ligne' },
    actions: LIGHT_ACTIONS,
    initialState: { mode: 'normal' },
  },
  {
    id: 'feu-a4',
    name: 'Feu tricolore A4',
    kind: 'traffic-light',
    category: 'Mobilité',
    description: 'Rue du Centre × Boulevard Sud',
    point: { x: 424, y: 826 },
    initialStatus: 'ok',
    metrics: { Cycle: '120 s', Mode: 'Normal' },
    actions: LIGHT_ACTIONS,
    initialState: { mode: 'normal' },
  },
  {
    id: 'feu-a5',
    name: 'Feu tricolore A5',
    kind: 'traffic-light',
    category: 'Mobilité',
    description: 'Diagonale × Rue du Centre',
    point: { x: 478, y: 612 },
    initialStatus: 'ok',
    metrics: { Cycle: '60 s', Mode: 'Normal' },
    actions: LIGHT_ACTIONS,
    initialState: { mode: 'normal' },
  },

  /* --- Barrières --- */
  {
    id: 'barriere-centrale',
    name: 'Barrière Centrale (P-C-BAR)',
    kind: 'barrier',
    category: 'Mobilité',
    description: 'Contrôle d’accès au site de la centrale électrique.',
    point: { x: 204, y: 115 },
    initialStatus: 'ok',
    metrics: { 'Cycles aujourd’hui': '14', Badgeuse: 'OK' },
    actions: BARRIER_ACTIONS,
    initialState: { open: false },
  },
  {
    id: 'barriere-parking-ouest',
    name: 'Barrière Parking Ouest (P-O-BAR)',
    kind: 'barrier',
    category: 'Mobilité',
    point: { x: 120, y: 820 },
    initialStatus: 'ok',
    metrics: { 'Cycles aujourd’hui': '212', Badgeuse: 'OK' },
    actions: BARRIER_ACTIONS,
    initialState: { open: false },
  },
  {
    id: 'barriere-parking-ne',
    name: 'Barrière Parking N-E (P-NE-BAR)',
    kind: 'barrier',
    category: 'Mobilité',
    point: { x: 713, y: 368 },
    initialStatus: 'ok',
    metrics: { 'Cycles aujourd’hui': '318', Badgeuse: 'OK' },
    actions: BARRIER_ACTIONS,
    initialState: { open: true },
  },

  /* --- Éclairage public --- */
  ...(
    [
      [300, 278],
      [560, 278],
      [745, 278],
      [822, 470],
      [822, 720],
      [320, 822],
    ] as const
  ).map(
    ([x, y], i): CityComponent => ({
      id: `lampadaire-${i + 1}`,
      name: `Lampadaire L${i + 1}`,
      kind: 'lamp',
      category: 'Éclairage public',
      point: { x, y },
      initialStatus: i === 1 ? 'warning' : 'ok',
      metrics: { Puissance: '150 W', Pilotage: 'LoRa' },
      actions: LAMP_ACTIONS,
      initialState: { on: true },
    }),
  ),
]

/* ---------------------------------------------
   Plan par défaut (zones, voirie, décor)
--------------------------------------------- */

export const defaultLayout: CityLayout = {
  components: defaultComponents,

  zones: [
    { id: 'z-quartier-nord', type: 'quartier', x: 262, y: -25, w: 580, d: 313 },
    { id: 'z-technique', type: 'technique', x: -25, y: -25, w: 232, d: 313 },
    { id: 'z-parc-ouest', type: 'parc', x: -25, y: 362, w: 232, d: 480 },
    { id: 'z-parc-central', type: 'parc', x: 270, y: 478, w: 160, d: 136 },
    { id: 'z-esplanade-est', type: 'esplanade', x: 899, y: -25, w: 126, d: 1050 },
    { id: 'z-esplanade-sud', type: 'esplanade', x: -25, y: 899, w: 924, d: 126 },
    { id: 'z-etang', type: 'eau', x: 58, y: 444, w: 124, d: 72 },
  ],

  roads: [
    {
      id: 'r-periph',
      name: 'Boulevard périphérique',
      type: 'standard',
      width: 58,
      points: [
        { x: 870, y: -25 },
        { x: 870, y: 820 },
        { x: 820, y: 870 },
        { x: -25, y: 870 },
      ],
    },
    {
      id: 'r-avenue',
      name: 'Avenue de la République (tram)',
      type: 'tram',
      width: 74,
      points: [
        { x: -25, y: 325 },
        { x: 870, y: 325 },
      ],
    },
    {
      id: 'r-gauche',
      name: 'Rue de la Centrale',
      type: 'standard',
      width: 52,
      points: [
        { x: 235, y: -25 },
        { x: 235, y: 325 },
      ],
    },
    {
      id: 'r-centre',
      name: 'Rue du Centre',
      type: 'standard',
      width: 52,
      points: [
        { x: 455, y: 325 },
        { x: 455, y: 870 },
      ],
    },
    {
      id: 'r-diagonale',
      name: 'Diagonale du Parc',
      type: 'standard',
      width: 40,
      points: [
        { x: -25, y: 495 },
        { x: 455, y: 615 },
      ],
    },
    {
      id: 'r-pompiers',
      name: 'Rue des Pompiers',
      type: 'standard',
      width: 36,
      points: [
        { x: 455, y: 618 },
        { x: 870, y: 618 },
      ],
    },
    {
      id: 'r-acces-po',
      name: 'Accès Parking Ouest',
      type: 'standard',
      width: 26,
      points: [
        { x: 120, y: 870 },
        { x: 120, y: 805 },
      ],
    },
    {
      id: 'r-allee-lotissement',
      name: 'Allée du Lotissement',
      type: 'pietonne',
      width: 16,
      points: [
        { x: 262, y: 140 },
        { x: 430, y: 95, smooth: true },
        { x: 590, y: 200 },
      ],
    },
    {
      id: 'r-allee-parc',
      name: 'Allée du Parc',
      type: 'pietonne',
      width: 14,
      points: [
        { x: 40, y: 420 },
        { x: 160, y: 540, smooth: true },
        { x: 300, y: 545 },
      ],
    },
  ],

  /* Contrôles d'intersections (détectées automatiquement) :
     clé = `idRouteA|idRouteB|n` dans l'ordre de déclaration des routes. */
  intersections: {
    'r-avenue|r-gauche|0': 'feux',
    'r-periph|r-pompiers|0': 'stop',
  },

  /* Plateaux de maquette 1 m × 1 m (extensibles dans l'éditeur). */
  modules: [{ x: 0, y: 0 }],

  crosswalks: [
    { id: 'cw-1', x: 455, y: 325, angle: 0, span: 74 },
    { id: 'cw-2', x: 455, y: 870, angle: 0, span: 58 },
    { id: 'cw-3', x: 455, y: 400, angle: 90, span: 52 },
  ],

  trees: (
    [
      [70, 260],
      [130, 310],
      [75, 420],
      [150, 580],
      [90, 560],
      [300, 520],
      [360, 555],
      [400, 505],
      [640, 235],
      [760, 235],
      [620, 80],
      [620, 180],
    ] as const
  ).map(([x, y], i) => ({ id: `tree-${i + 1}`, x, y })),
}

/* ---------------------------------------------
   Événements mockés
--------------------------------------------- */

let eventSeq = 0

function ago(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000)
}

export function makeEvent(
  severity: EventSeverity,
  message: string,
  componentId?: string,
  time = new Date(),
): CityEvent {
  return { id: ++eventSeq, time, severity, message, componentId }
}

export function initialEvents(): CityEvent[] {
  return [
    makeEvent('critical', 'IDS Banque : intrusion détectée — segment isolé par l’équipe bleue', 'banque', ago(2)),
    makeEvent('warning', 'Usine : vibration anormale ligne 2 (capteur VIB-04)', 'usine', ago(9)),
    makeEvent('info', 'Feu A3 : perte de liaison — passage en mode dégradé', 'feu-a3', ago(14)),
    makeEvent('success', 'Barrière Parking N-E : cycle de test terminé', 'barriere-parking-ne', ago(21)),
    makeEvent('info', 'Règles RBAC mises à jour par admin@sector404', undefined, ago(33)),
    makeEvent('info', 'Centrale : pic de charge 74 % absorbé', 'centrale', ago(47)),
    makeEvent('success', 'Sauvegarde MongoDB terminée (12,4 Mo)', undefined, ago(58)),
  ]
}

/** Événements simulés, joués en boucle (mode démo sans back-end). */
export const simulationPool: ReadonlyArray<{
  severity: EventSeverity
  message: string
  componentId?: string
}> = [
  { severity: 'info', message: 'Relevé capteurs : 45 / 45 composants interrogés' },
  { severity: 'warning', message: 'Usine : température four au-dessus du seuil souple', componentId: 'usine' },
  { severity: 'info', message: 'Feu A1 : passage en cycle nuit programmé à 22h00', componentId: 'feu-a1' },
  { severity: 'success', message: 'Banque : règle de pare-feu poussée par l’équipe bleue', componentId: 'banque' },
  { severity: 'info', message: 'Éclairage public : luminosité ajustée (capteur crépusculaire)' },
  { severity: 'warning', message: 'Parking Ouest : file d’attente détectée à la barrière', componentId: 'barriere-parking-ouest' },
]
