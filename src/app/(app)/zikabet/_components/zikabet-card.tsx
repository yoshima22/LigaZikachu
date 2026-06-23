"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Coins, CheckCircle } from "lucide-react";
import { placeBet, placeWeeklyLeagueBet } from "../actions";

const betStatusLabel: Record<string, string> = {
  OPEN: "Aberta", CLOSED: "Fechada", WON: "Vencida",
  LOST: "Perdida", REFUNDED: "Reembolsada", CANCELLED: "Cancelada"
};
const betStatusColor: Record<string, string> = {
  OPEN: "text-[#F7D02C]", CLOSED: "text-slate-400", WON: "text-[#7AC74C]",
  LOST: "text-red-400", REFUNDED: "text-blue-400", CANCELLED: "text-slate-500"
};

interface Match {
  id: string;
  playerA: { id: string; displayName: string };
  playerB: { id: string; displayName: string };
  playerAOdds: number | null;
  playerBOdds: number | null;
  weekLabel: string;
}

interface MyBet {
  betOnPlayerId: string;
  amount: number;
  odds: number;
  potentialReturn: number;
  status: string;
}

interface Props {
  match: Match;
  myBet: MyBet | null;
  balance: number;
  config: { minBet: number; maxBet: number };
  isLoggedIn: boolean;
  source?: "tcg" | "weekly";
}

export function ZikaBetCard({ match, myBet, balance, config, isLoggedIn, source = "tcg" }: Props) {
  const [pending, startTransition] = useTransition();
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [amount, setAmount] = useState(config.minBet);

  const selectedOdds = selectedPlayer === match.playerA.id
    ? (match.playerAOdds ?? 1.5)
    : (match.playerBOdds ?? 1.5);
  const potentialReturn = Math.floor(amount * selectedOdds);

  const handleBet = () => {
    if (!selectedPlayer) { toast.error("Selecione um jogador."); return; }
    if (amount < config.minBet || amount > config.maxBet) {
      toast.error(`Aposta entre ${config.minBet} e ${config.maxBet} ZC.`); return;
    }
    startTransition(async () => {
      try {
        const result = source === "weekly"
          ? await placeWeeklyLeagueBet({ weeklyMatchId: match.id, betOnPlayerId: selectedPlayer, amount })
          : await placeBet({ matchId: match.id, betOnPlayerId: selectedPlayer, amount });
        if (result.error) { toast.error(result.error); return; }
        toast.success(`Aposta de ${amount} ZC registrada! Retorno potencial: ${potentialReturn} ZC`);
        setSelectedPlayer(null);
      } catch { toast.error("Erro ao registrar aposta."); }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-slate-950/60 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{match.weekLabel}</p>
        <p className="text-xs text-slate-500">Odds disponíveis</p>
      </div>

      {/* Duas opções de aposta */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { player: match.playerA, odds: match.playerAOdds },
          { player: match.playerB, odds: match.playerBOdds }
        ].map(({ player, odds }) => {
          const selected = selectedPlayer === player.id;
          const isMyBetOn = myBet?.betOnPlayerId === player.id;
          return (
            <button
              key={player.id}
              type="button"
              disabled={!!myBet || pending || !isLoggedIn}
              onClick={() => setSelectedPlayer(selected ? null : player.id)}
              className={`rounded-xl border p-4 text-left transition-all ${
                isMyBetOn
                  ? "border-[#7AC74C]/50 bg-[#7AC74C]/10"
                  : selected
                  ? "border-[#FFCB05]/50 bg-[#FFCB05]/5"
                  : "border-border bg-slate-900/40 hover:border-slate-600"
              }`}
            >
              <p className="font-semibold text-white text-sm truncate">{player.displayName}</p>
              <p className="mt-1 text-xl font-bold text-[#FFCB05]">
                {odds ? `${odds}x` : "—"}
              </p>
              {isMyBetOn && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-[#7AC74C]">
                  <CheckCircle size={10} /> Sua aposta
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Já apostou: mostrar resumo */}
      {myBet && (
        <div className="rounded-lg border border-border bg-slate-900/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="text-slate-400">
              <span className="font-semibold text-white">{myBet.amount.toLocaleString("pt-BR")} ZC</span>
              {" "}apostado @ {myBet.odds}x
            </p>
            <span className={`text-xs font-semibold ${betStatusColor[myBet.status]}`}>
              {betStatusLabel[myBet.status]}
            </span>
          </div>
          {myBet.status === "OPEN" && (
            <p className="mt-1 text-xs text-slate-500">
              Retorno potencial: <span className="text-[#7AC74C] font-semibold">{myBet.potentialReturn.toLocaleString("pt-BR")} ZC</span>
            </p>
          )}
          {myBet.status === "WON" && (
            <p className="mt-1 text-xs text-[#7AC74C]">
              +{myBet.potentialReturn.toLocaleString("pt-BR")} ZC recebidos!
            </p>
          )}
        </div>
      )}

      {/* Formulário de aposta */}
      {!myBet && selectedPlayer && isLoggedIn && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <label className="flex-1 space-y-1 text-xs text-slate-400">
              <span>Valor da aposta (ZC)</span>
              <input
                type="number"
                min={config.minBet}
                max={Math.min(config.maxBet, balance)}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
              />
            </label>
            <div className="text-right">
              <p className="text-[10px] text-slate-500">Retorno se ganhar</p>
              <p className="text-sm font-bold text-[#7AC74C]">{potentialReturn.toLocaleString("pt-BR")} ZC</p>
              <p className="text-[10px] text-slate-600">({selectedOdds}x)</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <Coins size={12} /> Saldo: {balance.toLocaleString("pt-BR")} ZC
            </p>
            <button
              type="button"
              disabled={pending || amount < config.minBet || amount > balance}
              onClick={handleBet}
              className="rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
            >
              {pending ? "Apostando…" : "Confirmar aposta"}
            </button>
          </div>
        </div>
      )}

      {!isLoggedIn && (
        <p className="text-xs text-slate-500 text-center">Faça login para apostar.</p>
      )}
    </div>
  );
}
