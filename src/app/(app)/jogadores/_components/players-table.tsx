"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { User, Pencil, ShieldOff, ShieldCheck, CheckCircle, Trash2, X } from "lucide-react";
import { Role, UserStatus } from "@prisma/client";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  approvePlayerAction,
  toggleSuspendPlayerAction,
  editPlayerAction,
  deletePlayerAction
} from "../actions";

export interface PlayerRow {
  userId: string;
  playerId: string;
  displayName: string;
  ptcglNick: string | null;
  email: string;
  status: UserStatus;
  role: Role;
  image: string | null;
  whatsapp: string | null;
  notes: string | null;
  wins: number;
  losses: number;
}

interface Props {
  players: PlayerRow[];
  seasonId: string;
  currentUserId: string;
  currentUserRole: Role;
}

function userStatusBadge(status: UserStatus) {
  const map: Record<UserStatus, { variant: "active" | "pending" | "suspended" | "rejected" | "draft"; label: string }> = {
    ACTIVE: { variant: "active", label: "Ativo" },
    PENDING_APPROVAL: { variant: "pending", label: "Pendente" },
    SUSPENDED: { variant: "suspended", label: "Suspenso" },
    REJECTED: { variant: "rejected", label: "Rejeitado" }
  };
  const item = map[status] ?? { variant: "draft" as const, label: status };
  return <StatusBadge variant={item.variant} label={item.label} />;
}

interface EditModalProps {
  player: PlayerRow;
  onClose: () => void;
}

function EditPlayerModal({ player, onClose }: EditModalProps) {
  const [displayName, setDisplayName] = useState(player.displayName);
  const [ptcglNick, setPtcglNick] = useState(player.ptcglNick ?? "");
  const [whatsapp, setWhatsapp] = useState(player.whatsapp ?? "");
  const [notes, setNotes] = useState(player.notes ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await editPlayerAction({
        playerId: player.playerId,
        displayName,
        ptcglNick: ptcglNick || null,
        whatsapp: whatsapp || null,
        notes: notes || null,
        newPassword: newPassword || null
      });
      if (result?.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Editar jogador</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Nome de exibição *</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full rounded-xl border border-border bg-slate-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Nick no PTCGL</label>
            <input
              value={ptcglNick}
              onChange={(e) => setPtcglNick(e.target.value)}
              className="w-full rounded-xl border border-border bg-slate-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">WhatsApp</label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full rounded-xl border border-border bg-slate-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Notas internas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-slate-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Nova senha</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              minLength={8}
              maxLength={72}
              placeholder="Deixe vazio para nao alterar"
              className="w-full rounded-xl border border-border bg-slate-800 px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PlayersTable({ players, seasonId, currentUserId, currentUserRole }: Props) {
  const [editingPlayer, setEditingPlayer] = useState<PlayerRow | null>(null);
  const [, startTransition] = useTransition();

  const canAdmin = currentUserRole === Role.ADMIN || currentUserRole === Role.SUPER_ADMIN;
  const isSuperAdmin = currentUserRole === Role.SUPER_ADMIN;

  if (players.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-slate-950/70 p-10 text-center">
        <User size={32} className="mx-auto mb-3 text-slate-600" />
        <p className="text-sm text-slate-400">Nenhum jogador encontrado.</p>
      </div>
    );
  }

  return (
    <>
      {editingPlayer && (
        <EditPlayerModal player={editingPlayer} onClose={() => setEditingPlayer(null)} />
      )}

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-900/80 text-left text-xs uppercase tracking-widest text-slate-400">
              <th className="px-4 py-3">Jogador</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nick PTCGL</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">V / D</th>
              {canAdmin && <th className="px-4 py-3 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-slate-950/70">
            {players.map((p) => (
              <tr key={p.userId} className="transition-colors hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link
                    href={`/jogadores/${p.playerId}`}
                    className="flex items-center gap-3 hover:text-primary"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-white">
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt={p.displayName} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        p.displayName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className="font-medium text-white">{p.displayName}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-300">{p.email}</td>
                <td className="px-4 py-3 text-slate-400">{p.ptcglNick ?? "—"}</td>
                <td className="px-4 py-3">{userStatusBadge(p.status)}</td>
                <td className="px-4 py-3 text-center text-slate-300">
                  <span className="text-emerald-400">{p.wins}</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-red-400">{p.losses}</span>
                </td>
                {canAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {p.status === UserStatus.PENDING_APPROVAL && (
                        <button
                          title="Aprovar"
                          onClick={() =>
                            startTransition(() => approvePlayerAction(p.userId))
                          }
                          className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button
                        title={p.status === UserStatus.SUSPENDED ? "Reativar" : "Suspender"}
                        onClick={() =>
                          startTransition(() => toggleSuspendPlayerAction(p.userId))
                        }
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5"
                      >
                        {p.status === UserStatus.SUSPENDED ? (
                          <ShieldCheck size={16} className="text-emerald-400" />
                        ) : (
                          <ShieldOff size={16} />
                        )}
                      </button>
                      <button
                        title="Editar"
                        onClick={() => setEditingPlayer(p)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5"
                      >
                        <Pencil size={16} />
                      </button>
                      {canAdmin && p.userId !== currentUserId && (
                        <button
                          title="Excluir conta"
                          onClick={() => {
                            const warn = isSuperAdmin
                              ? `Excluir PERMANENTEMENTE a conta de ${p.displayName}? Esta ação não pode ser desfeita.`
                              : `Excluir a conta pendente de ${p.displayName}?`;
                            if (confirm(warn)) {
                              startTransition(async () => {
                                const result = await deletePlayerAction(p.userId);
                                if (result?.error) {
                                  toast.error(result.error);
                                  return;
                                }
                                toast.success("Conta excluída.");
                              });
                            }
                          }}
                          className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {players.map((p) => (
          <div key={p.userId} className="rounded-2xl border border-border bg-slate-950/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/jogadores/${p.playerId}`} className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-white">
                  {p.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-white">{p.displayName}</p>
                  <p className="text-xs text-slate-400">{p.ptcglNick ?? p.email}</p>
                </div>
              </Link>
              {userStatusBadge(p.status)}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-400">
                <span className="text-emerald-400">{p.wins}V</span>
                {" / "}
                <span className="text-red-400">{p.losses}D</span>
              </span>
              {canAdmin && (
                <div className="flex gap-1">
                  {p.status === UserStatus.PENDING_APPROVAL && (
                    <button
                      onClick={() => startTransition(() => approvePlayerAction(p.userId))}
                      className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <CheckCircle size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => startTransition(() => toggleSuspendPlayerAction(p.userId))}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5"
                  >
                    {p.status === UserStatus.SUSPENDED ? (
                      <ShieldCheck size={15} className="text-emerald-400" />
                    ) : (
                      <ShieldOff size={15} />
                    )}
                  </button>
                  <button
                    onClick={() => setEditingPlayer(p)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5"
                  >
                    <Pencil size={15} />
                  </button>
                  {canAdmin && p.userId !== currentUserId && (
                    <button
                      onClick={() => {
                        const warn = isSuperAdmin
                          ? `Excluir PERMANENTEMENTE a conta de ${p.displayName}?`
                          : `Excluir a conta pendente de ${p.displayName}?`;
                        if (confirm(warn)) {
                          startTransition(async () => {
                            const result = await deletePlayerAction(p.userId);
                            if (result?.error) {
                              toast.error(result.error);
                              return;
                            }
                            toast.success("Conta excluída.");
                          });
                        }
                      }}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
