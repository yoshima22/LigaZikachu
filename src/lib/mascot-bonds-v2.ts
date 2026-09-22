import type { MascotPersonality, Prisma } from "@prisma/client";
import { getPokemonName, getPokemonElement, getTypeLabelPt, PERSONALITY_LABEL } from "@/lib/mascot-data";
import { clampScore, relationTypeFromScore, type BondOption } from "@/lib/mascot-bonds";
import { buildRefugeStory, tierFromScore, pairKey, stepArc, pickCallback, type StoryActor, type StoryContext, type PairStoryState, type PairArcState } from "@/lib/bond-story-engine";
import { runRefugeFight, fightNarrative } from "@/lib/bond-fight";

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
  if (score <= -80) return "Nêmesis — Obsessão Competitiva: +8% de dano contra este Nêmesis nos 3 primeiros confrontos diretos. Na mesma equipe, ambos causam +7% de dano tentando superar o outro, mas recebem +4% de dano pela imprudência. Só funciona enquanto os dois estiverem aptos.";
  if (score <= -50) return "Inimigo — Disputa Agressiva: +5% de dano apenas contra este Inimigo específico. Na mesma equipe, ambos causam +4% de dano, mas recebem +2% de dano por se recusarem a cooperar defensivamente. Só funciona enquanto os dois estiverem aptos.";
  if (score <= -15) return "Rival — Competição Saudável: +3% de dano contra este Rival; na mesma equipe, ambos causam +2% de dano enquanto estiverem aptos, sem penalidade defensiva. Não acumula com outro Laço.";
  if (score <= 14) return "Sem efeito mecânico; novas experiências definem o rumo da relação.";
  if (score <= 39) return "Colega — Entrosamento: na mesma equipe, ambos causam +1% de dano enquanto estiverem aptos. É um benefício leve e não acumula com outro Laço.";
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

export function buildImportantRefugeOptions(location: RefugeLocation, conflict: boolean, firstName: string, secondName: string): BondOption[] {
  const local = {
    GARDEN: { challenge: "Organizar uma divisão justa da colheita", listen: "Descobrir quem cuidou de cada canteiro", cooperate: "Pedir que preparem uma cesta juntos", repeat: "Planejar uma nova colheita em dupla", positiveItem: "BOND_SHARED_BERRY", positiveName: "Frutinha da Partilha", rivalryItem: "BOND_CALMING_HERB", rivalryName: "Erva Apaziguadora" },
    TRAINING: { challenge: "Marcar uma revanche com regras claras", listen: "Rever o treino com os dois", cooperate: "Propor uma técnica que exige dupla", repeat: "Agendar uma nova sessão conjunta", positiveItem: "BOND_TRAINING_RIBBON", positiveName: "Faixa de Treino em Dupla", rivalryItem: "BOND_REVENGE_TOKEN", rivalryName: "Ficha de Revanche" },
    REST: { challenge: "Combinar limites para o horário de descanso", listen: "Ouvir quem precisava de silêncio", cooperate: "Montar juntos um canto confortável", repeat: "Sugerir que compartilhem esse lugar novamente", positiveItem: "BOND_SHARED_PILLOW", positiveName: "Almofada Compartilhada", rivalryItem: "BOND_NIGHT_TEA", rivalryName: "Chá de Boa-Noite" },
    YARD: { challenge: "Transformar a disputa em uma brincadeira com regras", listen: "Perguntar como cada um entendeu a cena", cooperate: "Organizar uma busca em dupla", repeat: "Incentivar um novo encontro no Pátio", positiveItem: "BOND_YARD_TOY", positiveName: "Brinquedo de Pátio", rivalryItem: "BOND_ILLUSTRATED_INVITATION", rivalryName: "Convite Ilustrado" },
  }[location];
  const choose = (variants: BondOption[]) => pick(variants);
  const suffix = `${location.toLowerCase()}_${Math.floor(Math.random() * 1_000_000)}`;
  if (conflict) return [
    choose([
      { id: `channel_${suffix}`, intention: "Transformar tensão em motivação", label: local.challenge, outcomePreview: `${firstName} e ${secondName} mantêm uma rivalidade controlada: relação −5/−2, EXP para quem tomou a iniciativa e uma promessa de revanche.`, type: "AGGRESSIVE", cost: { kind: "BOND_ITEM", quantity: 1, itemType: local.rivalryItem, itemName: local.rivalryName }, scoreDelta: -5, scoreDeltaB: -2, expA: location === "TRAINING" ? 18 : 8 },
      { id: `stakes_${suffix}`, intention: "Aumentar o desafio", label: `Pedir que ${firstName} prove seu ponto em uma disputa justa`, outcomePreview: "A rivalidade cresce nas duas direções (−4/−4), mas ambos saem motivados e o conflito vira memória competitiva.", type: "AGGRESSIVE", scoreDelta: -4, scoreDeltaB: -4, expA: 10, expB: 10 },
      { id: `private_rivalry_${suffix}`, intention: "Preservar a competição", label: `Deixar ${secondName} escolher as regras da revanche`, outcomePreview: "A relação de quem foi desafiado cai −3; o desafiante ganha +12 EXP e a revanche continua aberta.", type: "AGGRESSIVE", scoreDelta: -1, scoreDeltaB: -3, expA: 12 },
    ]),
    choose([
      { id: `repair_${suffix}`, intention: "Reconstruir confiança", label: local.cooperate, outcomePreview: "A convivência melhora em +7/+5, ambos recebem +3 de felicidade e guardam uma memória de reconciliação.", type: "POSITIVE", cost: { kind: "BOND_ITEM", quantity: 1, itemType: local.positiveItem, itemName: local.positiveName }, scoreDelta: 7, scoreDeltaB: 5, happinessA: 3, happinessB: 3 },
      { id: `gesture_${suffix}`, intention: "Oferecer um gesto concreto", label: `${firstName} entrega o recurso a ${secondName}`, outcomePreview: "O gesto custa um item local, concede +6/+4 de relação e +4 de felicidade a quem o recebe.", type: "POSITIVE", cost: { kind: "BOND_ITEM", quantity: 1, itemType: local.positiveItem, itemName: local.positiveName }, scoreDelta: 6, scoreDeltaB: 4, happinessB: 4 },
      { id: `shared_task_${suffix}`, intention: "Trocar discussão por cooperação", label: `Dar aos dois uma tarefa que só funciona em dupla`, outcomePreview: "A tensão vira cooperação: +5 nas duas direções e +8 EXP para cada mascote.", type: "POSITIVE", scoreDelta: 5, scoreDeltaB: 5, expA: 8, expB: 8 },
    ]),
    choose([
      { id: `listen_${suffix}`, intention: "Compreender antes de decidir", label: local.listen, outcomePreview: "A tensão diminui sem apagar sua causa: +2/+4 de relação e uma memória sobre as duas versões.", type: "NEUTRAL", scoreDelta: 2, scoreDeltaB: 4 },
      { id: `hear_first_${suffix}`, intention: "Ouvir quem tomou a iniciativa", label: `Perguntar a ${firstName} o que estava tentando provar`, outcomePreview: "A conversa dá +3 na direção principal e +6 EXP, mas não força reconciliação.", type: "NEUTRAL", scoreDelta: 3, scoreDeltaB: 0, expA: 6 },
      { id: `hear_second_${suffix}`, intention: "Dar espaço ao outro lado", label: `Deixar ${secondName} contar como interpretou a situação`, outcomePreview: "O segundo mascote se sente ouvido: +1/+4 de relação e +3 de felicidade para ele.", type: "NEUTRAL", scoreDelta: 1, scoreDeltaB: 4, happinessB: 3 },
    ]),
    choose([
      { id: `observe_${suffix}`, intention: "Confiar na personalidade deles", label: "Não interferir e observar a consequência", outcomePreview: "Sem custo. A relação muda pouco (−1/+1) e a cena permanece no diário como conflito não resolvido.", type: "NEUTRAL", scoreDelta: -1, scoreDeltaB: 1 },
      { id: `pause_${suffix}`, intention: "Dar tempo antes de reagir", label: "Separá-los por enquanto e retomar o assunto depois", outcomePreview: "Sem custo. Evita uma escalada imediata, não altera a relação e registra a tensão para histórias futuras.", type: "NEUTRAL", scoreDelta: 0, scoreDeltaB: 0 },
      { id: `accept_${suffix}`, intention: "Aceitar o desacordo", label: "Deixar claro que eles não precisam concordar", outcomePreview: "Sem custo. Cada direção ganha +1 por respeito, sem apagar a rivalidade.", type: "NEUTRAL", scoreDelta: 1, scoreDeltaB: 1 },
    ]),
  ];
  return [
    choose([
      { id: `celebrate_${suffix}`, intention: "Reconhecer a aproximação", label: "Celebrar o momento com os dois", outcomePreview: "Fortalece a relação em +7/+5, concede felicidade +4/+3 e registra uma lembrança positiva.", type: "POSITIVE", cost: { kind: "BOND_ITEM", quantity: 1, itemType: local.positiveItem, itemName: local.positiveName }, scoreDelta: 7, scoreDeltaB: 5, happinessA: 4, happinessB: 3 },
      { id: `souvenir_${suffix}`, intention: "Transformar o encontro em lembrança", label: `Preparar uma recordação para ${firstName} e ${secondName}`, outcomePreview: "Custa um item local, concede +6 nas duas direções e registra uma memória compartilhada.", type: "POSITIVE", cost: { kind: "BOND_ITEM", quantity: 1, itemType: local.positiveItem, itemName: local.positiveName }, scoreDelta: 6, scoreDeltaB: 6 },
      { id: `repeat_paid_${suffix}`, intention: "Investir no próximo encontro", label: local.repeat, outcomePreview: "Custa um item local, aproxima em +5/+4 e deixa um convite narrativo para um novo encontro.", type: "POSITIVE", cost: { kind: "BOND_ITEM", quantity: 1, itemType: local.positiveItem, itemName: local.positiveName }, scoreDelta: 5, scoreDeltaB: 4 },
    ]),
    choose([
      { id: `independence_${suffix}`, intention: "Estimular sem forçar", label: local.repeat, outcomePreview: "Sem custo. Cria uma oportunidade futura e aproxima em +4/+2, favorecendo quem tomou a iniciativa.", type: "POSITIVE", scoreDelta: 4, scoreDeltaB: 2 },
      { id: `praise_second_${suffix}`, intention: "Reconhecer reciprocidade", label: `Elogiar a maneira como ${secondName} respondeu`, outcomePreview: "A resposta recebe reconhecimento: +2/+4 de relação e +5 EXP para o segundo mascote.", type: "POSITIVE", scoreDelta: 2, scoreDeltaB: 4, expB: 5 },
      { id: `team_goal_${suffix}`, intention: "Criar um objetivo em comum", label: "Propor uma pequena missão para a dupla", outcomePreview: "Os dois ganham +3 de relação e +7 EXP; a parceria fica registrada para eventos futuros.", type: "POSITIVE", scoreDelta: 3, scoreDeltaB: 3, expA: 7, expB: 7 },
    ]),
    choose([
      { id: `meaning_${suffix}`, intention: "Entender o que isso significou", label: `Conversar separadamente com ${firstName}`, outcomePreview: "Revela uma interpretação pessoal: +3 na direção principal e +6 EXP, sem decidir pelo outro mascote.", type: "NEUTRAL", scoreDelta: 3, scoreDeltaB: 0, expA: 6 },
      { id: `second_meaning_${suffix}`, intention: "Conhecer o outro ponto de vista", label: `Perguntar a ${secondName} por que o momento foi importante`, outcomePreview: "A relação muda em +1/+3 e o segundo mascote recebe +2 de felicidade.", type: "NEUTRAL", scoreDelta: 1, scoreDeltaB: 3, happinessB: 2 },
      { id: `name_bond_${suffix}`, intention: "Dar significado ao vínculo", label: "Perguntar aos dois se querem repetir essa experiência", outcomePreview: "Uma resposta cautelosa aproxima em +2/+2 e transforma o encontro em memória recorrente.", type: "NEUTRAL", scoreDelta: 2, scoreDeltaB: 2 },
    ]),
    choose([
      { id: `preserve_${suffix}`, intention: "Deixar acontecer naturalmente", label: "Guardar a memória sem interferir", outcomePreview: "Sem custo. O acontecimento entra no diário e a relação muda apenas +1/+1.", type: "NEUTRAL", scoreDelta: 1, scoreDeltaB: 1 },
      { id: `watch_next_${suffix}`, intention: "Observar antes de definir", label: "Esperar o próximo encontro antes de incentivar algo", outcomePreview: "Sem custo e sem mudança de relação. A memória será usada como contexto no próximo acontecimento.", type: "NEUTRAL", scoreDelta: 0, scoreDeltaB: 0 },
      { id: `quiet_support_${suffix}`, intention: "Apoiar discretamente", label: "Não interromper, mas preparar o espaço para continuarem", outcomePreview: "Sem custo. Ambos recebem +2 de relação e o momento permanece espontâneo.", type: "POSITIVE", scoreDelta: 2, scoreDeltaB: 2 },
    ]),
  ];
}

/** Processa um ciclo social automático de um local público. */
export async function simulateRefugeMoment(tx: Prisma.TransactionClient, playerId: string, location: RefugeLocation) {
  const definition = REFUGE_LOCATIONS[location];
  const ownRoutines = await tx.mascotRoutine.findMany({
    where: { playerId, locationType: location, status: "ACTIVE", player: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } } },
    orderBy: [{ nextEventAt: "asc" }, { startedAt: "asc" }],
    take: definition.capacity,
    include: { mascot: { select: { id: true, playerId: true, pokemonId: true, nickname: true, personality: true } } },
  });
  if (ownRoutines.length === 0) throw new Error(`Coloque pelo menos um mascote seu em ${definition.label}.`);

  // Os locais são públicos. Priorizamos um visitante de outra conta para que
  // a simulação represente encontros reais; sem visitante, usamos outro mascote do dono.
  const visitor = await tx.mascotRoutine.findFirst({
    where: { playerId: { not: playerId }, locationType: location, status: "ACTIVE", player: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } } },
    orderBy: [{ nextEventAt: "asc" }, { lastProcessedAt: "asc" }],
    include: { mascot: { select: { id: true, playerId: true, pokemonId: true, nickname: true, personality: true } } },
  });
  const routines = [ownRoutines[0], visitor ?? ownRoutines[1]].filter((routine): routine is NonNullable<typeof routine> => Boolean(routine));

  const first = routines[0].mascot;
  const second = routines[1]?.mascot ?? null;
  const locationMascots = await tx.mascotRoutine.findMany({ where: { locationType: location, status: "ACTIVE", player: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } } }, select: { mascotId: true }, take: definition.capacity });
  const nearbyRelations = await tx.mascotRelation.findMany({ where: { mascotAId: first.id, mascotBId: { in: locationMascots.map((entry) => entry.mascotId) }, isActive: true }, select: { relationshipScore: true } });
  const friendCircleActive = nearbyRelations.filter((relation) => relation.relationshipScore >= 15).length >= 2;
  const fightClubActive = nearbyRelations.filter((relation) => relation.relationshipScore <= -15).length >= 2;
  const [firstName, secondName] = names([first, ...(second ? [second] : [])]);
  const influence = second ? await tx.mascotSocialInfluence.findUnique({ where: { observerPlayerId_targetMascotId: { observerPlayerId: playerId, targetMascotId: second.id } }, select: { direction: true } }) : null;
  const suggestion = influence?.direction === 1 ? 1 : influence?.direction === -1 ? -1 : 0;
  const delta = second ? socialDelta(location, first.personality) + suggestion : 0;
  const conflictChance = Math.max(0.05, Math.min(0.8, (location === "TRAINING" ? 0.55 : 0.18) - suggestion * 0.08));
  let conflict = Boolean(second && (delta < 0 || Math.random() < conflictChance));
  // ── História modular do encontro (motor contextual + arcos) ───────────────
  const singleFallback: Record<RefugeLocation, string> = {
    GARDEN: `${firstName} cuidou da Horta e separou parte da produção.`,
    TRAINING: `${firstName} treinou por conta própria e saiu mais determinado.`,
    REST: `${firstName} encontrou tempo para recuperar o ânimo.`,
    YARD: `${firstName} explorou o Pátio à procura de companhia.`,
  };
  let storyText = singleFallback[location];
  let storyPhraseIds: string[] = [];
  let storyFamilies: string[] = [];
  let storyArc: { arcId: string; beat: string } | null = null;
  let arcResultado: "POSITIVE" | "CONFLICT" | null = null;
  let pairStateUpdate: { pairKey: string; next: PairStoryState } | null = null;
  let fightData: { winnerId: string | null; loserId: string | null; rounds: number; replay: unknown; participants: { id: string; side: "A" | "B" }[] } | null = null;
  if (second) {
    const pk = pairKey(first.id, second.id);
    const [owners, currentRel, recentMemories, savedState] = await Promise.all([
      tx.player.findMany({ where: { id: { in: [first.playerId, second.playerId] } }, select: { id: true, displayName: true } }),
      tx.mascotRelation.findUnique({ where: { mascotAId_mascotBId: { mascotAId: first.id, mascotBId: second.id } }, select: { relationshipScore: true, interactionCount: true, isActive: true } }),
      tx.mascotBondMemory.findMany({
        where: { OR: [{ mascotAId: first.id, mascotBId: second.id }, { mascotAId: second.id, mascotBId: first.id }], sourceType: "REFUGE" },
        orderBy: { createdAt: "desc" }, take: 20, select: { metadata: true },
      }),
      tx.mascotBondPairState.findUnique({ where: { pairKey: pk }, select: { arcsJson: true, tagsJson: true } }),
    ]);
    const ownerName = (id: string) => owners.find((o) => o.id === id)?.displayName ?? "um treinador";
    const actor = (m: { pokemonId: number; nickname: string | null; personality: MascotPersonality }, ownerId: string): StoryActor => {
      const el = getPokemonElement(m.pokemonId);
      return { name: m.nickname ?? getPokemonName(m.pokemonId), owner: ownerName(ownerId), element: el, elementLabel: getTypeLabelPt(el).toLowerCase(), personality: m.personality, personalityLabel: PERSONALITY_LABEL[m.personality] ?? m.personality };
    };
    const recentIds = new Set<string>();
    const recentFamilies = new Set<string>();
    recentMemories.forEach((mem, index) => {
      const meta = (mem.metadata ?? {}) as { phraseIds?: string[]; families?: string[] };
      (meta.phraseIds ?? []).forEach((id) => recentIds.add(id));
      if (index < 8) (meta.families ?? []).forEach((f) => recentFamilies.add(f));
    });
    const scoreNow = currentRel?.isActive ? currentRel.relationshipScore : 0;
    const ctx: StoryContext = {
      location, conflict,
      a: actor(first, first.playerId),
      b: actor(second, second.playerId),
      tier: tierFromScore(scoreNow),
      encounterCount: currentRel?.interactionCount ?? 0,
      recentIds, recentFamilies,
    };
    const state: PairStoryState = { arcs: (savedState?.arcsJson as PairArcState[] | null) ?? [], tags: (savedState?.tagsJson as string[] | null) ?? [] };
    const arc = stepArc(state, location, ctx);
    if (arc) {
      if (arc.resultado !== "ANY") { arcResultado = arc.resultado; conflict = arc.resultado === "CONFLICT"; }
      const callback = pickCallback(ctx, state.tags, definition.label);
      storyText = callback ? `${callback} ${arc.text}` : arc.text;
      storyArc = { arcId: arc.arcId, beat: arc.beat };
      pairStateUpdate = { pairKey: pk, next: arc.newState };
    } else {
      const story = buildRefugeStory(ctx, definition.label);
      storyText = story.text; storyPhraseIds = story.phraseIds; storyFamilies = story.families;
    }

    // ── Briga: rivalidade hostil pode virar combate real (motor da Liga) ──────
    // Puramente narrativo/relacional: NÃO altera HP, felicidade nem impõe repouso.
    if (conflict && scoreNow <= -15) {
      const fightChance = (location === "TRAINING" ? 0.35 : 0.15) + (scoreNow <= -80 ? 0.2 : scoreNow <= -50 ? 0.1 : 0);
      if (Math.random() < fightChance) {
        const nearbyIds = locationMascots.map((entry) => entry.mascotId).filter((id) => id !== first.id && id !== second.id);
        const stats = await tx.mascot.findMany({
          where: { id: { in: [first.id, second.id, ...nearbyIds] } },
          select: { id: true, playerId: true, pokemonId: true, nickname: true, level: true, statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true, speciesNameOverride: true, primaryTypeOverride: true, secondaryTypeOverride: true, personality: true, diseasedAt: true, preferredCombatRole: true },
        });
        const fa = stats.find((s) => s.id === first.id);
        const fb = stats.find((s) => s.id === second.id);
        if (fa && fb) {
          // Participação especial: aliado de um lado e hostil ao outro entra 2x1;
          // sem aliado, um rival próximo pode se intrometer contra o seu desafeto.
          const relations = await tx.mascotRelation.findMany({ where: { isActive: true, OR: [{ mascotAId: { in: [first.id, second.id, ...nearbyIds] }, mascotBId: { in: [first.id, second.id, ...nearbyIds] } }, { mascotBId: { in: [first.id, second.id, ...nearbyIds] }, mascotAId: { in: [first.id, second.id, ...nearbyIds] } }] }, select: { mascotAId: true, mascotBId: true, relationshipScore: true } });
          const scoreOf = (a: string, b: string) => relations.find((relation) => (relation.mascotAId === a && relation.mascotBId === b) || (relation.mascotAId === b && relation.mascotBId === a))?.relationshipScore ?? 0;
          const third = stats.find((mascot) => mascot.id !== first.id && mascot.id !== second.id && ((scoreOf(mascot.id, first.id) >= 40 && scoreOf(mascot.id, second.id) <= -15) || (scoreOf(mascot.id, second.id) >= 40 && scoreOf(mascot.id, first.id) <= -15) || scoreOf(mascot.id, first.id) <= -15 || scoreOf(mascot.id, second.id) <= -15));
          const alliedWithFirst = third && scoreOf(third.id, first.id) >= 40 && scoreOf(third.id, second.id) <= -15;
          const alliedWithSecond = third && scoreOf(third.id, second.id) >= 40 && scoreOf(third.id, first.id) <= -15;
          const intrudesAgainstFirst = Boolean(third && !alliedWithFirst && !alliedWithSecond && scoreOf(third.id, first.id) <= -15);
          const fight = runRefugeFight(alliedWithFirst ? [fa, third!] : fa, alliedWithSecond || intrudesAgainstFirst ? [fb, third!] : fb);
          storyText = fightNarrative(fight, definition.label);
          fightData = { winnerId: fight.winnerId, loserId: fight.loserId, rounds: fight.rounds, replay: fight.replay, participants: fight.participants };
          storyPhraseIds = []; storyFamilies = [];
          arcResultado = "CONFLICT";
        }
      }
    }
  }
  // Uma briga multi também deixa marcas nas relações das duplas adicionais:
  // aliados se aproximam; lados opostos acumulam rivalidade. Não há dano físico.
  if (fightData) {
    const participants = fightData.participants;
    for (let index = 0; index < participants.length; index++) for (let other = index + 1; other < participants.length; other++) {
      const a = participants[index], b = participants[other];
      if ((a.id === first.id && b.id === second?.id) || (b.id === first.id && a.id === second?.id)) continue;
      const delta = a.side === b.side ? 2 : -3;
      const current = await tx.mascotRelation.findUnique({ where: { mascotAId_mascotBId: { mascotAId: a.id, mascotBId: b.id } }, select: { relationshipScore: true } });
      const next = clampScore((current?.relationshipScore ?? 0) + delta);
      await tx.mascotRelation.upsert({ where: { mascotAId_mascotBId: { mascotAId: a.id, mascotBId: b.id } }, update: { relationshipScore: next, type: relationTypeFromScore(next), interactionCount: { increment: 1 }, lastInteractionAt: new Date(), isActive: true }, create: { mascotAId: a.id, mascotBId: b.id, relationshipScore: next, type: relationTypeFromScore(next), interactionCount: 1, lastInteractionAt: new Date() } });
    }
  }
  const appliedDelta = fightData ? Math.min(-6, -Math.abs(delta) - 4)
    : arcResultado === "POSITIVE" ? Math.max(2, Math.abs(delta))
    : arcResultado === "CONFLICT" ? Math.min(-2, -Math.abs(delta))
    : conflict ? Math.min(-2, delta) : delta;

  if (second) {
    const current = await tx.mascotRelation.findUnique({
      where: { mascotAId_mascotBId: { mascotAId: first.id, mascotBId: second.id } },
      select: { id: true, relationshipScore: true, isActive: true },
    });
    if (current?.isActive || await tx.mascotRelation.count({ where: { mascotAId: first.id, isActive: true } }) < 10) {
      if (current && !current.isActive) await tx.mascotRelation.delete({ where: { id: current.id } });
      const next = clampScore((current?.isActive ? current.relationshipScore : 0) + appliedDelta);
      await tx.mascotRelation.upsert({
        where: { mascotAId_mascotBId: { mascotAId: first.id, mascotBId: second.id } },
        update: { relationshipScore: next, type: relationTypeFromScore(next), interactionCount: { increment: 1 }, lastInteractionAt: new Date(), isActive: true },
        create: { mascotAId: first.id, mascotBId: second.id, relationshipScore: next, type: relationTypeFromScore(next), interactionCount: 1, lastInteractionAt: new Date() },
      });
    }
  }

  // Persiste o estado narrativo da dupla (arcos ativos + tags de payoff).
  if (pairStateUpdate) {
    await tx.mascotBondPairState.upsert({
      where: { pairKey: pairStateUpdate.pairKey },
      create: { pairKey: pairStateUpdate.pairKey, arcsJson: pairStateUpdate.next.arcs as unknown as Prisma.InputJsonValue, tagsJson: pairStateUpdate.next.tags as unknown as Prisma.InputJsonValue },
      update: { arcsJson: pairStateUpdate.next.arcs as unknown as Prisma.InputJsonValue, tagsJson: pairStateUpdate.next.tags as unknown as Prisma.InputJsonValue },
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
      description: storyText,
      intensity: Math.abs(delta) >= 5 ? 2 : 1,
      metadata: { location, scoreDelta: appliedDelta, conflict, trainerInfluence: suggestion, personalities: [first.personality, second?.personality].filter(Boolean), phraseIds: storyPhraseIds, families: storyFamilies, ...(storyArc ? { arcId: storyArc.arcId, arcBeat: storyArc.beat } : {}), ...(fightData ? { fight: fightData } : {}) } as unknown as Prisma.InputJsonValue,
    },
  });
  let importantEventId: string | null = null;
  const groupEventBonus = friendCircleActive || (location === "TRAINING" && fightClubActive) ? 0.1 : 0;
  const important = Boolean(second && !fightData && (Math.abs(appliedDelta) >= 5 || Math.random() < 0.3 + groupEventBonus));
  if (second && important) {
    const event = await tx.mascotSocialEvent.create({
      data: {
        ownerId: playerId,
        mascotAId: first.id,
        mascotBId: second.id,
        eventType: conflict ? `REFUGE_${location}_CONFLICT` : `REFUGE_${location}_BOND`,
        title: conflict ? `Algo ficou mal resolvido em ${definition.label}` : `Um vínculo ganhou significado em ${definition.label}`,
        description: storyText,
        optionsJson: buildImportantRefugeOptions(location, conflict, firstName, secondName) as unknown as Prisma.InputJsonValue,
        visibility: "INVOLVED_PLAYERS",
        affectedPlayerIds: [...new Set([playerId, second.playerId])] as Prisma.InputJsonValue,
        publicEligible: false,
        sourceType: "REFUGE",
        contextJson: { location, conflict, friendCircleActive, fightClubActive, generatedFrom: ["source", "fact", "personality", "relation", "interpretation", "reaction", "consequence"] },
        isImportant: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
    });
    importantEventId = event.id;
  }
  const processedAt = new Date();
  for (const routine of routines) {
    const nextMinutes = 180 + Math.floor(Math.random() * 121);
    await tx.mascotRoutine.update({ where: { id: routine.id }, data: { accumulatedUnits: { increment: 1 }, lastProcessedAt: processedAt, nextEventAt: new Date(processedAt.getTime() + nextMinutes * 60_000) } });
  }

  let reward: string | null = null;
  const rewardsToday = await tx.mascotBondMemory.count({
    where: { mascotAId: first.id, sourceType: "REFUGE_REWARD", createdAt: { gte: startOfTodayBrt() } },
  });
  if (rewardsToday < 2 && !routines[0].pendingRewardType) {
    const roll = Math.random();
    // Círculos de amigos e Clubes da Luta têm benefícios equivalentes, mas
    // com identidades diferentes: cooperação fora do Treino e competição nele.
    const groupRewardBonus = friendCircleActive || (location === "TRAINING" && fightClubActive) ? 0.1 : 0;
    const itemType = roll < 0.1 ? LOCATION_ITEMS[location].uncommon : roll < 0.5 + groupRewardBonus ? LOCATION_ITEMS[location].common : null;
    if (itemType) {
      const item = await tx.shopItem.findFirst({ where: { type: itemType as never }, select: { id: true, name: true } });
      if (item) {
        await tx.mascotRoutine.update({ where: { id: routines[0].id }, data: { pendingRewardType: itemType, pendingRewardAt: new Date() } });
        reward = `${firstName} encontrou algo. Clique nele no Refúgio para resgatar 1x ${item.name}.`;
      }
    }
  }

  return {
    description: reward ? `${storyText} ${reward}` : storyText,
    storyDescription: storyText,
    delta: appliedDelta,
    participants: routines.length,
    importantEventId,
    affectedPlayerIds: second && important ? [...new Set([playerId, second.playerId])] : [],
    reward,
    rewardOwnerPlayerId: reward ? first.playerId : null,
    rewardMascotName: reward ? firstName : null,
  };
}
