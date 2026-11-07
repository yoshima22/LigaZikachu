import type { UnlockRule } from "./types";

export type UnlockContext = {
  mascotIds: Set<number>;
  stickerIds: Set<number>;
  /** geração → { owned, total } de figurinhas */
  gens: Record<number, { owned: number; total: number }>;
};

function ruleOk(rule: UnlockRule, ctx: UnlockContext) {
  if (rule.type === "mascot") return ctx.mascotIds.has(rule.pokemonId);
  if (rule.type === "sticker") return ctx.stickerIds.has(rule.pokemonId);
  const g = ctx.gens[rule.generation];
  return !!g && g.total > 0 && (g.owned / g.total) * 100 >= rule.percent;
}

export const isEntryUnlocked = (rules: UnlockRule[], ctx: UnlockContext) => rules.some((r) => ruleOk(r, ctx));

export function describeRule(rule: UnlockRule, nameOf: (id: number) => string = (id) => `#${id}`) {
  if (rule.type === "mascot") return `Ter (ou já ter tido) o mascote ${nameOf(rule.pokemonId)}`;
  if (rule.type === "sticker") return `Ter a figurinha de ${nameOf(rule.pokemonId)}`;
  return `Completar ${rule.percent}% do álbum da Geração ${rule.generation}`;
}
