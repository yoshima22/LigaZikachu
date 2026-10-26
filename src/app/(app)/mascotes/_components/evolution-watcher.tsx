"use client";

import { useEffect, useState } from "react";
import { EvolutionAnimation } from "@/components/mascot/evolution-animation";
import { EVOLUTION_REVERSE_MAP } from "@/lib/mascot-data";
import { getMegaStoneForMegaPokemon } from "@/lib/mega-evolution";

type Seen = { id: string; pokemonId: number };
type Queued = { key: string; from: number; to: number; mega: boolean; stoneName?: string };

// `from` está na linha evolutiva que leva a `to`? (exclui desevoluções, ex.: Pena Arco-Íris)
function isForwardEvolution(from: number, to: number) {
  const seen = new Set<number>();
  const stack = [to];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const evo of EVOLUTION_REVERSE_MAP.get(cur) ?? []) {
      if (evo.from === from) return true;
      if (!seen.has(evo.from)) { seen.add(evo.from); stack.push(evo.from); }
    }
  }
  return false;
}

/**
 * Toca a animação quando um mascote evoluiu/mega evoluiu desde a última visita.
 * Compara o pokemonId atual com o último visto neste navegador (localStorage);
 * a primeira visita e mascotes novos só gravam a base, sem animar.
 */
export function EvolutionWatcher({ playerId, mascots }: { playerId: string; mascots: Seen[] }) {
  const [queue, setQueue] = useState<Queued[]>([]);

  useEffect(() => {
    const storageKey = `evo-seen:${playerId}`;
    try {
      const raw = localStorage.getItem(storageKey);
      const prev: Record<string, number> | null = raw ? JSON.parse(raw) : null;
      const next: Record<string, number> = { ...(prev ?? {}) };
      const found: Queued[] = [];
      for (const m of mascots) {
        const was = prev?.[m.id];
        if (was !== undefined && was !== m.pokemonId) {
          const stone = getMegaStoneForMegaPokemon(m.pokemonId);
          if (stone && stone.compatiblePokemonId === was) {
            found.push({ key: `${m.id}:${m.pokemonId}`, from: was, to: m.pokemonId, mega: true, stoneName: stone.stoneName });
          } else if (isForwardEvolution(was, m.pokemonId)) {
            found.push({ key: `${m.id}:${m.pokemonId}`, from: was, to: m.pokemonId, mega: false });
          }
        }
        next[m.id] = m.pokemonId;
      }
      localStorage.setItem(storageKey, JSON.stringify(next));
      if (found.length) setQueue(found);
    } catch {
      // sem localStorage: sem animação, nada quebra
    }
  }, [playerId, mascots]);

  const current = queue[0];
  if (!current) return null;
  return (
    <EvolutionAnimation
      key={current.key}
      fromId={current.from}
      toId={current.to}
      mega={current.mega}
      stoneName={current.stoneName}
      onClose={() => setQueue((q) => q.slice(1))}
    />
  );
}
