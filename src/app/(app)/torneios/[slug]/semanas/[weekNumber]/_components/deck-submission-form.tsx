"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PokemonTypeSelector } from "@/components/ui/pokemon-type-selector";
import { submitTournamentWeekDeck } from "../../../../actions";

interface ExistingDeckSubmission {
  deckNumber: number;
  deckName: string;
  archetype: string | null;
  deckList: string;
}

interface SavedDeckOption {
  id: string;
  name: string;
  archetype: string | null;
  deckList: string;
}

interface DeckSubmissionFormProps {
  tournamentWeekId: string;
  deckNumber: number;
  existingSubmission?: ExistingDeckSubmission | null;
  savedDecks?: SavedDeckOption[];
}

export function DeckSubmissionForm({
  tournamentWeekId,
  deckNumber,
  existingSubmission,
  savedDecks = []
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
      {savedDecks.length > 0 && (
        <div className="mb-3">
          <label className="block space-y-1 text-xs text-slate-400">
            <span>Carregar deck salvo</span>
            <select
              onChange={(e) => {
                const d = savedDecks.find((s) => s.id === e.target.value);
                if (d) {
                  setDeckName(d.name);
                  setDeckList(d.deckList);
                  setSelectedTypes(d.archetype ? d.archetype.split(",").map((t) => t.trim()).filter(Boolean) : []);
                }
              }}
              defaultValue=""
              className="w-full rounded-lg border border-[#FFCB05]/30 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
            >
              <option value="">— Preencher manualmente —</option>
              {savedDecks.map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.archetype ? ` (${d.archetype})` : ""}</option>
              ))}
            </select>
          </label>
        </div>
      )}

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
        <PokemonTypeSelector selected={selectedTypes} onChange={setSelectedTypes} />
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

