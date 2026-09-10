import type { MascotPersonality, Prisma } from "@prisma/client";
import { getPokemonName } from "@/lib/mascot-data";
import { clampScore, relationTypeFromScore, type BondOption } from "@/lib/mascot-bonds";

export const REFUGE_LOCATIONS = {
  GARDEN: { label: "Horta", icon: "🌱", capacity: 4, accent: "emerald", purpose: "Comida, cuidado e cooperação", impact: "Favorece amizade (+4). Mascotes Gulosos podem iniciar disputas (-2)." },
  TRAINING: { label: "Campo de Treino", icon: "🥊", capacity: 3, accent: "amber", purpose: "EXP leve, motivação e rivalidade", impact: "Favorece rivalidade (-2). Competitivos intensificam o desafio (-5)." },
  REST: { label: "Área de Descanso", icon: "🌙", capacity: 4, accent: "sky", purpose: "Recuperação, conforto e reconciliação", impact: "Aproxima relações (+3). Serenos e Tímidos recebem efeito maior (+5)." },
  YARD: { label: "Pátio", icon: "✨", capacity: 6, accent: "violet", purpose: "Novos encontros e interação social", impact: "Cria aproximações (+3). Brincalhões e Curiosos interagem mais (+5)." },
} as const;

export type RefugeLocation = keyof typeof REFUGE_LOCATIONS;
export { BONDS_V2_BALANCE } from "@/lib/mascot-bonds-v2-balance";

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
  if (score <= -80) return "Acerto de Contas: ambos causam +8% de dano um contra o outro nos 3 primeiros turnos de confronto direto.";
  if (score <= -50) return "Tenho Algo a Provar: +5% de dano apenas contra este Inimigo específico.";
  if (score <= -15) return "Motivação: conquistas deste Rival podem inspirar treino e revanche, no máximo uma vez por mascote ao dia.";
  if (score <= 14) return "Sem efeito mecânico; novas experiências definem o rumo da relação.";
  if (score <= 39) return "Colega: participa de histórias e interações, sem bônus numérico fixo.";
  if (score <= 79) return "Amigo: −3% no tempo de expedições simultâneas e +5% de EXP quando treinam juntos.";
  return "Super Amigo: −7% no tempo de expedições simultâneas e +10% de EXP quando treinam juntos.";
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

const OPENINGS = [
  "Sem chamar atenção dos treinadores,", "Durante uma pausa na rotina,", "Quando o movimento do local diminuiu,",
  "Depois de observarem um ao outro por algum tempo,", "No meio de uma tarefa aparentemente comum,",
];

const REACTIONS: Record<RefugeLocation, string[]> = {
  GARDEN: ["a divisão da colheita virou assunto", "um alimento desapareceu antes da hora", "uma tarefa difícil exigiu cooperação", "os dois discordaram sobre quem havia trabalhado mais"],
  TRAINING: ["um desafio amistoso ficou sério", "uma provocação exigiu resposta", "a diferença de desempenho ficou evidente", "um pedido de revanche mudou o clima"],
  REST: ["uma tentativa de consolo foi bem recebida", "uma brincadeira interrompeu o silêncio", "uma mágoa antiga voltou à conversa", "um deles percebeu que o outro precisava de companhia"],
  YARD: ["uma brincadeira improvisada reuniu curiosos", "uma disputa por atenção começou", "um encontro inesperado despertou admiração", "um comentário atravessado criou tensão"],
};

function pick<T>(items: T[]) { return items[Math.floor(Math.random() * items.length)]; }

function importantOptions(location: RefugeLocation, conflict: boolean, firstName: string, secondName: string): BondOption[] {
  if (conflict) return [
    { id: "channel_rivalry", intention: "Transformar tensão em motivação", label: `Propor um desafio com regras claras`, outcomePreview: `${firstName} e ${secondName} mantêm a rivalidade saudável e criam uma promessa de revanche.`, type: "AGGRESSIVE", scoreDelta: -5, scoreDeltaB: -2, expA: location === "TRAINING" ? 18 : 8 },
    { id: "listen_both", intention: "Compreender antes de decidir", label: "Ouvir a versão de cada mascote", outcomePreview: "A tensão diminui sem apagar o motivo do conflito; os dois ganham respeito em ritmos diferentes.", type: "NEUTRAL", scoreDelta: 2, scoreDeltaB: 4 },
    { id: "repair_together", intention: "Reconstruir confiança", label: "Dar aos dois uma tarefa cooperativa", outcomePreview: "A convivência melhora e esta discussão vira uma memória de reconciliação.", type: "POSITIVE", cost: { kind: "FOOD", quantity: 1 }, scoreDelta: 7, scoreDeltaB: 5, happinessA: 3, happinessB: 3 },
    { id: "let_them_settle", intention: "Confiar na personalidade deles", label: "Não interferir e observar a consequência", outcomePreview: "Sem custo. Cada mascote reage de acordo com sua personalidade e a rivalidade pode se intensificar.", type: "NEUTRAL", scoreDelta: -1, scoreDeltaB: 1 },
  ];
  return [
    { id: "celebrate_bond", intention: "Reconhecer a aproximação", label: "Celebrar o momento com os dois", outcomePreview: "Fortalece a amizade nas duas direções e registra uma lembrança positiva.", type: "POSITIVE", cost: { kind: "SWEET", quantity: 1 }, scoreDelta: 7, scoreDeltaB: 5, happinessA: 4, happinessB: 3 },
    { id: "encourage_independence", intention: "Estimular sem forçar", label: "Sugerir que repitam a atividade juntos", outcomePreview: "Cria uma oportunidade futura e aproxima mais o mascote que tomou a iniciativa.", type: "POSITIVE", scoreDelta: 4, scoreDeltaB: 2 },
    { id: "ask_meaning", intention: "Entender o que isso significou", label: `Conversar separadamente com ${firstName}`, outcomePreview: "Revela uma interpretação pessoal e pode transformar admiração em motivação.", type: "NEUTRAL", scoreDelta: 3, scoreDeltaB: 0, expA: 6 },
    { id: "preserve_moment", intention: "Deixar acontecer naturalmente", label: "Guardar a memória sem interferir", outcomePreview: "Sem custo. O acontecimento entra no diário, mas a relação muda pouco.", type: "NEUTRAL", scoreDelta: 1, scoreDeltaB: 1 },
  ];
}

/** Processador experimental isolado: só é chamado pelas ações administrativas da prévia. */
export async function simulateRefugeMoment(tx: Prisma.TransactionClient, playerId: string, location: RefugeLocation) {
  const definition = REFUGE_LOCATIONS[location];
  const ownRoutines = await tx.mascotRoutine.findMany({
    where: { playerId, locationType: location, status: "ACTIVE" },
    orderBy: { startedAt: "asc" },
    take: definition.capacity,
    include: { mascot: { select: { id: true, playerId: true, pokemonId: true, nickname: true, personality: true } } },
  });
  if (ownRoutines.length === 0) throw new Error(`Coloque pelo menos um mascote seu em ${definition.label}.`);

  // Os locais são públicos. Priorizamos um visitante de outra conta para que
  // a simulação represente encontros reais; sem visitante, usamos outro mascote do dono.
  const visitor = await tx.mascotRoutine.findFirst({
    where: { playerId: { not: playerId }, locationType: location, status: "ACTIVE" },
    orderBy: { lastProcessedAt: "asc" },
    include: { mascot: { select: { id: true, playerId: true, pokemonId: true, nickname: true, personality: true } } },
  });
  const routines = [ownRoutines[0], visitor ?? ownRoutines[1]].filter((routine): routine is NonNullable<typeof routine> => Boolean(routine));

  const first = routines[0].mascot;
  const second = routines[1]?.mascot ?? null;
  const [firstName, secondName] = names([first, ...(second ? [second] : [])]);
  const delta = second ? socialDelta(location, first.personality) : 0;
  const conflict = Boolean(second && (delta < 0 || Math.random() < (location === "TRAINING" ? 0.55 : 0.18)));
  const appliedDelta = conflict ? Math.min(-2, delta) : delta;
  const descriptions: Record<RefugeLocation, string> = {
    GARDEN: second ? `${pick(OPENINGS)} ${firstName} e ${secondName} cuidaram da Horta quando ${pick(REACTIONS.GARDEN)}. ${conflict ? "O desacordo não terminou ali." : "A forma como resolveram isso aproximou os dois."}` : `${firstName} cuidou da Horta e separou parte da produção.`,
    TRAINING: second ? `${pick(OPENINGS)} ${firstName} treinou com ${secondName} e ${pick(REACTIONS.TRAINING)}. ${conflict ? "Agora existe algo a provar." : "O esforço terminou em respeito mútuo."}` : `${firstName} treinou por conta própria e saiu mais determinado.`,
    REST: second ? `${pick(OPENINGS)} ${firstName} dividiu o descanso com ${secondName} quando ${pick(REACTIONS.REST)}. ${conflict ? "O descanso terminou com um assunto mal resolvido." : "Nenhum dos dois saiu dali exatamente igual."}` : `${firstName} encontrou tempo para recuperar o ânimo.`,
    YARD: second ? `${pick(OPENINGS)} ${firstName} encontrou ${secondName} no Pátio e ${pick(REACTIONS.YARD)}. ${conflict ? "Outros mascotes perceberam o clima mudar." : "A cena pode ser o começo de um novo grupo."}` : `${firstName} explorou o Pátio à procura de companhia.`,
  };

  if (second) {
    const current = await tx.mascotRelation.findUnique({
      where: { mascotAId_mascotBId: { mascotAId: first.id, mascotBId: second.id } },
      select: { relationshipScore: true },
    });
    const next = clampScore((current?.relationshipScore ?? 0) + appliedDelta);
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
      metadata: { location, scoreDelta: appliedDelta, conflict, personalities: [first.personality, second?.personality].filter(Boolean) },
    },
  });
  if (second) {
    await tx.mascotSocialEvent.create({
      data: {
        ownerId: playerId,
        mascotAId: first.id,
        mascotBId: second.id,
        eventType: conflict ? `REFUGE_${location}_CONFLICT` : `REFUGE_${location}_BOND`,
        title: conflict ? `Algo ficou mal resolvido em ${definition.label}` : `Um vínculo ganhou significado em ${definition.label}`,
        description: descriptions[location],
        optionsJson: importantOptions(location, conflict, firstName, secondName) as unknown as Prisma.InputJsonValue,
        visibility: "INVOLVED_PLAYERS",
        affectedPlayerIds: [...new Set([playerId, second.playerId])] as Prisma.InputJsonValue,
        publicEligible: false,
        sourceType: "REFUGE",
        contextJson: { location, conflict, generatedFrom: ["source", "fact", "personality", "relation", "interpretation", "reaction", "consequence"] },
        isImportant: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
    });
  }
  await tx.mascotRoutine.updateMany({
    where: { id: { in: routines.map((routine) => routine.id) } },
    data: { accumulatedUnits: { increment: 1 }, lastProcessedAt: new Date() },
  });

  return { description: descriptions[location], delta: appliedDelta, participants: routines.length };
}
