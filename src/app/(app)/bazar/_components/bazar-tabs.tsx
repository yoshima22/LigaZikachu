import Link from "next/link";

const TABS = [
  { key: "anuncios", label: "Vitrine", hint: "Slots do Miauvadão e anúncios", icon: "🏪" },
  { key: "pedidos", label: "Pedidos", hint: "Quem quer comprar", icon: "📋" },
  { key: "jogos", label: "Jogos", hint: "Jogos do Miauvadão", icon: "🎩" },
] as const;

/** Navegação por abas (server component, estado na URL ?tab=). */
export function BazarTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Seções do Bazar" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.key === "anuncios" ? "/bazar" : `/bazar?tab=${t.key}`}
            aria-current={on ? "page" : undefined}
            className={`flex min-w-[7.5rem] flex-1 items-center gap-2 rounded-xl border px-4 py-2.5 transition-colors sm:flex-none ${
              on
                ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 text-[#FFCB05] shadow-[0_0_18px_rgba(255,203,5,0.08)]"
                : "border-border bg-slate-950/40 text-slate-400 hover:border-[#FFCB05]/30 hover:text-slate-200"
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span className="min-w-0">
              <span className="block text-xs font-bold leading-tight">{t.label}</span>
              <span className="hidden text-[10px] leading-tight opacity-70 sm:block">{t.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
