"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OrderRaidTeamSelector } from "../../ordem-da-trapaca/_components/order-raid-team-selector";
import type { JohtoAdminSummary } from "@/lib/johto-raid";
import { JOHTO_LEADERS } from "@/lib/johto-raid-sim";
import { johtoAdminAction, johtoTestBattleAction } from "../actions";
import { JohtoBattleResultView } from "./johto-battle-view";

export type JohtoTestMascot = {
  id: string; pokemonId: number; nickname: string | null; level: number;
  statForce: number; statAgility: number; statInstinct: number; statVitality: number; statCharisma: number;
};

type Cmd = Parameters<typeof johtoAdminAction>[0];
type Prize = { playerId: string; playerName: string; zc: number; egg: boolean; tier: string; mascotLevel: number };

const btn = "rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50";
const neutral = `${btn} border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700`;
const danger = `${btn} border-red-500/50 bg-red-500/10 text-red-200 hover:bg-red-500/20`;
const good = `${btn} border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20`;
const input = "mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white";
const STATUS_LABEL: Record<string, string> = { DEFEATED: "derrotado", ESCAPED: "venceu pelo prazo", CURRENT: "em andamento", WAITING: "aguardando" };

/** Controles do evento para administradores: liberar ao público, abrir/pausar ataques, debug e laboratório de testes de combate. */
export function JohtoAdminControls({ summary, testMascots = [] }: { summary: JohtoAdminSummary; testMascots?: JohtoTestMascot[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cooldown, setCooldown] = useState(String(summary.cooldownMinutes));
  const [scale, setScale] = useState(String(summary.damageScale));
  const [days, setDays] = useState(String(summary.leaderDays));
  const [damage, setDamage] = useState("1000000");
  const [hp, setHp] = useState("35000000");
  const [extend, setExtend] = useState("24");
  const [rewardLeader, setRewardLeader] = useState(summary.currentLeaderKey ?? JOHTO_LEADERS[0].key);
  const [testLeader, setTestLeader] = useState(summary.currentLeaderKey ?? JOHTO_LEADERS[0].key);
  const [runs, setRuns] = useState("20");
  const [combo, setCombo] = useState("0");
  const [prizes, setPrizes] = useState<Prize[] | null>(null);
  const [showTest, setShowTest] = useState(false);

  function run(command: Cmd, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const response = await johtoAdminAction(command);
      (response.ok ? toast.success : toast.error)(response.message);
      if (response.preview) setPrizes(response.preview);
      router.refresh();
    });
  }

  const pctLeft = summary.hpMax > 0 ? Math.round((summary.hpCurrent / summary.hpMax) * 100) : 0;
  return (
    <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">Painel do administrador · Raid de Johto</p>
          <p className="mt-1 text-xs text-slate-400">Só administradores veem esta caixa. Ataques de contas de admin contam como teste: não entram no ranking, nos prêmios nem nos avisos do Professor Enguiça.</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
          <span className={`rounded-full px-2 py-1 ${summary.visible ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-700 text-slate-300"}`}>{summary.visible ? "VISÍVEL AOS JOGADORES" : "OCULTA (só admin)"}</span>
          <span className={`rounded-full px-2 py-1 ${summary.active ? "bg-sky-500/20 text-sky-200" : "bg-slate-700 text-slate-300"}`}>{summary.active ? "ATAQUES ABERTOS" : "ATAQUES PAUSADOS"}</span>
          {summary.defeated && <span className="rounded-full bg-amber-500/20 px-2 py-1 text-amber-200">SERVIDOR VENCEU</span>}
        </div>
      </div>

      {!summary.exists ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] text-slate-400">HP total por líder (dividido em 6 mascotes)
            <input value={hp} onChange={(e) => setHp(e.target.value.replace(/\D/g, ""))} className={`${input} w-40`} />
          </label>
          <button disabled={pending} className={good} onClick={() => run({ type: "create", hpPerLeader: Number(hp) || undefined })}>Criar evento (inativo e oculto)</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {summary.leaders.map((l) => (
              <span key={l.key} className={`rounded-full border px-2 py-1 ${l.status === "CURRENT" ? "border-[#FFCB05]/60 text-[#FFCB05]" : l.status === "DEFEATED" ? "border-emerald-500/40 text-emerald-300" : l.status === "ESCAPED" ? "border-red-500/40 text-red-300" : "border-slate-700 text-slate-400"}`}>
                {l.name}: {STATUS_LABEL[l.status] ?? l.status}{l.rewardsGranted ? " ✓prêmios" : ""}
              </span>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-300">Publicação</p>
              <div className="flex flex-wrap gap-2">
                <button disabled={pending} className={summary.visible ? danger : good} onClick={() => run({ type: "visible", value: !summary.visible }, summary.visible ? undefined : "Liberar a página para TODOS os jogadores?")}>
                  {summary.visible ? "Ocultar dos jogadores" : "Liberar para jogadores"}
                </button>
                <button disabled={pending} className={summary.active ? danger : good} onClick={() => run({ type: "active", value: !summary.active })}>
                  {summary.active ? "Pausar ataques" : "Abrir ataques"}
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[10px] text-slate-400">Espera (min)<input value={cooldown} onChange={(e) => setCooldown(e.target.value.replace(/\D/g, ""))} className={`${input} w-20`} /></label>
                <label className="text-[10px] text-slate-400">Escala de dano ×<input value={scale} onChange={(e) => setScale(e.target.value.replace(/[^\d.]/g, ""))} className={`${input} w-20`} /></label>
                <label className="text-[10px] text-slate-400">Dias por líder<input value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} className={`${input} w-16`} /></label>
                <button disabled={pending} className={neutral} onClick={() => run({ type: "settings", cooldownMinutes: Number(cooldown) || 0, damageScale: Number(scale) || 10, leaderDays: Number(days) || 5 })}>Salvar</button>
              </div>
              <p className="text-[10px] text-slate-500">Multiplicador do dano causado aos mascotes do líder (1 = dano real da luta). Os mascotes do líder lutam com a vida global real; use o laboratório abaixo para ver quantas lutas cada líder aguenta e ajuste a vida ou este multiplicador.</p>
              {summary.expiresAt && (
                <div className="flex flex-wrap items-end gap-2">
                  <p className="text-[10px] text-slate-400">Prazo do líder atual: {new Date(summary.expiresAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
                  <label className="text-[10px] text-slate-400">±horas<input value={extend} onChange={(e) => setExtend(e.target.value.replace(/[^\d-]/g, ""))} className={`${input} w-16`} /></label>
                  <button disabled={pending} className={neutral} onClick={() => run({ type: "extend", hours: Number(extend) || 0 })}>Ajustar prazo</button>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-300">Debug · {summary.currentLeader ?? "nenhum líder em andamento"} ({pctLeft}% do HP)</p>
              <p className="text-[10px] text-slate-500">{summary.participants} jogadores · {summary.attacks} ataques registrados</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[10px] text-slate-400">Tirar HP<input value={damage} onChange={(e) => setDamage(e.target.value.replace(/\D/g, ""))} className={`${input} w-32`} /></label>
                <button disabled={pending} className={neutral} onClick={() => run({ type: "damage", amount: Number(damage) || 1 })}>Aplicar</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={pending} className={neutral} onClick={() => run({ type: "healCurrent" })}>Restaurar líder</button>
                <button disabled={pending} className={neutral} onClick={() => run({ type: "skipCurrent" }, "Derrubar o líder atual sem atribuir golpe final?")}>Derrubar líder</button>
                <button disabled={pending} className={neutral} onClick={() => run({ type: "resetMyCooldown" })}>Zerar meu cooldown</button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <label className="text-[10px] text-slate-400">Prêmios do líder
              <select value={rewardLeader} onChange={(e) => setRewardLeader(e.target.value)} className={`${input} w-36`}>
                {JOHTO_LEADERS.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
              </select>
            </label>
            <button disabled={pending} className={neutral} onClick={() => run({ type: "rewards", leaderKey: rewardLeader, deliver: false })}>Ver prévia</button>
            <button disabled={pending} className={good} onClick={() => run({ type: "rewards", leaderKey: rewardLeader, deliver: true }, "Entregar agora os prêmios deste líder (só funciona se ele estiver derrotado; é idempotente)?")}>Entregar prêmios</button>
            <span className="mx-1 hidden h-6 w-px bg-slate-700 sm:block" />
            <button disabled={pending} className={danger} onClick={() => run({ type: "resetProgress" }, "Zerar TODO o progresso (HP, prazos, ranking, ataques e recompensas)? ZC e mascotes já entregues não são desfeitos.")}>Zerar progresso</button>
            <button disabled={pending} className={danger} onClick={() => run({ type: "create", reset: true, hpPerLeader: Number(hp) || undefined }, "Apagar o evento e recriar do zero?")}>Recriar do zero</button>
            <label className="ml-auto text-[10px] text-slate-400">HP por líder (recriar)<input value={hp} onChange={(e) => setHp(e.target.value.replace(/\D/g, ""))} className={`${input} w-32`} /></label>
          </div>

          {prizes && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-300">Prêmios ({prizes.length})</p>
              <div className="max-h-56 space-y-1 overflow-y-auto text-[11px]">
                {prizes.map((p, i) => (
                  <div key={`${p.playerId}-${p.tier}-${i}`} className="rounded-lg bg-slate-900/70 px-2 py-1.5">
                    <span className="font-bold text-white">{p.playerName}</span> <span className="text-slate-400">{p.tier}</span>{" "}
                    <span className="text-amber-300">{p.zc.toLocaleString("pt-BR")} ZC{p.egg ? " + ovo especial" : ""} + mascote Nv.{p.mascotLevel}</span>
                  </div>
                ))}
                {prizes.length === 0 && <p className="text-slate-500">Ninguém atacou este líder ainda.</p>}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-200">🧪 Laboratório de combate</p>
                <p className="text-[11px] text-slate-400">Monte uma equipe de 6 e rode várias simulações contra um líder (time completo, 6 mascotes). Não grava nada: mostra taxa de vitória, dano convertido, ataques estimados e permite assistir ao replay.</p>
              </div>
              <button className={neutral} onClick={() => setShowTest((v) => !v)}>{showTest ? "Esconder" : "Abrir laboratório"}</button>
            </div>
            {showTest && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-[10px] text-slate-400">Líder
                    <select value={testLeader} onChange={(e) => setTestLeader(e.target.value)} className={`${input} w-36`}>
                      {JOHTO_LEADERS.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] text-slate-400">Simulações (1–50)<input value={runs} onChange={(e) => setRuns(e.target.value.replace(/\D/g, ""))} className={`${input} w-20`} /></label>
                  <label className="text-[10px] text-slate-400">Combo simulado
                    <select value={combo} onChange={(e) => setCombo(e.target.value)} className={`${input} w-28`}>
                      {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 0 ? "sem combo" : `+${n * 2}% (${n} treinador${n > 1 ? "es" : ""})`}</option>)}
                    </select>
                  </label>
                </div>
                {testMascots.length < 6 ? (
                  <p className="text-xs text-amber-200">Sua conta precisa de pelo menos 6 mascotes livres para testar.</p>
                ) : (
                  <OrderRaidTeamSelector
                    mascots={testMascots}
                    attackAction={johtoTestBattleAction}
                    submitLabel="Simular combate"
                    extraFields={{ leaderKey: testLeader, runs, combo }}
                    renderResult={(result, close) => <JohtoBattleResultView result={result} onClose={close} />}
                  />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
