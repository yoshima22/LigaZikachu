import type { MascotPersonality, Prisma } from "@prisma/client";
import { getPokemonName } from "@/lib/mascot-data";
import { clampScore, relationTypeFromScore } from "@/lib/mascot-bonds";

export const REFUGE_LOCATIONS = {
  GARDEN: { label: "Horta", icon: "🌱", capacity: 4, accent: "emerald", purpose: "Comida, cuidado e cooperação" },
  TRAINING: { label: "Campo de Treino", icon: "🥊", capacity: 3, accent: "amber", purpose: "EXP leve, motivação e rivalidade" },
  REST: { label: "Área de Descanso", icon: "🌙", capacity: 4, accent: "sky", purpose: "Recuperação, conforto e reconciliação" },
  YARD: { label: "Pátio", icon: "✨", capacity: 6, accent: "violet", purpose: "Novos encontros e interação social" },
} as const;

export type RefugeLocation = keyof typeof REFUGE_LOCATIONS;

export function relationTierV2(score: number) {
  if (score <= -80) return "Nêmesis";
  if (score <= -50) return "Inimigo";
  if (score <= -15) return "Rival";
  if (score <= 14) return "Conhecido";
  if (score <= 39) return "Colega";
  if (score <= 79) return "Amigo";
  return "Super Amigo";
}

export function relationEffectV2(score: number) {
  if (score <= -80) return "Acerto de Contas: confronto especial e visível contra este Nêmesis.";
  if (score <= -50) return "Tenho Algo a Provar: bônus ofensivo situacional apenas contra este Inimigo.";
  if (score <= -15) return "Motivação: conquistas deste Rival podem inspirar treino e revanche.";
  if (score <= 14) return "Sem efeito mecânico; novas experiências definem o rumo da relação.";
  if (score <= 39) return "Cooperação leve e chance de felicidade em atividades conjuntas.";
  if (score <= 79) return "Parceiros: bônus limitado em treino e expedições simultâneas.";
  return "Super Amigos: melhor bônus elegível de jornada, treino e apoio emocional.";
}

function names(mascots: Array<{ pokemonId: number; nickname: string | null }>) {
  return mascots.map((m) => m.nickname ?? getPokemonName(m.pokemonId));
}

function socialDelta(location: RefugeLocation, personality: MascotPersonality) {
  if (location === "TRAINING") return personality === "COMPETITIVE" ? -5 : -2;
  if (location === "REST") return personality === "SERENE" || personality === "TIMID" ? 5 : 3;
  if (location === "GARDEN") return personality === "GLUTTON" ? -2 : 4;
  return personality === "PLAYFUL" || personality === "CURIOUS" ? 5 : 3;
}

/** Processador experimental isolado: só é chamado pelas ações administrativas da prévia. */
export async function simulateRefugeMoment(tx: Prisma.TransactionClient, playerId: string, location: RefugeLocation) {
  const definition = REFUGE_LOCATIONS[location];
  const routines = await tx.mascotRoutine.findMany({
    where: { playerId, locationType: location, status: "ACTIVE" },
    orderBy: { startedAt: "asc" },
    take: definition.capacity,
    include: { mascot: { select: { id: true, pokemonId: true, nickname: true, personality: true } } },
  });
  if (routines.length === 0) throw new Error(`Coloque pelo menos um mascote em ${definition.label}.`);

  const first = routines[0].mascot;
  const second = routines[1]?.mascot ?? null;
  const [firstName, secondName] = names([first, ...(second ? [second] : [])]);
  const delta = second ? socialDelta(location, first.personality) : 0;
  const descriptions: Record<RefugeLocation, string> = {
    GARDEN: second ? `${firstName} e ${secondName} cuidaram da Horta. A divisão da colheita revelou como os dois convivem.` : `${firstName} cuidou da Horta e separou parte da produção.`,
    TRAINING: second ? `${firstName} desafiou ${secondName} para uma sessão competitiva no Campo de Treino.` : `${firstName} treinou por conta própria e saiu mais determinado.`,
    REST: second ? `${firstName} e ${secondName} dividiram um momento tranquilo na Área de Descanso.` : `${firstName} encontrou tempo para recuperar o ânimo.`,
    YARD: second ? `${firstName} e ${secondName} se encontraram no Pátio e passaram a prestar mais atenção um no outro.` : `${firstName} explorou o Pátio à procura de companhia.`,
  };

  if (second) {
    const current = await tx.mascotRelation.findUnique({
      where: { mascotAId_mascotBId: { mascotAId: first.id, mascotBId: second.id } },
      select: { relationshipScore: true },
    });
    const next = clampScore((current?.relationshipScore ?? 0) + delta);
    await tx.mascotRelation.upsert({
      where: { mascotAId_mascotBId: { mascotAId: first.id, mascotBId: second.id } },
      update: { relationshipScore: next, type: relationTypeFromScore(next), interactionCount: { increment: 1 }, lastInteractionAt: new Date(), isActive: true, dormantAt: null },
      create: { mascotAId: first.id, mascotBId: second.id, relationshipScore: next, type: relationTypeFromScore(next), interactionCount: 1, lastInteractionAt: new Date() },
    });
  }

  await tx.mascotBondMemory.create({
    data: {
      mascotAId: first.id,
      mascotBId: second?.id,
      memoryType: location === "TRAINING" ? "TREINARAM_JUNTOS" : location === "GARDEN" ? "TRABALHARAM_JUNTOS" : location === "REST" ? "DESCANSARAM_JUNTOS" : "ENCONTRO_NO_PATIO",
      sourceType: "REFUGE",
      title: `${definition.icon} ${definition.label}`,
      description: descriptions[location],
      intensity: Math.abs(delta) >= 5 ? 2 : 1,
      metadata: { location, scoreDelta: delta },
    },
  });
  await tx.mascotRoutine.updateMany({
    where: { id: { in: routines.map((routine) => routine.id) } },
    data: { accumulatedUnits: { increment: 1 }, lastProcessedAt: new Date() },
  });

  return { description: descriptions[location], delta, participants: routines.length };
}
