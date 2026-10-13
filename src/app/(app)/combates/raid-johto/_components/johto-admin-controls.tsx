"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { johtoAdminAction } from "../actions";

import type { JohtoAdminSummary } from "@/lib/johto-raid";

type Cmd = Parameters<typeof johtoAdminAction>[0];
type Prize = { playerId: string; playerName: string; zc: number; egg: boolean; lines: string[] };

const btn = "rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50";
const neutral = `${btn} border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700`;
const danger = `${btn} border-red-500/50 bg-red-500/10 text-red-200 hover:bg-red-500/20`;
const good = `${btn} border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20`;

/** Controles do evento para administradores: liberar ao público, abrir/pausar ataques e ferramentas de debug. */
export function JohtoAdminControls({ summary }: { summary: JohtoAdminSummary }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cooldown, setCooldown] = useState(String(summary.cooldownMinutes));
  const [duration, setDuration] = useState("48");
  const [damage, setDamage] = useState("1000000");
  const [hp, setHp] = useState("100000000");
  const [prizes, setPrizes] = useState<Prize[] | null>(null);

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
          <p className="mt-1 text-xs text-slate-400">Só administradores veem esta caixa. Ataques de contas de admin não entram no ranking nem nos prêmios.</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
          <span className={`rounded-full px-2 py-1 ${summary.visible ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-700 text-slate-300"}`}>{summary.visible ? "VISÍVEL AOS JOGADORES" : "OCULTA (só admin)"}</span>
          <span className={`rounded-full px-2 py-1 ${summary.active ? "bg-sky-500/20 text-sky-200" : "bg-slate-700 text-slate-300"}`}>{summary.active ? "ATAQUES ABERTOS" : "ATAQUES PAUSADOS"}</span>
          {summary.defeated && <span className="rounded-full bg-amber-500/20 px-2 py-1 text-amber-200">VENCIDO{summary.rewardsGranted ? " · PRÊMIOS ENTREGUES" : ""}</span>}
        </div>
      </div>

      {!summary.exists ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] text-slate-400">HP por líder
            <input value={hp} onChange={(e) => setHp(e.target.value.replace(/\D/g, ""))} className="mt-1 block w-36 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white" />
          </label>
          <button disabled={pending} className={good} onClick={() => run({ type: "create", hpPerLeader: Number(hp) || undefined })}>Criar evento (inativo e oculto)</button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-300">Publicação</p>
              <div className="flex flex-wrap gap-2">
                <button disabled={pending} className={summary.visible ? danger : good} onClick={() => run({ type: "visible", value: !summary.visible }, summary.visible ? undefined : "Liberar a página para TODOS os jogadores?")}>
                  {summary.visible ? "Ocultar dos jogadores" : "Liberar para jogadores"}
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[10px] text-slate-400">Duração (h, 0 = sem prazo)
                  <input value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))} className="mt-1 block w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white" />
                </label>
                <button disabled={pending} className={summary.active ? danger : good} onClick={() => run({ type: "active", value: !summary.active, durationHours: Number(duration) || 0 })}>
                  {summary.active ? "Pausar ataques" : "Abrir ataques"}
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[10px] text-slate-400">Espera entre ataques (min)
                  <input value={cooldown} onChange={(e) => setCooldown(e.target.value.replace(/\D/g, ""))} className="mt-1 block w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white" />
                </label>
                <button disabled={pending} className={neutral} onClick={() => run({ type: "cooldown", minutes: Number(cooldown) || 0 })}>Salvar</button>
              </div>
              {summary.endsAt && <p className="text-[10px] text-slate-500">Termina em {new Date(summary.endsAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>}
            </div>

            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-300">Debug · {summary.currentLeader ?? "todos derrotados"} ({pctLeft}% do HP)</p>
              <p className="text-[10px] text-slate-500">{summary.participants} jogadores · {summary.attacks} ataques registrados</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[10px] text-slate-400">Tirar HP
                  <input value={damage} onChange={(e) => setDamage(e.target.value.replace(/\D/g, ""))} className="mt-1 block w-32 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white" />
                </label>
                <button disabled={pending} className={neutral} onClick={() => run({ type: "damage", amount: Number(damage) || 1 })}>Aplicar</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={pending} className={neutral} onClick={() => run({ type: "healCurrent" })}>Curar líder atual</button>
                <button disabled={pending} className={neutral} onClick={() => run({ type: "skipCurrent" }, "Derrubar o líder atual sem atribuir golpe final?")}>Derrubar líder atual</button>
                <button disabled={pending} className={neutral} onClick={() => run({ type: "resetMyCooldown" })}>Zerar meu cooldown</button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <button disabled={pending} className={good} onClick={() => run({ type: "grantRewards" })}>Prévia / entregar prêmios</button>
            <button disabled={pending} className={danger} onClick={() => run({ type: "resetProgress" }, "Zerar TODO o progresso (HP, ranking e ataques)? Prêmios já entregues não são desfeitos.")}>Zerar progresso</button>
            <button disabled={pending} className={danger} onClick={() => run({ type: "create", reset: true, hpPerLeader: Number(hp) || undefined }, "Apagar o evento e recriar do zero?")}>Recriar do zero</button>
            <label className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">HP por líder (recriar)
              <input value={hp} onChange={(e) => setHp(e.target.value.replace(/\D/g, ""))} className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white" />
            </label>
          </div>

          {prizes && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-300">Prévia dos prêmios ({prizes.length} jogadores)</p>
              <div className="max-h-64 space-y-1 overflow-y-auto text-[11px]">
                {prizes.map((p) => (
                  <div key={p.playerId} className="rounded-lg bg-slate-900/70 px-2 py-1.5">
                    <span className="font-bold text-white">{p.playerName}</span> <span className="text-amber-300">{p.zc.toLocaleString("pt-BR")} ZC{p.egg ? " + ovo" : ""}</span>
                    <p className="text-slate-500">{p.lines.join(" · ")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
