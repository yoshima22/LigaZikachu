type Props = { dust: number };

export function DraCleideLabHeader({ dust }: Props) {
  return (
    <section className="relative mb-5 overflow-hidden rounded-3xl border border-fuchsia-400/35 bg-[radial-gradient(circle_at_72%_0%,rgba(217,70,239,0.3),transparent_30%),linear-gradient(125deg,#21102f_0%,#101427_58%,#26112f_100%)] shadow-[0_0_32px_rgba(192,38,211,0.2)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-[repeating-linear-gradient(-45deg,#facc15_0_14px,#171426_14px_28px)] opacity-90" />
      <div className="pointer-events-none absolute right-5 top-3 text-5xl text-fuchsia-300/15">🧪</div>
      <div className="pointer-events-none absolute right-20 top-14 h-24 w-24 rounded-full bg-fuchsia-500/15 blur-3xl" />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/dra-cleide-lab-hero.png"
        alt="Dra. Cleide Combustão preparando uma experiência"
        className="pointer-events-none absolute bottom-0 left-0 hidden w-[265px] max-w-none object-contain drop-shadow-[12px_0_20px_rgba(0,0,0,0.65)] md:block"
      />

      <div className="relative min-h-[164px] px-5 py-5 md:ml-[190px] md:pl-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-md">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-200">Pesquisa, misturo, testo…</p>
            <h1 className="mt-1 text-xl font-black text-white sm:text-2xl">Laboratório da Dra. Cleide</h1>
            <p className="mt-1 text-sm leading-relaxed text-violet-100/75">Recicle mascotes e transforme cada descoberta em novas experiências.</p>
          </div>
          <div className="rounded-2xl border border-yellow-300/45 bg-slate-950/55 px-4 py-2 shadow-[0_0_18px_rgba(250,204,21,0.12)] backdrop-blur-sm">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-200">Reagente disponível</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl">🧫</span>
              <strong className="text-lg text-[#FFCB05]">{dust}</strong>
              <span className="text-xs font-semibold text-slate-300">Pó de Criação</span>
            </div>
          </div>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-950/35 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-100">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FFCB05] shadow-[0_0_8px_#FFCB05]" />
          Bancada de análises estabilizada
        </div>
      </div>
    </section>
  );
}
