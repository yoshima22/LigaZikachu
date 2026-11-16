"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AbilityAllocator, type AllocMascot } from "@/components/ability-lineup";
import { availableAbilities, resolveAbilitySlug, sortByAbilityOrder } from "@/lib/abilities";
import { setArenaTeamAbilitiesAction } from "../actions";

export type TeamAbilityMember = {
  id: string;
  name: string;
  pokemonId: number;
  slot: number;
  abilityChoice: string | null;
  hiddenAbilityUnlocked: boolean;
  stats: { force: number; agility: number; charisma: number; instinct: number; vitality: number };
};

/** Montagem de habilidades de uma equipe já criada (mesmo componente dos outros modos). */
export function TeamAbilityEditor({
  teamId, members, initialOrder, debug = false,
}: { teamId: string; members: TeamAbilityMember[]; initialOrder: string[] | null; debug?: boolean }) {
  const [pending, start] = useTransition();
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<string[] | null>(initialOrder);
  const [dirty, setDirty] = useState(false);

  const mascots: AllocMascot[] = sortByAbilityOrder(members, order).map((m) => {
    const options = availableAbilities(m.pokemonId, m.hiddenAbilityUnlocked, "REAL");
    const preferred = resolveAbilitySlug({ pokemonId: m.pokemonId, choice: m.abilityChoice, hiddenUnlocked: m.hiddenAbilityUnlocked, mode: "REAL" });
    return {
      id: m.id, name: m.name, pokemonId: m.pokemonId, slot: m.slot, stats: m.stats, options, preferred,
      ability: resolveAbilitySlug({ pokemonId: m.pokemonId, choice: picks[m.id] ?? m.abilityChoice, hiddenUnlocked: m.hiddenAbilityUnlocked, mode: "REAL" }),
    };
  });

  return (
    <details className="group mt-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[11px] font-semibold text-fuchsia-200">
        <span>✨ Habilidades da equipe</span>
        <span className="text-[10px] text-fuchsia-300/70">escolha e prioridade</span>
      </summary>
      <div className="space-y-2 border-t border-fuchsia-500/15 p-3">
        <AbilityAllocator
          mascots={mascots}
          debug={debug}
          onReorder={(ids) => { setOrder(ids); setDirty(true); }}
          onChangeAbility={(id, slug) => { setPicks((p) => ({ ...p, [id]: slug })); setDirty(true); }}
        />
        <button
          type="button"
          disabled={pending || !dirty}
          onClick={() => start(async () => {
            const r = await setArenaTeamAbilitiesAction(teamId, picks, order ?? mascots.map((m) => m.id));
            if (r.error) toast.error(r.error);
            else { toast.success("Habilidades da equipe salvas."); setDirty(false); }
          })}
          className="rounded-lg border border-fuchsia-400/40 bg-fuchsia-400/10 px-3 py-1.5 text-[11px] font-bold text-fuchsia-200 disabled:opacity-40"
        >
          {pending ? "Salvando…" : "Salvar habilidades"}
        </button>
      </div>
    </details>
  );
}
