/**
 * Modèle agnostique des composants de la ville (cf. cahier des charges §1.3) :
 * un service métier = un type de composant déclaré dynamiquement
 * (nom, icône, états, actions), sans logique codée en dur.
 */

export type Status = 'ok' | 'warning' | 'critical' | 'offline'

export type ComponentKind = 'building' | 'parking' | 'traffic-light' | 'barrier' | 'lamp'

export interface Footprint {
  x: number
  y: number
  w: number
  d: number
  h: number
}

export interface Point {
  x: number
  y: number
}

/** Effet local (mock) d'une action sur l'état du composant. */
export interface ActionEffect {
  key: string
  value: string | boolean
}

export interface ComponentAction {
  id: string
  label: string
  critical?: boolean
  effect?: ActionEffect
}

/** Lumière pilotable rattachée à un composant (LED sur la maquette). */
export interface ComponentLight {
  id: string
  name: string
}

export interface CityComponent {
  id: string
  name: string
  kind: ComponentKind
  /** Catégorie métier déclarative (énergie, sécurité, mobilité…). */
  category: string
  /** Bâtiment hébergeant un SI. */
  si?: boolean
  description?: string
  footprint?: Footprint
  /**
   * Contour libre du bâtiment (coordonnées plan absolues, ≥ 3 sommets).
   * Prend le pas sur le rectangle du footprint ; permet murs diagonaux,
   * rotations et formes avancées. Le footprint reste la bounding box.
   */
  poly?: Point[]
  point?: Point
  initialStatus: Status
  /** Métriques mockées affichées dans le panneau de détail. */
  metrics: Record<string, string>
  actions: ComponentAction[]
  /** État interne initial (barrière ouverte, lampe allumée…). */
  initialState?: Record<string, string | boolean>
  /**
   * Lumières du composant (0..n). Un bâtiment sans lumière ni SI n'est pas
   * connecté : aucun widget ne le considère comme opérationnel. L'état
   * allumé/éteint vit côté runtime (`states[id]['light:<lightId>']`).
   */
  lights?: ComponentLight[]
}

/* ---------------------------------------------
   Voirie & décor (édités via l'éditeur de ville)
--------------------------------------------- */

export type RoadType = 'standard' | 'pietonne' | 'tram'

/** Sommet de route : `smooth` lisse la courbe en ce point précis. */
export interface RoadPoint extends Point {
  smooth?: boolean
}

export interface Road {
  id: string
  name?: string
  type: RoadType
  /** Largeur de l'emprise (unités plan). */
  width: number
  /** Polyligne en coordonnées plan ; la route passe par chaque sommet. */
  points: RoadPoint[]
  /** Marquage axial pointillé (défaut : oui). */
  dashed?: boolean
}

/** Contrôle d'une intersection détectée automatiquement. */
export type IntersectionControl = 'none' | 'stop' | 'feux'

/** Mode de pilotage des feux d'une intersection (conduite simulée). */
export type LightMode = 'normal' | 'orange' | 'rouge'

/** Intersection calculée entre deux routes carrossables. */
export interface RoadIntersection {
  id: string
  x: number
  y: number
  /** Identifiants des deux routes (a déclarée avant b dans le plan). */
  a: string
  b: string
  /** Tangentes unitaires de chaque route au point de croisement. */
  ta: Point
  tb: Point
  /** Largeurs des deux routes. */
  wa: number
  wb: number
  control: IntersectionControl
  /** Mode courant des feux (uniquement si `control === 'feux'`). */
  mode: LightMode
}

export type ZoneType = 'parc' | 'eau' | 'quartier' | 'esplanade' | 'technique'

export interface Zone {
  id: string
  type: ZoneType
  x: number
  y: number
  w: number
  d: number
  /**
   * Contour libre de la zone (≥ 3 sommets, coordonnées plan absolues).
   * Prend le pas sur le rectangle x/y/w/d ; permet des bords diagonaux
   * (parkings en biais, esplanades, etc.). Le rectangle reste la bounding box.
   */
  poly?: Point[]
}

export interface Crosswalk {
  id: string
  x: number
  y: number
  /** Rotation en degrés (0 = traverse une route horizontale). */
  angle: number
  /** Largeur de la chaussée traversée. */
  span: number
}

export interface TreeItem {
  id: string
  x: number
  y: number
}

/** Module de maquette 1 m × 1 m (1000 × 1000 unités plan), en grille. */
export interface CityModule {
  x: number
  y: number
}

/** Plan complet de la ville — sérialisable (localStorage / export JSON). */
export interface CityLayout {
  components: CityComponent[]
  roads: Road[]
  zones: Zone[]
  crosswalks: Crosswalk[]
  trees: TreeItem[]
  /** Contrôle choisi par intersection détectée (clé = `idRouteA|idRouteB|n`). */
  intersections: Record<string, IntersectionControl>
  /** Mode des feux par intersection « feux » (clé = même id d'intersection). */
  intersectionModes?: Record<string, LightMode>
  /**
   * Mode de chaque feu pris individuellement (clé = id du feu `${idIntersection}-f${k}`).
   * Chaque feu d'une intersection est un composant à part entière (un feu = une
   * sortie pilotable côté maquette / Raspberry), supervisé et piloté comme un
   * feu tricolore posé à la main.
   */
  feuModes?: Record<string, LightMode>
  /** Plateaux de maquette posés côte à côte (au moins {x:0, y:0}). */
  modules: CityModule[]
  /** Durées du cycle des feux (calcul back-end ; défaut serveur sinon). */
  trafficCycle?: { greenMs: number; orangeMs: number }
}

/** Snapshot du moteur de feux servi par le back-end (source de vérité). */
export interface TrafficSnapshot {
  /** Époque d'ancrage du cycle (ms epoch serveur). */
  epoch: number
  /** Horloge serveur au moment du snapshot (correction de dérive). */
  now: number
  cycle: { greenMs: number; orangeMs: number }
  intersections: {
    id: string
    mode: LightMode
    phase: string
    step: string
    remainingMs: number
  }[]
  feuModes: Record<string, LightMode>
}

/* ---------------------------------------------
   Événements
--------------------------------------------- */

export type EventSeverity = 'info' | 'success' | 'warning' | 'critical'

export interface CityEvent {
  id: string | number
  time: Date
  severity: EventSeverity
  message: string
  componentId?: string
}
