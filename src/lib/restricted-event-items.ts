/** Itens internos de um modo não podem vazar por recompensas genéricas. */
export function isRestrictedEventItem(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const data = metadata as Record<string, unknown>;
  return data.towerOnly === true || data.adminGrantOnly === true;
}
