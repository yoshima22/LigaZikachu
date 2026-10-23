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

export type ActiveStatus = {
  key: string;
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

/** Rótulo curto para o texto flutuante do canvas (o completo fica na legenda). */
export function shortEffectLabel(effect: string | undefined): string {
  if (!effect) return "Efeito";
  const first = splitEffect(effect)[0] ?? effect;
  const head = first.includes(":") ? first.split(":")[0] : first;
  const clean = head.trim().replace(/[.!]$/, "");
  return clean.length > 26 ? `${clean.slice(0, 25)}…` : clean;
}
