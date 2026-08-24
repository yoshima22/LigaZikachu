"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getTutorialStatus, completeTutorial } from "@/app/(app)/tutorial/actions";

const WELCOME_PAGE_ID = "welcome-screen";

type WelcomePage = { emoji: string; title: string; body: string };

const PAGES: WelcomePage[] = [
  {
    emoji: "⚡",
    title: "Bem-vindo à Liga Zikachu!",
    body: "Aqui você compete no card game, cria e treina mascotes, participa de combates, negocia no Bazar e sobe no ranking. Este guia rápido mostra o essencial — leva menos de 1 minuto!",
  },
  {
    emoji: "🐣",
    title: "Mascotes",
    body: "Choque ovos, cuide dos seus mascotes (alimente, brinque, faça carinho) e mande-os em expedições para ganhar EXP, ovos, itens e moedas. Marque favoritos e defina a postura de combate preferida de cada um.",
  },
  {
    emoji: "⚔️",
    title: "Combates",
    body: "Monte equipes e lute na Arena Z, na Liga Semanal automática e no Desafio Sincronizado. Cada mascote tem uma postura (Atacante, Defensor, Cuidador...) que muda o papel dele na batalha. Toque no ❓ de cada postura para entender os números.",
  },
  {
    emoji: "🃏",
    title: "Torneios & Ranking",
    body: "Inscreva-se nos campeonatos, registre seus decks a cada semana e dispute o Top do Dia. Vitórias, conquistas e insígnias sobem sua posição no Ranking Geral da temporada.",
  },
  {
    emoji: "🛒",
    title: "ZikaShop & Bazar",
    body: "Use ZikaCoins (🪙) para comprar itens, ovos e cosméticos na ZikaShop. No Bazar você negocia direto com outros jogadores: vendas, trocas e leilões. Fique de olho no Miauvadão e nas ofertas do dia!",
  },
  {
    emoji: "🎁",
    title: "Recompensas do dia a dia",
    body: "Resgate o Passe de Apoiador, participe da ZikaLoot, abra presentes de amigos e complete conquistas. No seu aniversário você ganha uma roleta especial de presentes — não esqueça de preencher sua data no perfil!",
  },
  {
    emoji: "💡",
    title: "Precisa de ajuda?",
    body: "Em qualquer página, toque no botão ❓ no topo para rever as dicas daquela tela. Bom jogo e boa sorte, treinador!",
  },
];

export function WelcomeScreen({
  forcePreview = false,
  onClosePreview,
}: {
  forcePreview?: boolean;
  onClosePreview?: () => void;
}) {
  const [show, setShow] = useState(forcePreview);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (forcePreview) return;
    getTutorialStatus(WELCOME_PAGE_ID)
      .then(({ completed, isAdmin }) => {
        if (!completed && !isAdmin) setShow(true);
      })
      .catch(() => {});
  }, [forcePreview]);

  if (!show) return null;

  const isLast = page === PAGES.length - 1;
  const current = PAGES[page];

  const finish = () => {
    setShow(false);
    if (forcePreview) onClosePreview?.();
    else void completeTutorial(WELCOME_PAGE_ID);
  };

  const next = () => (isLast ? finish() : setPage((p) => Math.min(PAGES.length - 1, p + 1)));
  const prev = () => setPage((p) => Math.max(0, p - 1));

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-[#FFCB05]/50 bg-gradient-to-b from-[#1e1740] via-[#241a3d] to-[#120c22] shadow-[0_0_60px_rgba(255,203,5,0.22)]">
        <div className="pointer-events-none absolute inset-0 opacity-25" style={{ background: "radial-gradient(circle at 50% 0%, rgba(255,203,5,0.35), transparent 60%)" }} />

        <button
          onClick={finish}
          aria-label="Fechar"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/35 text-slate-300 hover:bg-black/55 hover:text-white"
        >
          <X size={16} />
        </button>

        {forcePreview && (
          <div className="relative bg-pink-500/15 px-4 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-pink-200">
            Prévia de admin
          </div>
        )}

        <div className="relative px-7 pb-6 pt-9 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 text-5xl">
            {current.emoji}
          </div>
          <h2 className="mt-4 font-pixel text-base leading-snug text-[#FFCB05] drop-shadow-[0_0_10px_rgba(255,203,5,0.4)]">
            {current.title}
          </h2>
          <p className="mt-3 min-h-[6.5rem] text-sm leading-relaxed text-slate-300">{current.body}</p>

          {/* Paginação (bolinhas) */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {PAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Página ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === page ? "w-5 bg-[#FFCB05]" : i < page ? "w-2 bg-[#FFCB05]/40" : "w-2 bg-slate-700"}`}
              />
            ))}
          </div>

          {/* Controles */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              onClick={prev}
              disabled={page === 0}
              className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-30"
            >
              <ChevronLeft size={14} /> Voltar
            </button>
            <span className="text-[11px] text-slate-500">{page + 1} / {PAGES.length}</span>
            <button
              onClick={next}
              className="flex items-center gap-1 rounded-xl bg-[#FFCB05] px-5 py-2 text-xs font-black text-[#1a1330] hover:bg-[#FFD700]"
            >
              {isLast ? "Começar! 🎉" : "Próximo"}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
