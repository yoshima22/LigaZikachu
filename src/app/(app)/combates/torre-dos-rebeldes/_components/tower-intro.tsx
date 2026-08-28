"use client";

import { useEffect, useState } from "react";

const pages = [
  {
    eyebrow: "A ameaça",
    title: "A Torre despertou",
    text: "O Barão Pikachuque e seus sete regentes prometem libertar os mascotes dos treinadores — mesmo que para isso precisem transformar outros mascotes em soldados da Torre.",
    points: [
      "Monte uma expedição de 1 a 3 jogadores.",
      "Cada treinador leva 2 mascotes e escolhe uma classe.",
      "Vida, derrotas e descobertas continuam valendo durante toda a run.",
    ],
  },
  {
    eyebrow: "Passo a passo",
    title: "Como uma run funciona",
    text: "A equipe prepara a sala, confirma os mascotes e avança por um mapa de salas conectadas. Em cada turno, cada jogador escolhe um caminho ou resolve o acontecimento da sala onde está.",
    points: [
      "Crie ou entre em uma sala e marque Pronto.",
      "Explore rotas, vote em mecanismos e enfrente encontros.",
      "Alcance o chefe do andar para abrir o próximo.",
      "A run termina na vitória, derrota ou abandono da equipe.",
    ],
  },
  {
    eyebrow: "Cooperação",
    title: "Juntos ou separados?",
    text: "Jogadores podem seguir rotas diferentes para investigar mais salas, mas a Torre reage a essa divisão. O mapa sempre mostra onde cada aliado está e qual caminho confirmou.",
    points: [
      "No mesmo caminho: progresso mais seguro e ajuda imediata.",
      "Em caminhos diferentes: mais descobertas, porém a Pressão sobe em dobro.",
      "Aliados distantes precisam percorrer conexões abertas para ajudar em um encontro.",
    ],
  },
  {
    eyebrow: "A ameaça cresce",
    title: "Pressão da Torre",
    text: "Pressão mede quanto a Torre percebe e reage à expedição. Cada ação confirmada aumenta a Pressão; esperar diante de inimigos também custa 1 ponto e pode permitir que um aliado se aproxime.",
    points: [
      "Mais Pressão fortalece os inimigos encontrados.",
      "Dividir a equipe acelera esse crescimento.",
      "Contramedidas, classes e talentos podem conter parte da Pressão.",
      "A interface mostra o valor atual e o bônus inimigo resultante.",
    ],
  },
  {
    eyebrow: "Conhecimento",
    title: "Arquivo não é Legado",
    text: "O Arquivo da Torre é uma biblioteca: registra pistas, personagens, mecanismos e relatos descobertos pela comunidade. Consultá-lo ensina o que esperar, mas não aumenta atributos por si só.",
    points: [
      "Arquivo: informação permanente e compartilhada.",
      "Estudos comunitários: liberam contramedidas ao atingir a meta.",
      "Legado das Runs: pontos conquistados que viram melhorias mecânicas permanentes.",
    ],
  },
  {
    eyebrow: "Preparação",
    title: "Sua classe muda a estratégia",
    text: "A classe é uma especialidade do treinador dentro da Torre. Ela não substitui a postura dos mascotes: define como você explora, quais posturas pode levar e em que situação sua equipe tem vantagem.",
    points: [
      "Leia propósito e uso prático antes de escolher.",
      "A sala mostra classe, mascotes e posturas de todos.",
      "Online tem ações de 5 minutos e Legado maior; Lento oferece janelas de 4 horas.",
    ],
  },
] as const;

export function TowerIntro({ forceKey = 0 }: { forceKey?: number }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (forceKey > 0) {
      setPage(0);
      setOpen(true);
      return;
    }
    if (!localStorage.getItem("tower-intro-seen-v5")) setOpen(true);
  }, [forceKey]);
  if (!open) return null;
  const close = () => {
    localStorage.setItem("tower-intro-seen-v5", "1");
    setOpen(false);
  };
  const current = pages[page];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm">
      <section className="my-auto grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-purple-400/40 bg-[#07040d] shadow-[0_0_80px_rgba(126,34,206,.4)] lg:grid-cols-[minmax(340px,.9fr)_minmax(0,1.1fr)]">
        <div className="relative min-h-[300px] overflow-hidden border-b border-purple-400/20 lg:min-h-[640px] lg:border-b-0 lg:border-r">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/events/torre-dos-rebeldes/cover.png"
            alt="Torre dos Rebeldes"
            className="absolute inset-0 h-full w-full object-cover object-[center_58%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07040d] via-transparent to-black/20 lg:bg-gradient-to-r lg:from-transparent lg:to-[#07040d]/20" />
          <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-black/65 p-4 backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-[.28em] text-purple-200">
              Torre dos Rebeldes
            </p>
            <p className="mt-1 text-xs text-slate-300">
              Suba. Supere. Desobedeça aos planos da Torre.
            </p>
          </div>
        </div>
        <div className="relative flex min-h-[520px] flex-col p-5 sm:p-8 lg:min-h-[640px] lg:p-10">
          <button
            onClick={close}
            aria-label="Fechar introdução"
            className="absolute right-4 top-4 rounded-full border border-slate-700 bg-black/50 px-3 py-2 text-white"
          >
            ✕
          </button>
          <p className="pr-12 text-[10px] font-black uppercase tracking-[.25em] text-purple-300">
            Guia da expedição · {page + 1}/{pages.length}
          </p>
          <div className="my-auto py-8">
            <span className="rounded-full border border-purple-300/25 bg-purple-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-purple-200">
              {current.eyebrow}
            </span>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
              {current.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              {current.text}
            </p>
            <div className="mt-6 space-y-2">
              {current.points.map((point, index) => (
                <div
                  key={point}
                  className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/65 p-3 text-xs leading-relaxed text-slate-200"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-purple-400/15 font-black text-purple-200">
                    {index + 1}
                  </span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-5">
            <button
              disabled={page === 0}
              onClick={() => setPage((v) => v - 1)}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-30"
            >
              Anterior
            </button>
            <div className="flex gap-1.5">
              {pages.map((_, index) => (
                <button
                  key={index}
                  aria-label={`Ir para etapa ${index + 1}`}
                  onClick={() => setPage(index)}
                  className={`h-2 rounded-full transition-all ${index === page ? "w-7 bg-[#FFCB05]" : "w-2 bg-slate-700"}`}
                />
              ))}
            </div>
            {page < pages.length - 1 ? (
              <button
                onClick={() => setPage((v) => v + 1)}
                className="rounded-xl bg-[#FFCB05] px-5 py-2 text-sm font-black text-slate-950"
              >
                Próxima
              </button>
            ) : (
              <button
                onClick={close}
                className="rounded-xl bg-emerald-400 px-5 py-2 text-sm font-black text-emerald-950"
              >
                Preparar expedição
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
