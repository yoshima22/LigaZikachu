"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitTournamentWeekDeck } from "../../../../actions";

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
  const [archetype, setArchetype] = useState(existingSubmission?.archetype ?? "");
  const [deckList, setDeckList] = useState(existingSubmission?.deckList ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await submitTournamentWeekDeck({
        tournamentWeekId,
        deckNumber,
        deckName,
        archetype,
        deckList
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(existingSubmission ? "Decklist atualizada." : "Decklist enviada.");
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
        <label className="space-y-1 text-xs text-slate-400">
          <span>Arquetipo</span>
          <input
            value={archetype}
            onChange={(event) => setArchetype(event.target.value)}
            maxLength={120}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[#FFCB05]"
            placeholder="Opcional"
          />
        </label>
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

      <div className="mt-3 flex justify-end">
        <Button type="submit" size="sm" disabled={isPending}>
          <Save size={14} className="mr-1.5" />
          {isPending ? "Salvando..." : existingSubmission ? "Atualizar decklist" : "Enviar decklist"}
        </Button>
      </div>
    </form>
  );
}

