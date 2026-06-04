"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { pickLootNumber } from "../actions";

interface Props {
  lootId: string;
  picks: { number: number; playerName: string }[];
  blockedNumbers?: number[];
  myNumbers: number[];          // múltiplos números do jogador
  hasTicket: boolean;
  isLoggedIn: boolean;
  drawAt: string;
  previousDraws?: number[];
}

export function LootBoard({ lootId, picks, blockedNumbers = [], myNumbers, hasTicket, isLoggedIn, drawAt, previousDraws = [] }: Props) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<number | null>(null);

  const takenMap   = new Map(picks.map((p) => [p.number, p.playerName]));
  const blockedSet = new Set(blockedNumbers);
  const mySet      = new Set(myNumbers);
  const isExpired  = new Date() >= new Date(drawAt);

  // Pode escolher mais números enquanto tiver tickets
  const canPickMore = hasTicket && isLoggedIn && !isExpired;

  const handlePick = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        const result = await pickLootNumber(lootId, selected);
        if (result.error) { toast.error(result.error); return; }
        toast.success(`Número ${selected} escolhido! Boa sorte! 🍀`);
        setSelected(null);
      } catch { toast.error("Erro ao escolher número."); }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-200">Escolha seu número (1–200)</h2>
        {myNumbers.length > 0 && (
          <span className="rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-1 text-xs font-bold text-[#FFCB05]">
            {myNumbers.length > 1 ? `Seus números: ${myNumbers.join(", ")}` : `Seu número: ${myNumbers[0]}`}
          </span>
        )}
      </div>

      {!isLoggedIn && <p className="text-sm text-slate-500">Faça login para participar.</p>}
      {isLoggedIn && !hasTicket && myNumbers.length === 0 && (
        <p className="text-sm text-amber-400">Você precisa de um Ticket ZikaLoot. Compre na ZikaShop ou ganhe via Caixa de Presentes.</p>
      )}
      {isLoggedIn && !hasTicket && myNumbers.length > 0 && (
        <p className="text-xs text-slate-500 bg-slate-900/60 border border-border rounded-lg px-3 py-2">
          Você usou todos os seus tickets neste sorteio. Seus números: <strong className="text-[#FFCB05]">{myNumbers.join(", ")}</strong>
        </p>
      )}
      {isLoggedIn && hasTicket && myNumbers.length > 0 && (
        <p className="text-xs text-green-400 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
          🎟️ Você ainda tem tickets! Escolha mais números — cada ticket = um número.
          Seus números atuais: <strong>{myNumbers.join(", ")}</strong>
        </p>
      )}
      {isExpired && <p className="text-sm text-red-400">O prazo para escolher números encerrou.</p>}

      <div className="grid grid-cols-10 gap-1 sm:grid-cols-20">
        {Array.from({ length: 200 }, (_, i) => i + 1).map((n) => {
          const taken    = takenMap.get(n);
          const isBlocked = blockedSet.has(n);
          const isMe     = mySet.has(n);
          const isSel    = n === selected;
          // Desabilita se: já é meu número, ou já foi pego por outro, ou bloqueado, ou sem ticket, etc.
          const disabled = isMe || (!!taken && !isMe) || isBlocked || isExpired || !canPickMore || pending;
          return (
            <button
              key={n}
              type="button"
              title={isBlocked ? "Sorteado anteriormente (sem dono)" : isMe ? `Meu número` : taken ? taken : `Número ${n}`}
              disabled={disabled}
              onClick={() => setSelected(isSel ? null : n)}
              className={`aspect-square rounded text-[10px] font-semibold transition-all ${
                isMe
                  ? "bg-[#FFCB05] text-[#1A1A2E] cursor-default"
                  : isBlocked
                  ? "bg-red-900/30 text-red-700 cursor-not-allowed line-through"
                  : taken
                  ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                  : isSel
                  ? "bg-[#FFCB05]/30 text-[#FFCB05] ring-1 ring-[#FFCB05]"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>

      {selected && canPickMore && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-300">
            Confirmar número <strong className="text-[#FFCB05]">{selected}</strong>? Isso usará 1 ticket.
          </p>
          <button type="button" disabled={pending} onClick={handlePick}
            className="rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-60">
            {pending ? "Confirmando…" : "Confirmar"}
          </button>
          <button type="button" onClick={() => setSelected(null)}
            className="text-xs text-slate-500 hover:text-slate-300">Cancelar</button>
        </div>
      )}

      {previousDraws.length > 0 && (
        <p className="text-xs text-slate-500">
          Números já sorteados sem dono (bloqueados):{" "}
          <span className="text-red-400">{previousDraws.join(", ")}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-[#FFCB05]" /> Meu(s) número(s)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-700" /> Escolhido por outro</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-900 border border-slate-700" /> Disponível</span>
      </div>
    </div>
  );
}
