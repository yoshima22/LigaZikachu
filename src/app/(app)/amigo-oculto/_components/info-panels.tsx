"use client";

import { TIERS } from "@/lib/amigo-oculto/catalog";
import type { ResolvedPackage } from "@/lib/amigo-oculto/catalog-db";
import { PackageCard, tierRange } from "./package-ui";

const panel = "space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4";
const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

// Explica o que é o amigo oculto, as datas e como o presente é definido.
export function HowItWorks({ startsOn, deliverAt, minParticipants }: { startsOn: string; deliverAt: string; minParticipants: number }) {
  const deliver = new Date(deliverAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às");
  const steps = [
    ["📝", "Inscrição", `Aberta agora até ${dm(startsOn)}. Precisa de pelo menos ${minParticipants} inscritos.`],
    ["🤫", "Sorteio", `Automático no dia ${dm(startsOn)}, 00:00 (Brasília). Você descobre quem tirou e pode consultar quando quiser.`],
    ["🍭", "Bengalas de açúcar", `De ${dm(startsOn)} a ${dm(new Date(Date.parse(deliverAt) - 1 - 3 * 3_600_000).toISOString().slice(0, 10))}: cada check-in diário vale 1 bengala para a comunidade. Quanto mais bengalas, mais categorias de presente são liberadas.`],
    ["🎀", "Montagem", "Aqui mesmo você escolhe até 3 kits das categorias liberadas e monta o cartão de Natal com frases prontas."],
    ["🎁", "Entrega", `${deliver} (Brasília): para cada pessoa, 1 dos 3 kits que o amigo escolheu é sorteado. O cartão chega com animação e o presente cai na Caixa de Presentes.`],
  ];
  return (
    <section className={panel}>
      <h2 className="font-semibold">📖 Como funciona</h2>
      <ol className="space-y-2">
        {steps.map(([icon, title, text], i) => (
          <li key={title} className="flex gap-3 rounded-xl bg-black/20 p-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300/20 text-lg">{icon}</span>
            <div className="text-sm"><b>{i + 1}. {title}</b><p className="text-slate-300">{text}</p></div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-slate-300">🏅 <b>Constância:</b> quem faz check-in em 70% dos dias manda um mimo extra junto do presente. Os presentes não custam moedas: vêm das bengalas que a Liga junta unida.</p>
    </section>
  );
}

// As 4 categorias, o que cada uma exige e os kits que elas têm (com as imagens reais dos itens).
export function CategoryCatalog({ packages, levels, bonds }: { packages: ResolvedPackage[]; levels: number[]; bonds: number }) {
  return (
    <section className={panel}>
      <h2 className="font-semibold">🎁 Categorias de presente</h2>
      <p className="text-xs text-slate-300">Cada categoria tem seus kits. O presenteador escolhe <b>até 3 kits</b> de categorias já liberadas e o sorteio define qual deles o amigo recebe. A comunidade já juntou <b>{bonds} 🍭</b>.</p>
      <div className="space-y-2">
        {TIERS.map((t) => {
          const kits = packages.filter((p) => p.tier === t.tier);
          const open = bonds >= levels[t.tier - 1];
          const range = tierRange({ ...t, from: levels[t.tier - 1], to: t.tier < 4 ? levels[t.tier] - 1 : null });
          return (
            <details key={t.tier} className="group rounded-xl border border-white/10 bg-black/20">
              <summary className="flex cursor-pointer items-center justify-between gap-2 p-3">
                <span className="text-sm"><b>{t.emoji} {t.name}</b><span className="ml-2 text-xs text-slate-400">{range}</span><span className="block text-xs text-slate-300">{t.blurb}</span></span>
                <span className="shrink-0 text-right text-xs"><span className={open ? "text-emerald-300" : "text-slate-400"}>{open ? "✔ liberada" : "🔒 bloqueada"}</span><span className="block text-slate-400">{kits.length} kits × {kits[0]?.items.length ?? 0} itens</span></span>
              </summary>
              <div className="grid gap-2 p-3 pt-0 sm:grid-cols-2">{kits.map((p) => <PackageCard key={p.key} pkg={p} />)}</div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
