// Motor narrativo dos Laços: monta a frase-história de um encontro a partir do
// banco modular (bond-stories-data), com seleção por pontuação (contexto de
// personalidade/tier/elemento), cooldown por id/família e placeholders.
// Fase 1: aberturas + verbo + reação + desfecho. Arcos/callbacks vêm na Fase 2.

import { BOND_STORY_PHRASES, BOND_STORY_ARCS, type StoryPhrase, type StorySlot, type StoryLocal, type StoryResult } from "@/lib/bond-stories-data";

const ARC_BY_ID = new Map(BOND_STORY_ARCS.map((a) => [a.arcId, a]));
const LOCAL_LABEL: Record<string, string> = { GARDEN: "Horta", TRAINING: "Campo de Treino", REST: "Área de Descanso", YARD: "Pátio" };

export function pairKey(a: string, b: string): string { return [a, b].sort().join(":"); }

export type StoryTier = "NEMESIS" | "INIMIGO" | "RIVAL" | "CONHECIDO" | "COLEGA" | "AMIGO" | "SUPER_AMIGO";

export function tierFromScore(score: number): StoryTier {
  if (score <= -80) return "NEMESIS";
  if (score <= -50) return "INIMIGO";
  if (score <= -15) return "RIVAL";
  if (score <= 14) return "CONHECIDO";
  if (score <= 39) return "COLEGA";
  if (score <= 79) return "AMIGO";
  return "SUPER_AMIGO";
}

export type StoryActor = { name: string; owner: string; element: string; elementLabel: string; personality: string; personalityLabel: string };
export type StoryContext = {
  location: Exclude<StoryLocal, "ANY">;
  conflict: boolean;
  a: StoryActor;
  b: StoryActor;
  tier: StoryTier;
  encounterCount: number;
  recentIds: Set<string>;      // ids usados nos últimos ~20 encontros da dupla
  recentFamilies: Set<string>; // famílias usadas nos últimos ~8 encontros da dupla
  rng?: () => number;
};

function weightedPick(items: { p: StoryPhrase; w: number }[], rng: () => number): StoryPhrase | null {
  const total = items.reduce((sum, item) => sum + item.w, 0);
  if (total <= 0) return items[0]?.p ?? null;
  let roll = rng() * total;
  for (const item of items) { roll -= item.w; if (roll <= 0) return item.p; }
  return items[items.length - 1].p;
}

function selectPhrase(slot: StorySlot, ctx: StoryContext): StoryPhrase | null {
  const rng = ctx.rng ?? Math.random;
  const resultado: StoryResult = ctx.conflict ? "CONFLICT" : "POSITIVE";
  const pool = BOND_STORY_PHRASES.filter((p) =>
    p.slot === slot &&
    (p.local === "ANY" || p.local === ctx.location) &&
    (p.resultado === "ANY" || p.resultado === resultado) &&
    !p.requerMemoria &&
    // exclui frases incompatíveis com o contexto (etiquetas que não casam)
    !(p.personalidade && p.personalidade !== ctx.a.personality && p.personalidade !== ctx.b.personality) &&
    !(p.tier && p.tier !== "ANY" && p.tier !== ctx.tier) &&
    !(p.tipoElemental && p.tipoElemental !== "ANY" && p.tipoElemental !== ctx.a.element && p.tipoElemental !== ctx.b.element),
  );
  if (pool.length === 0) return null;
  const weighted = pool.map((p) => {
    let w = p.peso ?? 1;
    // Especificidade: frases que "casam" com estes mascotes ganham prioridade.
    if (p.personalidade && (p.personalidade === ctx.a.personality || p.personalidade === ctx.b.personality)) w *= 2.2;
    if (p.tier && p.tier === ctx.tier) w *= 1.8;
    if (p.tipoElemental && (p.tipoElemental === ctx.a.element || p.tipoElemental === ctx.b.element)) w *= 1.8;
    if (p.local === ctx.location) w *= 1.3;
    if (p.resultado === resultado) w *= 1.2;
    // Cooldown: id/família recentes da dupla são fortemente evitados (não banidos).
    if (ctx.recentIds.has(p.id)) w *= 0.02;
    if (p.familiaNarrativa && ctx.recentFamilies.has(p.familiaNarrativa)) w *= 0.12;
    return { p, w };
  });
  return weightedPick(weighted, rng);
}

export function resolvePlaceholders(text: string, ctx: StoryContext, localLabel: string): string {
  return text
    .replaceAll("{A}", ctx.a.name).replaceAll("{B}", ctx.b.name)
    .replaceAll("{DONO_A}", ctx.a.owner).replaceAll("{DONO_B}", ctx.b.owner)
    .replaceAll("{ELEMENTO_A}", ctx.a.elementLabel).replaceAll("{ELEMENTO_B}", ctx.b.elementLabel)
    .replaceAll("{PERSONALIDADE_A}", ctx.a.personalityLabel).replaceAll("{PERSONALIDADE_B}", ctx.b.personalityLabel)
    .replaceAll("{LOCAL}", localLabel)
    .replaceAll("{CONTAGEM_ENCONTROS}", String(ctx.encounterCount))
    // Placeholders de memória (Fase 2) — por ora removidos para não vazar.
    .replace(/\{MEMORIA_[A-Z]+\}|\{OBJETO_MEMORIA\}/g, "")
    .replace(/\s{2,}/g, " ").trim();
}

/** Monta a história de um encontro entre dois mascotes. */
export function buildRefugeStory(ctx: StoryContext, localLabel: string): { text: string; phraseIds: string[]; families: string[] } {
  const opening = selectPhrase("ABERTURA", ctx);
  const verbo = selectPhrase("VERBO_LOCAL", ctx);
  const reacao = selectPhrase("REACAO", ctx);
  const desfecho = selectPhrase("DESFECHO", ctx);

  const A = ctx.a.name, B = ctx.b.name;
  const openText = (opening?.texto ?? "").trim();
  const verboText = verbo?.texto ?? "se encontraram";
  const endsConnective = /\bquando$/i.test(openText);

  const used: StoryPhrase[] = [];
  if (opening) used.push(opening);
  if (verbo) used.push(verbo);

  let raw: string;
  if (endsConnective) {
    // "…quando {A} e {B} <verbo>. <desfecho>" (a reação é dispensada nesta forma)
    raw = `${openText} ${A} e ${B} ${verboText}.`;
    if (desfecho) { raw += ` ${desfecho.texto}`; used.push(desfecho); }
  } else {
    const conn = openText.endsWith(",") ? "" : openText ? "" : "";
    const prefix = openText ? `${openText}${conn} ` : "";
    if (reacao) {
      raw = `${prefix}${A} e ${B} ${verboText} quando ${reacao.texto}.`;
      used.push(reacao);
    } else {
      raw = `${prefix}${A} e ${B} ${verboText}.`;
    }
    if (desfecho) { raw += ` ${desfecho.texto}`; used.push(desfecho); }
  }

  const text = resolvePlaceholders(raw, ctx, localLabel);
  return {
    text,
    phraseIds: used.map((p) => p.id),
    families: [...new Set(used.map((p) => p.familiaNarrativa).filter((f): f is string => Boolean(f)))],
  };
}

// ── Fase 2: arcos e callbacks ────────────────────────────────────────────────

export type PairArcState = { arcId: string; beatIndex: number };
export type PairStoryState = { arcs: PairArcState[]; tags: string[] };

/** Avança ou inicia um arco para a dupla neste local. Retorna o beat pronto ou null. */
export function stepArc(state: PairStoryState, location: Exclude<StoryLocal, "ANY">, ctx: StoryContext):
  { text: string; arcId: string; beat: string; resultado: StoryResult; newState: PairStoryState; tagCreated?: string } | null {
  const rng = ctx.rng ?? Math.random;
  const arcs = state.arcs ?? [];
  const tags = state.tags ?? [];

  // 1) Avançar um arco ativo deste local (chance moderada — não avança sempre).
  const active = arcs.filter((a) => { const arc = ARC_BY_ID.get(a.arcId); return arc && arc.local === location && a.beatIndex < arc.beats.length; });
  if (active.length && rng() < 0.45) {
    const chosen = active[Math.floor(rng() * active.length)];
    const arc = ARC_BY_ID.get(chosen.arcId)!;
    const beat = arc.beats[chosen.beatIndex];
    const nextIndex = chosen.beatIndex + 1;
    const isPayoff = beat.beat === "PAYOFF" || nextIndex >= arc.beats.length;
    const nextArcs = arcs
      .map((a) => (a.arcId === chosen.arcId ? { ...a, beatIndex: nextIndex } : a))
      .filter((a) => { const ar = ARC_BY_ID.get(a.arcId); return ar && a.beatIndex < ar.beats.length; });
    const tagCreated = isPayoff ? arc.arcId : undefined;
    const nextTags = tagCreated ? [...new Set([...tags, tagCreated])] : tags;
    return { text: resolvePlaceholders(beat.texto, ctx, LOCAL_LABEL[location]), arcId: arc.arcId, beat: beat.beat, resultado: beat.resultado, newState: { arcs: nextArcs, tags: nextTags }, tagCreated };
  }

  // 2) Iniciar um novo arco (máx. 2 ativos; não repetir arco já iniciado/concluído).
  const startedOrDone = new Set([...arcs.map((a) => a.arcId), ...tags]);
  const candidates = BOND_STORY_ARCS.filter((a) => a.local === location && !startedOrDone.has(a.arcId));
  if (arcs.length < 2 && candidates.length && rng() < 0.22) {
    const arc = candidates[Math.floor(rng() * candidates.length)];
    const beat = arc.beats[0];
    return { text: resolvePlaceholders(beat.texto, ctx, LOCAL_LABEL[location]), arcId: arc.arcId, beat: beat.beat, resultado: beat.resultado, newState: { arcs: [...arcs, { arcId: arc.arcId, beatIndex: 1 }], tags } };
  }
  return null;
}

/** Frase de callback rara, liberada quando a dupla tem uma tag de arco concluído. */
export function pickCallback(ctx: StoryContext, tags: string[], localLabel: string): string | null {
  const rng = ctx.rng ?? Math.random;
  if (!tags.length || rng() > 0.3) return null;
  const tag = tags[Math.floor(rng() * tags.length)];
  const arc = ARC_BY_ID.get(tag);
  const objeto = arc?.titulo ?? "";
  const memoriaLocal = arc ? LOCAL_LABEL[arc.local] : localLabel;
  const pool = BOND_STORY_PHRASES.filter((p) => p.slot === "CALLBACK");
  // Preenche os placeholders de memória ANTES do resolvedor geral (que limparia
  // {MEMORIA_*}). Sorteia até achar uma que fique sem placeholders sobrando.
  for (const p of [...pool].sort(() => rng() - 0.5)) {
    const withMem = p.texto
      .replaceAll("{OBJETO_MEMORIA}", objeto)
      .replaceAll("{MEMORIA_LOCAL}", memoriaLocal)
      .replaceAll("{MEMORIA_RESUMO}", objeto);
    const resolved = resolvePlaceholders(withMem, ctx, localLabel);
    if (resolved && !/\{[A-Z_]+\}/.test(resolved)) return resolved;
  }
  return null;
}
