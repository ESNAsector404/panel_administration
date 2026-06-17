/** Représentation publique d'un utilisateur authentifié, avec ses permissions. */
export function publicUser(user) {
  const role = user.role
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    displayName: user.displayName || user.username,
    active: user.active,
    lastLoginAt: user.lastLoginAt,
    role: role
      ? { id: String(role._id), slug: role.slug, name: role.name }
      : null,
    permissions: role?.permissions ?? [],
  }
}
