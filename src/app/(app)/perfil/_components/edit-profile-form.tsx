"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activateAccountStandby, setCasualModeAction, updateOwnPassword, updatePlayerProfile } from "../actions";

interface EditProfileFormProps {
  player: {
    displayName: string;
    ptcglNick: string | null;
    popId: string | null;
    avatarUrl: string | null;
    standbyUntil: Date | string | null;
    casualMode: boolean;
    mascotSpritePreference: string | null;
    megaSpritePreference: string | null;
  };
}

export function EditProfileForm({ player }: EditProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(player.displayName);
  const [ptcglNick, setPtcglNick] = useState(player.ptcglNick ?? "");
  const [popId, setPopId] = useState(player.popId ?? "");
  const [avatarUrl, setAvatarUrl] = useState(player.avatarUrl ?? "");
  const [mascotSpritePreference, setMascotSpritePreference] = useState(player.mascotSpritePreference === "STATIC" ? "STATIC" : "ANIMATED");
  const [megaSpritePreference, setMegaSpritePreference] = useState(player.megaSpritePreference === "STATIC" ? "STATIC" : "ANIMATED");
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [standbyLoading, setStandbyLoading] = useState(false);
  const [standbyDays, setStandbyDays] = useState<7 | 14 | 30 | 60 | 90>(7);
  const [casualMode, setCasualMode] = useState(player.casualMode);
  const [casualLoading, setCasualLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handleAvatarFile(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }

    if (file.size > 850_000) {
      toast.error("A imagem precisa ter menos de 850 KB por enquanto.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
    reader.onerror = () => toast.error("Nao consegui carregar a imagem.");
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await updatePlayerProfile({
        displayName,
        ptcglNick: ptcglNick || undefined,
        popId: popId || undefined,
        avatarUrl: avatarUrl || undefined,
        mascotSpritePreference: mascotSpritePreference as "ANIMATED" | "STATIC",
        megaSpritePreference: megaSpritePreference as "ANIMATED" | "STATIC",
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

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordLoading(true);
    try {
      const result = await updateOwnPassword({
        currentPassword,
        newPassword,
        confirmPassword
      });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Senha atualizada.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar senha");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleStandbySubmit(e: React.FormEvent) {
    e.preventDefault();
    setStandbyLoading(true);
    try {
      const result = await activateAccountStandby({ days: standbyDays });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Conta colocada em standby.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao ativar standby");
    } finally {
      setStandbyLoading(false);
    }
  }

  async function handleCasualToggle(enabled: boolean) {
    setCasualLoading(true);
    try {
      if (!enabled) {
        const result = await setCasualModeAction(false);
        if (result?.error) { toast.error(result.error); return; }
        setCasualMode(false);
        toast.success("Modo Casual desativado.");
        return;
      }

      const check = await setCasualModeAction(true);
      if (check?.error) { toast.error(check.error); return; }

      if (check?.requiresConfirm) {
        const parts: string[] = [];
        if (check.arenaTeamCount) {
          parts.push(`${check.arenaTeamCount} equipe(s) na Arena Z — cofres serão coletados quando possível e times retirados (cofres bloqueados por lock PvP serão abandonados)`);
        }
        if (check.syncTeamCount) {
          parts.push(`${check.syncTeamCount} dupla(s) no Desafio Sincronizado — serão canceladas e os tickets devolvidos`);
        }
        const ok = window.confirm(
          `Ativar o Modo Casual vai remover:\n\n• ${parts.join("\n• ")}\n\nDeseja continuar?`
        );
        if (!ok) return;

        const result = await setCasualModeAction(true, true);
        if (result?.error) { toast.error(result.error); return; }
        setCasualMode(true);
        toast.success("Modo Casual ativado. Times e duplas removidos.");
      } else {
        setCasualMode(true);
        toast.success("Modo Casual ativado.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar Modo Casual");
    } finally {
      setCasualLoading(false);
    }
  }

  const standbyUntil = player.standbyUntil ? new Date(player.standbyUntil) : null;
  const standbyActive = !!standbyUntil && standbyUntil > new Date();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
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
          Play! Pokémon ID (PopID)
        </label>
        <Input
          value={popId}
          onChange={(e) => setPopId(e.target.value)}
          maxLength={30}
          placeholder="Ex: B1234567 (opcional)"
          className="bg-slate-900/70 border-border text-slate-100"
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Seu ID nos torneios oficiais Pokémon Play! — opcional, apenas para referência.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
          Foto de perfil
        </label>
        <Input
          type="file"
          accept="image/*"
          onChange={(event) => handleAvatarFile(event.target.files?.[0])}
          className="mb-2"
        />
        <Input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="Cole uma URL ou carregue uma imagem acima"
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

      <div className="space-y-3 rounded-2xl border border-border bg-slate-950/50 p-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Visual dos mascotes</h3>
          <p className="mt-1 text-xs text-slate-500">
            Escolha se prefere sprites animados ou imagens estaticas ao navegar pelo jogo.
          </p>
        </div>

        <SpritePreferenceToggle
          label="Mascotes em geral"
          description="Vale para mascotes comuns, raros, lendarios e formas normais."
          value={mascotSpritePreference}
          onChange={setMascotSpritePreference}
        />

        <SpritePreferenceToggle
          label="Mega evolucoes"
          description="Controle separado para as formas mega, que podem ter sprites mais pesados."
          value={megaSpritePreference}
          onChange={setMegaSpritePreference}
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Salvando..." : "Salvar alteracoes"}
      </Button>
    </form>

    <div className="space-y-4">
    <form onSubmit={handlePasswordSubmit} className="space-y-4 rounded-2xl border border-border bg-slate-950/50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Trocar senha</h3>
        <p className="mt-1 text-xs text-slate-500">Use pelo menos 8 caracteres.</p>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
          Senha atual
        </label>
        <Input
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          type="password"
          minLength={8}
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
          Nova senha
        </label>
        <Input
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          type="password"
          minLength={8}
          maxLength={72}
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500">
          Confirmar nova senha
        </label>
        <Input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          type="password"
          minLength={8}
          maxLength={72}
          required
        />
      </div>
      <Button type="submit" disabled={passwordLoading}>
        {passwordLoading ? "Salvando..." : "Atualizar senha"}
      </Button>
    </form>

    <form onSubmit={handleStandbySubmit} className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div>
        <h3 className="text-sm font-semibold text-amber-100">Desativar conta temporariamente</h3>
        <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
          Use quando ficar alguns dias afastado. Durante o standby sua conta nao entra na Liga Semanal e seus mascotes nao perdem fome/felicidade. Depois de ativar, nao e possivel cancelar antes da data.
        </p>
      </div>
      {standbyActive ? (
        <div className="rounded-xl border border-amber-500/30 bg-slate-950/50 p-3 text-xs text-amber-100">
          Standby ativo ate {standbyUntil.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.
        </div>
      ) : (
        <>
          <label className="block text-xs font-medium uppercase tracking-widest text-slate-500">
            Periodo
          </label>
          <select
            value={standbyDays}
            onChange={(event) => setStandbyDays(Number(event.target.value) as 7 | 14 | 30 | 60 | 90)}
            className="w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            {[7, 14, 30, 60, 90].map((days) => (
              <option key={days} value={days}>{days} dias</option>
            ))}
          </select>
          <Button type="submit" disabled={standbyLoading} className="border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20">
            {standbyLoading ? "Ativando..." : "Ativar standby"}
          </Button>
        </>
      )}
    </form>
    <div className="rounded-2xl border border-slate-700/50 bg-slate-950/50 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-white">Modo Casual</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          No Modo Casual voce continua jogando, mas fica fora das Ligas Semanais, batalhas na Arena Z nao movimentam cofres nem geram cooldown para nenhum dos envolvidos, e voce nao pode participar do Desafio Sincronizado. Uma tag &quot;Casual&quot; aparece para todos na arena.
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-300">{casualMode ? "Modo Casual ativo" : "Modo Casual inativo"}</span>
        <button
          type="button"
          disabled={casualLoading}
          onClick={() => handleCasualToggle(!casualMode)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${casualMode ? "bg-sky-500" : "bg-slate-700"}`}
          aria-checked={casualMode}
          role="switch"
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${casualMode ? "translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </div>
    </div>
    </div>
    </div>
  );
}

function SpritePreferenceToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: "ANIMATED" | "STATIC") => void;
}) {
  const isAnimated = value !== "STATIC";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-200">{label}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isAnimated}
          onClick={() => onChange(isAnimated ? "STATIC" : "ANIMATED")}
          className={[
            "relative h-8 w-36 rounded-full border px-1 text-[10px] font-bold uppercase tracking-wide transition",
            isAnimated
              ? "border-[#FFCB05]/50 bg-[#FFCB05]/20 text-[#FFCB05]"
              : "border-slate-700 bg-slate-900 text-slate-300",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-1 h-6 w-16 rounded-full bg-slate-100 transition-transform",
              isAnimated ? "translate-x-[66px]" : "translate-x-0",
            ].join(" ")}
          />
          <span className="relative z-10 grid grid-cols-2">
            <span>Fixo</span>
            <span>Animado</span>
          </span>
        </button>
      </div>
    </div>
  );
}
