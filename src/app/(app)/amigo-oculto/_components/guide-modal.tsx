"use client";

import { useEffect, useState } from "react";
import { TIERS } from "@/lib/amigo-oculto/catalog";
import { INVITE_IMAGE } from "./invite-modal";

type Info = { startsOn: string; deliverAt: string; levels: number[]; totalDays: number; mimoMinPct: number };
const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

function pagesFor(i: Info) {
  const deliver = new Date(i.deliverAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às");
  const lastDay = dm(new Date(Date.parse(i.deliverAt) - 1 - 3 * 3_600_000).toISOString().slice(0, 10));
  const mimoDays = Math.ceil(i.totalDays * i.mimoMinPct);
  return [
    { eyebrow: "O evento", title: "Amigo Oculto da Liga", text: "Uma troca de presentes de Natal entre os jogadores da Liga. Cada inscrito tira uma pessoa, monta um cartão e escolhe presentes de dentro do jogo para ela — e também recebe um de alguém.", points: ["Inscrição aberta até " + dm(i.startsOn) + ".", "Tudo acontece na página Amigo Oculto, no menu Mercado.", "A entrega é em " + deliver + " (Brasília)."] },
    { eyebrow: "Passo 1", title: "Inscrição e sorteio dos amigos", text: "Clique em “Quero participar!” na aba Início. No dia " + dm(i.startsOn) + " o sorteio acontece sozinho e você descobre quem tirou.", points: ["Ninguém tira a si mesmo e cada pessoa é tirada por uma só.", "O sorteio é auditável: o código dele é publicado antes e a semente é revelada depois da entrega.", "Quem você tirou fica salvo na aba Início — pode consultar quando quiser."] },
    { eyebrow: "Passo 2", title: "Bengalas de açúcar e check-in", text: "De " + dm(i.startsOn) + " a " + lastDay + ", todo dia você faz o check-in manual: aba Início → botão “Fazer check-in (+1 bengala)”. Vale 1 bengala por dia.", points: ["O check-in não é automático: você precisa clicar uma vez por dia (dia de Brasília).", "As bengalas de todos se somam — é um esforço da comunidade.", "Na aba Início você vê os dias que você fez e o total que a Liga já juntou."] },
    { eyebrow: "Passo 3", title: "Categorias de kits", text: "O total de bengalas da comunidade libera categorias de presente. Os kits custam zero moedas: vêm do esforço de todos.", points: TIERS.map((t) => `${t.emoji} ${t.name}: a partir de ${i.levels[t.tier - 1]} bengalas`) },
    { eyebrow: "Passo 4", title: "Escolha dos kits e sorteio", text: "Cada kit é uma caixa com 3 ou 4 itens do jogo. Você escolhe até 3 kits das categorias liberadas.", points: ["Seu amigo NÃO recebe os 3: o sistema sorteia 1 entre os que você escolheu.", "O sorteio acontece na entrega (" + deliver + ").", "Dá para mudar a escolha quantas vezes quiser até lá."] },
    { eyebrow: "Passo 5", title: "Cartão de Natal", text: "Monte um cartão com frases prontas (início, meio e fim), uma ilustração dos personagens da Liga, fundo e adorno. Dá para começar já.", points: ["O cartão chega junto com o presente sorteado, assinado com o seu nome.", "Depois da entrega, todos os cartões ficam abertos para leitura de todos os jogadores, na aba Cartões da Liga."] },
    { eyebrow: "Bônus", title: "Presente do Papai Noel", text: `Quem fizer check-in em ${Math.round(i.mimoMinPct * 100)}% dos dias (cerca de ${mimoDays} dos ${i.totalDays}) ganha um presente especial do Papai Noel, entregue junto do presente de Natal.`, points: ["É sorteado entre: 🥚 Ovo de Laboratório, 💊 Proteína Zika ou 🌈 Pena Arco-Íris de Laboratório Potente.", "O bônus vem para quem fez a constância, não para quem escolheu o presente."] },
    { eyebrow: "Dia 25", title: "Entrega", text: "À 00:00 de 25/12 os presentes e cartões são entregues. Abra seu cartão na aba Início: o envelope abre com animação e o presente cai na sua Caixa de Presentes.", points: ["Você vê quem te presenteou pela assinatura do cartão.", "Todos os cartões ficam disponíveis para ler depois.", "Feliz Natal da Liga Zikachu! 🎄"] },
  ];
}

// Guia paginado (mesmo formato do guia da Torre dos Rebeldes).
export function GuideModal({ info, onClose }: { info: Info; onClose: () => void }) {
  const pages = pagesFor(info);
  const [page, setPage] = useState(0);
  const cur = pages[page];
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") setPage((p) => Math.min(pages.length - 1, p + 1)); if (e.key === "ArrowLeft") setPage((p) => Math.max(0, p - 1)); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, pages.length]);
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm" onClick={onClose} role="dialog" aria-label="Como funciona o Amigo Oculto">
      <section onClick={(e) => e.stopPropagation()} className="my-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-amber-300/40 bg-[#0d0a1f] shadow-[0_0_80px_rgba(251,191,36,.25)] lg:grid-cols-[minmax(280px,.8fr)_minmax(0,1.2fr)]">
        <div className="relative min-h-[200px] overflow-hidden border-b border-amber-300/20 lg:min-h-[560px] lg:border-b-0 lg:border-r">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={INVITE_IMAGE} alt="Amigo Oculto da Liga" className="absolute inset-0 h-full w-full object-cover object-[22%_center]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a1f] via-transparent to-black/20 lg:bg-gradient-to-r lg:from-transparent lg:to-[#0d0a1f]/30" />
        </div>
        <div className="relative flex min-h-[480px] flex-col p-5 sm:p-8">
          <button onClick={onClose} aria-label="Fechar guia" className="absolute right-4 top-4 rounded-full border border-slate-700 bg-black/50 px-3 py-2 text-white">✕</button>
          <p className="pr-12 text-[10px] font-black uppercase tracking-[.25em] text-amber-300">Como funciona · {page + 1}/{pages.length}</p>
          <div className="my-auto py-6">
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200">{cur.eyebrow}</span>
            <h2 className="mt-4 text-3xl font-black text-white">{cur.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{cur.text}</p>
            <div className="mt-5 space-y-2">
              {cur.points.map((pt, n) => (
                <div key={pt} className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/65 p-3 text-xs leading-relaxed text-slate-200">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-300/15 font-black text-amber-200">{n + 1}</span>
                  <span>{pt}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-5">
            <button disabled={page === 0} onClick={() => setPage((v) => v - 1)} className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-30">Anterior</button>
            <div className="flex gap-1.5">{pages.map((_, n) => <button key={n} aria-label={`Ir para etapa ${n + 1}`} onClick={() => setPage(n)} className={`h-2 rounded-full transition-all ${n === page ? "w-7 bg-amber-400" : "w-2 bg-slate-700"}`} />)}</div>
            {page < pages.length - 1
              ? <button onClick={() => setPage((v) => v + 1)} className="rounded-xl bg-amber-400 px-5 py-2 text-sm font-black text-slate-950">Próxima</button>
              : <button onClick={onClose} className="rounded-xl bg-emerald-400 px-5 py-2 text-sm font-black text-emerald-950">Entendi!</button>}
          </div>
        </div>
      </section>
    </div>
  );
}
