"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, Sparkles } from "lucide-react";
import { claimGift } from "../caixa-de-presentes/actions";
import { dismissGiftPopupAction } from "./gift-popup-actions";
import type { GiftPopupData } from "@/lib/gift-popup";

// Janela de presente recebido de outro jogador: aparece uma vez em qualquer página.
// "Depois" mantém o presente na Caixa de presentes sem mostrar a janela de novo.
export function GiftPopupModal({ gift }: { gift: GiftPopupData }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!open) return null;

  const later = () => start(async () => { await dismissGiftPopupAction(gift.id); setOpen(false); });
  const claim = () => start(async () => {
    setError("");
    const result = await claimGift({ giftId: gift.id });
    if ("error" in result && result.error) { setError(result.error); return; }
    setDone(true);
    router.refresh();
  });
  const kindLabel = gift.kind === "SUPPORTER_PASS" ? "Passe Apoiador" : "LigaCash";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="gift-popup-title" className="fixed inset-0 z-[10040] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border-2 border-cyan-300/50 bg-gradient-to-b from-[#12254a] via-[#171a3d] to-[#0d0b20] shadow-[0_0_60px_rgba(34,211,238,0.22)]">
        <div className="border-b border-white/10 bg-white/[0.05] px-5 py-4 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-200"><Gift size={28} /></div>
          <p className="mt-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200"><Sparkles size={12} />{kindLabel} de {gift.senderName}<Sparkles size={12} /></p>
          <h2 id="gift-popup-title" className="mt-1 text-xl font-black leading-tight text-white">{gift.title}</h2>
        </div>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto px-5 py-4">
          {gift.message && (
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-200">Mensagem de {gift.senderName}</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">{gift.message}</p>
            </div>
          )}
          <div className="rounded-xl border border-[#FFCB05]/25 bg-[#FFCB05]/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#FFCB05]/80">Seu presente</p>
            <p className="mt-1 text-base font-black text-slate-50">{gift.rewardLabel}</p>
          </div>
          {done && <p className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm font-semibold text-emerald-200">Presente resgatado! Aproveite. 🎉</p>}
          {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
        </div>
        <div className="flex flex-col gap-2 border-t border-white/10 px-5 py-4 sm:flex-row">
          {done ? (
            <button type="button" onClick={() => setOpen(false)} className="w-full rounded-xl bg-cyan-300 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-200">Fechar</button>
          ) : (
            <>
              <button type="button" onClick={claim} disabled={pending} className="flex-1 rounded-xl bg-cyan-300 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:opacity-60">{pending ? "Resgatando…" : "Resgatar agora"}</button>
              <button type="button" onClick={later} disabled={pending} className="flex-1 rounded-xl border border-slate-600 py-2.5 text-sm font-bold text-slate-200 hover:border-slate-400 disabled:opacity-60">Depois</button>
            </>
          )}
        </div>
        {!done && <p className="pb-3 text-center text-[11px] text-slate-500">Ele fica guardado na <Link href="/caixa-de-presentes" onClick={later} className="text-cyan-300 underline">Caixa de presentes</Link>.</p>}
      </div>
    </div>
  );
}
