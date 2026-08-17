"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  heartbeatSpecPresenceAction, leaveSpecPresenceAction, getSpecStandsAction,
  createSpecPollAction, voteSpecPollAction, closeSpecPollAction,
} from "@/app/(app)/spec/stands-actions";

type Stands = Awaited<ReturnType<typeof getSpecStandsAction>>;

// Arquibancada (lista de espectadores) + enquetes. `sendPresence` = o usuário
// entra na arquibancada (watch); no painel do transmissor fica false (ele não é
// espectador, mas vê a lista e gerencia enquetes).
export function SpecStands({ streamId, sendPresence }: { streamId: string; sendPresence: boolean }) {
  const [stands, setStands] = useState<Stands | null>(null);

  const refresh = useCallback(async () => {
    const s = await getSpecStandsAction(streamId).catch(() => null);
    if (s) setStands(s);
  }, [streamId]);

  // Heartbeat de presença (watch) a cada 15s + saída ao desmontar.
  useEffect(() => {
    if (!sendPresence) return;
    void heartbeatSpecPresenceAction(streamId);
    const timer = window.setInterval(() => { void heartbeatSpecPresenceAction(streamId); }, 15_000);
    const onHide = () => { void leaveSpecPresenceAction(streamId); };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", onHide);
      void leaveSpecPresenceAction(streamId);
    };
  }, [streamId, sendPresence]);

  // Atualiza arquibancada + enquete a cada 8s.
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 8_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (!stands) return null;

  return (
    <div className="space-y-4">
      <PollSection stands={stands} streamId={streamId} onChange={refresh} />

      <div className="rounded-2xl border border-border bg-slate-950/60 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#FFCB05]/70">
          🪑 Arquibancada · {stands.count} {stands.count === 1 ? "pessoa" : "pessoas"}
        </p>
        {stands.spectators.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Ninguém na arquibancada ainda.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {stands.spectators.map((s) => (
              <span key={s.userId} className="rounded-full border border-border bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PollSection({ stands, streamId, onChange }: { stands: Stands; streamId: string; onChange: () => void }) {
  const poll = stands.poll;
  const [voting, setVoting] = useState(false);

  const vote = async (index: number) => {
    if (!poll || voting) return;
    setVoting(true);
    const res = await voteSpecPollAction(poll.id, index);
    setVoting(false);
    if (!res.ok) { toast.error(res.error ?? "Falha ao votar."); return; }
    onChange();
  };

  const close = async () => {
    if (!poll) return;
    const res = await closeSpecPollAction(poll.id);
    if (!res.ok) { toast.error(res.error ?? "Falha ao encerrar."); return; }
    toast.success("Enquete encerrada.");
    onChange();
  };

  return (
    <div className="rounded-2xl border border-purple-500/25 bg-purple-950/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-purple-200">🗳️ Enquete da arquibancada</p>
        {stands.canManage && poll && (
          <button onClick={close} className="text-[10px] font-bold text-slate-400 underline hover:text-slate-200">Encerrar</button>
        )}
      </div>

      {poll ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm font-bold text-white">{poll.question}</p>
          {poll.options.map((opt, i) => {
            const count = poll.counts[i] ?? 0;
            const pct = poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
            const mine = poll.myVote === i;
            return (
              <button
                key={i}
                onClick={() => vote(i)}
                disabled={voting}
                className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors disabled:opacity-60 ${mine ? "border-[#FFCB05] text-white" : "border-border text-slate-300 hover:border-slate-500"}`}
              >
                <span className="absolute inset-y-0 left-0 bg-[#FFCB05]/15" style={{ width: `${pct}%` }} />
                <span className="relative flex items-center justify-between gap-2">
                  <span>{mine ? "✓ " : ""}{opt}</span>
                  <span className="text-slate-400">{pct}% · {count}</span>
                </span>
              </button>
            );
          })}
          <p className="text-[10px] text-slate-500">{poll.totalVotes} voto{poll.totalVotes === 1 ? "" : "s"} · toque para votar (pode trocar)</p>
        </div>
      ) : stands.canManage ? (
        <NewPollForm streamId={streamId} onCreated={onChange} />
      ) : (
        <p className="mt-2 text-xs text-slate-500">Nenhuma enquete ativa no momento.</p>
      )}
    </div>
  );
}

function NewPollForm({ streamId, onCreated }: { streamId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    setSaving(true);
    const res = await createSpecPollAction(streamId, question, options);
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Falha ao criar."); return; }
    toast.success("Enquete no ar!");
    setQuestion(""); setOptions(["", ""]); setOpen(false);
    onCreated();
  };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setTimeout(() => firstRef.current?.focus(), 0); }} className="mt-2 rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-200 hover:bg-purple-500/20">
        + Criar enquete
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <input
        ref={firstRef}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Pergunta (ex.: Quem vence essa partida?)"
        className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500"
      />
      {options.map((opt, i) => (
        <input
          key={i}
          value={opt}
          onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
          placeholder={`Opção ${i + 1}`}
          className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500"
        />
      ))}
      <div className="flex flex-wrap gap-2">
        {options.length < 6 && (
          <button onClick={() => setOptions((prev) => [...prev, ""])} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white">+ Opção</button>
        )}
        <button onClick={submit} disabled={saving} className="rounded-lg bg-[#FFCB05] px-3 py-1 text-[11px] font-black text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50">Publicar</button>
        <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200">Cancelar</button>
      </div>
    </div>
  );
}
