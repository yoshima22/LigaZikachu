"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { PT, fmtPts } from "@/lib/rei-do-rio/config";
import type { BoxesView } from "@/lib/rei-do-rio/wallet";
import { ItemIcon } from "@/app/(app)/amigo-oculto/_components/package-ui";
import { claimBoxAction, loadBoxesAction } from "../actions";
import { Card, Empty, Skeleton, Title } from "./rei-ui";

const TIER_RING = ["", "border-emerald-400/30", "border-sky-400/30", "border-sky-300/40", "border-fuchsia-400/30", "border-fuchsia-300/40", "border-amber-400/40", "border-amber-300/50", "border-amber-200/70"];

// Caixas de recompensa: pontos do ranking acumulados entre as semanas viram saldo; cada caixa abre 1 vez e deixa escolher 1 de 3 opções.
export function BoxesView({ onToast }: { onToast: (ok: boolean, text: string) => void }) {
  const [data, setData] = useState<BoxesView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const load = useCallback(async () => {
    const r = await loadBoxesAction();
    if (r.ok) { setData(r.boxes); setError(null); } else setError(r.error ?? "Falha ao carregar as caixas.");
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <Empty icon="🎁" title="Não foi possível carregar">{error}</Empty>;
  if (!data) return <Skeleton rows={4} />;
  const boxes = [...data.boxes].sort((a, b) => b.cost - a.cost);
  const claimedN = boxes.filter((b) => b.claimed).length;

  const claim = (boxKey: string, name: string) => {
    const optionKey = pick[boxKey];
    if (!optionKey) return onToast(false, "Escolha uma das 3 opções primeiro.");
    start(async () => {
      const r = await claimBoxAction(boxKey, optionKey);
      onToast(r.ok, r.ok ? `🎁 ${name} resgatada! O prêmio está na sua Caixa de Presentes.` : r.error ?? "Não foi possível resgatar.");
      await load();
    });
  };

  return (
    <div className="space-y-4">
      <Card glow>
        <Title sub="Os pontos que você faz no ranking viram moeda para as caixas.">Caixas de recompensa</Title>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80">Seu saldo</p><p className="mt-1 text-3xl font-black tabular-nums text-amber-200">{fmtPts(data.balance)}</p><p className="text-[11px] text-slate-400">pontos disponíveis</p></div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Já ganhou</p><p className="mt-1 text-2xl font-black tabular-nums text-white">{fmtPts(data.earned)}</p><p className="text-[11px] text-slate-500">somando todas as semanas</p></div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Caixas abertas</p><p className="mt-1 text-2xl font-black tabular-nums text-white">{claimedN}<span className="text-base text-slate-500">/{boxes.length}</span></p><p className="text-[11px] text-slate-500">1 resgate por caixa</p></div>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-300">
          <li>Ao fim de cada semana (sexta, 21h) <b className="text-white">todos os pontos que você fez no ranking</b> entram no seu saldo. O saldo <b className="text-white">acumula entre as edições</b>.</li>
          <li>Cada caixa custa uma quantidade de pontos, pode ser resgatada <b className="text-white">uma única vez</b> e deixa você <b className="text-white">escolher 1 entre 3 prêmios</b>. Quanto mais cara, melhor o prêmio.</li>
          <li>Referência: uma semana rende em média <b className="text-white">~800 pontos</b> (de ~450 a ~1.500, conforme o desempenho). A temporada de dezembro tem 4 semanas.</li>
        </ul>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {boxes.map((b) => {
          const costC = b.cost * PT;
          const can = data.balance >= costC && !b.claimed;
          const pct = Math.min(100, Math.round((data.balance / costC) * 100));
          const open = openKey === b.key;
          return (
            <div key={b.key} className={`rounded-2xl border bg-slate-950/70 p-4 ${TIER_RING[b.tier] ?? "border-slate-700"} ${b.claimed ? "opacity-70" : ""}`}>
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-800 text-2xl">{b.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white">{b.name}</p>
                  <p className="text-xs text-slate-400">{b.blurb}</p>
                </div>
                <div className="text-right"><p className="font-mono text-lg font-black tabular-nums text-amber-200">{b.cost.toLocaleString("pt-BR")}</p><p className="text-[10px] uppercase tracking-wider text-slate-500">pontos</p></div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${can || b.claimed ? "bg-emerald-400" : "bg-amber-300/70"}`} style={{ width: `${b.claimed ? 100 : pct}%` }} /></div>
              <div className="mt-1.5 flex items-center justify-between text-[11px]">
                <span className={b.claimed ? "text-emerald-300" : can ? "text-emerald-300" : "text-slate-500"}>{b.claimed ? "✔ Resgatada" : can ? "Disponível para resgatar" : `Faltam ${fmtPts(costC - data.balance)} pontos`}</span>
                <button className="font-bold text-sky-300 hover:underline" onClick={() => setOpenKey(open ? null : b.key)}>{open ? "Ocultar prêmios" : "Ver os 3 prêmios"}</button>
              </div>
              {open && (
                <div className="mt-3 space-y-2">
                  {b.options.map((o) => {
                    const chosen = (b.claimed?.optionKey ?? pick[b.key]) === o.key;
                    return (
                      <label key={o.key} className={`flex cursor-pointer gap-2.5 rounded-xl border p-2.5 ${chosen ? "border-amber-300 bg-amber-300/10" : "border-slate-800 bg-slate-900/60 hover:border-slate-600"} ${b.claimed ? "cursor-default" : ""}`}>
                        <input type="radio" name={`opt-${b.key}`} className="mt-1" disabled={!!b.claimed} checked={chosen} onChange={() => setPick((p) => ({ ...p, [b.key]: o.key }))} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-white">{o.label}</span>
                          <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                            {o.items.map((i) => (
                              <li key={i.name} className="flex items-center gap-2"><ItemIcon item={i} size={32} /><span className="min-w-0 flex-1 text-[11px] leading-tight text-slate-200">{i.name}</span><b className="rounded bg-black/40 px-1 text-[11px] text-amber-200">×{i.qty}</b></li>
                            ))}
                          </ul>
                        </span>
                      </label>
                    );
                  })}
                  {!b.claimed && <button disabled={!can || pending || !pick[b.key]} onClick={() => claim(b.key, b.name)} className="w-full rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40">{can ? (pick[b.key] ? `Resgatar por ${b.cost.toLocaleString("pt-BR")} pontos` : "Escolha 1 dos 3 prêmios") : "Pontos insuficientes"}</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
