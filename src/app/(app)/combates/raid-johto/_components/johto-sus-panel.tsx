"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getPokemonName, getStaticSpriteUrl } from "@/lib/mascot-data";
import { healAllJohtoMascotsSusAction, healJohtoMascotSusAction, useJohtoRaidShieldAction } from "../actions";

type Mascot = { id: string; pokemonId: number; nickname: string | null; level: number; playerName?: string };
type Page = { items: Mascot[]; page: number; totalPages: number; total: number };

function Pager({ page, param }: { page: Page; param: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  if (page.totalPages < 2) return null;
  const move = (next: number) => {
    const params = new URLSearchParams(search.toString());
    if (next <= 1) params.delete(param); else params.set(param, String(next));
    router.push(`${pathname}${params.size ? `?${params}` : ""}#sus`, { scroll: false });
  };
  return <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-400">
    <button type="button" disabled={page.page <= 1} onClick={() => move(page.page - 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 font-bold disabled:cursor-not-allowed disabled:opacity-40">← Anterior</button>
    <span>Página {page.page} de {page.totalPages} · {page.total}</span>
    <button type="button" disabled={page.page >= page.totalPages} onClick={() => move(page.page + 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 font-bold disabled:cursor-not-allowed disabled:opacity-40">Próxima →</button>
  </div>;
}

export function JohtoSusPanel({ mine, allies, shieldAvailable }: { mine: Page; allies: Page; shieldAvailable: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (action: (data: FormData) => Promise<{ ok: boolean; message?: string }>, mascotId?: string) => startTransition(async () => {
    const data = new FormData();
    if (mascotId) data.set("mascotId", mascotId);
    try {
      const result = await action(data);
      if (!result.ok) { toast.error(result.message ?? "Não foi possível concluir a ação."); return; }
      toast.success(result.message ?? "Ação concluída.");
      router.refresh();
    } catch {
      toast.error("Não foi possível concluir a ação. Tente novamente.");
    }
  });

  return <>
    {mine.total > 0 && <section id="sus" className="rounded-2xl border border-orange-500/25 bg-slate-900/60 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-white">⚠️ Atendimento SUS</h2>
        <button type="button" disabled={pending} onClick={() => run(healAllJohtoMascotsSusAction)} className="rounded-lg bg-orange-400 px-3 py-2 text-xs font-black text-slate-950 disabled:cursor-wait disabled:opacity-60">{pending ? "Recuperando…" : `Recuperar todos · ${mine.total * 10} ZC`}</button>
      </div>
      <div className="space-y-2">
        {mine.items.map((mascot) => <div key={mascot.id} className="flex items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/10 p-2.5">
          <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-9 w-9 object-contain" style={{ imageRendering: "pixelated" }} />
          <p className="min-w-0 flex-1 truncate text-sm font-bold text-orange-100">{mascot.nickname ?? getPokemonName(mascot.pokemonId)} <span className="text-[10px] font-normal text-orange-200/70">Nv.{mascot.level}</span></p>
          <button type="button" disabled={pending} onClick={() => run(healJohtoMascotSusAction, mascot.id)} className="rounded-lg bg-[#FFCB05] px-3 py-1.5 text-[10px] font-black text-slate-950 hover:brightness-110 disabled:cursor-wait disabled:opacity-60">Atendimento SUS · 10 ZC</button>
        </div>)}
      </div>
      <Pager page={mine} param="susPage" />
    </section>}

    <section className="rounded-2xl border border-cyan-500/25 bg-slate-900/60 p-4">
      <h2 className="text-base font-bold text-white">🛡️ Escudo Cooperativo de Johto</h2>
      <p className="mt-1 text-xs text-slate-400">Exclusivo de Johto: revive um mascote de outro jogador. Diferente da Arena Z, ele volta a ficar disponível após seu próximo ataque e não acumula cargas.</p>
      <p className={`mt-2 text-xs font-bold ${shieldAvailable ? "text-emerald-300" : "text-amber-300"}`}>{shieldAvailable ? "Escudo pronto para resgatar um aliado." : "Escudo gasto: ataque novamente na raid para recarregar."}</p>
      <div className="mt-3 space-y-2">
        {allies.items.length ? allies.items.map((mascot) => <div key={mascot.id} className="flex items-center gap-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-2">
          <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-8 w-8 object-contain" style={{ imageRendering: "pixelated" }} />
          <p className="min-w-0 flex-1 truncate text-xs font-bold text-cyan-100">{mascot.nickname ?? getPokemonName(mascot.pokemonId)} · {mascot.playerName}</p>
          <button type="button" disabled={pending || !shieldAvailable} onClick={() => run(useJohtoRaidShieldAction, mascot.id)} className="rounded-lg bg-cyan-300 px-3 py-1.5 text-[10px] font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Reviver aliado</button>
        </div>) : <p className="text-xs text-slate-500">Nenhum aliado ferido no momento.</p>}
      </div>
      <Pager page={allies} param="allySusPage" />
    </section>
  </>;
}
