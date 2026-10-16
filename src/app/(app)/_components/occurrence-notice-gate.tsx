"use client";

import { useEffect, useState } from "react";
import { getMascotImageRendering, getPreferredSpriteUrl } from "@/lib/sprite-preferences";
import { OCCURRENCE_TAG_PLAYER_LABEL } from "@/lib/mascot-occurrence-phrases";
import type { OccurrenceNotice } from "@/lib/mascot-occurrences";
import { acknowledgeOccurrenceNoticeAction, fetchOccurrenceNoticesAction } from "./occurrence-notice-actions";

const POLL_MS = 60_000;

function deadlineText(endsAt: string) {
  return new Date(endsAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function OccurrenceNoticeGate({ initialNotices }: { initialNotices: OccurrenceNotice[] }) {
  const [queue, setQueue] = useState<OccurrenceNotice[]>(initialNotices);
  const [busy, setBusy] = useState(false);

  // Também aparece para quem está online quando a ocorrência começa ou o mascote volta.
  useEffect(() => {
    const timer = setInterval(async () => {
      const fresh = await fetchOccurrenceNoticesAction().catch(() => null);
      if (!fresh) return;
      setQueue((prev) => {
        const known = new Set(prev.map((n) => `${n.id}:${n.kind}`));
        const added = fresh.filter((n) => !known.has(`${n.id}:${n.kind}`));
        return added.length ? [...prev, ...added] : prev;
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const notice = queue[0];
  if (!notice) return null;
  const isReturn = notice.kind === "RETURN";

  const confirm = async () => {
    setBusy(true);
    await acknowledgeOccurrenceNoticeAction(notice.id, notice.kind).catch(() => null);
    setQueue((prev) => prev.filter((n) => !(n.id === notice.id && n.kind === notice.kind)));
    setBusy(false);
  };

  const palette = isReturn
    ? { frame: "border-sky-300/40 shadow-[0_0_60px_rgba(125,211,252,0.18)]", bg: "from-[#0b1d2e] via-[#0e2a35] to-[#0b2230]", eyebrow: "text-sky-300", title: "text-emerald-200", tag: "border-emerald-300/40 bg-emerald-400/10 text-emerald-200", button: "bg-emerald-300 text-slate-950 hover:bg-emerald-200", fog: "rgba(110,231,183,0.14)" }
    : { frame: "border-violet-300/40 shadow-[0_0_60px_rgba(139,92,246,0.25)]", bg: "from-[#140f2b] via-[#101536] to-[#0b1026]", eyebrow: "text-violet-300", title: "text-amber-200", tag: "border-amber-300/40 bg-amber-400/10 text-amber-200", button: "bg-amber-300 text-slate-950 hover:bg-amber-200", fog: "rgba(167,139,250,0.18)" };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <style>{`@keyframes occFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}@keyframes occFog{0%,100%{opacity:.55}50%{opacity:.9}}@keyframes occIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}`}</style>
      <div className={`relative w-full max-w-md overflow-hidden rounded-3xl border bg-gradient-to-b p-6 text-center ${palette.frame} ${palette.bg}`} style={{ animation: "occIn .35s ease-out" }}>
        <p className={`text-[10px] font-black uppercase tracking-[0.25em] ${palette.eyebrow}`}>
          Liga Zikachu · {isReturn ? "Boas notícias do refúgio" : "Ocorrência incomum"}
        </p>
        <h2 className={`mt-2 font-pixel text-sm leading-relaxed ${palette.title}`}>
          {isReturn ? `${notice.mascotName} está de volta!` : "Algo estranho aconteceu..."}
        </h2>

        <div className="relative mx-auto my-4 grid h-40 w-40 place-items-center">
          <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${palette.fog} 0%, transparent 70%)`, animation: "occFog 4s ease-in-out infinite" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getPreferredSpriteUrl(notice.pokemonId, null, { shiny: notice.isShiny })}
            alt={notice.mascotName}
            className="relative h-32 w-32 object-contain drop-shadow-[0_0_14px_rgba(255,255,255,0.25)]"
            style={{ imageRendering: getMascotImageRendering(notice.pokemonId), animation: "occFloat 4s ease-in-out infinite" }}
          />
        </div>
        <p className="font-semibold text-slate-100">{notice.mascotName}</p>

        <p className="mt-3 text-sm leading-relaxed text-slate-200">{notice.message}</p>

        <p className={`mx-auto mt-4 inline-block rounded-full border px-3 py-1 text-xs font-bold ${palette.tag}`}>
          {isReturn ? "Disponível novamente" : OCCURRENCE_TAG_PLAYER_LABEL[notice.tag]}
        </p>
        {!isReturn && notice.showDeadline && notice.endsAt && (
          <p className="mt-2 text-[11px] text-slate-400">Previsão de retorno: {deadlineText(notice.endsAt)} (BRT)</p>
        )}

        <button onClick={confirm} disabled={busy} className={`mt-5 w-full rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-60 ${palette.button}`}>
          {isReturn ? "Que bom que voltou!" : "Entendi..."}
        </button>
        {queue.length > 1 && <p className="mt-2 text-[10px] text-slate-500">+{queue.length - 1} aviso(s) a seguir</p>}
      </div>
    </div>
  );
}
