import React from "react";

export function TowerHero() {
  return (
    <header className="relative overflow-hidden rounded-3xl border border-purple-500/35 bg-[#080612] shadow-[0_0_60px_rgba(109,40,217,.18)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(126,34,206,.22),transparent_48%)]" />
      <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,390px)] lg:items-center lg:gap-10 lg:p-10">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🗼</span>
            <h1 className="text-2xl font-black text-white sm:text-3xl">Torre dos Rebeldes</h1>
            <span className="rounded-full border border-purple-400/40 bg-purple-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-200">
              Evento em construção
            </span>
            <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-300">
              Teste fechado
            </span>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300">
            Uma expedição Solo com quatro mascotes ou cooperativa para 2–3 jogadores com dois mascotes por pessoa. Atravesse
            salas cobertas pela névoa, neutralize mecanismos e enfrente os rebeldes em
            confrontos apresentados rodada por rodada. O progresso de vida permanece entre os andares.
          </p>
        </div>
        <div className="mx-auto w-full max-w-[360px] rounded-2xl border border-purple-300/20 bg-purple-950/15 p-2 shadow-[0_20px_60px_rgba(0,0,0,.35)] lg:max-w-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/events/torre-dos-rebeldes/cover.png"
            alt="Pôster ilustrado da Torre dos Rebeldes"
            width={1122}
            height={1402}
            className="block h-auto w-full object-contain"
          />
        </div>
      </div>
    </header>
  );
}
