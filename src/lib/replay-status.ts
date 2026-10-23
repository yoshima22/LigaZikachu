// Efeitos ativos por mascote num ponto do replay moderno. Puro: reconstrói a
// partir do log (sem I/O), então funciona para qualquer combate já gravado.
//
// Duas fontes:
//  - debuffEvents (habilidades do Arena Draft): estruturados, com origem; ficam
//    ativos até o evento REMOVE ou o nocaute.
//  - frases de efeito do turno (Encorajador, Guardião, personalidades…): valem
//    no turno em que aparecem e somem logo depois.
import { classify, splitEffect, type EffectKind } from "@/components/replay-effect-chips";
import type { ReplayData } from "@/components/replay/replay-canvas";

/** Condições (estados alterados das habilidades) que mudam a aparência do mascote no campo. */
export type CondKind = "FREEZE" | "SLEEP" | "PARALYSIS" | "CONFUSION" | "POISON" | "BURN" | "CURSE";
const COND_BY_ADJ: Record<string, CondKind> = {
  congelado: "FREEZE", dormindo: "SLEEP", paralisado: "PARALYSIS", confuso: "CONFUSION", envenenado: "POISON", queimado: "BURN",
};
const COND_LABEL: Record<CondKind, string> = {
  FREEZE: "❄️ Congelado", SLEEP: "💤 Dormindo", PARALYSIS: "⚡ Paralisado", CONFUSION: "😵 Confuso",
  POISON: "☠️ Envenenado", BURN: "🔥 Queimado", CURSE: "👻 Maldito",
};
const ADJ = "(congelado|dormindo|paralisado|confuso|envenenado|queimado)";

export type ActiveStatus = {
  key: string;
  /** Presente quando o efeito é uma condição com visual próprio no campo. */
  condition?: CondKind;
  kind: Exclude<EffectKind, "neutral">;
  label: string;
  detail: string;
  source: string | null;
  /** Índice do turno (no replay) em que o efeito entrou. */
  since: number;
  /** Persistente (debuff de habilidade) ou só do turno em que apareceu. */
  persistent: boolean;
};

const STAT_PT: Record<string, string> = { force: "Força", agility: "Agilidade", instinct: "Instinto", vitality: "Vitalidade" };
const TRANSIENT_TURNS = 2;

type DebuffEvent = { kind: "APPLY" | "REMOVE"; targetId: string; stat: string; pct: number; sourceId: string | null; sourceName: string; label: string };

function asDebuffEvents(value: unknown): DebuffEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((e): e is DebuffEvent => !!e && typeof e === "object" && "targetId" in e && "stat" in e && "kind" in e);
}

/** Frase recai em quem RECEBE (proteção, debuff, dano recebido) ou em quem AGE. */
function subjectOf(kind: EffectKind, sentence: string): "actor" | "target" {
  if (kind === "protection" || kind === "debuff") return "target";
  if (/recebid/i.test(sentence)) return "target";
  return "actor";
}

export function statusesAt(data: ReplayData, idx: number): Map<string, ActiveStatus[]> {
  const byMon = new Map<string, Map<string, ActiveStatus>>();
  const bucket = (id: string) => byMon.get(id) ?? byMon.set(id, new Map()).get(id)!;
  const names = new Map(data.teams.map((c) => [c.id, c.name]));
  const debuffPct = new Map<string, number>(); // `${target}:${stat}` → pct restante

  // Nome do mascote logo antes de uma expressão ("Pikachu ficou paralisado").
  // Nomes mais longos primeiro, para "Mega Gyarados" não casar como "Gyarados".
  const byLongestName = [...data.teams].sort((a, b) => b.name.length - a.name.length);
  const whoBefore = (sentence: string, phrase: string) => byLongestName.find((c) => sentence.includes(`${c.name} ${phrase}`))?.id ?? null;
  const setCond = (id: string, cond: CondKind, i: number, detail: string, source: string | null) =>
    bucket(id).set(`cond:${cond}`, { key: `cond:${cond}`, condition: cond, kind: "debuff", label: COND_LABEL[cond], detail, source, since: i, persistent: true });

  /** Condições vêm como frases fixas do motor (abilities/combat.ts). Retorna true se tratou a frase. */
  const applyCondition = (sentence: string, i: number): boolean => {
    let m = sentence.match(new RegExp(`ficou ${ADJ} por (\\d+) rodada`));
    if (m) {
      const id = whoBefore(sentence, `ficou ${m[1]}`);
      const src = sentence.match(/, de ([^)]+)\)/)?.[1] ?? null;
      if (id) setCond(id, COND_BY_ADJ[m[1]], i, `Dura ${m[2]} rodada${Number(m[2]) > 1 ? "s" : ""}`, src);
      return Boolean(id);
    }
    m = sentence.match(new RegExp(`deixou de estar ${ADJ}`));
    if (m) {
      const id = whoBefore(sentence, `deixou de estar ${m[1]}`);
      if (id) bucket(id).delete(`cond:${COND_BY_ADJ[m[1]]}`);
      return Boolean(id);
    }
    // Reforço: o motor anuncia a condição ao pular a ação (cobre logs sem a frase de aplicação).
    m = sentence.match(/(continua dormindo|está paralisado|está confuso)/);
    if (m) {
      const cond: CondKind = m[1].includes("dormindo") ? "SLEEP" : m[1].includes("paralisado") ? "PARALYSIS" : "CONFUSION";
      const id = whoBefore(sentence, m[1]);
      if (id && !bucket(id).has(`cond:${cond}`)) setCond(id, cond, i, "", null);
      return false; // a frase também vale como efeito do turno
    }
    m = sentence.match(/está amaldiçoado por (.+?) e perdeu/);
    if (m) {
      const id = whoBefore(sentence, "está amaldiçoado");
      if (id && !bucket(id).has("cond:CURSE")) setCond(id, "CURSE", i, "Dura até quem amaldiçoou cair", m[1]);
      return false;
    }
    m = sentence.match(/A maldição sobre (.+?) acabou/);
    if (m) {
      const id = byLongestName.find((c) => c.name === m![1])?.id;
      if (id) bucket(id).delete("cond:CURSE");
      return Boolean(id);
    }
    return false;
  };

  const last = Math.min(idx, data.turns.length - 1);
  for (let i = 0; i <= last; i++) {
    const t = data.turns[i];
    // Efeitos do turno anterior expiram.
    for (const m of byMon.values()) for (const [k, s] of m) if (!s.persistent && i - s.since >= TRANSIENT_TURNS) m.delete(k);

    const events = asDebuffEvents(t.debuffEvents);
    for (const e of events) {
      const key = `debuff:${e.stat}`;
      const pk = `${e.targetId}:${e.stat}`;
      if (e.kind === "APPLY") {
        debuffPct.set(pk, e.pct);
        bucket(e.targetId).set(key, {
          key, kind: "debuff", label: e.label, persistent: true, since: i,
          detail: `−${Math.round(e.pct * 100)}% de ${STAT_PT[e.stat] ?? e.stat}`,
          source: e.sourceName && e.sourceName !== "—" ? e.sourceName : null,
        });
      } else {
        const left = Math.max(0, (debuffPct.get(pk) ?? 0) - e.pct);
        debuffPct.set(pk, left);
        const cur = bucket(e.targetId).get(key);
        if (left <= 0.005) bucket(e.targetId).delete(key);
        else if (cur) cur.detail = `−${Math.round(left * 100)}% de ${STAT_PT[e.stat] ?? e.stat}`;
      }
    }

    if (t.effect) {
      for (const sentence of splitEffect(t.effect)) {
        if (applyCondition(sentence, i)) continue;
        const kind = classify(sentence);
        if (kind === "neutral") continue;
        // Debuff já veio estruturado nos eventos: não duplica pela frase.
        if (kind === "debuff" && events.length) continue;
        const who = subjectOf(kind, sentence) === "target" ? t.targetId : t.actorId;
        const [head, ...rest] = sentence.replace(/^✨\s*/, "").split(":");
        const label = (rest.length ? head : sentence).trim().replace(/[.!]$/, "");
        const key = `fx:${label.toLowerCase()}`;
        bucket(who).set(key, {
          key, kind, label, persistent: false, since: i,
          detail: rest.length ? rest.join(":").trim().replace(/[.!]$/, "") : "",
          source: who === t.actorId ? null : names.get(t.actorId) ?? null,
        });
      }
    }

    // Nocaute limpa tudo do mascote derrubado.
    if (t.targetHpAfter <= 0 && t.action !== "HEAL") byMon.delete(t.targetId);
    if (t.guardianInterceptId && (t.guardianHpAfter ?? 1) <= 0) byMon.delete(t.guardianInterceptId);
  }

  const out = new Map<string, ActiveStatus[]>();
  for (const [id, m] of byMon) if (m.size) out.set(id, [...m.values()]);
  return out;
}

/** Condições ativas por mascote (para o canvas animar). */
export function conditionsOf(statuses: Map<string, ActiveStatus[]>): Record<string, CondKind[]> {
  const out: Record<string, CondKind[]> = {};
  for (const [id, list] of statuses) {
    const conds = list.flatMap((s) => (s.condition ? [s.condition] : []));
    if (conds.length) out[id] = conds;
  }
  return out;
}

/** Rótulo curto para o texto flutuante do canvas (o completo fica na legenda). */
export function shortEffectLabel(effect: string | undefined): string {
  if (!effect) return "Efeito";
  const first = splitEffect(effect)[0] ?? effect;
  const head = first.includes(":") ? first.split(":")[0] : first;
  const clean = head.trim().replace(/[.!]$/, "");
  return clean.length > 26 ? `${clean.slice(0, 25)}…` : clean;
}
