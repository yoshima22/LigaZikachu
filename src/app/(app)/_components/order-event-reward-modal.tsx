"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Gift, X } from "lucide-react";
import { ORDER_EVENT_IMAGES } from "@/lib/order-event-assets";

export function OrderEventRewardModal({
  notificationId,
  title,
  onSeen,
}: {
  notificationId: string;
  title: string;
  onSeen: (notificationId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const close = () => {
    startTransition(async () => {
      await onSeen(notificationId);
      setOpen(false);
    });
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-[#FFCB05]/35 bg-slate-950 shadow-2xl shadow-purple-950/60">
        <button
          type="button"
          onClick={close}
          disabled={pending}
          className="absolute right-3 top-3 z-10 rounded-full border border-white/10 bg-black/45 p-2 text-slate-200 transition hover:bg-black/70 disabled:opacity-50"
          aria-label="Fechar recompensa"
        >
          <X size={16} />
        </button>

        <div className="relative h-56 w-full overflow-hidden bg-[#11101a] sm:h-72">
          <Image
            src={ORDER_EVENT_IMAGES.reward}
            alt="Ordem da Trapaca derrotada"
            fill
            sizes="(max-width: 768px) 100vw, 672px"
            priority
            className="object-contain"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#FFCB05]/35 bg-[#FFCB05]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#FFCB05]">
              <Gift size={13} /> Recompensa coletiva
            </span>
            <h2 className="mt-3 font-pixel text-2xl leading-tight text-[#FFCB05] sm:text-3xl">
              Travessura derrotada!
            </h2>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-sm leading-relaxed text-slate-200">
            A Liga removeu a travessura <strong className="text-purple-200">{title}</strong>.
            Todos os jogadores receberam a recompensa do evento.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#FFCB05]/25 bg-[#FFCB05]/10 p-4 text-center">
              <p className="text-2xl font-black text-[#FFCB05]">500 ZC</p>
              <p className="text-xs text-slate-400">ZikaCoins</p>
            </div>
            <div className="rounded-2xl border border-purple-400/25 bg-purple-500/10 p-4 text-center">
              <p className="text-2xl font-black text-purple-100">1 Ovo</p>
              <p className="text-xs text-slate-400">Ovo de Evento</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={pending}
            className="mt-6 w-full rounded-2xl bg-[#FFCB05] px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-[#FFD700] disabled:opacity-60"
          >
            Receber noticia
          </button>
        </div>
      </div>
    </div>
  );
}
