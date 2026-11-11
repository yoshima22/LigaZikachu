"use client";

import type { ResolvedPackage } from "@/lib/amigo-oculto/catalog-db";
import { MIMO, OPTIONS_PER_GIFT } from "@/lib/amigo-oculto/catalog";

const TIER = ["", "Nível 1", "Nível 2", "Nível 3", "Nível 4"];
const TIER_COLOR = ["", "text-emerald-300", "text-sky-300", "text-fuchsia-300", "text-amber-300"];

// Pacote com as imagens originais dos itens da loja (sem imagem: ícone genérico).
export function PackageCard({ pkg, locked, selected, onClick, order }: { pkg: ResolvedPackage; locked?: boolean; selected?: boolean; onClick?: () => void; order?: number }) {
  return (
    <button type="button" disabled={locked || !onClick} onClick={onClick} className={`relative w-full rounded-xl border p-3 text-left transition ${selected ? "border-amber-300 bg-amber-300/10 ring-1 ring-amber-300" : "border-white/10 bg-white/5"} ${locked ? "opacity-40" : onClick ? "hover:bg-white/10" : ""}`}>
      {selected && order !== undefined && <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-slate-900">{order}</span>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{locked ? "🔒" : pkg.emoji} {pkg.name}</span>
        <span className={`text-[11px] ${TIER_COLOR[pkg.tier]}`}>{TIER[pkg.tier]}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {pkg.items.map((i) => (
          <span key={i.name} title={`${i.qty}× ${i.name}`} className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-white/90 p-1">
            {i.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.imageUrl} alt={i.name} loading="lazy" className="h-full w-full object-contain" />
            ) : <span className="text-xl">{i.egg ? "🥚" : "🎁"}</span>}
            {i.qty > 1 && <span className="absolute bottom-0 right-0 rounded-tl-md bg-slate-900/85 px-1 text-[10px] font-bold text-white">×{i.qty}</span>}
          </span>
        ))}
        {pkg.food ? <span className="flex h-14 min-w-14 items-center justify-center rounded-lg bg-white/10 px-2 text-xs">🍖 ×{pkg.food}</span> : null}
        {pkg.sweet ? <span className="flex h-14 min-w-14 items-center justify-center rounded-lg bg-white/10 px-2 text-xs">🍬 ×{pkg.sweet}</span> : null}
      </div>
      <p className="mt-1.5 text-[11px] leading-tight text-slate-400">{pkg.items.map((i) => `${i.qty > 1 ? `${i.qty}× ` : ""}${i.name}`).join(" · ")}</p>
    </button>
  );
}

// Escolha de exatamente 3 pacotes entre os liberados pelo nível; os demais aparecem trancados.
export function PackagePicker({ packages, level, selected, onChange }: { packages: ResolvedPackage[]; level: number; selected: string[]; onChange: (keys: string[]) => void }) {
  const toggle = (k: string) => onChange(selected.includes(k) ? selected.filter((x) => x !== k) : selected.length < OPTIONS_PER_GIFT ? [...selected, k] : selected);
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-300">Escolha <b>{OPTIONS_PER_GIFT} pacotes</b> ({selected.length}/{OPTIONS_PER_GIFT}). Quem tirou você recebe <b>1 deles por sorteio</b> na entrega.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {packages.map((p) => {
          const locked = p.tier > level;
          const i = selected.indexOf(p.key);
          return <PackageCard key={p.key} pkg={p} locked={locked} selected={i >= 0} order={i >= 0 ? i + 1 : undefined} onClick={() => toggle(p.key)} />;
        })}
      </div>
    </div>
  );
}

// Painel "seu presente" mostrado depois que o cartão abre.
export function ReceivedGift({ pkg, mimo, delivered }: { pkg: ResolvedPackage; mimo: boolean; delivered: boolean }) {
  return (
    <div className="space-y-2 rounded-xl border border-amber-300/50 bg-black/30 p-3 text-center">
      <p className="text-xs uppercase tracking-wider text-amber-200">🎲 O sorteio escolheu para você</p>
      <PackageCard pkg={pkg} />
      {mimo && <p className="text-xs text-emerald-300">+ mimo de constância: {MIMO.food} comidas e {MIMO.sweet} doces</p>}
      <p className="text-sm text-slate-300">{delivered ? "O presente já está na sua Caixa de Presentes." : "(Testador: sem Caixa de Presentes.)"}</p>
    </div>
  );
}
