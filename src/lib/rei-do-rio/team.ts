// Formação, validação (servidor e cliente) e estado diário do Rei do Rio. Tudo puro.
import { COMBAT_ROLE_VALUES } from "@/lib/combat-roles";
import { canSelectTrainingStance } from "@/lib/training-journey-state";
import { SLOT_COUNT, SQUAD_SIZE, TEAM_SIZE } from "./config";

/** Legado (antes da troca por slot). KEEP = "até cair"; PRESERVE = sugestão automática por postura. */
export type Strategy = "KEEP" | "PRESERVE";

/**
 * `swapBelowPct`: o mascote ativo sai ao fim de um combate se sobreviveu com HP <= X% e o próximo da fila
 * (vivo, com HP > X%) assume. 0/null/ausente = "até cair" (só sai quando derrotado).
 */
export type SlotPlan = { role: string; mascotIds: string[]; swapBelowPct?: number | null };
export type Formation = { slots: SlotPlan[]; /** @deprecated use swapBelowPct por slot */ strategy?: Strategy };

export const SWAP_MIN = 10;
export const SWAP_MAX = 90;
export const SWAP_PRESETS = [{ pct: 0, label: "Até cair" }, { pct: 30, label: "Trocar aos 30%" }, { pct: 50, label: "Trocar aos 50% (sugerido)" }, { pct: 70, label: "Trocar aos 70%" }] as const;

/** Limiar efetivo do slot (inclui compatibilidade com formações antigas que usavam `strategy`). */
export function slotSwapPct(f: Pick<Formation, "strategy">, slot: Pick<SlotPlan, "swapBelowPct">): number {
  if (slot.swapBelowPct !== undefined && slot.swapBelowPct !== null) return slot.swapBelowPct;
  return f.strategy === "PRESERVE" ? 50 : 0;
}

/**
 * Sugestão padrão do montador. Nas simulações (todas as faixas de força), trocar com 30–50% de HP venceu "até cair"
 * por 4 a 18 pontos percentuais de vitórias; 50% foi o melhor/mais estável. Segue como sugestão, o jogador muda por slot.
 */
export const DEFAULT_SWAP_PCT = 50;
export function suggestedSwapPct(_role?: string): number {
  void _role;
  return DEFAULT_SWAP_PCT;
}

/** Frase de prévia mostrada no editor. */
export function describeSwap(pctValue: number): string {
  return pctValue <= 0
    ? "Fica em campo até ser derrotado; só então entra o próximo da fila."
    : `Se terminar um combate com ${pctValue}% de HP ou menos, sai e entra o próximo da fila que esteja acima de ${pctValue}%. Ele continua vivo na fila, sem se curar.`;
}

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
  return { slots: Array.from({ length: SLOT_COUNT }, () => ({ role: "ATTACKER", mascotIds: [], swapBelowPct: DEFAULT_SWAP_PCT })) };
}

export const formationMascotIds = (f: Formation) => f.slots.flatMap((s) => s.mascotIds);

/**
 * Valida uma formação. `pool` = mascotes que o jogador possui (antes do fechamento)
 * ou o roster congelado (depois). `lockedIds` != null => o conjunto de 18 é imutável.
 */
export function validateFormation(f: Formation, pool: Map<string, MascotSnap>, lockedIds: Set<string> | null = null): string[] {
  const errors: string[] = [];
  if (!f || !Array.isArray(f.slots) || f.slots.length !== SLOT_COUNT) return [`A formação precisa de exatamente ${SLOT_COUNT} slots.`];
  const seen = new Set<string>();
  f.slots.forEach((slot, i) => {
    const label = `Slot ${i + 1}`;
    if (!isValidRole(slot.role)) errors.push(`${label}: postura inválida.`);
    const sw = slot.swapBelowPct;
    if (sw !== undefined && sw !== null && !(Number.isInteger(sw) && (sw === 0 || (sw >= SWAP_MIN && sw <= SWAP_MAX)))) errors.push(`${label}: o limite de troca por vida deve ser "até cair" ou entre ${SWAP_MIN}% e ${SWAP_MAX}%.`);
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
 * - Ativo derrotado: entra o próximo da fila que esteja vivo (preferindo quem está acima do limiar do slot).
 * - Ativo vivo com HP% <= swapBelowPct: troca pelo próximo da fila vivo e ACIMA do limiar; se não houver, fica.
 */
export function chooseActives(f: Formation, st: DayState, _cfg?: unknown): (string | null)[] {
  void _cfg;
  return f.slots.map((slot, i) => {
    const queue = slot.mascotIds;
    const thr = slotSwapPct(f, slot);
    const current = st.active[i];
    const alive = (id: string) => usable(st, id);
    if (current && alive(current)) {
      if (thr > 0 && pct(st.mascots[current]) <= thr) {
        const next = queue.find((id) => id !== current && alive(id) && pct(st.mascots[id]) > thr);
        if (next) return next;
      }
      return current;
    }
    // Ativo caiu (ou slot novo): primeiro da fila vivo e acima do limiar; senão, o primeiro vivo.
    return queue.find((id) => alive(id) && (thr <= 0 || pct(st.mascots[id]) > thr)) ?? queue.find((id) => alive(id)) ?? null;
  });
}

/** Aplica o HP final de uma luta ao estado e decide os ativos do próximo combate. */
export function applyBattleToState(f: Formation, st: DayState, finalHp: Record<string, number>, cfg?: unknown): DayState {
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
