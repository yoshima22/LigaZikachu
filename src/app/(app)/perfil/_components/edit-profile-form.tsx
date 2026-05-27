"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePlayerProfile } from "../actions";

interface EditProfileFormProps {
  player: {
    displayName: string;
    ptcglNick: string | null;
    avatarUrl: string | null;
  };
}

export function EditProfileForm({ player }: EditProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(player.displayName);
  const [ptcglNick, setPtcglNick] = useState(player.ptcglNick ?? "");
  const [avatarUrl, setAvatarUrl] = useState(player.avatarUrl ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await updatePlayerProfile({
        displayName,
        ptcglNick: ptcglNick || undefined,
        avatarUrl: avatarUrl || undefined,
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Perfil atualizado!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
          Nome de exibicao
        </label>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={60}
          className="bg-slate-900/70 border-border text-slate-100"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
          Nickname Pokemon TCG Live
        </label>
        <Input
          value={ptcglNick}
          onChange={(e) => setPtcglNick(e.target.value)}
          maxLength={60}
          placeholder="Seu nick no jogo..."
          className="bg-slate-900/70 border-border text-slate-100"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
          URL da foto de perfil
        </label>
        <Input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          type="url"
          placeholder="https://..."
          className="bg-slate-900/70 border-border text-slate-100"
        />
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt="Preview"
            className="mt-2 h-16 w-16 rounded-full object-cover border-2 border-[#FFCB05]/30"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Salvar alteracoes"}
      </Button>
    </form>
  );
}
