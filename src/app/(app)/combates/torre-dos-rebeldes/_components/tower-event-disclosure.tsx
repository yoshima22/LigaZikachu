import type { buildTowerEventDisclosure } from "@/lib/tower/event-disclosure";

type Disclosure = ReturnType<typeof buildTowerEventDisclosure>;

export function TowerEventDisclosure({ disclosure, compact = false }: { disclosure: Disclosure; compact?: boolean }) {
  const ticketMissing = disclosure.ticket.required && disclosure.ticket.count < 1;
  return <section aria-label="Regras e recompensas da Torre" className="space-y-3">
    <div className="grid gap-3 md:grid-cols-2">
      <article className={`min-w-0 rounded-2xl border p-4 ${ticketMissing ? "border-red-400/35 bg-red-950/15" : "border-cyan-400/25 bg-cyan-950/15"}`}>
        <p className="text-[10px] font-black uppercase tracking-wider text-cyan-200">Entrada na Torre</p>
        <h3 className="mt-1 text-sm font-black text-white">Ticket da Torre · saldo {disclosure.ticket.count}</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">{disclosure.ticket.explanation}</p>
        {ticketMissing && <p className="mt-2 text-xs font-bold text-red-200">Você ainda não possui o ticket exigido para iniciar.</p>}
        <p className="mt-2 text-[11px] leading-5 text-slate-400">{disclosure.ticket.acquisition}</p>
      </article>
      <article className="min-w-0 rounded-2xl border border-emerald-400/25 bg-emerald-950/10 p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-emerald-200">Resgates</p>
        <h3 className="mt-1 text-sm font-black text-white">Kit de Reanimação · saldo {disclosure.recovery.kitCount}</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">{disclosure.recovery.kitRule}</p>
        <p className="mt-2 text-xs leading-5 text-emerald-100/80">{disclosure.recovery.roomCooldown}</p>
        <p className="mt-2 text-[11px] leading-5 text-slate-400">{disclosure.recovery.acquisition}</p>
      </article>
    </div>
    {compact ? <div className="rounded-xl border border-amber-300/20 bg-amber-950/10 p-3 text-xs text-slate-300"><p className="font-bold text-amber-100">Achados do andar ainda podem ser perdidos</p><p className="mt-1 leading-5">{disclosure.floorLoot.failure}</p><details className="mt-2 border-t border-amber-300/15 pt-2"><summary className="cursor-pointer font-semibold text-amber-200">Ver entrega e elegibilidade</summary><p className="mt-2 leading-5">{disclosure.floorLoot.rule} {disclosure.floorLoot.eligibility}</p></details></div> : <>
      <article className="rounded-2xl border border-amber-300/25 bg-amber-950/10 p-4">
        <h3 className="text-sm font-black text-amber-100">Achados da expedição</h3>
        <p className="mt-2 text-xs leading-5 text-slate-300">{disclosure.floorLoot.rule}</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">{disclosure.floorLoot.failure}</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">{disclosure.floorLoot.eligibility}</p>
      </article>
      <div className="rounded-2xl border border-purple-300/20 bg-purple-950/10 p-4">
        <h3 className="text-sm font-black text-purple-100">Baús de Doces e Travessuras</h3>
        <p className="mt-1 text-xs text-slate-400">Planejados para uma etapa futura; ainda não podem ser obtidos nem abertos.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{disclosure.chests.map((chest) => <article key={chest.name} className="rounded-xl border border-slate-700 bg-black/20 p-3"><b className="text-xs text-white">{chest.name} · {chest.source}</b><p className="mt-1 text-[11px] leading-5 text-slate-400">{chest.explanation}</p></article>)}</div>
      </div>
    </>}
  </section>;
}
