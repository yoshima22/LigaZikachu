"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { ABILITY_FEEDBACK_MAX_COMMENT, ABILITY_VERDICTS, ABILITY_VERDICT_KEYS, type AbilityVerdict } from "@/lib/abilities/feedback";
import { getMyAbilityFeedbackAction, submitAbilityFeedbackAction } from "@/lib/abilities/feedback-actions";

/** Janelinha (dentro do card de habilidades) para o jogador votar no equilíbrio da habilidade. */
export function AbilityFeedbackDialog({ slug, name, onClose, fixed = false }: { slug: string; name: string; onClose: () => void; fixed?: boolean }) {
  const [verdict, setVerdict] = useState<AbilityVerdict | null>(null);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    getMyAbilityFeedbackAction(slug).then((r) => { if (alive && r) { setVerdict(r.verdict); setComment(r.comment); } }).catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  const send = () => {
    if (!verdict) return setMsg({ ok: false, text: "Escolha uma opção." });
    start(async () => {
      const r = await submitAbilityFeedbackAction({ slug, verdict, comment });
      setMsg(r.ok ? { ok: true, text: "Obrigado! Sua opinião foi registrada." } : { ok: false, text: r.error ?? "Erro ao enviar." });
    });
  };

  return (
    <div className={`${fixed ? "fixed z-[70]" : "absolute z-20"} inset-0 flex items-center justify-center bg-black/70 p-3`} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div role="dialog" aria-label={`Opinar sobre ${name}`} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-xl border border-white/15 bg-slate-950 p-3 shadow-xl">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">O que você acha?</p>
            <p className="truncate text-sm font-black text-fuchsia-100">✨ {name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"><X size={14} /></button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {ABILITY_VERDICT_KEYS.map((k) => {
            const v = ABILITY_VERDICTS[k];
            return (
              <button key={k} type="button" onClick={() => { setVerdict(k); setMsg(null); }} aria-pressed={verdict === k}
                className={`rounded-lg border px-2 py-2 text-[11px] font-bold transition ${verdict === k ? v.cls : "border-white/10 bg-white/[.03] text-slate-300 hover:bg-white/[.07]"}`}>
                <span aria-hidden="true">{v.emoji}</span> {v.label}
              </button>
            );
          })}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, ABILITY_FEEDBACK_MAX_COMMENT))} rows={3}
          placeholder="Comentário (opcional): o que mudaria?"
          className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-slate-900 p-2 text-[11px] text-slate-100 placeholder:text-slate-600 focus:border-fuchsia-300/40 focus:outline-none" />
        <div className="mt-1 flex items-center gap-2">
          <p className={`min-w-0 flex-1 text-[10px] ${msg ? (msg.ok ? "text-emerald-300" : "text-rose-300") : "text-slate-600"}`}>
            {msg?.text ?? `${comment.length}/${ABILITY_FEEDBACK_MAX_COMMENT} · um voto por habilidade, você pode trocar depois`}
          </p>
          <button type="button" onClick={send} disabled={pending}
            className="rounded-lg bg-fuchsia-500/80 px-3 py-1.5 text-[11px] font-black text-white hover:bg-fuchsia-500 disabled:opacity-50">
            {pending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Link discreto "Opinar" que abre a janelinha de voto sobre a habilidade (fora do card de replay). */
export function AbilityFeedbackLink({ slug, name, className = "" }: { slug: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Dar sua opinião sobre esta habilidade"
        className={`text-[10px] text-slate-500 underline-offset-2 hover:text-fuchsia-200 hover:underline ${className}`}>💬 Opinar</button>
      {open && <AbilityFeedbackDialog fixed slug={slug} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}
