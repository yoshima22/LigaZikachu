"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Award, Trash2, Upload } from "lucide-react";
import { PlayerSearchInput, type PlayerSearchOption } from "@/components/player-search-input";
import { setTournamentBadgeOwner, updateTournamentBadgeImage } from "../badge-actions";

type Badge = { id: string; name: string; imageUrl: string; owners: Array<{ id: string; displayName: string }> };

export function TournamentBadgeManager({ badges }: { badges: Badge[] }) {
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<Record<string, string>>({});
  const [player, setPlayer] = useState<PlayerSearchOption | null>(null);
  const [badgeId, setBadgeId] = useState(badges[0]?.id ?? "");

  function selectFile(badgeId: string, file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFiles((current) => ({ ...current, [badgeId]: String(reader.result ?? "") }));
    reader.readAsDataURL(file);
  }

  function upload(badgeId: string) {
    const imageDataUrl = files[badgeId];
    if (!imageDataUrl) return;
    startTransition(async () => {
      const result = await updateTournamentBadgeImage({ badgeId, imageDataUrl });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Imagem enviada ao Supabase e vinculada a insignia.");
      setFiles((current) => ({ ...current, [badgeId]: "" }));
    });
  }

  function changeOwner(awarded: boolean, targetPlayer = player, targetBadgeId = badgeId) {
    if (!targetPlayer || !targetBadgeId) return;
    startTransition(async () => {
      const result = await setTournamentBadgeOwner({ badgeId: targetBadgeId, playerId: targetPlayer.id, awarded });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(awarded ? "Insignia entregue ao jogador." : "Insignia removida do jogador.");
      if (awarded) setPlayer(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#FFCB05]/25 bg-[#FFCB05]/5 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#FFCB05]">Entrega manual</p>
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)_auto]">
          <PlayerSearchInput value={player?.id ?? ""} onChange={(_, option) => setPlayer(option)} placeholder="Buscar jogador por nome ou nick..." />
          <select value={badgeId} onChange={(event) => setBadgeId(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
            {badges.map((badge) => <option key={badge.id} value={badge.id}>{badge.name}</option>)}
          </select>
          <button type="button" disabled={pending || !player || !badgeId} onClick={() => changeOwner(true)} className="flex items-center justify-center gap-1 rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] disabled:opacity-40">
            <Award size={14} /> Entregar
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">A entrega da insígnia é independente dos pontos da Jornada exibidos no ranking.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {badges.map((badge) => (
        <div key={badge.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={files[badge.id] || badge.imageUrl} alt={badge.name} className="h-28 w-full rounded-lg bg-slate-900 object-contain" />
          <p className="mt-2 truncate text-sm font-semibold text-white">{badge.name}</p>
          <label className="mt-2 block cursor-pointer rounded-lg border border-slate-700 px-2 py-1.5 text-center text-[10px] text-slate-300 hover:border-[#FFCB05]/50">
            Escolher imagem
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(event) => selectFile(badge.id, event.target.files?.[0])} />
          </label>
          <button type="button" disabled={pending || !files[badge.id]} onClick={() => upload(badge.id)} className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-[#FFCB05] px-2 py-1.5 text-[10px] font-bold text-[#1A1A2E] disabled:opacity-40">
            <Upload size={11} /> Enviar ao Supabase
          </button>
          {badge.owners.length > 0 && (
            <div className="mt-3 border-t border-slate-800 pt-2">
              <p className="mb-1 text-[9px] font-semibold uppercase text-slate-500">Donos atuais</p>
              <div className="space-y-1">
                {badge.owners.map((owner) => (
                  <div key={owner.id} className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
                    <span className="truncate">{owner.displayName}</span>
                    <button type="button" disabled={pending} onClick={() => changeOwner(false, { id: owner.id, displayName: owner.displayName, ptcglNick: null }, badge.id)} className="rounded p-1 text-red-400 hover:bg-red-500/10" title="Remover insígnia"><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}
