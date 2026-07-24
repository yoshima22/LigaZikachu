"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X } from "lucide-react";
import {
  AGILITY_EXTRA_ACTION_GAP,
  AGILITY_THIRD_ACTION_GAP,
  COMBAT_ROLE_DESCRIPTIONS,
  getCombatRoleLabel,
  normalizeCombatRole,
  getHealerHealAmount,
  type CombatRole,
} from "@/lib/combat-roles";

export type CombatRoleStats = {
  name?: string;
  level?: number;
  statForce: number;
  statAgility: number;
  statVitality: number;
  statInstinct: number;
  statCharisma: number;
};

type CombatMode = "ARENA" | "LEAGUE" | "RAID" | "SYNC" | "GENERAL";

const pct = (value: number) => `${Math.round(value * 100)}%`;
const cap = (value: number, maximum: number) => Math.min(value, maximum);

function roleNumbers(role: CombatRole, s?: CombatRoleStats) {
  if (!s) return [COMBAT_ROLE_DESCRIPTIONS[role]];
  const { statForce: f, statAgility: a, statVitality: v, statInstinct: i, statCharisma: c } = s;
  switch (role) {
    case "DEFENDER":
      return [`Redução pessoal estimada: ${pct(cap(0.08 + v / 240, 0.35))}.`, "Atrai normalmente 78% dos ataques; contra Atacantes, 62%.", "Na Arena, tem 20% de chance de gastar a ação preparando uma defesa de 45%."];
    case "ATTACKER":
      return [`Bônus pessoal de dano: ${pct(0.08 + cap(f / 420, 0.18))}.`, "Contra Defensor, multiplica o resultado novamente por +15%.", "Prefere inimigos de maior Força; Defensores ainda podem puxar seu ataque em 62% das vezes."];
    case "FLANK":
      return [`Bônus pessoal de dano: ${pct(0.04 + cap(a / 500, 0.14))}.`, `Chance de ignorar a atração do Defensor e focar o alvo mais frágil: ${pct(cap(0.35 + a / 150, 0.82))}.`, `Redução defensiva na Arena: até ${pct(cap(a / 360, 0.25))}; +12% de dano contra suportes.`];
    case "OPPORTUNIST":
      return [`Chance de aplicar redução: ${pct(cap(0.22 + i / 220, 0.62))}.`, `Redução aplicada em Força, Agilidade, Instinto ou Vitalidade: ${pct(cap(0.08 + i / 500, 0.25))}.`, "Recebe +10% de dano se seu Instinto superar o do alvo e prefere inimigos de Instinto baixo."];
    case "ENCOURAGER":
      return [`Bônus de dano para toda a equipe enquanto estiver vivo: ${pct(cap(0.04 + c / 650, 0.18))}.`, "O bônus é passivo: ele ainda ataca em seu turno.", "Um Sabotador inimigo pode reduzir parte desse bônus."];
    case "GUARDIAN":
      return [`Intercepta ${pct(cap(0.15 + (v + c) / 600, 0.40))} do dano dirigido a um aliado; o dano interceptado vai para o Guardião.`, `Redução pessoal: ${pct(cap(0.05 + v / 300, 0.20))}; dano causado: -10%.`, "Na Arena, tem 15% de chance de gastar a ação preparando defesa de 38%."];
    case "DUELIST":
      return [`Bônus de dano base: ${pct(0.06 + cap((f + i) / 800, 0.12))}.`, "Depois de escolher um alvo, recebe mais +12% enquanto o duelo permanecer no mesmo inimigo.", "Mantém o foco até o alvo cair."];
    case "SABOTEUR":
      return [`Chance de interferência na Arena: ${pct(cap(0.18 + (i + a) / 400, 0.55))}.`, `Reduz entre 15% e 40% do bônus de Encorajadores na Liga, conforme Instinto + Agilidade.`, "Prefere Encorajadores e Cuidadores; o efeito é passivo e ele também ataca."];
    case "HEALER": {
      const heal = getHealerHealAmount({ charisma: c, vitality: v, level: s.level ?? 1 });
      const count = 2 + Math.floor((c + v) / 40);
      return [`Cura individual prevista: ${heal} HP por ação. Fórmula: (35% do Carisma + 25% da Vitalidade + nível) × 2,5.`, `Limite previsto: ${count} curas por combate tradicional.`, "Escolhe um aliado vivo ferido, priorizando o de menor HP; não cura o time inteiro. Na Arena/Liga, troca o ataque pela cura. Em Raid, ataca e pode curar depois."];
    }
    case "SCOUT":
      return [`Bônus passivo de dano da equipe: ${pct(cap(a / 400 + i / 500, 0.08))}.`, `Chance de furar a atração do Defensor: ${pct(cap(0.35 + a / 150, 0.82))}.`, "Foca o inimigo de menor HP e causa -5% de dano próprio."];
    case "PROVOKER":
      return [`Chance de redirecionar um ataque para si: ${pct(cap(0.20 + c / 300 + i / 400, 0.55))}.`, "Quando redireciona, o golpe causa 8% menos dano.", "O efeito é reativo/passivo; em seu turno também ataca, causando -8%."];
    case "SPECIALIST": {
      const best = Math.max(f, a, v, i, c);
      return [`Usa o maior atributo (${best}) para obter ${pct(0.06 + cap(best / 500, 0.14))} de dano.`, "É uma postura ofensiva estável: sempre usa sua ação para atacar."];
    }
    case "SURVIVOR":
      return [`Redução base: ${pct(cap(v / 400, 0.15))}.`, "Abaixo de 30% de HP: +15% de dano e mais 25% de redução.", "Uma vez por combate, um golpe fatal o deixa com 1 HP."];
  }
}

function modeText(mode: CombatMode) {
  if (mode === "RAID") return `Na Raid, a equipe age na ordem da escalação. Cada mascote ataca 1 vez; recebe 2 ataques ao superar a média de Agilidade dos companheiros em ${AGILITY_EXTRA_ACTION_GAP} e 3 ao superar em ${AGILITY_THIRD_ACTION_GAP}. O Cuidador ainda pode curar depois.`;
  if (mode === "SYNC") return "Na Arena Sincronizada, a postura altera pesos e confrontos do cálculo do modo. A ordem visual da escalação não promete ataques extras.";
  return `Na Arena e Liga Semanal, a Agilidade define a ordem, com pequena variação de até 3 pontos. Cada mascote começa com 1 ação: recebe 2 ações ao superar a média de Agilidade inimiga em ${AGILITY_EXTRA_ACTION_GAP} e 3 ações ao superar em ${AGILITY_THIRD_ACTION_GAP}. A postura, sozinha, não concede ações extras.`;
}

function actionBehavior(role: CombatRole, mode: CombatMode) {
  if (role === "HEALER") {
    return mode === "RAID"
      ? "ATACA + CURA: na Raid, ataca normalmente e depois pode realizar uma cura adicional."
      : "CURA OU ATACA: se houver aliado ferido e ainda restarem curas, usa a ação para curar no lugar de atacar. Caso contrário, ataca.";
  }
  if (role === "DEFENDER") return "ATACA OU DEFENDE: na Arena pode gastar a ação preparando defesa; nos demais casos, ataca. A atração de golpes é passiva.";
  if (role === "GUARDIAN") return "ATACA OU DEFENDE: sua interceptação é passiva e não consome o turno. Na Arena também pode gastar a ação preparando defesa.";
  if (role === "ENCOURAGER") return "ATACA + BUFF PASSIVO: fortalece o dano da equipe enquanto estiver vivo e continua atacando normalmente.";
  if (role === "SABOTEUR") return "ATACA + DEBUFF PASSIVO: reduz ou bloqueia suporte inimigo e também realiza seu ataque.";
  if (role === "SCOUT") return "ATACA + BUFF PASSIVO: melhora o dano/foco da equipe enquanto estiver vivo e também ataca.";
  if (role === "PROVOKER") return "ATACA + PROVOCAÇÃO PASSIVA: redireciona golpes fora do próprio turno e ataca quando chega sua ação.";
  if (role === "SURVIVOR") return "ATACA + SOBREVIVÊNCIA PASSIVA: seus efeitos defensivos não consomem a ação.";
  return "ATACA: usa suas ações para causar dano; os efeitos descritos são aplicados junto ao ataque ou passivamente.";
}

export function CombatRoleHelpButton({
  role,
  stats,
  teamStats = [],
  mode = "GENERAL",
  className = "",
}: {
  role: unknown;
  stats?: CombatRoleStats;
  teamStats?: CombatRoleStats[];
  mode?: CombatMode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const normalized = normalizeCombatRole(role);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const rank = stats ? 1 + teamStats.filter((item) => item.statAgility > stats.statAgility).length : 0;

  const modal = open ? (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 p-4" onMouseDown={() => setOpen(false)}>
      <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#FFCB05]/35 bg-slate-950 p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#FFCB05]">Manual de postura</p>
            <h3 className="mt-1 text-lg font-black text-white">{getCombatRoleLabel(normalized)}{stats?.name ? ` — ${stats.name}` : ""}</h3>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs leading-relaxed text-cyan-100">
          <strong>Turnos e prioridade:</strong> {modeText(mode)}
          {stats && (
            <div className="mt-2 space-y-1 text-cyan-300">
            <p>
              Iniciativa deste mascote: <strong>{stats.statAgility}</strong>
              {rank > 0 ? ` — posição estimada #${rank} entre ${teamStats.length} membros da equipe.` : "."}
            </p>
            <p>
              Ações por rodada: <strong>1 normalmente</strong>; 2 se a média {mode === "RAID" ? "dos companheiros" : "inimiga"} for até {Math.max(0, stats.statAgility - AGILITY_EXTRA_ACTION_GAP)}; 3 se for até {Math.max(0, stats.statAgility - AGILITY_THIRD_ACTION_GAP)}.
            </p>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-[#FFCB05]/25 bg-[#FFCB05]/5 px-3 py-2 text-xs font-bold leading-relaxed text-yellow-100">
          {actionBehavior(normalized, mode)}
        </div>

        <p className="mt-4 text-xs leading-relaxed text-slate-300">{COMBAT_ROLE_DESCRIPTIONS[normalized]}</p>
        <div className="mt-4 space-y-2">
          {roleNumbers(normalized, stats).map((line) => (
            <div key={line} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs leading-relaxed text-slate-200">{line}</div>
          ))}
        </div>
        <p className="mt-4 text-[10px] leading-relaxed text-slate-500">Previsões usam os atributos atuais. Tipo, nível, adversário, buffs, modificadores do modo e a variação de dano ainda alteram o resultado real.</p>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }} className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 ${className}`} title="Entender postura, prioridade e números" aria-label="Ver detalhes da postura">
        <HelpCircle size={14} />
      </button>
      {open && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </>
  );
}
