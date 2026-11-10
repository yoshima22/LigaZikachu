// Montador automático: 18 mascotes diferentes, 6 slots, titulares e reservas, só com posturas reais
// e respeitando o desbloqueio individual. Equilibra papéis (não pega só os mais fortes).
import { COMBAT_ROLE_LABELS, type CombatRole } from "@/lib/combat-roles";
import { getPokemonName } from "@/lib/mascot-data";
import { canSelectTrainingStance } from "@/lib/training-journey-state";
import { SLOT_COUNT, SQUAD_SIZE, TEAM_SIZE } from "./config";
import { emptyFormation, suggestedSwapPct, type Formation, type MascotSnap, type Strategy } from "./team";

export type Preset = "BALANCED" | "OFFENSIVE" | "ENDURANCE" | "CONTROL";
export const PRESETS: Record<Preset, { name: string; desc: string; roles: CombatRole[] }> = {
  BALANCED: { name: "Equilibrada", desc: "Frente firme, dano, cura e apoio.", roles: ["DEFENDER", "ATTACKER", "ATTACKER", "HEALER", "ENCOURAGER", "FLANK"] },
  OFFENSIVE: { name: "Ofensiva", desc: "Pressão máxima: derrubar antes de ser derrubado.", roles: ["ATTACKER", "ATTACKER", "FLANK", "DUELIST", "ENCOURAGER", "SPECIALIST"] },
  ENDURANCE: { name: "Resistência", desc: "Aguenta o dia inteiro e cura quem precisa.", roles: ["DEFENDER", "GUARDIAN", "SURVIVOR", "HEALER", "DEFENDER", "ENCOURAGER"] },
  CONTROL: { name: "Controle", desc: "Desorganiza o adversário e protege o time.", roles: ["SABOTEUR", "OPPORTUNIST", "PROVOKER", "SCOUT", "HEALER", "DEFENDER"] },
};

type W = Partial<Record<"f" | "a" | "i" | "v" | "c", number>>;
const ROLE_WEIGHTS: Partial<Record<CombatRole, W>> = {
  ATTACKER: { f: 1, a: 0.3 }, FLANK: { a: 1, f: 0.5 }, DEFENDER: { v: 1, f: 0.2 }, GUARDIAN: { v: 0.8, c: 0.6 },
  HEALER: { c: 1, v: 0.6 }, ENCOURAGER: { c: 1, a: 0.2 }, DUELIST: { f: 0.7, i: 0.7 }, SABOTEUR: { i: 0.8, a: 0.7 },
  OPPORTUNIST: { i: 1, a: 0.3 }, PROVOKER: { c: 0.7, i: 0.6, v: 0.3 }, SCOUT: { a: 0.7, i: 0.7 }, SURVIVOR: { v: 1, c: 0.2 },
  SPECIALIST: { f: 0.4, a: 0.4, i: 0.4, v: 0.4, c: 0.4 },
};

const power = (m: MascotSnap) => m.statForce + m.statAgility + m.statInstinct + m.statVitality + m.statCharisma + m.level * 2;
function fit(m: MascotSnap, role: CombatRole) {
  const w = ROLE_WEIGHTS[role] ?? { f: 0.4, a: 0.4, i: 0.4, v: 0.4, c: 0.4 };
  const v = (w.f ?? 0) * m.statForce + (w.a ?? 0) * m.statAgility + (w.i ?? 0) * m.statInstinct + (w.v ?? 0) * m.statVitality + (w.c ?? 0) * m.statCharisma;
  // Um pouco de poder bruto para desempatar, sem deixar os "melhores" engolirem todos os slots.
  return v + power(m) * 0.15;
}

export type AutoBuildResult =
  | { ok: true; formation: Formation; explanation: string[] }
  | { ok: false; error: string; missing: string[] };

/** `strategy`: KEEP = todos os slots "até cair"; PRESERVE = limiar sugerido por postura (suportes saem aos 50%). */
export function autoBuild(pool: MascotSnap[], preset: Preset = "BALANCED", strategy: Strategy = "KEEP"): AutoBuildResult {
  const unique = [...new Map(pool.map((m) => [m.id, m])).values()];
  if (unique.length < TEAM_SIZE) {
    return { ok: false, error: `Você precisa de ${TEAM_SIZE} mascotes diferentes e tem ${unique.length}.`, missing: [`Faltam ${TEAM_SIZE - unique.length} mascote(s) na coleção.`] };
  }
  const template = PRESETS[preset].roles;
  const f = emptyFormation();
  const left = new Set(unique.map((m) => m.id));
  const byId = new Map(unique.map((m) => [m.id, m]));
  const explanation: string[] = [];

  // Slots com posturas básicas primeiro; os avançados (se um preset futuro usar) ficam com as sobras compatíveis.
  const order = template.map((role, i) => ({ role, i })).sort((x, y) => (ROLE_WEIGHTS[x.role] ? 0 : 1) - (ROLE_WEIGHTS[y.role] ? 0 : 1));
  const picked: Record<number, string[]> = {};
  for (const { role, i } of order) {
    const eligible = [...left].map((id) => byId.get(id)!).filter((m) => canSelectTrainingStance(role, m.unlocked));
    const ranked = eligible.sort((a, b) => fit(b, role) - fit(a, role));
    // Titular = melhor encaixe; reservas = próximos melhores (mesma postura do slot).
    const squad = ranked.slice(0, SQUAD_SIZE);
    squad.forEach((m) => left.delete(m.id));
    picked[i] = squad.map((m) => m.id);
  }
  // Slots que não conseguiram 3 elegíveis (postura avançada rara): completa com qualquer sobra e rebaixa a postura básica.
  for (let i = 0; i < SLOT_COUNT; i++) {
    let role = template[i];
    const ids = picked[i] ?? [];
    if (ids.length < SQUAD_SIZE) {
      role = "ATTACKER";
      const extra = [...left].map((id) => byId.get(id)!).sort((a, b) => fit(b, role) - fit(a, role)).slice(0, SQUAD_SIZE - ids.length);
      extra.forEach((m) => left.delete(m.id));
      ids.push(...extra.map((m) => m.id));
      explanation.push(`Slot ${i + 1}: faltaram mascotes com a postura ${COMBAT_ROLE_LABELS[template[i]]}; usei Atacante.`);
    }
    f.slots[i] = { role, mascotIds: ids, swapBelowPct: strategy === "PRESERVE" ? suggestedSwapPct(role) : 0 };
  }
  f.slots.forEach((s, i) => {
    const t = byId.get(s.mascotIds[0])!;
    explanation.push(`Slot ${i + 1} · ${COMBAT_ROLE_LABELS[s.role as CombatRole]}: ${t.nickname || t.speciesNameOverride || getPokemonName(t.pokemonId)} abre, com 2 reservas na fila${s.swapBelowPct ? `; troca ao ficar com ${s.swapBelowPct}% de HP ou menos` : "; fica até cair"}.`);
  });
  explanation.unshift(`Estratégia ${PRESETS[preset].name}: ${PRESETS[preset].desc} Escolhi pelo encaixe na postura, não só pelo poder bruto.`);
  return { ok: true, formation: f, explanation };
}
