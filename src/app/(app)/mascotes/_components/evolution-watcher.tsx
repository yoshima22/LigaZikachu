"use client";

import { useEffect, useState } from "react";
import { EvolutionAnimation } from "@/components/mascot/evolution-animation";
import { EVOLUTION_REVERSE_MAP } from "@/lib/mascot-data";
import { getMascotFormsAction } from "../actions";
import { getMegaStoneForMegaPokemon } from "@/lib/mega-evolution";

type Seen = { id: string; pokemonId: number };
type Queued = { key: string; mascotId: string; from: number; to: number; mega: boolean; stoneName?: string };

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
    let cancelled = false;
    // Busca todos os mascotes (inclui o banco); se falhar, usa só os do time.
    getMascotFormsAction().catch(() => mascots).then((all) => { if (!cancelled) check(all.length ? all : mascots); });
    return () => { cancelled = true; };

    function check(list: Seen[]) {
    const storageKey = `evo-seen:${playerId}`;
    try {
      const raw = localStorage.getItem(storageKey);
      const prev: Record<string, number> | null = raw ? JSON.parse(raw) : null;
      const next: Record<string, number> = { ...(prev ?? {}) };
      const found: Queued[] = [];
      for (const m of list) {
        const was = prev?.[m.id];
        if (was !== undefined && was !== m.pokemonId) {
          const stone = getMegaStoneForMegaPokemon(m.pokemonId);
          if (stone && stone.compatiblePokemonId === was) {
            found.push({ key: `${m.id}:${m.pokemonId}`, mascotId: m.id, from: was, to: m.pokemonId, mega: true, stoneName: stone.stoneName });
          } else if (isForwardEvolution(was, m.pokemonId)) {
            found.push({ key: `${m.id}:${m.pokemonId}`, mascotId: m.id, from: was, to: m.pokemonId, mega: false });
          }
        }
        // Quem vai animar só vira "visto" ao fechar a animação (recarregar no meio da fila não perde as restantes).
        if (!found.some((f) => f.mascotId === m.id)) next[m.id] = m.pokemonId;
      }
      localStorage.setItem(storageKey, JSON.stringify(next));
      if (found.length) setQueue((q) => [...q, ...found.filter((f) => !q.some((x) => x.key === f.key))]);
    } catch {
      // sem localStorage: sem animação, nada quebra
    }
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
      onClose={() => {
        try {
          const key = `evo-seen:${playerId}`;
          const map = JSON.parse(localStorage.getItem(key) ?? "{}");
          map[current.mascotId] = current.to;
          localStorage.setItem(key, JSON.stringify(map));
        } catch {}
        setQueue((q) => q.slice(1));
      }}
    />
  );
}
