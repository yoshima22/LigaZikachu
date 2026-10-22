import type { TowerRoomNode } from "./rooms";

export type TowerRouteIntel = { signal: string; opportunity: string; risk: string };

/** Clues may describe a room's category and position, never its hidden contents. */
export function getTowerRouteIntel(
  room: Pick<TowerRoomNode, "kind" | "index"> & { puzzle?: { id: string } },
  context: { allyNames?: string[] } = {},
): TowerRouteIntel {
  const position = ["superior", "central", "inferior"][room.index % 3];
  const ally = context.allyNames?.length ? ` ${context.allyNames.join(" e ")} já está nessa passagem.` : "";
  const puzzleSignal = room.puzzle?.id === "bells" ? "Sinos" : room.puzzle?.id === "mirror" ? "Espelhos" : "Runas";
  const clues: Record<TowerRoomNode["kind"], TowerRouteIntel> = {
    ENTRANCE: { signal: "Luz da entrada", opportunity: "Retornar ao ponto conhecido.", risk: "O retorno consome uma ação da expedição." },
    COMBAT: {
      signal: `Passos e metal no corredor ${position}`,
      opportunity: "Possível confronto com uma patrulha da Torre.",
      risk: `Combate pode causar baixas. Prévia da patrulha: +${room.index * 2} níveis sobre a média calculada pela Torre.`,
    },
    PUZZLE: { signal: `${puzzleSignal} no corredor ${position}`, opportunity: "Um mecanismo pode abrir a passagem.", risk: "Uma resposta errada pode aumentar a Pressão." },
    REST: { signal: `Calor de uma chama no corredor ${position}`, opportunity: "Interagir pode recuperar parte do HP.", risk: "Usar a chama aumenta a Pressão da Torre." },
    RECOVERY: { signal: `Sinais de enfermaria no corredor ${position}`, opportunity: "Pode reerguer um treinador caído, se a sala estiver disponível.", risk: "O uso é compartilhado e só recarrega após dois andares." },
    EVENT: { signal: `Movimento incomum no corredor ${position}`, opportunity: "Pode haver uma interação ou descoberta.", risk: "O resultado ainda é desconhecido." },
    RESCUE: { signal: `Marcas de contenção no corredor ${position}`, opportunity: "Pode haver resgate, se houver mascotes retidos.", risk: "As jaulas podem estar vazias." },
    LUCK: { signal: `Brilho instável no corredor ${position}`, opportunity: "Pode haver um achado para investigar.", risk: "Nada garante um item ou raridade específica." },
    BOSS: { signal: "Presença forte adiante", opportunity: "Confronto decisivo do andar.", risk: "Todos os treinadores vivos precisam se reunir." },
  };
  const clue = clues[room.kind];
  return { ...clue, opportunity: clue.opportunity + ally };
}
