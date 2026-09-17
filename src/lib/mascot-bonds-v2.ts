import type { MascotPersonality, Prisma } from "@prisma/client";
import { getPokemonName } from "@/lib/mascot-data";
import { clampScore, relationTypeFromScore, type BondOption } from "@/lib/mascot-bonds";

export const REFUGE_LOCATIONS = {
  GARDEN: { label: "Horta", icon: "🌱", capacity: 48, accent: "emerald", purpose: "Cultivo, cuidado e cooperação", impact: "Cooperar aproxima (+4); Gulosos podem disputar recursos (-2). Seus ciclos produzirão exclusivamente materiais de Laços, negociáveis entre jogadores." },
  TRAINING: { label: "Campo de Treino", icon: "🥊", capacity: 48, accent: "amber", purpose: "Motivação, desafio e rivalidade", impact: "Desafios criam rivalidade (-2); Competitivos intensificam o efeito (-5). Essa rivalidade alimenta histórias de revanche e efeitos contra o rival específico." },
  REST: { label: "Área de Descanso", icon: "🌙", capacity: 48, accent: "sky", purpose: "Conforto, ensino e reconciliação", impact: "Compartilhar conforto aproxima (+3); Serenos e Tímidos ensinam rotinas de descanso com efeito maior (+5). Transições agitadas vindas do Treino geram histórias próprias." },
  YARD: { label: "Pátio", icon: "✨", capacity: 48, accent: "violet", purpose: "Descobertas, grupos e novos encontros", impact: "Encontros espontâneos aproximam (+3); Brincalhões e Curiosos interagem com mais intensidade (+5), favorecendo novos círculos sociais." },
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
  if (score <= -80) return "Nêmesis — Acerto de Contas: +8% de dano contra este Nêmesis nos 3 primeiros turnos de confronto direto. Na mesma equipe, não concede cooperação.";
  if (score <= -50) return "Inimigo — Tenho Algo a Provar: +5% de dano apenas contra este Inimigo específico. Na mesma equipe, não concede cooperação.";
  if (score <= -15) return "Rival — Competição: +3% de dano contra este Rival; na mesma equipe, ambos causam +2% de dano enquanto estiverem aptos. Não acumula com outro Laço.";
  if (score <= 14) return "Sem efeito mecânico; novas experiências definem o rumo da relação.";
  if (score <= 39) return "Colega: participa de histórias e interações, sem bônus numérico fixo.";
  if (score <= 79) return "Amigo — Sintonia: na mesma equipe, +2% de dano causado e −2% de dano recebido enquanto ambos estiverem aptos. Em lados opostos, o primeiro ataque direto causa −5% de dano por hesitação. Também: −3% no tempo de expedição e +5% de EXP em treino conjunto.";
  return "Super Amigo — Cobertura: na mesma equipe, +3% de dano causado e −3% recebido; uma vez por combate, reduz em mais 5% o golpe que deixaria o amigo abaixo de 20% de HP. Em lados opostos, o primeiro ataque direto causa −10% de dano. Também: −7% de expedição e +10% de EXP em treino conjunto.";
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
  "Pouco antes de o clima do lugar mudar,", "Enquanto outros mascotes cuidavam da própria rotina,",
  "Quando ninguém parecia estar prestando atenção,", "Entre uma atividade e outra,",
];

const REACTIONS: Record<RefugeLocation, string[]> = {
  GARDEN: ["a divisão da colheita virou assunto", "um alimento desapareceu antes da hora", "uma tarefa difícil exigiu cooperação", "os dois discordaram sobre quem havia trabalhado mais", "uma cesta tombou e os dois reagiram de maneiras opostas", "a melhor fruta da colheita ficou sem dono", "um canteiro frágil obrigou os dois a coordenar cada passo"],
  TRAINING: ["um desafio amistoso ficou sério", "uma provocação exigiu resposta", "a diferença de desempenho ficou evidente", "um pedido de revanche mudou o clima", "um golpe inesperado arrancou aplausos dos visitantes", "um dos dois recusou encerrar o treino empatado", "uma técnica difícil só funcionou quando passaram a observar um ao outro"],
  REST: ["uma tentativa de consolo foi bem recebida", "uma brincadeira interrompeu o silêncio", "uma mágoa antiga voltou à conversa", "um deles percebeu que o outro precisava de companhia", "o lugar favorito para dormir já estava ocupado", "um ensinou ao outro como encontrar o canto mais silencioso", "a energia trazida do treino incomodou quem tentava cochilar"],
  YARD: ["uma brincadeira improvisada reuniu curiosos", "uma disputa por atenção começou", "um encontro inesperado despertou admiração", "um comentário atravessado criou tensão", "um objeto perdido virou o centro de uma busca coletiva", "uma corrida sem regras terminou cercada de torcida", "os dois descobriram que estavam seguindo a mesma curiosidade"],
};

const POSITIVE_ENDINGS: Record<RefugeLocation, string[]> = {
  GARDEN: ["No fim, dividiram a colheita sem precisar contar as partes.", "O canteiro ficou melhor — e a parceria também.", "Uma pequena porção foi deixada de lado como promessa para o próximo encontro."],
  TRAINING: ["O respeito apareceu antes mesmo de o treino terminar.", "Os dois saíram planejando uma nova estratégia.", "A despedida teve o silêncio satisfeito de quem encontrou um bom parceiro."],
  REST: ["O silêncio compartilhado acabou sendo mais importante que qualquer conversa.", "Quando levantaram, o lugar já parecia pertencer aos dois.", "A confiança cresceu sem que nenhum deles precisasse explicar por quê."],
  YARD: ["A brincadeira terminou, mas o grupo formado ao redor deles não se desfez.", "Os dois combinaram um sinal secreto para o próximo encontro.", "Outros mascotes passaram a enxergá-los como uma dupla."],
};

const CONFLICT_ENDINGS: Record<RefugeLocation, string[]> = {
  GARDEN: ["A última fruta permaneceu entre os dois, intocada.", "Cada um refez sua parte do trabalho sem olhar para o outro.", "A colheita terminou, mas a discussão continuou nos gestos."],
  TRAINING: ["Nenhum deles aceitou chamar aquilo de empate.", "A revanche foi marcada antes de a poeira baixar.", "O público se dispersou sabendo que aquele placar ainda teria continuação."],
  REST: ["Um deles mudou de canto; o outro fingiu não perceber.", "O descanso acabou cedo demais para os dois.", "O silêncio que restou não era confortável."],
  YARD: ["A roda de curiosos se abriu para deixar os dois seguirem caminhos opostos.", "A brincadeira perdeu a graça, mas a provocação ficou.", "Os dois saíram dali guardando versões muito diferentes do que aconteceu."],
};

const LOCATION_ITEMS: Record<RefugeLocation, { common: string; uncommon: string }> = {
  GARDEN: { common: "BOND_SHARED_BERRY", uncommon: "BOND_CALMING_HERB" },
  TRAINING: { common: "BOND_REVENGE_TOKEN", uncommon: "BOND_TRAINING_RIBBON" },
  REST: { common: "BOND_SHARED_PILLOW", uncommon: "BOND_NIGHT_TEA" },
  YARD: { common: "BOND_YARD_TOY", uncommon: "BOND_ILLUSTRATED_INVITATION" },
};

function startOfTodayBrt(now = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${day}T03:00:00.000Z`);
}

function pick<T>(items: T[]) { return items[Math.floor(Math.random() * items.length)]; }

function importantOptions(location: RefugeLocation, conflict: boolean, firstName: string, secondName: string): BondOption[] {
  const local = {
    GARDEN: { challenge: "Organizar uma divisão justa da colheita", listen: "Descobrir quem cuidou de cada canteiro", cooperate: "Pedir que preparem uma cesta juntos", repeat: "Planejar uma nova colheita em dupla", positiveItem: "BOND_SHARED_BERRY", positiveName: "Frutinha da Partilha", rivalryItem: "BOND_CALMING_HERB", rivalryName: "Erva Apaziguadora" },
    TRAINING: { challenge: "Marcar uma revanche com regras claras", listen: "Rever o treino com os dois", cooperate: "Propor uma técnica que exige dupla", repeat: "Agendar uma nova sessão conjunta", positiveItem: "BOND_TRAINING_RIBBON", positiveName: "Faixa de Treino em Dupla", rivalryItem: "BOND_REVENGE_TOKEN", rivalryName: "Ficha de Revanche" },
    REST: { challenge: "Combinar limites para o horário de descanso", listen: "Ouvir quem precisava de silêncio", cooperate: "Montar juntos um canto confortável", repeat: "Sugerir que compartilhem esse lugar novamente", positiveItem: "BOND_SHARED_PILLOW", positiveName: "Almofada Compartilhada", rivalryItem: "BOND_NIGHT_TEA", rivalryName: "Chá de Boa-Noite" },
    YARD: { challenge: "Transformar a disputa em uma brincadeira com regras", listen: "Perguntar como cada um entendeu a cena", cooperate: "Organizar uma busca em dupla", repeat: "Incentivar um novo encontro no Pátio", positiveItem: "BOND_YARD_TOY", positiveName: "Brinquedo de Pátio", rivalryItem: "BOND_ILLUSTRATED_INVITATION", rivalryName: "Convite Ilustrado" },
  }[location];
  if (conflict) return [
    { id: "channel_rivalry", intention: "Transformar tensão em motivação", label: local.challenge, outcomePreview: `${firstName} e ${secondName} preservam o motivo da rivalidade: relação -5/-2 e uma promessa de continuação.`, type: "AGGRESSIVE", cost: { kind: "BOND_ITEM", quantity: 1, itemType: local.rivalryItem, itemName: local.rivalryName }, scoreDelta: -5, scoreDeltaB: -2, expA: location === "TRAINING" ? 18 : 8 },
    { id: "listen_both", intention: "Compreender antes de decidir", label: local.listen, outcomePreview: "A tensão diminui sem apagar o motivo do conflito; os dois ganham respeito em ritmos diferentes.", type: "NEUTRAL", scoreDelta: 2, scoreDeltaB: 4 },
    { id: "repair_together", intention: "Reconstruir confiança", label: local.cooperate, outcomePreview: "A convivência melhora: relação +7/+5, felicidade +3 para ambos e uma memória de reconciliação.", type: "POSITIVE", cost: { kind: "BOND_ITEM", quantity: 1, itemType: local.positiveItem, itemName: local.positiveName }, scoreDelta: 7, scoreDeltaB: 5, happinessA: 3, happinessB: 3 },
    { id: "let_them_settle", intention: "Confiar na personalidade deles", label: "Não interferir e observar a consequência", outcomePreview: "Sem custo. Cada mascote reage de acordo com sua personalidade e a rivalidade pode se intensificar.", type: "NEUTRAL", scoreDelta: -1, scoreDeltaB: 1 },
  ];
  return [
    { id: "celebrate_bond", intention: "Reconhecer a aproximação", label: "Celebrar o momento com os dois", outcomePreview: "Fortalece a relação em +7/+5, concede felicidade +4/+3 e registra uma lembrança positiva.", type: "POSITIVE", cost: { kind: "BOND_ITEM", quantity: 1, itemType: local.positiveItem, itemName: local.positiveName }, scoreDelta: 7, scoreDeltaB: 5, happinessA: 4, happinessB: 3 },
    { id: "encourage_independence", intention: "Estimular sem forçar", label: local.repeat, outcomePreview: "Cria uma oportunidade futura e aproxima mais o mascote que tomou a iniciativa.", type: "POSITIVE", scoreDelta: 4, scoreDeltaB: 2 },
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
    GARDEN: second ? `${pick(OPENINGS)} ${firstName} e ${secondName} cuidaram da Horta quando ${pick(REACTIONS.GARDEN)}. ${pick(conflict ? CONFLICT_ENDINGS.GARDEN : POSITIVE_ENDINGS.GARDEN)}` : `${firstName} cuidou da Horta e separou parte da produção.`,
    TRAINING: second ? `${pick(OPENINGS)} ${firstName} treinou com ${secondName} e ${pick(REACTIONS.TRAINING)}. ${pick(conflict ? CONFLICT_ENDINGS.TRAINING : POSITIVE_ENDINGS.TRAINING)}` : `${firstName} treinou por conta própria e saiu mais determinado.`,
    REST: second ? `${pick(OPENINGS)} ${firstName} dividiu o descanso com ${secondName} quando ${pick(REACTIONS.REST)}. ${pick(conflict ? CONFLICT_ENDINGS.REST : POSITIVE_ENDINGS.REST)}` : `${firstName} encontrou tempo para recuperar o ânimo.`,
    YARD: second ? `${pick(OPENINGS)} ${firstName} encontrou ${secondName} no Pátio e ${pick(REACTIONS.YARD)}. ${pick(conflict ? CONFLICT_ENDINGS.YARD : POSITIVE_ENDINGS.YARD)}` : `${firstName} explorou o Pátio à procura de companhia.`,
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
      sourceId: location,
      title: `${definition.icon} ${definition.label}`,
      description: descriptions[location],
      intensity: Math.abs(delta) >= 5 ? 2 : 1,
      metadata: { location, scoreDelta: appliedDelta, conflict, personalities: [first.personality, second?.personality].filter(Boolean) },
    },
  });
  let importantEventId: string | null = null;
  const important = Boolean(second && (Math.abs(appliedDelta) >= 5 || Math.random() < 0.3));
  if (second && important) {
    const event = await tx.mascotSocialEvent.create({
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
    importantEventId = event.id;
  }
  await tx.mascotRoutine.updateMany({
    where: { id: { in: routines.map((routine) => routine.id) } },
    data: { accumulatedUnits: { increment: 1 }, lastProcessedAt: new Date() },
  });

  let reward: string | null = null;
  const rewardsToday = await tx.mascotBondMemory.count({
    where: { mascotAId: first.id, sourceType: "REFUGE_REWARD", createdAt: { gte: startOfTodayBrt() } },
  });
  if (rewardsToday < 2) {
    const roll = Math.random();
    const itemType = roll < 0.1 ? LOCATION_ITEMS[location].uncommon : roll < 0.5 ? LOCATION_ITEMS[location].common : null;
    if (itemType) {
      const item = await tx.shopItem.findFirst({ where: { type: itemType as never }, select: { id: true, name: true } });
      if (item) {
        await tx.playerInventory.upsert({
          where: { playerId_itemId: { playerId: first.playerId, itemId: item.id } },
          update: { quantity: { increment: 1 } },
          create: { playerId: first.playerId, itemId: item.id, quantity: 1, source: "BONDS_REFUGE" },
        });
        reward = `A rotina rendeu 1x ${item.name}.`;
        await tx.mascotBondMemory.create({
          data: { mascotAId: first.id, memoryType: "RECURSO_DE_LACOS", sourceType: "REFUGE_REWARD", sourceId: location, title: `Recurso encontrado em ${definition.label}`, description: `${firstName} encontrou 1x ${item.name} durante a rotina.`, metadata: { location, itemType, quantity: 1 } },
        });
      }
    }
  }

  return { description: reward ? `${descriptions[location]} ${reward}` : descriptions[location], delta: appliedDelta, participants: routines.length, importantEventId, affectedPlayerIds: second && important ? [...new Set([playerId, second.playerId])] : [], reward };
}
