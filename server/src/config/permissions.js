/**
 * Catalogue des permissions RBAC (source de vérité).
 *
 * Le modèle est granulaire : un rôle porte une liste de permissions, et le
 * contrôle d'accès se fait toujours côté serveur (RNF-SEC). Le front ne fait
 * que masquer ce que l'utilisateur ne peut pas faire.
 *
 * Convention : `domaine:action`. Le wildcard `*` octroie tout (réservé à un
 * super-rôle). `domaine:*` octroie toutes les actions d'un domaine.
 */
export const PERMISSIONS = {
  // Accès aux pages de l'IHM. Accéder à une page donne le droit d'utiliser ce
  // qu'elle propose : `page:editor` autorise aussi la modification du plan
  // côté API (pas de permission d'édition séparée).
  PAGE_DASHBOARD: 'page:dashboard',
  PAGE_EDITOR: 'page:editor',
  PAGE_ADMIN: 'page:admin',
  // Supervision / vue ville
  CITY_READ: 'city:read',
  CITY_PILOT: 'city:pilot',
  // Journal d'audit
  AUDIT_READ: 'audit:read',
  // Administration RBAC
  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',
  ROLES_READ: 'roles:read',
  ROLES_MANAGE: 'roles:manage',
}

/** Liste plate de toutes les permissions connues (validation, UI admin). */
export const ALL_PERMISSIONS = Object.values(PERMISSIONS)

/**
 * Permissions groupées par domaine — pour l'affichage dans l'IHM d'admin.
 */
export const PERMISSION_GROUPS = [
  {
    domain: 'Pages',
    permissions: [
      { key: PERMISSIONS.PAGE_DASHBOARD, label: "Accéder à la vue d'ensemble (dashboard)" },
      { key: PERMISSIONS.PAGE_EDITOR, label: "Accéder à l'éditeur et modifier le plan de la ville" },
      { key: PERMISSIONS.PAGE_ADMIN, label: "Accéder à l'administration" },
    ],
  },
  {
    domain: 'Supervision',
    permissions: [
      { key: PERMISSIONS.CITY_READ, label: 'Consulter la ville (plan, états, événements)' },
      { key: PERMISSIONS.CITY_PILOT, label: 'Piloter les actionneurs (actions, lumières, feux)' },
    ],
  },
  {
    domain: 'Journal',
    permissions: [{ key: PERMISSIONS.AUDIT_READ, label: "Consulter le journal d'audit (module à venir)" }],
  },
  {
    domain: 'Administration',
    permissions: [
      { key: PERMISSIONS.USERS_READ, label: 'Consulter les utilisateurs' },
      { key: PERMISSIONS.USERS_MANAGE, label: 'Créer / modifier / désactiver des comptes' },
      { key: PERMISSIONS.ROLES_READ, label: 'Consulter les rôles' },
      { key: PERMISSIONS.ROLES_MANAGE, label: 'Créer / modifier des rôles et permissions' },
    ],
  },
]

const P = PERMISSIONS

/**
 * Rôles système livrés par défaut (cf. cahier des charges §2).
 * Ils sont créés/réconciliés par le seed et ne sont pas supprimables.
 * `protected: true` empêche la suppression et la modification du slug.
 */
export const SYSTEM_ROLES = [
  {
    slug: 'admin',
    name: 'Administrateur',
    description: "Encadrant / animateur d'exercice — accès total.",
    protected: true,
    permissions: ['*'],
  },
  {
    slug: 'operator',
    name: 'Opérateur',
    description: 'Défenseur / opérateur urbain — supervision temps réel et pilotage.',
    protected: true,
    permissions: [P.PAGE_DASHBOARD, P.CITY_READ, P.CITY_PILOT, P.AUDIT_READ],
  },
  {
    slug: 'participant',
    name: 'Participant',
    description: "Participant à un exercice — supervision en lecture.",
    protected: true,
    permissions: [P.PAGE_DASHBOARD, P.CITY_READ],
  },
  {
    slug: 'observer',
    name: 'Observateur',
    description: "Spectateur d'exercice — lecture seule.",
    protected: true,
    permissions: [P.PAGE_DASHBOARD, P.CITY_READ],
  },
]

/**
 * Un rôle possède-t-il une permission ? Gère les wildcards `*` et `domaine:*`.
 */
export function permissionGrants(granted, required) {
  if (granted.includes('*')) return true
  if (granted.includes(required)) return true
  const domain = required.split(':')[0]
  return granted.includes(`${domain}:*`)
}
