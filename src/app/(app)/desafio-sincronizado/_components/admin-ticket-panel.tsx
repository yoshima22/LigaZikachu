"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Gift, Minus, Search } from "lucide-react";
import { adminGrantSyncTicketAction, adminRevokeSyncTicketAction } from "../actions";

interface Player {
  id: string;
  displayName: string;
  ptcglNick: string | null;
}

interface Props {
  players: Player[];
}

type TicketType = "LEFT" | "RIGHT" | "COMPLETE";

const TYPE_OPTS: { value: TicketType; label: string }[] = [
  { value: "LEFT",     label: "🔥 Metade Esquerda (Fogo)" },
  { value: "RIGHT",    label: "💧 Metade Direita (Água)" },
  { value: "COMPLETE", label: "🎫 Ticket Completo" },
];

export function AdminTicketPanel({ players }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"grant" | "revoke">("grant");
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [ticketType, setTicketType] = useState<TicketType>("LEFT");
  const [qty, setQty] = useState(1);

  const filtered = players.filter((p) =>
    p.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (p.ptcglNick ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = () => {
    if (!selectedPlayer) { toast.error("Selecione um jogador."); return; }
    const label = TYPE_OPTS.find((t) => t.value === ticketType)?.label ?? ticketType;
    const verb = mode === "grant" ? "Conceder" : "Retirar";
    if (!confirm(`${verb} ${qty}x ${label} para ${selectedPlayer.displayName}?`)) return;
    startTransition(async () => {
      const fn = mode === "grant" ? adminGrantSyncTicketAction : adminRevokeSyncTicketAction;
      const result = await fn(selectedPlayer.id, ticketType, qty);
      if (result.error) { toast.error(result.error); return; }
      toast.success(`${qty}x ${label} ${mode === "grant" ? "concedido" : "retirado"} de ${selectedPlayer.displayName}!`);
      router.refresh();
    });
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-300">Gerenciar tickets de um jogador</p>
        <div className="flex rounded-lg border border-border overflow-hidden text-[10px]">
          <button
            type="button"
            onClick={() => setMode("grant")}
            className={`px-3 py-1.5 font-semibold transition-colors ${mode === "grant" ? "bg-[#FFCB05]/10 text-[#FFCB05] border-r border-border" : "text-slate-500 hover:text-slate-300 border-r border-border"}`}
          >
            <Gift size={10} className="inline mr-1" />Conceder
          </button>
          <button
            type="button"
            onClick={() => setMode("revoke")}
            className={`px-3 py-1.5 font-semibold transition-colors ${mode === "revoke" ? "bg-red-500/10 text-red-400" : "text-slate-500 hover:text-slate-300"}`}
          >
            <Minus size={10} className="inline mr-1" />Retirar
          </button>
        </div>
      </div>

      {/* Busca de jogador */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-500">Jogador</label>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedPlayer(null); }}
            placeholder="Buscar por nome ou nick..."
            className="w-full rounded-lg border border-border bg-slate-950 pl-7 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
          />
        </div>
        {search && !selectedPlayer && filtered.length > 0 && (
          <div className="rounded-lg border border-border bg-slate-950 max-h-36 overflow-y-auto">
            {filtered.slice(0, 10).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setSelectedPlayer(p); setSearch(p.displayName); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition-colors border-b border-border/40 last:border-0"
              >
                {p.displayName}
                {p.ptcglNick && <span className="ml-1.5 text-slate-500">({p.ptcglNick})</span>}
              </button>
            ))}
          </div>
        )}
        {selectedPlayer && (
          <p className="text-[10px] text-green-400">✓ {selectedPlayer.displayName} selecionado</p>
        )}
      </div>

      {/* Tipo de ticket */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-500">Tipo de ticket</label>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTicketType(t.value)}
              className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                ticketType === t.value
                  ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]"
                  : "border-border text-slate-500 hover:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quantidade + botão */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-slate-500 whitespace-nowrap">Quantidade:</label>
          <input
            type="number"
            min={1}
            max={20}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value))))}
            className="w-14 rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05] text-center"
          />
        </div>
        <button
          type="button"
          disabled={pending || !selectedPlayer}
          onClick={handleSubmit}
          className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
            mode === "grant"
              ? "bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"
              : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
          }`}
        >
          {mode === "grant" ? "Conceder" : "Retirar"} {qty > 1 ? `×${qty}` : ""}
        </button>
      </div>
    </div>
  );
}
