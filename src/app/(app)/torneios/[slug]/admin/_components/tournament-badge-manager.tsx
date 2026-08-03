"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { updateTournamentBadgeImage } from "../badge-actions";

type Badge = { id: string; name: string; imageUrl: string };

export function TournamentBadgeManager({ badges }: { badges: Badge[] }) {
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<Record<string, string>>({});

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

  return (
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
        </div>
      ))}
    </div>
  );
}
