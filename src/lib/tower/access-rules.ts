/** This never treats the public event configuration as authorization. */
export function canAccessTower(role: string, userId: string, testerIds: readonly string[]): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN" || testerIds.includes(userId);
}
