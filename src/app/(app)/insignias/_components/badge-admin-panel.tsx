"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Award, Pencil, Plus, ShieldX, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  assignLeagueBadgeAction,
  createLeagueBadgeAction,
  deleteLeagueBadgeAction,
  removeLeagueBadgeAction,
  updateLeagueBadgeAction
} from "../actions";

interface TournamentOption {
  id: string;
  name: string;
  seasonName: string | null;
}

interface PlayerOption {
  id: string;
  displayName: string;
}

interface BadgeOwner {
  id: string;
  playerId: string;
  playerName: string;
}

interface BadgeItem {
  id: string;
  name: string;
  imageUrl: string;
  tournamentId: string;
  tournamentName: string;
  seasonName: string | null;
  owners: BadgeOwner[];
}

interface BadgeAdminPanelProps {
  tournaments: TournamentOption[];
  players: PlayerOption[];
  badges: BadgeItem[];
  admin: boolean;
}

export function BadgeAdminPanel({ tournaments, players, badges, admin }: BadgeAdminPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id ?? "");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<Record<string, string>>({});

  // Edição de insígnia existente
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTournamentId, setEditTournamentId] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");

  function readImageFile(file: File, onLoaded: (dataUrl: string) => void) {
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }

    if (file.size > 850_000) {
      toast.error("A imagem precisa ter menos de 850 KB por enquanto.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onLoaded(String(reader.result));
    reader.onerror = () => toast.error("Nao consegui carregar a imagem.");
    reader.readAsDataURL(file);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    readImageFile(file, setImageUrl);
  }

  function startEdit(badge: BadgeItem) {
    setEditingId(badge.id);
    setEditName(badge.name);
    setEditTournamentId(badge.tournamentId);
    setEditImageUrl("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditTournamentId("");
    setEditImageUrl("");
  }

  function handleEditImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    readImageFile(file, setEditImageUrl);
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;

    startTransition(async () => {
      const result = await updateLeagueBadgeAction({
        badgeId: editingId,
        name: editName,
        tournamentId: editTournamentId,
        imageUrl: editImageUrl || undefined
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Insignia atualizada.");
      cancelEdit();
    });
  }

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createLeagueBadgeAction({ name, tournamentId, imageUrl });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Insignia criada.");
      setName("");
      setImageUrl("");
    });
  }

  function selectedPlayerForBadge(badgeId: string) {
    return selectedPlayers[badgeId] ?? players[0]?.id ?? "";
  }

  function assignBadge(badgeId: string) {
    const playerId = selectedPlayerForBadge(badgeId);
    if (!playerId) return;

    startTransition(async () => {
      const result = await assignLeagueBadgeAction({ badgeId, playerId });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Insignia atribuida. O bonus de 3 pontos ja entra nos rankings.");
    });
  }

  function removeBadge(badgeId: string, playerId: string) {
    startTransition(async () => {
      const result = await removeLeagueBadgeAction({ badgeId, playerId });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Insignia removida do jogador.");
    });
  }

  function deleteBadge(badgeId: string) {
    if (!confirm("Deletar esta insignia? Ela sera removida tambem do jogador dono, se houver.")) return;

    startTransition(async () => {
      const result = await deleteLeagueBadgeAction({ badgeId });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Insignia deletada.");
    });
  }

  return (
    <div className="space-y-6">
      {admin && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-[#FFCB05]/20 bg-slate-950/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Award size={18} className="text-[#FFCB05]" />
            <h2 className="text-sm font-semibold text-white">Criar insignia</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
                Nome
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: Insignia Relampago"
                maxLength={80}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
                Torneio do grupo
              </label>
              <select
                value={tournamentId}
                onChange={(event) => setTournamentId(event.target.value)}
                required
                className="h-10 w-full rounded-xl border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
              >
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}{tournament.seasonName ? ` - ${tournament.seasonName}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
                Imagem
              </label>
              <Input type="file" accept="image/*" onChange={handleImageChange} required={!imageUrl} />
            </div>
          </div>

          {imageUrl && (
            <div className="mt-4 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Preview da insignia" className="h-16 w-16 rounded-xl object-cover" />
              <p className="text-xs text-slate-400">Preview carregado. A imagem sera salva junto da insignia.</p>
            </div>
          )}

          <Button type="submit" disabled={isPending || tournaments.length === 0} className="mt-4">
            <Plus size={15} className="mr-1.5" />
            Criar insignia
          </Button>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {badges.map((badge) => (
          <article key={badge.id} className="rounded-2xl border border-border bg-slate-950/70 p-4">
            <div className="flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badge.imageUrl} alt={badge.name} className="h-20 w-20 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-white">{badge.name}</h3>
                <p className="mt-1 text-xs text-slate-400">{badge.tournamentName}</p>
                <p className="text-xs text-[#FFCB05]">+3 pontos</p>
                {badge.seasonName && <p className="text-xs text-slate-500">{badge.seasonName}</p>}
              </div>
              {admin && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => (editingId === badge.id ? cancelEdit() : startEdit(badge))}
                    className="h-8 rounded-lg border border-[#FFCB05]/30 px-2 text-[#FFCB05] hover:bg-[#FFCB05]/10 disabled:opacity-50"
                    title={editingId === badge.id ? "Cancelar edicao" : "Editar insignia"}
                  >
                    {editingId === badge.id ? <X size={14} /> : <Pencil size={14} />}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => deleteBadge(badge.id)}
                    className="h-8 rounded-lg border border-red-500/30 px-2 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    title="Deletar insignia"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

            {admin && editingId === badge.id && (
              <form onSubmit={saveEdit} className="mt-4 space-y-3 rounded-xl border border-[#FFCB05]/20 bg-slate-900/50 p-3">
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Nome
                  </label>
                  <Input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    maxLength={80}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Torneio do grupo
                  </label>
                  <select
                    value={editTournamentId}
                    onChange={(event) => setEditTournamentId(event.target.value)}
                    required
                    className="h-10 w-full rounded-xl border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
                  >
                    {tournaments.map((tournament) => (
                      <option key={tournament.id} value={tournament.id}>
                        {tournament.name}{tournament.seasonName ? ` - ${tournament.seasonName}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    Nova imagem (opcional)
                  </label>
                  <Input type="file" accept="image/*" onChange={handleEditImageChange} />
                  <p className="mt-1 text-[10px] text-slate-500">Deixe em branco para manter a imagem atual.</p>
                </div>
                {editImageUrl && (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editImageUrl} alt="Preview da nova imagem" className="h-14 w-14 rounded-xl object-cover" />
                    <p className="text-xs text-slate-400">Nova imagem carregada.</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="submit" disabled={isPending} className="flex-1">
                    Salvar alteracoes
                  </Button>
                  <Button type="button" variant="outline" disabled={isPending} onClick={cancelEdit}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Dono atual</p>
              {badge.owners.length === 0 ? (
                <p className="text-xs text-slate-500">Sem dono no momento.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {badge.owners.map((owner) => (
                    <span
                      key={owner.id}
                      className="inline-flex items-center gap-2 rounded-full border border-[#FFCB05]/20 bg-[#FFCB05]/10 px-2.5 py-1 text-xs text-[#FFCB05]"
                    >
                      <Link href={`/jogadores/${owner.playerId}`} className="hover:text-white">
                        {owner.playerName}
                      </Link>
                      {admin && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => removeBadge(badge.id, owner.playerId)}
                          className="text-red-300 hover:text-red-200"
                          title="Remover insignia"
                        >
                          <ShieldX size={13} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {admin && players.length > 0 && (
              <div className="mt-4 flex gap-2">
                <select
                  value={selectedPlayerForBadge(badge.id)}
                  onChange={(event) =>
                    setSelectedPlayers((current) => ({ ...current, [badge.id]: event.target.value }))
                  }
                  className="min-w-0 flex-1 rounded-xl border border-border bg-slate-900/70 px-3 py-2 text-xs text-slate-100"
                >
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>{player.displayName}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => assignBadge(badge.id)}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#FFCB05] px-3 py-2 text-xs font-semibold text-[#1A1A2E] disabled:opacity-50"
                >
                  <UserPlus size={14} />
                  {badge.owners.length > 0 ? "Mover" : "Atribuir"}
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
