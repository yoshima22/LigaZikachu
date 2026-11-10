"use client";

import { useCallback, useEffect, useState } from "react";
import { REI_ASSETS } from "@/lib/rei-do-rio/assets";
import type { EditionView } from "@/lib/rei-do-rio/view";
import { Ornament, type OrnamentKey } from "./rei-ui";

const KEY = "rei-intro-seen-v1";
type Page = { eyebrow: string; title: string; text: string; points: string[]; orn: OrnamentKey };

function buildPages(cfg: EditionView["edition"]["cfg"]): Page[] {
  const pr = cfg.pressure.steps; const cu = cfg.current.steps;
  return [
    {
      eyebrow: "Bem-vindo", title: "Trono de Natal", orn: "crown",
      text: "Uma disputa de sobrevivência entre equipes. Você monta 18 mascotes na segunda e, de terça a sexta, eles lutam sozinhos — cinco combates por dia, sem você precisar entrar no site.",
      points: ["18 mascotes diferentes, divididos em 6 slots de 3.", "20 combates automáticos, de terça a sexta.", `A edição só acontece com pelo menos ${cfg.minParticipants} inscritos; senão é cancelada.`],
    },
    {
      eyebrow: "Segunda-feira", title: "Monte sua equipe", orn: "gift",
      text: "Cada slot tem um titular e duas reservas, todos com a postura escolhida para o slot. A ordem importa: o titular entra primeiro.",
      points: ["Toque em “Montar minha equipe automaticamente” e só confira o resultado.", "Posturas avançadas exigem que o mascote tenha desbloqueado aquela postura.", "Você pode mudar tudo até as 21h. Depois disso os 18 mascotes ficam travados."],
    },
    {
      eyebrow: "Terça a sexta", title: "Cinco combates por dia", orn: "lantern",
      text: "Às 09h, 12h, 15h, 18h e 21h (Brasília) a Liga junta equipes de pontuação parecida e resolve cada luta. Os confrontos de cada rodada aparecem na página principal assim que a anterior termina.",
      points: ["Acompanhe “Combates de hoje” e assista aos replays.", "Em número ímpar de equipes, uma folga: sem luta, sem pontos, sem desgaste.", "Você recebe um relatório do dia depois da rodada das 21h."],
    },
    {
      eyebrow: "No combate", title: "Como seus mascotes lutam", orn: "baubleBall",
      text: `Seis mascotes por lado, um de cada slot. Não há troca no meio da luta: quem cai fica fora até o fim do combate. A luta dura no máximo ${cfg.maxRounds} rodadas; se ninguém for eliminado, vence quem tiver mais HP somado.`,
      points: ["O HP continua de uma luta para a outra e não há cura entre combates.", "Mascote derrotado só volta na noite, com HP cheio.", `O HP máximo neste evento é ${cfg.hpMultiplier}× o normal (só aqui).`],
    },
    {
      eyebrow: "Estratégia", title: "Troca por vida", orn: "snowflake",
      text: "Em cada slot você escolhe: o mascote fica até cair, ou dá lugar ao próximo da fila quando termina um combate com HP abaixo de um limite (50% é o sugerido).",
      points: ["A troca só acontece entre combates, nunca durante.", "O mascote que saiu continua vivo na fila, sem se curar.", "Se o slot inteiro cair, ele fica vazio até a noite. Sem nenhum mascote em pé, a rodada é uma “Derrota por falta de mascotes”."],
    },
    {
      eyebrow: "Pontos", title: "Quem lidera?", orn: "crown",
      text: "A classificação segue os pontos, não as vitórias. Cada mascote ganha pontos pelo que faz: dano, KOs, suporte, resistência — e a vitória vale uma fatia.",
      points: [`Vitória vale ${cfg.budget.win} de ~${Object.values(cfg.budget).reduce((a, b) => a + b, 0)} pontos por combate; quem perde também pontua.`, `${cfg.pressure.minStreak} vitórias seguidas: −${pr[1]}% a −${pr[pr.length - 1]}% de Força, Instinto, Vitalidade e Carisma (Pressão do Trono).`, `${cfg.current.minStreak} derrotas seguidas: +${cu[1]}% a +${cu[cu.length - 1]}% (Calor da Lareira). Quebrou a sequência, o ajuste some.`],
    },
    {
      eyebrow: "21h → 08h", title: "Descanso", orn: "lantern",
      text: "Depois da rodada das 21h (terça a quinta) todos os mascotes voltam com HP cheio. Até as 08h você ajusta a equipe do dia seguinte.",
      points: ["Pode reordenar, mover mascotes entre slots, trocar posturas e o limite de troca.", "Não pode trocar nem remover os 18 mascotes.", "Sua formação de segunda fica guardada: dá para restaurá-la ou reaproveitar a de ontem."],
    },
  ];
}

export function ReiIntro({ cfg, forceKey = 0 }: { cfg: EditionView["edition"]["cfg"]; forceKey?: number }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pages = buildPages(cfg);
  useEffect(() => {
    if (forceKey > 0) { setPage(0); setOpen(true); return; }
    try { if (!localStorage.getItem(KEY)) setOpen(true); } catch { /* sem storage: não abre sozinho */ }
  }, [forceKey]);
  const close = useCallback(() => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } setOpen(false); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setPage((p) => Math.min(pages.length - 1, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, pages.length]);
  if (!open) return null;
  const cur = pages[page];
  const last = page === pages.length - 1;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Como funciona o Trono de Natal">
      <section className="my-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-sky-300/30 bg-[#070d1c] shadow-[0_0_80px_rgba(56,189,248,.25)] lg:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)]">
        <div className="relative min-h-[220px] overflow-hidden border-b border-sky-300/15 lg:min-h-[620px] lg:border-b-0 lg:border-r">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={REI_ASSETS.cover} alt="Trono de Natal" className="absolute inset-0 h-full w-full object-cover object-[center_20%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070d1c] via-transparent to-black/10 lg:bg-gradient-to-r lg:from-transparent lg:to-[#070d1c]/30" />
        </div>
        <div className="relative flex min-h-[480px] flex-col p-5 sm:p-8 lg:min-h-[620px] lg:p-10">
          <button onClick={close} aria-label="Fechar tutorial" className="absolute right-4 top-4 rounded-full border border-slate-700 bg-black/50 px-3 py-2 text-white hover:bg-black/70">✕</button>
          <p className="pr-12 text-[10px] font-black uppercase tracking-[.25em] text-sky-300">Guia rápido · {page + 1}/{pages.length}</p>
          <div className="my-auto py-6" key={page}>
            <div className="flex items-center gap-3">
              <Ornament k={cur.orn} size={52} />
              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200">{cur.eyebrow}</span>
            </div>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">{cur.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{cur.text}</p>
            <ul className="mt-5 space-y-2">
              {cur.points.map((pt, i) => (
                <li key={pt} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/65 p-3 text-xs leading-relaxed text-slate-200">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-400/15 font-black text-sky-200">{i + 1}</span>{pt}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 disabled:opacity-30">← Anterior</button>
            <div className="flex gap-1.5" role="tablist" aria-label="Páginas">
              {pages.map((_, i) => <button key={i} role="tab" aria-selected={i === page} aria-label={`Página ${i + 1}`} onClick={() => setPage(i)} className={`h-2 rounded-full transition-all ${i === page ? "w-6 bg-amber-300" : "w-2 bg-slate-600 hover:bg-slate-400"}`} />)}
            </div>
            {last
              ? <button onClick={close} className="rounded-xl bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-2 text-sm font-black text-slate-900">Começar</button>
              : <button onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white">Próxima →</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
