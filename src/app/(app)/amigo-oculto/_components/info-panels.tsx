"use client";

import { TIERS } from "@/lib/amigo-oculto/catalog";
import { Cane } from "./candy-cane";
import { TIER_COLOR } from "./package-ui";

export const panel = "space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5";
const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

// Barra de bengalas da comunidade com as 4 categorias marcadas.
export function CaneProgress({ bonds, levels, goal }: { bonds: number; levels: number[]; goal: number }) {
  const pct = Math.min(100, (bonds / goal) * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <p className="text-3xl font-extrabold leading-none text-white">{bonds} <Cane size={24} /></p>
        <p className="text-xs text-slate-300">meta final: {goal} bengalas</p>
      </div>
      <div className="relative h-4 overflow-hidden rounded-full bg-black/40">
        <div className="h-full rounded-full bg-gradient-to-r from-rose-500 via-white to-rose-500 transition-all" style={{ width: `${pct}%` }} />
        {levels.slice(1).map((m) => <span key={m} className="absolute top-0 h-full w-0.5 bg-slate-900/70" style={{ left: `${(m / goal) * 100}%` }} />)}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TIERS.map((t) => {
          const open = bonds >= levels[t.tier - 1];
          return (
            <div key={t.tier} className={`rounded-xl border p-2 text-center text-xs ${open ? "border-emerald-400/50 bg-emerald-400/10" : "border-white/10 bg-black/20 opacity-70"}`}>
              <p className="text-lg">{open ? t.emoji : "🔒"}</p>
              <p className={`font-semibold leading-tight ${TIER_COLOR[t.tier]}`}>{t.name}</p>
              <p className="text-slate-300">{levels[t.tier - 1]}+ <Cane size={11} /></p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Calendário dos dias de check-in do próprio jogador (feito / perdido / hoje / ainda vai chegar).
export function MyDays({ startsOn, deliverAt, today, days }: { startsOn: string; deliverAt: string; today: string; days: string[] }) {
  const last = new Date(Date.parse(deliverAt) - 1 - 3 * 3_600_000).toISOString().slice(0, 10);
  const all: string[] = [];
  for (let t = Date.parse(`${startsOn}T00:00:00Z`); new Date(t).toISOString().slice(0, 10) <= last && all.length < 62; t += 86_400_000) all.push(new Date(t).toISOString().slice(0, 10));
  const done = new Set(days);
  const made = all.filter((d) => done.has(d)).length;
  return (
    <div className="space-y-2">
      <p className="text-sm"><b className="text-emerald-300">{made}</b> de {all.length} dias feitos por você{today < startsOn ? " (começa em " + dm(startsOn) + ")" : ""}</p>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
        {all.map((d) => {
          const state = done.has(d) ? "done" : d === today ? "today" : d < today ? "missed" : "future";
          const cls = { done: "border-emerald-400/60 bg-emerald-400/20 text-emerald-100", today: "border-amber-300 bg-amber-300/15 text-amber-100 ring-2 ring-amber-300", missed: "border-red-400/30 bg-red-500/10 text-red-200/70", future: "border-white/10 bg-black/20 text-slate-500" }[state];
          return <div key={d} title={state === "done" ? "Feito" : state === "today" ? "Hoje — falta fazer" : state === "missed" ? "Não feito" : "Ainda não chegou"} className={`rounded-lg border px-1 py-1.5 text-center text-[11px] leading-tight ${cls}`}><div className="font-bold">{dm(d)}</div><div>{state === "done" ? "✔" : state === "today" ? "hoje" : state === "missed" ? "✕" : "·"}</div></div>;
        })}
      </div>
      <p className="text-[11px] text-slate-400">✔ feito · ✕ não feito · hoje = falta clicar no botão de check-in</p>
    </div>
  );
}

// Explica o que é o amigo oculto, as datas e como o presente é definido.
export function HowItWorks({ startsOn, deliverAt, minParticipants }: { startsOn: string; deliverAt: string; minParticipants: number }) {
  const deliver = new Date(deliverAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às");
  const lastDay = dm(new Date(Date.parse(deliverAt) - 1 - 3 * 3_600_000).toISOString().slice(0, 10));
  const steps: [React.ReactNode, string, string][] = [
    ["📝", "Inscrição", `Aberta agora até ${dm(startsOn)}. Precisa de pelo menos ${minParticipants} inscritos.`],
    ["🤫", "Sorteio dos amigos", `Automático em ${dm(startsOn)}, 00:00 (Brasília). Você descobre quem tirou e pode consultar quando quiser.`],
    [<Cane key="c" size={20} />, "Bengalas de açúcar", `De ${dm(startsOn)} a ${lastDay}: cada check-in diário vale 1 bengala para a comunidade. Quanto mais bengalas, mais categorias de kits são liberadas.`],
    ["🎀", "Kits e cartão", "Escolha até 3 kits das categorias liberadas e monte o cartão de Natal com frases prontas. Dá para editar até a entrega."],
    ["🎁", "Entrega", `${deliver} (Brasília): dos kits que o remetente escolheu, 1 é sorteado para o amigo. O cartão chega com animação e o presente cai na Caixa de Presentes.`],
  ];
  return (
    <section className={panel}>
      <h2 className="text-lg font-bold">📖 Como funciona</h2>
      <ol className="relative space-y-3 before:absolute before:bottom-4 before:left-[19px] before:top-4 before:w-px before:bg-white/15">
        {steps.map(([icon, title, text], i) => (
          <li key={title} className="relative flex gap-3">
            <span className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#1b1233] text-lg">{icon}</span>
            <div className="pt-0.5 text-sm"><p className="font-semibold">{i + 1}. {title}</p><p className="text-slate-300">{text}</p></div>
          </li>
        ))}
      </ol>
      <p className="rounded-lg bg-black/25 p-2.5 text-xs text-slate-300">🎅 <b>Presente do Papai Noel:</b> quem faz check-in em 70% dos dias ganha, junto do presente de Natal, 1 sorteado entre Ovo de Laboratório, Proteína Zika ou Pena Arco-Íris de Laboratório Potente. Os kits não custam moedas: vêm das bengalas que a Liga junta unida.</p>
    </section>
  );
}
