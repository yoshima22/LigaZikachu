"use client";

import type { ResolvedItem, ResolvedPackage } from "@/lib/amigo-oculto/catalog-db";
import { FX_EMOJI, MIMO, OPTIONS_PER_GIFT, TIERS } from "@/lib/amigo-oculto/catalog";
import { getShopItemEmoji } from "@/lib/shop-config";
import { Cane } from "./candy-cane";

export const TIER_COLOR = ["", "text-emerald-300", "text-sky-300", "text-fuchsia-300", "text-amber-300"];
const TIER_BORDER = ["", "border-emerald-400/30", "border-sky-400/30", "border-fuchsia-400/30", "border-amber-400/40"];
export const tierRange = (t: { from: number; to: number | null }) => (t.to === null ? `${t.from}+` : `${t.from} a ${t.to}`);

// Ícone do item igual ao do ZikaShop: imagem da loja; sem imagem, o emoji do tipo.
export function ItemIcon({ item, size = 40 }: { item: ResolvedItem; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/90 p-0.5" style={{ width: size, height: size }}>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={item.name} loading="lazy" className="h-full w-full object-contain" />
      ) : <span style={{ fontSize: size * 0.55 }}>{item.fx ? FX_EMOJI[item.fx] : getShopItemEmoji(item.type ?? "")}</span>}
    </span>
  );
}

// Kit: título + lista organizada (ícone · nome · quantidade).
export function PackageCard({ pkg, locked, selected, onClick, order }: { pkg: ResolvedPackage; locked?: boolean; selected?: boolean; onClick?: () => void; order?: number }) {
  return (
    <button type="button" disabled={locked || !onClick} onClick={onClick} className={`relative w-full rounded-xl border p-3 text-left transition ${selected ? "border-amber-300 bg-amber-300/10 ring-2 ring-amber-300" : "border-white/10 bg-white/5"} ${locked ? "opacity-50" : onClick ? "hover:bg-white/10" : ""}`}>
      {selected && order !== undefined && <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-slate-900">{order}</span>}
      <div className="mb-2 flex items-center gap-2 border-b border-white/10 pb-2">
        <span className="text-xl">{locked ? "🔒" : pkg.emoji}</span>
        <span className="text-sm font-semibold leading-tight">{pkg.name}</span>
        <span className="ml-auto shrink-0 rounded-full bg-black/30 px-2 py-0.5 text-[10px] text-slate-300">{pkg.items.length} itens</span>
      </div>
      <ul className="space-y-1.5">
        {pkg.items.map((i) => (
          <li key={i.name} className="flex items-center gap-2.5">
            <ItemIcon item={i} />
            <span className="min-w-0 flex-1 text-xs leading-tight text-slate-100">{i.name}</span>
            <span className="shrink-0 rounded-md bg-black/40 px-1.5 py-0.5 text-xs font-bold text-amber-200">×{i.qty}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

// Escolha de 1 a 3 kits. Explica que NÃO são enviados os 3: um deles é sorteado.
export function PackagePicker({ packages, level, levels, selected, onChange, readOnly, deliverLabel }: { packages: ResolvedPackage[]; level: number; levels: number[]; selected: string[]; onChange: (keys: string[]) => void; readOnly?: boolean; deliverLabel?: string }) {
  const toggle = (k: string) => onChange(selected.includes(k) ? selected.filter((x) => x !== k) : selected.length < OPTIONS_PER_GIFT ? [...selected, k] : selected);
  const byKey = new Map(packages.map((p) => [p.key, p]));
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm">
        <p className="font-semibold text-amber-200">🎲 Você escolhe até {OPTIONS_PER_GIFT} kits, mas seu amigo ganha só 1</p>
        <p className="mt-1 text-slate-200">Os kits que você marcar entram num <b>sorteio</b>{deliverLabel ? ` feito em ${deliverLabel}` : " na hora da entrega"}. O amigo oculto recebe <b>apenas o kit sorteado</b> — não os {OPTIONS_PER_GIFT}. Quem não escolher recebe um sorteio entre kits padrão.</p>
        {!readOnly && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: OPTIONS_PER_GIFT }, (_, i) => {
              const p = byKey.get(selected[i]);
              return (
                <button type="button" key={i} onClick={() => p && toggle(p.key)} className={`rounded-lg border p-2 text-center text-xs ${p ? "border-amber-300/60 bg-black/30" : "border-dashed border-white/20 text-slate-400"}`}>
                  <span className="block text-[10px] uppercase tracking-wider text-slate-400">Opção {i + 1}</span>
                  {p ? <><span className="block text-xl">{p.emoji}</span><span className="block leading-tight">{p.name}</span></> : <span className="block py-2">vazio</span>}
                </button>
              );
            })}
          </div>
        )}
        {!readOnly && selected.length > 1 && <p className="mt-2 text-center text-xs text-amber-100">↳ 1 de {selected.length} será sorteado</p>}
      </div>
      {TIERS.map((t) => {
        const locked = t.tier > level;
        const kits = packages.filter((p) => p.tier === t.tier);
        return (
          <section key={t.tier} className={`space-y-2 rounded-2xl border bg-black/15 p-3 ${TIER_BORDER[t.tier]}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className={`text-sm font-bold ${TIER_COLOR[t.tier]}`}>{t.emoji} {t.name}</p>
                <p className="text-xs text-slate-300">{t.blurb}</p>
              </div>
              <div className="text-right text-xs">
                <span className={`rounded-full px-2 py-0.5 ${locked ? "bg-white/10 text-slate-300" : "bg-emerald-400/20 text-emerald-200"}`}>{locked ? "🔒 bloqueada" : "✔ liberada"}</span>
                <p className="mt-1 text-slate-400">libera com {levels[t.tier - 1]} <Cane size={12} /> · {kits.length} kits de {kits[0]?.items.length ?? 0} itens</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {kits.map((p) => {
                const i = selected.indexOf(p.key);
                return <PackageCard key={p.key} pkg={p} locked={locked && !readOnly} selected={i >= 0} order={i >= 0 ? i + 1 : undefined} onClick={readOnly || locked ? undefined : () => toggle(p.key)} />;
              })}
            </div>
          </section>
        );
      })}
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
