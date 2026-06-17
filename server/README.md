# Back-end — Sector 404 (MVP 0.1.0)

API Node.js + Express + MongoDB pour l'IHM de supervision « Sector 404 ».
Couvre l'authentification, les sessions par cookies JWT et le RBAC (cf. cahier
des charges §3.1).

## Stack & sécurité

- **Express** + **Mongoose** (MongoDB).
- **argon2id** pour le hachage des mots de passe (`@node-rs/argon2`).
- **JWT en cookies `httpOnly` / `secure` / `sameSite=strict`** : access token
  court (15 min) + refresh token (7 j). Pas de token exposé au JS → résistant au
  XSS ; `sameSite=strict` → protège du CSRF.
- **RBAC** : rôles → permissions granulaires, contrôle **côté serveur** sur
  chaque route (`requirePermission`).
- **helmet**, **CORS** restreint à l'origine du front, **rate-limit** sur la
  connexion, **journal d'audit** des actions sensibles.

## Démarrage

```bash
# 1. MongoDB (ou une instance locale déjà lancée)
docker compose up -d

# 2. Dépendances
npm install

# 3. Configuration
cp .env.example .env      # puis renseigner les secrets et identifiants

# 4. Seed (rôles système + admin + opérateur)
npm run seed

# 5. API
npm run dev               # http://localhost:4000
```

Les identifiants des comptes initiaux sont définis dans le `.env`
(`SEED_ADMIN_*`, `SEED_USER_*`). Si un mot de passe n'est pas fourni, le seed en
génère un et l'affiche **une seule fois**.

## Rôles livrés (seed)

| Slug          | Permissions                                  |
| ------------- | -------------------------------------------- |
| `admin`       | `*` (accès total)                            |
| `operator`    | supervision, pilotage, CTF (lecture), audit  |
| `participant` | supervision (lecture), CTF (lecture)         |
| `observer`    | lecture seule                                |

L'admin peut créer des rôles personnalisés et ajuster les permissions via l'IHM
d'administration (`/administration`).

## Endpoints principaux

| Méthode | Route                  | Permission       | Rôle                          |
| ------- | ---------------------- | ---------------- | ----------------------------- |
| POST    | `/api/auth/login`      | —                | Connexion (cookies)           |
| POST    | `/api/auth/refresh`    | —                | Renouvelle l'access token     |
| POST    | `/api/auth/logout`     | —                | Déconnexion                   |
| GET     | `/api/auth/me`         | authentifié      | Profil + permissions          |
| GET     | `/api/users`           | `users:read`     | Liste des comptes             |
| POST    | `/api/users`           | `users:manage`   | Crée un compte                |
| PATCH   | `/api/users/:id`       | `users:manage`   | Modifie / désactive un compte |
| GET     | `/api/roles`           | `roles:read`     | Liste des rôles               |
| GET     | `/api/roles/permissions` | `roles:read`   | Catalogue des permissions     |
| POST    | `/api/roles`           | `roles:manage`   | Crée un rôle                  |
| PATCH   | `/api/roles/:id`       | `roles:manage`   | Modifie un rôle               |
| DELETE  | `/api/roles/:id`       | `roles:manage`   | Supprime un rôle non protégé  |
