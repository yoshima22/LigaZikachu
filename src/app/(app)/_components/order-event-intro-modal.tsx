"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ShieldAlert, Sparkles, X } from "lucide-react";
import { ORDER_EVENT_IMAGES } from "@/lib/order-event-assets";

function OrderEventIntroDialog({ onClose, pending = false }: { onClose: () => void; pending?: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-purple-400/35 bg-slate-950 shadow-2xl shadow-purple-950/60">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-black/45 p-2 text-slate-200 transition hover:bg-black/70 disabled:opacity-50"
          aria-label="Fechar introducao"
        >
          <X size={16} />
        </button>

        <div className="relative h-56 w-full overflow-hidden bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.22),transparent_55%),#050816] sm:h-72">
          <Image
            src={ORDER_EVENT_IMAGES.intro}
            alt="Arte da Ordem da Trapaca"
            fill
            sizes="(max-width: 768px) 100vw, 672px"
            priority
            className="object-contain"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-300/35 bg-purple-950/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-purple-100">
              <ShieldAlert size={13} /> Evento especial
            </span>
            <h2 className="mt-3 font-pixel text-2xl leading-tight text-[#FFCB05] sm:text-3xl">
              A Ordem da Trapaça chegou
            </h2>
          </div>
        </div>

        <div className="max-h-[calc(92vh-12rem)] overflow-y-auto p-5 sm:p-6">
          <div className="space-y-4 text-sm leading-relaxed text-slate-200">
            <p>
              Algo estranho começou a acontecer na Liga Zikachu. Recompensas sumiram,
              páginas foram adulteradas e algumas mecânicas parecem ter sido mexidas por
              um grupo misterioso que se autodenomina <strong className="text-purple-200">Ordem da Trapaça</strong>.
            </p>
            <div className="rounded-2xl border border-purple-400/25 bg-purple-500/10 p-4">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-purple-200">
                <Sparkles size={14} /> Como investigar
              </p>
              <ul className="mt-3 space-y-2 text-xs text-slate-300">
                <li>• Mascotes podem encontrar pistas em expedições curtas do tipo Padrão ou Itens.</li>
                <li>• Cada pista entra no painel público da Ordem da Trapaça e ajuda todos os jogadores.</li>
                <li>• Quando pistas suficientes forem reunidas, uma solução aparece na página afetada.</li>
                <li>• O primeiro jogador que resolver uma travessura remove aquele efeito negativo da Liga.</li>
              </ul>
            </div>
            <p>
              A primeira etapa é coletiva: mandar mascotes investigar, comparar pistas e
              descobrir como parar cada travessura. Há sinais de que a Ordem possui um
              esconderijo secreto e um líder poderoso, mas a Liga ainda precisa juntar provas
              antes de chegar até ele.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="mt-6 w-full rounded-2xl bg-[#FFCB05] px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-[#FFD700] disabled:opacity-60"
          >
            Começar investigação
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderEventIntroModal({ onSeen }: { onSeen: () => Promise<void> }) {
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const close = () => {
    startTransition(async () => {
      await onSeen();
      setOpen(false);
    });
  };

  return <OrderEventIntroDialog onClose={close} pending={pending} />;
}

export function OrderEventHelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-100 transition hover:bg-purple-500/20"
      >
        Como jogar
      </button>
      {open && <OrderEventIntroDialog onClose={() => setOpen(false)} />}
    </>
  );
}
