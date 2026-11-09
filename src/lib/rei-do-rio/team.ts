// Formação, validação (servidor e cliente) e estado diário do Rei do Rio. Tudo puro.
import { COMBAT_ROLE_VALUES } from "@/lib/combat-roles";
import { canSelectTrainingStance } from "@/lib/training-journey-state";
import { SLOT_COUNT, SQUAD_SIZE, TEAM_SIZE, type ReiConfig } from "./config";

export type Strategy = "KEEP" | "PRESERVE";
export const STRATEGY_LABELS: Record<Strategy, { name: string; desc: string }> = {
  KEEP: { name: "Manter os sobreviventes", desc: "Quem sobrevive continua no slot, mesmo ferido. Só os derrotados são substituídos." },
  PRESERVE: { name: "Preservar os feridos", desc: "Entre combates, um reserva bem mais saudável do mesmo slot pode assumir o lugar de um ferido." },
};

export type SlotPlan = { role: string; mascotIds: string[] };
export type Formation = { slots: SlotPlan[]; strategy: Strategy };

/** Foto do mascote congelada na inscrição. `unlocked` = posturas de jornada liberadas para ELE. */
export type MascotSnap = {
  id: string; pokemonId: number; nickname: string | null; level: number;
  statForce: number; statAgility: number; statInstinct: number; statVitality: number; statCharisma: number;
  personality: string | null;
  speciesNameOverride?: string | null; primaryTypeOverride?: string | null; secondaryTypeOverride?: string | null;
  preferredCombatRole?: string | null;
  unlocked: string[];
};

export type MascotState = { hp: number; max: number; dead: boolean };
export type DayState = {
  mascots: Record<string, MascotState>;
  /** Mascote ativo por slot (índice 0..5); null = slot esgotado. */
  active: (string | null)[];
};

export const isValidRole = (role: string) => (COMBAT_ROLE_VALUES as readonly string[]).includes(role);
export const roleAllowedFor = (role: string, m: Pick<MascotSnap, "unlocked">) => isValidRole(role) && canSelectTrainingStance(role, m.unlocked);

export function emptyFormation(): Formation {
  return { slots: Array.from({ length: SLOT_COUNT }, () => ({ role: "ATTACKER", mascotIds: [] })), strategy: "KEEP" };
}

export const formationMascotIds = (f: Formation) => f.slots.flatMap((s) => s.mascotIds);

/**
 * Valida uma formação. `pool` = mascotes que o jogador possui (antes do fechamento)
 * ou o roster congelado (depois). `lockedIds` != null => o conjunto de 18 é imutável.
 */
export function validateFormation(f: Formation, pool: Map<string, MascotSnap>, lockedIds: Set<string> | null = null): string[] {
  const errors: string[] = [];
  if (!f || !Array.isArray(f.slots) || f.slots.length !== SLOT_COUNT) return [`A formação precisa de exatamente ${SLOT_COUNT} slots.`];
  if (f.strategy !== "KEEP" && f.strategy !== "PRESERVE") errors.push("Estratégia de troca inválida.");
  const seen = new Set<string>();
  f.slots.forEach((slot, i) => {
    const label = `Slot ${i + 1}`;
    if (!isValidRole(slot.role)) errors.push(`${label}: postura inválida.`);
    if (!Array.isArray(slot.mascotIds) || slot.mascotIds.length !== SQUAD_SIZE) { errors.push(`${label}: precisa de ${SQUAD_SIZE} mascotes (titular + 2 reservas).`); return; }
    for (const id of slot.mascotIds) {
      const m = pool.get(id);
      if (!m) { errors.push(`${label}: mascote ${id} não encontrado na sua coleção.`); continue; }
      if (seen.has(id)) errors.push(`${label}: ${m.nickname ?? id} aparece mais de uma vez.`);
      seen.add(id);
      if (lockedIds && !lockedIds.has(id)) errors.push(`${label}: ${m.nickname ?? id} não faz parte dos 18 inscritos.`);
      if (isValidRole(slot.role) && !canSelectTrainingStance(slot.role, m.unlocked)) errors.push(`${label}: ${m.nickname ?? `#${m.pokemonId}`} não desbloqueou a postura escolhida.`);
    }
  });
  if (seen.size !== TEAM_SIZE) errors.push(`A equipe precisa de ${TEAM_SIZE} mascotes diferentes (há ${seen.size}).`);
  if (lockedIds) for (const id of lockedIds) if (!seen.has(id)) errors.push("Os 18 mascotes inscritos não podem ser removidos.");
  return [...new Set(errors)];
}

export const maxHpOf = (m: MascotSnap, mult = 1) => Math.max(10, Math.round((55 + m.level * 6 + m.statVitality * 4) * mult));

/** Recuperação completa: HP cheio, ninguém derrotado, titulares ativos. */
export function freshDayState(f: Formation, roster: Map<string, MascotSnap>, hpMult = 1): DayState {
  const mascots: Record<string, MascotState> = {};
  for (const id of formationMascotIds(f)) {
    const m = roster.get(id);
    const max = m ? maxHpOf(m, hpMult) : 1;
    mascots[id] = { hp: max, max, dead: false };
  }
  return { mascots, active: f.slots.map((s) => s.mascotIds[0] ?? null) };
}

const pct = (s: MascotState) => (s.max > 0 ? (s.hp / s.max) * 100 : 0);
const usable = (st: DayState, id: string) => !!st.mascots[id] && !st.mascots[id].dead && st.mascots[id].hp > 0;

/**
 * Escolhe quem entra no PRÓXIMO combate em cada slot. Nunca é chamada durante uma luta.
 * KEEP: sobrevivente fica; derrotado cede ao próximo reserva vivo na ordem.
 * PRESERVE: igual, mas um reserva com HP% >= ativo + limiar pode assumir (sem oscilar).
 */
export function chooseActives(f: Formation, st: DayState, cfg: Pick<ReiConfig, "swapHpGapPct">): (string | null)[] {
  return f.slots.map((slot, i) => {
    const queue = slot.mascotIds;
    const current = st.active[i];
    let pick: string | null = current && usable(st, current) ? current : null;
    if (!pick) pick = queue.find((id) => usable(st, id)) ?? null; // ordem do jogador
    if (pick && f.strategy === "PRESERVE") {
      const base = pct(st.mascots[pick]);
      const better = queue
        .filter((id) => id !== pick && usable(st, id))
        .map((id) => ({ id, p: pct(st.mascots[id]) }))
        .filter((c) => c.p - base >= cfg.swapHpGapPct)
        .sort((a, b) => b.p - a.p || queue.indexOf(a.id) - queue.indexOf(b.id))[0];
      if (better) pick = better.id;
    }
    return pick;
  });
}

/** Aplica o HP final de uma luta ao estado e decide os ativos do próximo combate. */
export function applyBattleToState(f: Formation, st: DayState, finalHp: Record<string, number>, cfg: Pick<ReiConfig, "swapHpGapPct">): DayState {
  const mascots = { ...st.mascots };
  for (const [id, hp] of Object.entries(finalHp)) {
    const cur = mascots[id];
    if (!cur) continue;
    const next = Math.max(0, Math.min(cur.max, Math.round(hp)));
    mascots[id] = { ...cur, hp: next, dead: next <= 0 };
  }
  const next: DayState = { mascots, active: st.active };
  return { mascots, active: chooseActives(f, next, cfg) };
}

export type Substitution = { slot: number; out: string; in: string; reason: "DEFEATED" | "WOUNDED" };
export function diffActives(before: (string | null)[], after: (string | null)[], st: DayState): Substitution[] {
  const out: Substitution[] = [];
  before.forEach((b, i) => {
    const a = after[i];
    if (b && a && a !== b) out.push({ slot: i + 1, out: b, in: a, reason: st.mascots[b]?.dead ? "DEFEATED" : "WOUNDED" });
  });
  return out;
}

export const aliveCount = (st: DayState) => Object.values(st.mascots).filter((m) => !m.dead && m.hp > 0).length;
export const exhaustedSlots = (f: Formation, st: DayState) => f.slots.filter((s) => s.mascotIds.every((id) => !usable(st, id))).length;
