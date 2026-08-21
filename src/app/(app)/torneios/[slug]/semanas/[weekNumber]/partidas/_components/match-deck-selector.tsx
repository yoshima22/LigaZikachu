"use client";

import { useMemo, useState, useTransition } from "react";
import { Award, BookOpen, ChevronDown, ChevronUp, Swords, Trash2, CheckCircle, PawPrint, Search, X } from "lucide-react";
import { POKEMON_TYPE_EMOJIS } from "@/lib/pokemon-types-data";
import { submitDeckForMatch, deleteOwnDeckSubmission } from "../../../../../actions";
import { DeckActionButtons } from "@/components/ui/deck-action-buttons";
import type { MascotMissionOption } from "@/lib/tcg-mascot-mission";
import { validateMascotMissionDeckList } from "@/lib/tcg-mascot-mission-validation";

interface SavedDeckOption {
  id: string;
  name: string;
  archetype: string | null;
  deckList: string;
}

interface ExistingSubmission {
  id: string;
  deckName: string;
  archetype: string | null;
  deckList: string;
  mascotMissionMascotId: string | null;
  mascotMissionPokemonId: number | null;
  mascotMissionMascotName: string | null;
  mascotMissionValid: boolean | null;
  gymBadgeId: string | null;
  gymBadgeName: string | null;
  gymBadgeValid: boolean | null;
}

interface GymBadgeOption { id: string; name: string; imageUrl: string; }

interface Props {
  matchId: string;
  matchNumber: number;
  opponentName: string;
  weekOpen: boolean;
  savedDecks: SavedDeckOption[];
  existingSubmission: ExistingSubmission | null;
  mascotMissionEnabled: boolean;
  mascotOptions: MascotMissionOption[];
  gymBadges: GymBadgeOption[];
}

export function MatchDeckSelector({
  matchId,
  matchNumber,
  opponentName,
  weekOpen,
  savedDecks,
  existingSubmission,
  mascotMissionEnabled,
  mascotOptions,
  gymBadges,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(!existingSubmission);
  const [deckName, setDeckName] = useState(existingSubmission?.deckName ?? "");
  const [deckList, setDeckList] = useState(existingSubmission?.deckList ?? "");
  const [archetype, setArchetype] = useState(existingSubmission?.archetype ?? "");
  const [selectedMascotId, setSelectedMascotId] = useState(existingSubmission?.mascotMissionMascotId ?? "");
  const [mascotQuery, setMascotQuery] = useState("");
  const [mascotPickerOpen, setMascotPickerOpen] = useState(false);
  const [selectedGymBadgeId, setSelectedGymBadgeId] = useState(existingSubmission?.gymBadgeId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const selectedMascot = mascotOptions.find((mascot) => mascot.id === selectedMascotId) ?? null;
  const filteredMascots = useMemo(() => {
    const query = mascotQuery.trim().toLocaleLowerCase("pt-BR");
    return mascotOptions.filter((mascot) => !query || `${mascot.displayName} ${mascot.speciesName} ${mascot.level}`.toLocaleLowerCase("pt-BR").includes(query)).slice(0, 12);
  }, [mascotOptions, mascotQuery]);
  const missionValidation = useMemo(
    () => selectedMascot ? validateMascotMissionDeckList(deckList, selectedMascot.acceptedCardNames) : null,
    [deckList, selectedMascot],
  );

  const loadSavedDeck = (deck: SavedDeckOption) => {
    setDeckName(deck.name);
    setDeckList(deck.deckList);
    setArchetype(deck.archetype ?? "");
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await submitDeckForMatch({
        matchId,
        deckName,
        archetype: archetype || undefined,
        deckList,
        mascotMissionMascotId: selectedMascotId || null,
        gymBadgeId: selectedGymBadgeId || null,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setOpen(false);
      }
    });
  };

  const handleDelete = () => {
    if (!existingSubmission) return;
    if (!window.confirm("Remover deck desta partida?")) return;
    startTransition(async () => {
      const result = await deleteOwnDeckSubmission(existingSubmission.id);
      if (result.error) {
        setError(result.error);
      } else {
        setDeckName(""); setDeckList(""); setArchetype(""); setSelectedMascotId(""); setSelectedGymBadgeId("");
        setSuccess(false);
        setOpen(true);
      }
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-indigo-950/30 shadow-xl shadow-black/10">
      {/* Header da partida */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-slate-800/40"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-400">
            {matchNumber}
          </span>
          <Swords size={13} className="shrink-0 text-slate-500" />
          <span className="text-sm font-medium text-white truncate">vs {opponentName}</span>
          {existingSubmission && !open && (
            <span className="shrink-0 flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-400">
              <CheckCircle size={10} /> {existingSubmission.deckName}
            </span>
          )}
          {existingSubmission?.mascotMissionMascotName && !open && (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${existingSubmission.mascotMissionValid ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-amber-400/30 bg-amber-500/10 text-amber-300"}`}>
              Mascote: {existingSubmission.mascotMissionMascotName}
            </span>
          )}
          {existingSubmission?.gymBadgeName && !open && (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${existingSubmission.gymBadgeValid === true ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : existingSubmission.gymBadgeValid === false ? "border-red-400/30 bg-red-500/10 text-red-300" : "border-amber-400/30 bg-amber-500/10 text-amber-300"}`}>
              Jornada: {existingSubmission.gymBadgeName} · {existingSubmission.gymBadgeValid === true ? "valida" : existingSubmission.gymBadgeValid === false ? "invalida" : "em revisao"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!existingSubmission && weekOpen && (
            <span className="text-[10px] text-amber-400 border border-amber-400/30 rounded-full px-2 py-0.5">
              Deck pendente
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      {/* Formulário */}
      {open && (
        <div className="space-y-4 border-t border-slate-700/70 px-4 py-5">
          {existingSubmission && (
            <div className="flex items-start justify-between gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-emerald-400">Deck registrado</p>
                <p className="text-[11px] text-slate-400">{existingSubmission.deckName}{existingSubmission.archetype ? ` · ${existingSubmission.archetype}` : ""}</p>
              </div>
              {weekOpen && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleDelete}
                  className="shrink-0 flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={10} /> Remover
                </button>
              )}
            </div>
          )}

          {weekOpen && (
            <>
              {/* Selecionar deck salvo */}
              {savedDecks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <BookOpen size={10} /> Selecionar dos meus decks
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {savedDecks.map(d => {
                      const types = d.archetype
                        ? d.archetype.split(/[,/]/).map(t => t.trim().toLowerCase()).filter(Boolean)
                        : [];
                      const selected = deckName === d.name;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => loadSavedDeck(d)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            selected
                              ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 text-[#FFCB05]"
                              : "border-border text-slate-400 hover:border-slate-500 hover:text-slate-200"
                          }`}
                        >
                          {types.slice(0, 3).map((t, i) => {
                            const emoji = (POKEMON_TYPE_EMOJIS as Record<string, string>)[t];
                            return emoji ? <span key={i}>{emoji}</span> : null;
                          })}
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Campos do deck */}
              <div className="space-y-2">
                {gymBadges.length > 0 && (
                  <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
                    <label className="space-y-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1 font-semibold uppercase tracking-wide text-amber-300"><Award size={11} /> Jornada de Ginasio (opcional)</span>
                      <span className="block leading-4 text-slate-500">Sinalize qual insignia este deck monotipo busca. A organizacao valida a lista antes de liberar progresso.</span>
                      <select
                        value={selectedGymBadgeId}
                        onChange={(event) => { setSelectedGymBadgeId(event.target.value); setSuccess(false); }}
                        className="w-full rounded-lg border border-amber-400/25 bg-slate-950 px-2.5 py-2 text-xs text-slate-100 outline-none focus:border-amber-400"
                      >
                        <option value="">Nao usar este deck em uma Jornada</option>
                        {gymBadges.map((badge) => <option key={badge.id} value={badge.id}>{badge.name}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                {mascotMissionEnabled && (
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                    <label className="space-y-1 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1 font-semibold uppercase tracking-wide text-emerald-300"><PawPrint size={11} /> Missão de Mascote (opcional)</span>
                      <span className="block text-[10px] leading-4 text-slate-500">A validação acontece agora, mas a EXP da missão só é entregue quando o dia for oficialmente encerrado.</span>
                      <span className="relative block">
                        <Search size={14} className="pointer-events-none absolute left-3 top-3 text-emerald-300/60" />
                        <input
                          value={mascotQuery}
                          onFocus={() => setMascotPickerOpen(true)}
                          onChange={(event) => { setMascotQuery(event.target.value); setMascotPickerOpen(true); }}
                          placeholder={selectedMascot ? `${selectedMascot.displayName} (${selectedMascot.speciesName})` : "Buscar mascote por nome ou espécie..."}
                          className="w-full rounded-xl border border-emerald-400/25 bg-slate-950 py-2.5 pl-9 pr-10 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400"
                        />
                        {(selectedMascot || mascotQuery) && <button type="button" onClick={() => { setSelectedMascotId(""); setMascotQuery(""); setMascotPickerOpen(false); setSuccess(false); }} className="absolute right-2.5 top-2.5 rounded p-0.5 text-slate-500 hover:text-white" aria-label="Remover mascote"><X size={15}/></button>}
                        {mascotPickerOpen && <span className="absolute z-30 mt-1 block max-h-72 w-full overflow-y-auto rounded-xl border border-emerald-400/25 bg-slate-950 p-1.5 shadow-2xl">
                          <button type="button" onClick={() => { setSelectedMascotId(""); setMascotQuery(""); setMascotPickerOpen(false); }} className="mb-1 flex w-full rounded-lg px-3 py-2 text-left text-[11px] text-slate-400 hover:bg-slate-800">Não participar da missão neste deck</button>
                          {filteredMascots.map((mascot) => <button key={mascot.id} type="button" onClick={() => { setSelectedMascotId(mascot.id); setMascotQuery(""); setMascotPickerOpen(false); setSuccess(false); }} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-emerald-400/10 ${selectedMascotId === mascot.id ? "bg-emerald-400/10" : ""}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}<img src={mascot.spriteUrl} alt="" className="h-10 w-10 shrink-0 object-contain" />
                            <span className="min-w-0"><b className="block truncate text-xs text-white">{mascot.displayName}</b><small className="block truncate text-[10px] text-slate-500">{mascot.speciesName} · Nv.{mascot.level}</small></span>
                          </button>)}
                          {filteredMascots.length === 0 && <span className="block px-3 py-4 text-center text-[11px] text-slate-500">Nenhum mascote encontrado.</span>}
                        </span>}
                      </span>
                    </label>
                    {selectedMascot && (
                      <div className="mt-3 flex items-start gap-3 rounded-lg border border-slate-700/70 bg-slate-950/70 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedMascot.spriteUrl} alt={selectedMascot.displayName} className="h-14 w-14 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white">{selectedMascot.displayName} <span className="font-normal text-slate-500">({selectedMascot.speciesName})</span></p>
                          <p className="mt-1 text-[10px] leading-4 text-slate-500">Linha aceita: {selectedMascot.acceptedCardNames.join(", ")}</p>
                          <p className={`mt-2 rounded-md border px-2 py-1.5 text-[10px] font-semibold ${missionValidation?.valid ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-red-400/30 bg-red-500/10 text-red-300"}`}>
                            {missionValidation?.valid
                              ? `✓ Deck válido para a missão. Encontrado: ${missionValidation.matchedCardNames.join(", ")}.`
                              : "Deck ainda não é válido: nenhuma carta da espécie ou linha evolutiva foi encontrada."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-[10px] text-slate-400">
                    <span>Nome do deck *</span>
                    <input
                      value={deckName}
                      onChange={e => { setDeckName(e.target.value); setSuccess(false); }}
                      placeholder="Ex: Charizard ex"
                      className="w-full rounded-lg border border-border bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05]"
                    />
                  </label>
                  <label className="space-y-1 text-[10px] text-slate-400">
                    <span>Arquétipo (opcional)</span>
                    <input
                      value={archetype}
                      onChange={e => { setArchetype(e.target.value); setSuccess(false); }}
                      placeholder="Ex: Fogo"
                      className="w-full rounded-lg border border-border bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05]"
                    />
                  </label>
                </div>
                <label className="space-y-1 text-[10px] text-slate-400 block">
                  <div className="flex items-center justify-between mb-1">
                    <span>Lista do deck *</span>
                    {/* Botões: copiar + salvar nos meus decks */}
                    <DeckActionButtons
                      deckName={deckName}
                      deckList={deckList}
                      archetype={archetype}
                    />
                  </div>
                  <textarea
                    value={deckList}
                    onChange={e => { setDeckList(e.target.value); setSuccess(false); }}
                    placeholder={"Pokémon: 4\n4 Charizard ex OBF 125\n...\nTreinador: ...\nEnergia: ..."}
                    rows={6}
                    className="w-full rounded-lg border border-border bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05] font-mono resize-none"
                  />
                </label>
              </div>

              {error && <p className="text-[11px] text-red-400">{error}</p>}
              {success && <p className="text-[11px] text-emerald-400">✓ Deck registrado com sucesso!{selectedMascot ? (missionValidation?.valid ? " Missão de Mascote validada." : " A missão ficou registrada como não elegível.") : ""}</p>}

              <button
                type="button"
                disabled={pending || !deckName.trim() || !deckList.trim()}
                onClick={handleSubmit}
                className="w-full rounded-lg bg-[#FFCB05] py-2 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? "Salvando…" : existingSubmission ? "Atualizar deck" : "Registrar deck para esta partida"}
              </button>
            </>
          )}

          {!weekOpen && !existingSubmission && (
            <p className="text-[11px] text-slate-500">Prazo encerrado — deck não enviado para esta partida.</p>
          )}
        </div>
      )}
    </div>
  );
}
