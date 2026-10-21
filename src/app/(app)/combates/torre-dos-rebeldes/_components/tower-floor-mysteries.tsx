import React from "react";

const floors = [1, 2, 3, 4, 5, 6, 7] as const;

export function TowerFloorMysteries() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">Segredos da Torre</p>
      <h2 className="mt-1 text-lg font-black text-white">Sete andares, sete regentes ainda desconhecidos</h2>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        A identidade de cada regente e o prêmio daquele andar são revelados pela sua conquista, não antes dela.
        Consulte o relatório da expedição para ver o que sua equipe obteve.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {floors.map((floor) => (
          <article key={floor} className="rounded-xl border border-amber-300/15 bg-amber-950/10 p-3">
            <small className="font-black uppercase text-amber-300">{floor}º andar</small>
            <b className="mt-1 block text-sm text-white">Regente desconhecido</b>
            <p className="mt-2 text-[11px] text-slate-300">✦ Recompensa lacrada</p>
          </article>
        ))}
      </div>
    </section>
  );
}
