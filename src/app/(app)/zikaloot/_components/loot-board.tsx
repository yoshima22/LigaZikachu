"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Ticket, X } from "lucide-react";
import { pickLootNumber } from "../actions";

interface Props {
  lootId: string;
  picks: { number: number; playerName: string; playerId?: string }[];
  blockedNumbers?: number[];
  myNumbers: number[];
  hasTicket: boolean;
  isLoggedIn: boolean;
  drawAt: string;
  previousDraws?: number[];
}

export function LootBoard({ lootId, picks, blockedNumbers = [], myNumbers, hasTicket, isLoggedIn, drawAt, previousDraws = [] }: Props) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const takenMap   = new Map(picks.map((p) => [p.number, { name: p.playerName, playerId: p.playerId }]));
  const blockedSet = new Set(blockedNumbers);
  const mySet      = new Set(myNumbers);
  const isExpired  = new Date() >= new Date(drawAt);
  const canPickMore = hasTicket && isLoggedIn && !isExpired;

  const handleSelectNumber = (n: number) => {
    if (!canPickMore) return;
    setSelected(n);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        const result = await pickLootNumber(lootId, selected);
        if (result.error) { toast.error(result.error); return; }
        toast.success(`🍀 Número ${selected} reservado! Boa sorte!`);
        setSelected(null);
        setShowConfirm(false);
      } catch { toast.error("Erro ao escolher número."); }
    });
  };

  return (
    <div className="space-y-4">
      {/* Modal de confirmação */}
      {showConfirm && selected && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-[#FFCB05]/30 bg-[#1A1A2E] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">ZikaLoot</p>
                <h3 className="text-lg font-bold text-white">Confirmar escolha?</h3>
              </div>
              <button onClick={() => { setShowConfirm(false); setSelected(null); }} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 text-center">
              <p className="text-4xl font-black text-[#FFCB05]">{selected}</p>
              <p className="text-xs text-slate-400 mt-1">Seu número escolhido</p>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-slate-900/60 border border-border px-3 py-2 text-xs text-slate-400">
              <Ticket size={12} className="text-[#FFCB05] shrink-0" />
              Isso consumirá <strong className="text-white mx-1">1 Ticket ZikaLoot</strong> do seu inventário.
            </div>

            <div className="flex gap-3">
              <button type="button" disabled={pending} onClick={handleConfirm}
                className="flex-1 rounded-xl bg-[#FFCB05] py-2.5 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50">
                {pending ? "Confirmando…" : "Confirmar número"}
              </button>
              <button type="button" onClick={() => { setShowConfirm(false); setSelected(null); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
          Todos os tickets usados neste sorteio. Seus números: <strong className="text-[#FFCB05]">{myNumbers.join(", ")}</strong>
        </p>
      )}
      {isLoggedIn && hasTicket && myNumbers.length > 0 && (
        <p className="text-xs text-green-400 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
          🎟️ Você ainda tem tickets! Clique em um número para escolher. Números atuais: <strong>{myNumbers.join(", ")}</strong>
        </p>
      )}
      {isExpired && <p className="text-sm text-red-400">O prazo para escolher números encerrou.</p>}

      <div className="grid grid-cols-10 gap-1 sm:grid-cols-20">
        {Array.from({ length: 200 }, (_, i) => i + 1).map((n) => {
          const takenInfo = takenMap.get(n);
          const taken    = takenInfo?.name;
          const takenPlayerId = takenInfo?.playerId;
          const isBlocked = blockedSet.has(n);
          const isMe     = mySet.has(n);
          const disabled = isMe || (!!taken && !isMe) || isBlocked || isExpired || !canPickMore || pending;

          const cellClass = `flex flex-col items-center justify-center rounded transition-all min-h-[32px] py-0.5 px-0.5 ${
            isMe ? "bg-[#FFCB05] text-[#1A1A2E] cursor-default"
            : isBlocked ? "bg-red-900/30 text-red-700 cursor-not-allowed"
            : taken ? "bg-slate-800 text-slate-400 cursor-not-allowed"
            : canPickMore ? "bg-slate-900 text-slate-400 hover:bg-[#FFCB05]/20 hover:text-[#FFCB05] cursor-pointer"
            : "bg-slate-900 text-slate-600 cursor-not-allowed"
          }`;

          const numberEl = (
            <>
              <span className={`text-[10px] font-bold leading-none ${isBlocked ? "line-through" : ""}`}>{n}</span>
              {taken && !isMe && (
                <span className="text-[7px] leading-none mt-0.5 truncate w-full text-center opacity-70 max-w-[40px]">
                  {taken.split(" ")[0]}
                </span>
              )}
            </>
          );

          // Números tomados por outros: link clicável para o perfil
          if (taken && !isMe && takenPlayerId) {
            return (
              <Link key={n} href={`/jogadores/${takenPlayerId}`}
                title={`Número de ${taken}`}
                className={cellClass}>
                {numberEl}
              </Link>
            );
          }

          return (
            <button key={n} type="button"
              title={isBlocked ? "Sorteado anteriormente" : isMe ? "Meu número" : `Escolher ${n}`}
              disabled={disabled}
              onClick={() => !disabled && handleSelectNumber(n)}
              className={cellClass}>
              {numberEl}
            </button>
          );
        })}
      </div>

      {previousDraws.length > 0 && (
        <p className="text-xs text-slate-500">
          Números sorteados sem dono (bloqueados):{" "}
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
