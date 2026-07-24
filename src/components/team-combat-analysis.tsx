"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, X } from "lucide-react";
import {
  getCombatRoleLabel,
  getHealerHealAmount,
  normalizeCombatRole,
  recommendCombatRole,
  type CombatRole,
} from "@/lib/combat-roles";
import { getPokemonName, getPokemonTypes, TYPE_ADVANTAGE } from "@/lib/mascot-data";

export type TeamAnalysisMascot = {
  id: string;
  pokemonId: number;
  nickname?: string | null;
  name?: string;
  level: number;
  statForce: number;
  statAgility: number;
  statVitality: number;
  statInstinct: number;
  statCharisma: number;
};

type CombatMode = "ARENA" | "LEAGUE" | "RAID";

const TYPE_LABELS: Record<string, string> = {
  normal: "Normal", fire: "Fogo", water: "Água", electric: "Elétrico",
  grass: "Planta", ice: "Gelo", fighting: "Lutador", poison: "Veneno",
  ground: "Terra", flying: "Voador", psychic: "Psíquico", bug: "Inseto",
  rock: "Pedra", ghost: "Fantasma", dragon: "Dragão", dark: "Sombrio",
  steel: "Aço", fairy: "Fada",
};

const pct = (value: number) => `${Math.round(value * 100)}%`;
const cap = (value: number, max: number) => Math.min(value, max);
const nameOf = (m: TeamAnalysisMascot) => m.nickname ?? m.name ?? getPokemonName(m.pokemonId);

function roleOf(m: TeamAnalysisMascot, roles: Record<string, unknown>): CombatRole {
  return normalizeCombatRole(roles[m.id] ?? recommendCombatRole(m));
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{detail}</p>
    </div>
  );
}

export function TeamCombatAnalysisButton({
  mascots,
  roles,
  mode = "ARENA",
  className = "",
}: {
  mascots: TeamAnalysisMascot[];
  roles: Record<string, unknown>;
  mode?: CombatMode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const analysis = useMemo(() => {
    const positioned = mascots.map((m, position) => ({ ...m, position, role: roleOf(m, roles) }));
    const attackOrder = mode === "RAID"
      ? positioned
      : [...positioned].sort((a, b) => b.statAgility - a.statAgility || a.position - b.position);
    const encouragers = positioned.filter((m) => m.role === "ENCOURAGER");
    const encouragerBonus = encouragers.length
      ? cap(0.04 + encouragers.reduce((sum, m) => sum + m.statCharisma, 0) / 650, 0.18)
      : 0;
    const scouts = positioned.filter((m) => m.role === "SCOUT");
    const scoutBonus = scouts.length
      ? cap(scouts[0].statAgility / 400 + scouts[0].statInstinct / 500, 0.08)
      : 0;
    const healers = positioned.filter((m) => m.role === "HEALER");
    const healing = healers.reduce((sum, m) => {
      const amount = getHealerHealAmount({ charisma: m.statCharisma, vitality: m.statVitality, level: m.level });
      if (mode !== "RAID") return sum + amount;
      const chance = cap((35 + Math.floor((m.statCharisma + m.statVitality) / 8)) / 100, 0.78);
      return sum + amount * chance;
    }, 0);
    const guardians = positioned.filter((m) => m.role === "GUARDIAN");
    const guardianDefense = guardians.length
      ? cap(0.15 + (guardians[0].statVitality + guardians[0].statCharisma) / 600, 0.40)
      : 0;
    const attackers = positioned.filter((m) => m.role === "ATTACKER");
    const flanks = positioned.filter((m) => m.role === "FLANK");
    const provokers = positioned.filter((m) => m.role === "PROVOKER");
    const typeSet = new Set(positioned.flatMap((m) => getPokemonTypes(m.pokemonId)));
    const coverage = new Set<string>();
    for (const type of typeSet) for (const target of TYPE_ADVANTAGE[type] ?? []) coverage.add(target);
    const weaknesses = new Set<string>();
    for (const own of typeSet) {
      for (const [attacker, targets] of Object.entries(TYPE_ADVANTAGE)) {
        if (targets.includes(own)) weaknesses.add(attacker);
      }
    }
    const recommendations: string[] = [];
    if (positioned.length < 6) recommendations.push(`Complete os ${6 - positioned.length} espaço(s) vazio(s) para uma leitura mais confiável.`);
    if (!healers.length) recommendations.push("Considere um Cuidador: a equipe não possui recuperação de HP.");
    if (!guardians.length && positioned.length >= 3) recommendations.push("A equipe não possui Guardião para interceptar dano dirigido aos aliados.");
    if (!encouragers.length && positioned.length >= 3) recommendations.push("Um Encorajador pode elevar em até 18% o dano de toda a equipe.");
    if (typeSet.size <= 2 && positioned.length >= 4) recommendations.push("Cobertura de tipos concentrada: diversificar reduz confrontos desfavoráveis.");
    if (healers.length > 1) recommendations.push("Dois Cuidadores aumentam sustentação, mas podem reduzir a pressão ofensiva na Arena/Liga.");
    const offRecommended = positioned.filter((m) => m.role !== recommendCombatRole(m));
    if (offRecommended.length >= 3) recommendations.push(`${offRecommended.length} mascotes usam postura diferente da recomendada pelos atributos; confira os casos individualmente.`);
    if (!recommendations.length) recommendations.push("Composição equilibrada: ajuste fino deve considerar os tipos e posturas do adversário.");

    return {
      positioned, attackOrder, encouragerBonus, scoutBonus, healing, guardians,
      guardianDefense, attackers, flanks, provokers, coverage, weaknesses,
      recommendations,
    };
  }, [mascots, roles, mode]);

  const modal = open ? (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-3" onMouseDown={() => setOpen(false)}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-slate-950 p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Análise tática</p>
            <h3 className="mt-1 text-xl font-black text-white">Preview da equipe posicionada</h3>
            <p className="mt-1 text-xs text-slate-400">Estimativas atualizadas conforme mascotes e posturas selecionados.</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
        </div>

        {!analysis.positioned.length ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">Posicione ao menos um mascote para gerar a análise.</div>
        ) : (
          <>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Impulso ofensivo" value={pct(analysis.encouragerBonus + analysis.scoutBonus)} detail={`Encorajador ${pct(analysis.encouragerBonus)} + Batedor ${pct(analysis.scoutBonus)} enquanto estiverem ativos.`} />
              <StatCard label="Cura média por rodada" value={`${Math.round(analysis.healing)} HP`} detail={mode === "RAID" ? "Valor esperado considerando a chance de cura da Raid." : "Potencial se os Cuidadores tiverem aliados feridos e curas disponíveis."} />
              <StatCard label="Proteção de Guardião" value={pct(analysis.guardianDefense)} detail={analysis.guardians.length ? `Primeiro Guardião intercepta essa parcela do golpe em um aliado.` : "Nenhum Guardião selecionado."} />
              <StatCard label="Cobertura ofensiva" value={`${analysis.coverage.size} tipos`} detail={`${analysis.positioned.length} mascote(s), ${new Set(analysis.positioned.flatMap((m) => getPokemonTypes(m.pokemonId))).size} tipo(s) próprio(s).`} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
                <h4 className="text-sm font-black text-white">Ordem de ações</h4>
                <p className="mt-1 text-[10px] text-slate-500">{mode === "RAID" ? "Na Raid vale a posição da escalação." : "Estimativa por Agilidade; o combate ainda aplica pequena variação de iniciativa."}</p>
                <div className="mt-3 space-y-2">
                  {analysis.attackOrder.map((m, index) => (
                    <div key={m.id} className="flex items-center gap-2 rounded-lg bg-slate-950/70 px-3 py-2 text-xs">
                      <span className="w-5 font-black text-cyan-300">#{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-bold text-slate-100">{nameOf(m)}</span>
                      <span className="text-slate-500">{getCombatRoleLabel(m.role)}</span>
                      <span className="font-mono text-yellow-300">Agi {m.statAgility}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
                <h4 className="text-sm font-black text-white">Efeitos das posturas</h4>
                <div className="mt-3 space-y-2 text-xs text-slate-300">
                  <p><strong className="text-yellow-200">Atacantes:</strong> {analysis.attackers.length || "nenhum"}; +15% contra Defensores. Bônus pessoal varia com Força.</p>
                  <p><strong className="text-fuchsia-200">Flancos:</strong> {analysis.flanks.length || "nenhum"}; +12% contra suportes e chance de ignorar Defensor de {analysis.flanks.length ? analysis.flanks.map((m) => pct(cap(0.35 + m.statAgility / 150, 0.82))).join(", ") : "0%"}.</p>
                  <p><strong className="text-blue-200">Duelistas:</strong> mantêm o alvo e recebem +12% durante o mesmo duelo. O bônus contra suportes pertence ao Flanco.</p>
                  <p><strong className="text-orange-200">Provocadores:</strong> {analysis.provokers.length ? analysis.provokers.map((m) => `${nameOf(m)} ${pct(cap(0.20 + m.statCharisma / 300 + m.statInstinct / 400, 0.55))}`).join(" · ") : "nenhum"}.</p>
                  <p><strong className="text-green-200">Cuidadores:</strong> cura individual no aliado vivo mais ferido; {mode === "RAID" ? "atacam e podem curar depois." : "trocam o ataque pela cura quando necessário."}</p>
                </div>
              </section>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                <h4 className="text-sm font-black text-green-200">Vantagens de tipo cobertas</h4>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[...analysis.coverage].sort().map((type) => <span key={type} className="rounded-full border border-green-500/25 bg-green-500/10 px-2 py-1 text-[10px] text-green-100">{TYPE_LABELS[type] ?? type}</span>)}
                  {!analysis.coverage.size && <span className="text-xs text-slate-500">Nenhuma vantagem cadastrada para os tipos atuais.</span>}
                </div>
              </section>
              <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <h4 className="text-sm font-black text-red-200">Ameaças de tipo do conjunto</h4>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {[...analysis.weaknesses].sort().map((type) => <span key={type} className="rounded-full border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] text-red-100">{TYPE_LABELS[type] ?? type}</span>)}
                </div>
                <p className="mt-3 text-[10px] text-slate-500">A lista reúne fraquezas possíveis dos tipos da equipe; tipos secundários e o adversário definem o confronto real.</p>
              </section>
            </div>

            <section className="mt-4 rounded-xl border border-[#FFCB05]/25 bg-[#FFCB05]/5 p-4">
              <h4 className="text-sm font-black text-yellow-200">Recomendações</h4>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-yellow-50/80">
                {analysis.recommendations.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </section>
            <p className="mt-4 text-[10px] text-slate-500">Este preview usa as fórmulas das posturas e os atributos atuais. Não prevê o time inimigo, alvos aleatórios, críticos, modificadores semanais nem efeitos de itens.</p>
          </>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }} className={`inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/20 ${className}`} title="Analisar equipe posicionada">
        <BarChart3 size={13} /> Analisar equipe
      </button>
      {open && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </>
  );
}
