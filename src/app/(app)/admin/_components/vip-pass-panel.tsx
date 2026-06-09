"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Star, UserPlus, UserMinus, Clock, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { adminGrantVip, adminRevokeVip } from "@/app/(app)/passe-apoiador/actions";

interface Player {
  id: string;
  displayName: string;
}

interface ActiveVip {
  passId: string;
  playerId: string;
  displayName: string;
  startsAt: Date;
  expiresAt: Date;
  daysRemaining: number;
  claimedDays: number;
}

interface Props {
  players: Player[];
  activeVips: ActiveVip[];
}

export function VipPassPanel({ players, activeVips }: Props) {
  const [open, setOpen] = useState(false);
  const [grantPending, startGrant] = useTransition();
  const [revokePending, startRevoke] = useTransition();
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleGrant = () => {
    if (!selectedPlayerId) { toast.error("Selecione um jogador."); return; }
    startGrant(async () => {
      const result = await adminGrantVip({ playerId: selectedPlayerId, days: durationDays });
      if (result.ok) {
        toast.success("Passe VIP concedido com sucesso!");
        setSelectedPlayerId("");
      } else {
        toast.error(result.error ?? "Erro ao conceder VIP.");
      }
    });
  };

  const handleRevoke = (passId: string) => {
    startRevoke(async () => {
      const result = await adminRevokeVip(passId, revokeReason || "Revogado pelo admin.");
      if (result.ok) {
        toast.success("Passe VIP revogado.");
        setRevokingId(null);
        setRevokeReason("");
      } else {
        toast.error(result.error ?? "Erro ao revogar.");
      }
    });
  };

  return (
    <Card>
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <Star size={18} className="text-yellow-400" />
          <CardTitle className="text-base">Passe Apoiador VIP</CardTitle>
          {activeVips.length > 0 && (
            <span className="rounded-full bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 text-xs text-yellow-300 font-semibold">
              {activeVips.length} ativo{activeVips.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="mt-6 space-y-6">
          {/* Grant VIP */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Conceder Passe VIP</p>
            <div className="flex flex-wrap gap-3">
              <select
                value={selectedPlayerId}
                onChange={e => setSelectedPlayerId(e.target.value)}
                className="rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-yellow-400/50 flex-1 min-w-48"
              >
                <option value="">Selecionar jogador...</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Dias:</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={durationDays}
                  onChange={e => setDurationDays(Number(e.target.value))}
                  className="w-20 rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-yellow-400/50"
                />
              </div>
              <Button
                onClick={handleGrant}
                disabled={grantPending || !selectedPlayerId}
                className="gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold"
              >
                <UserPlus size={14} />
                {grantPending ? "Concedendo..." : "Conceder VIP"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Conceder cria um passe de {durationDays} dias, adiciona o título &quot;Pilar da Comunidade&quot; ao inventário e registra no log de auditoria.
            </p>
          </div>

          {/* Active VIPs list */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Passes ativos</p>
            {activeVips.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum passe ativo no momento.</p>
            ) : (
              <div className="space-y-2">
                {activeVips.map(vip => (
                  <div
                    key={vip.passId}
                    className="rounded-xl border border-yellow-400/10 bg-yellow-950/10 p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <Star size={14} className="text-yellow-400 shrink-0" />
                      <div>
                        <p className="font-semibold text-sm text-white">{vip.displayName}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {vip.daysRemaining}d restantes
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 size={10} />
                            {vip.claimedDays}/30 resgatados
                          </span>
                          <span>Expira {new Date(vip.expiresAt).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>

                    {revokingId === vip.passId ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          placeholder="Motivo (opcional)"
                          value={revokeReason}
                          onChange={e => setRevokeReason(e.target.value)}
                          className="rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-red-400/50 w-48"
                        />
                        <Button
                          onClick={() => handleRevoke(vip.passId)}
                          disabled={revokePending}
                          variant="destructive"
                          className="text-xs h-8 px-3"
                        >
                          {revokePending ? "Revogando..." : "Confirmar"}
                        </Button>
                        <Button
                          onClick={() => { setRevokingId(null); setRevokeReason(""); }}
                          variant="ghost"
                          className="text-xs h-8 px-3"
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setRevokingId(vip.passId)}
                        variant="ghost"
                        className="gap-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8"
                      >
                        <UserMinus size={12} />
                        Revogar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
