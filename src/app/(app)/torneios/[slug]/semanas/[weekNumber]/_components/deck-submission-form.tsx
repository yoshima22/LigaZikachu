"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import {
  Brain,
  Circle,
  Diamond,
  Droplet,
  Dumbbell,
  Flame,
  Heart,
  Leaf,
  Moon,
  Save,
  Shield,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitTournamentWeekDeck } from "../../../../actions";

const pokemonTypes = [
  { value: "Grass", label: "Grama", icon: Leaf, className: "bg-emerald-500 text-emerald-950" },
  { value: "Fire", label: "Fogo", icon: Flame, className: "bg-orange-500 text-orange-950" },
  { value: "Water", label: "Agua", icon: Droplet, className: "bg-sky-500 text-sky-950" },
  { value: "Lightning", label: "Eletrico", icon: Zap, className: "bg-yellow-300 text-yellow-950" },
  { value: "Fighting", label: "Lutador", icon: Dumbbell, className: "bg-amber-700 text-amber-50" },
  { value: "Psychic", label: "Psiquico", icon: Brain, className: "bg-fuchsia-500 text-fuchsia-950" },
  { value: "Colorless", label: "Incolor", icon: Circle, className: "bg-slate-200 text-slate-900" },
  { value: "Darkness", label: "Noturno", icon: Moon, className: "bg-zinc-800 text-zinc-100" },
  { value: "Metal", label: "Metalico", icon: Shield, className: "bg-slate-400 text-slate-950" },
  { value: "Dragon", label: "Dragao", icon: Diamond, className: "bg-indigo-500 text-indigo-50" },
  { value: "Fairy", label: "Fada", icon: Heart, className: "bg-pink-300 text-pink-950" }
];

interface ExistingDeckSubmission {
  deckNumber: number;
  deckName: string;
  archetype: string | null;
  deckList: string;
}

interface DeckSubmissionFormProps {
  tournamentWeekId: string;
  deckNumber: number;
  existingSubmission?: ExistingDeckSubmission | null;
}

export function DeckSubmissionForm({
  tournamentWeekId,
  deckNumber,
  existingSubmission
}: DeckSubmissionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [deckName, setDeckName] = useState(existingSubmission?.deckName ?? "");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    existingSubmission?.archetype
      ? existingSubmission.archetype.split(",").map((item) => item.trim()).filter(Boolean)
      : []
  );
  const [deckList, setDeckList] = useState(existingSubmission?.deckList ?? "");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage(null);

    startTransition(async () => {
      const result = await submitTournamentWeekDeck({
        tournamentWeekId,
        deckNumber,
        deckName,
        archetype: selectedTypes.join(", "),
        deckList
      });

      if (result.error) {
        setMessage({ type: "error", text: result.error });
        toast.error(result.error);
        return;
      }

      const successMessage = existingSubmission ? "Decklist atualizada." : "Decklist enviada.";
      setMessage({ type: "success", text: successMessage });
      toast.success(successMessage);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-slate-950/50 p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Deck {deckNumber}
          </h3>
          <p className="text-xs text-slate-500">
            {existingSubmission ? "Edite a lista enviada para este dia." : "Envie a lista que voce vai usar neste dia."}
          </p>
        </div>
        {existingSubmission && (
          <span className="rounded-full border border-[#7AC74C]/30 bg-[#7AC74C]/10 px-2 py-0.5 text-xs font-semibold text-[#7AC74C]">
            Enviada
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-slate-400">
          <span>Nome do deck</span>
          <input
            value={deckName}
            onChange={(event) => setDeckName(event.target.value)}
            required
            maxLength={120}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
            placeholder="Ex.: Charizard ex"
          />
        </label>
        <div className="space-y-1 text-xs text-slate-400">
          <span>Tipos do deck</span>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-700 bg-slate-950 p-2 sm:grid-cols-3">
            {pokemonTypes.map((type) => {
              const active = selectedTypes.includes(type.value);
              const TypeIcon = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() =>
                    setSelectedTypes((current) =>
                      current.includes(type.value)
                        ? current.filter((item) => item !== type.value)
                        : [...current, type.value]
                    )
                  }
                  className={[
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition",
                    active
                      ? "border-[#FFCB05] bg-[#FFCB05]/10 text-white"
                      : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-600"
                  ].join(" ")}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full ${type.className}`}>
                    <TypeIcon size={14} strokeWidth={2.4} aria-hidden="true" />
                  </span>
                  <span>{type.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-500">Selecione um ou mais tipos presentes no deck.</p>
        </div>
      </div>

      <label className="mt-3 block space-y-1 text-xs text-slate-400">
        <span>Lista completa</span>
        <textarea
          value={deckList}
          onChange={(event) => setDeckList(event.target.value)}
          required
          rows={8}
          maxLength={12000}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 outline-none transition focus:border-[#FFCB05]"
          placeholder="Cole aqui a decklist exportada do PTCG Live"
        />
      </label>

      {message && (
        <p
          className={[
            "mt-3 rounded-lg border px-3 py-2 text-xs",
            message.type === "success"
              ? "border-[#7AC74C]/30 bg-[#7AC74C]/10 text-[#7AC74C]"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          ].join(" ")}
        >
          {message.text}
        </p>
      )}

      <div className="mt-3 flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          <Save size={14} className="mr-1.5" />
          {isPending ? "Salvando..." : existingSubmission ? "Atualizar decklist" : "Enviar decklist"}
        </Button>
      </div>
    </form>
  );
}

