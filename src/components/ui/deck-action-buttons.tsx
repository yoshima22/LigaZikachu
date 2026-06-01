"use client";

import { useState, useTransition } from "react";
import { Copy, Check, BookmarkPlus, BookmarkCheck } from "lucide-react";
import { saveDeckToMyList } from "@/app/(app)/jogadores/actions";

interface Props {
  deckName: string;
  deckList: string;
  archetype?: string;
  /** Se false, esconde o botão de salvar (ex: usuário não logado) */
  canSave?: boolean;
}

export function DeckActionButtons({ deckName, deckList, archetype, canSave = true }: Props) {
  const [copied, setCopied]       = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "exists" | "error">("idle");
  const [pending, startTransition] = useTransition();

  const handleCopy = async () => {
    if (!deckList.trim()) return;
    try {
      await navigator.clipboard.writeText(deckList);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback para browsers sem permissão de clipboard
      const el = document.createElement("textarea");
      el.value = deckList;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = () => {
    if (!deckList.trim() || !deckName.trim()) return;
    setSaveState("saving");
    startTransition(async () => {
      const result = await saveDeckToMyList({ name: deckName, archetype, deckList });
      if (result.alreadyExists) {
        setSaveState("exists");
        setTimeout(() => setSaveState("idle"), 3000);
      } else if (result.error) {
        setSaveState("error");
        setTimeout(() => setSaveState("idle"), 3000);
      } else {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 3000);
      }
    });
  };

  if (!deckList.trim()) return null;

  return (
    <div className="flex items-center gap-1.5">
      {/* Copiar lista */}
      <button
        type="button"
        onClick={handleCopy}
        title="Copiar lista do deck"
        className="flex items-center gap-1 rounded-md border border-border bg-slate-800/60 px-2 py-1 text-[10px] text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors"
      >
        {copied
          ? <><Check size={10} className="text-emerald-400" /> <span className="text-emerald-400">Copiado!</span></>
          : <><Copy size={10} /> Copiar</>
        }
      </button>

      {/* Salvar nos meus decks */}
      {canSave && (
        <button
          type="button"
          disabled={pending || saveState === "saving"}
          onClick={handleSave}
          title="Salvar na minha lista de decks"
          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors disabled:opacity-50 ${
            saveState === "saved"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : saveState === "exists"
              ? "border-slate-600 text-slate-500"
              : saveState === "error"
              ? "border-red-500/30 text-red-400"
              : "border-border bg-slate-800/60 text-slate-400 hover:border-[#FFCB05]/40 hover:text-[#FFCB05]"
          }`}
        >
          {saveState === "saved"    ? <><BookmarkCheck size={10} /> Salvo!</>
          : saveState === "exists"  ? <><BookmarkCheck size={10} /> Já salvo</>
          : saveState === "error"   ? <>Erro ao salvar</>
          : saveState === "saving"  ? <>Salvando…</>
          : <><BookmarkPlus size={10} /> Salvar deck</>}
        </button>
      )}
    </div>
  );
}
