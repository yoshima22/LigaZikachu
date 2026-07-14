import { createHash, randomInt } from "crypto";
import { ZikaCoinTxType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";
import { normalizeCombatRole, type CombatRole } from "@/lib/combat-roles";
import { creditCoins } from "@/lib/zikacoins";

export const ORDER_EVENT_SLUG = "ordem-da-trapaca";
export const ORDER_RAID_PASSWORD = "063741";

export const RAID_PHASE_LABELS: Record<string, string> = {
  ANNOUNCED: "Anunciado",
  INVESTIGATION: "Investigacao",
  HIDEOUT_UNLOCKING: "Desbloqueando esconderijo",
  HIDEOUT_FOUND: "Esconderijo encontrado",
  RAID_ACTIVE: "Raid ativa",
  RAID_DEFEATED: "Raid vencida",
  RAID_FAILED: "Boss escapou",
  ENDED: "Encerrado",
};

export const ORDER_MYSTERY_STEPS = [
  {
    stepKey: "ZIKALOOT_FAKE_NUMBER",
    pageKey: "zikaloot",
    requiredVisibleClues: 7,
    requiredGeneralClues: 5,
    requiredSpecificClues: 2,
    requiredPreviousStepKey: null,
    interactionType: "CLICK",
    targetKey: "fake-number",
    successFeedback: "“O número falso se desfez em fumaça roxa. A ZikaLoot foi recuperada!”",
    earlyFeedback: "“O painel parece suspeito, mas ainda faltam pistas para entender a tranca.”",
  },
  {
    stepKey: "BAZAR_SLOT_SIX_CLICKS",
    pageKey: "bazar",
    requiredVisibleClues: 13,
    requiredGeneralClues: 10,
    requiredSpecificClues: 3,
    requiredPreviousStepKey: null,
    interactionType: "MULTI_CLICK",
    targetKey: "sabotaged-slot",
    successFeedback: "“O slot sabotado piscou e voltou ao normal.”",
    earlyFeedback: "“O slot parece falso, mas ainda faltam pistas para desmontar a fraude.”",
  },
  {
    stepKey: "LAB_SMOKE_TO_MACHINE",
    pageKey: "laboratorio",
    requiredVisibleClues: 18,
    requiredGeneralClues: 15,
    requiredSpecificClues: 3,
    requiredPreviousStepKey: null,
    interactionType: "DRAG",
    targetKey: "smoke-to-machine",
    successFeedback: "“A fumaça foi sugada pela máquina. O Laboratório voltou a funcionar.”",
    earlyFeedback: "“A fumaça se mexeu, mas você ainda não sabe o que fazer com ela.”",
  },
  {
    stepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS",
    pageKey: "liga-semanal",
    requiredVisibleClues: 24,
    requiredGeneralClues: 20,
    requiredSpecificClues: 4,
    requiredPreviousStepKey: null,
    interactionType: "MULTI_CLICK",
    targetKey: "last-place",
    successFeedback: "“A tabela tremeu e os atributos voltaram ao normal.”",
    earlyFeedback: "“A tabela está adulterada, mas ainda faltam pistas para corrigir.”",
  },
  {
    stepKey: "MASCOTS_EQUIPPED_WHISPER",
    pageKey: "mascotes",
    requiredVisibleClues: 29,
    requiredGeneralClues: 25,
    requiredSpecificClues: 4,
    requiredPreviousStepKey: null,
    interactionType: "CLICK",
    targetKey: "equipped-mascot",
    successFeedback: "“Seu mascote revelou a última pista. Os ataques aleatórios foram interrompidos.”",
    earlyFeedback: "“Seu mascote parece preocupado, mas ainda não quer falar.”",
  },
] as const;

export type OrderMysteryStepKey = typeof ORDER_MYSTERY_STEPS[number]["stepKey"];
export const ORDER_MYSTERY_STEP_KEYS = ORDER_MYSTERY_STEPS.map((step) => step.stepKey);

export const ORDER_STEP_CONFIG = Object.fromEntries(
  ORDER_MYSTERY_STEPS.map((step) => [step.stepKey, step]),
) as Record<OrderMysteryStepKey, typeof ORDER_MYSTERY_STEPS[number]>;

export const ORDER_STEP_REWARD_NOTIFICATION: Record<OrderMysteryStepKey, string> = {
  ZIKALOOT_FAKE_NUMBER: "ORDER_REWARD_ZIKALOOT",
  BAZAR_SLOT_SIX_CLICKS: "ORDER_REWARD_BAZAR",
  LAB_SMOKE_TO_MACHINE: "ORDER_REWARD_LAB",
  MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS: "ORDER_REWARD_LEAGUE",
  MASCOTS_EQUIPPED_WHISPER: "ORDER_REWARD_MASCOTS",
};

export const ORDER_STEP_PUBLIC_REWARD_LABELS: Record<string, string> = {
  ORDER_REWARD_ZIKALOOT: "ZikaLoot roubada",
  ORDER_REWARD_BAZAR: "Bazar sabotado",
  ORDER_REWARD_LAB: "Laboratorio travado",
  ORDER_REWARD_LEAGUE: "Liga Semanal adulterada",
  ORDER_REWARD_MASCOTS: "Mascotes atacados",
};

function hashRaidPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function makeCodeForPosition(password: string, greenIndex: number) {
  const digits = password.split("");
  return digits.map((digit, index) => {
    if (index === greenIndex) return digit;
    let fake = String(randomInt(0, 10));
    while (fake === digit) fake = String(randomInt(0, 10));
    return fake;
  }).join("");
}

export async function ensureOrderPasswordStamps(raidEventId: string) {
  const existing = await prisma.raidPassword.findFirst({
    where: { raidEventId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const players = await prisma.player.findMany({
    where: { active: true, user: { status: "ACTIVE" } },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!players.length) return;

  const password = ORDER_RAID_PASSWORD;
  if (existing) {
    await prisma.raidPassword.update({
      where: { id: existing.id },
      data: {
        passwordHash: hashRaidPassword(password),
        passwordLength: password.length,
        debugPassword: password,
      },
    });
  } else {
    await prisma.raidPassword.create({
      data: {
        raidEventId,
        passwordHash: hashRaidPassword(password),
        passwordLength: password.length,
        debugPassword: password,
      },
    });
  }

  for (let index = 0; index < players.length; index++) {
    const player = players[index];
    const position = index % password.length;
    await prisma.raidPasswordStamp.upsert({
      where: { raidEventId_userId: { raidEventId, userId: player.userId } },
      create: {
        raidEventId,
        userId: player.userId,
        displayedCode: makeCodeForPosition(password, position),
        greenIndex: position,
        greenDigit: password[position],
        active: true,
      },
      update: {
        displayedCode: makeCodeForPosition(password, position),
        greenIndex: position,
        greenDigit: password[position],
        active: true,
      },
    });
  }
}

async function ensureSingleOrderPasswordStamp(raidEventId: string, userId: string) {
  const password = ORDER_RAID_PASSWORD;
  const existingCount = await prisma.raidPasswordStamp.count({ where: { raidEventId } }).catch(() => 0);
  const position = existingCount % password.length;
  return prisma.raidPasswordStamp.upsert({
    where: { raidEventId_userId: { raidEventId, userId } },
    create: {
      raidEventId,
      userId,
      displayedCode: makeCodeForPosition(password, position),
      greenIndex: position,
      greenDigit: password[position],
      active: true,
    },
    update: {
      displayedCode: makeCodeForPosition(password, position),
      greenIndex: position,
      greenDigit: password[position],
      active: true,
    },
    select: { displayedCode: true, greenIndex: true },
  });
}

export async function getOrderPasswordStampForUser(userId: string) {
  const event = await prisma.raidEvent.findUnique({
    where: { slug: ORDER_EVENT_SLUG },
    select: { id: true, active: true, phase: true },
  }).catch(() => null);

  if (!event?.active || !["HIDEOUT_UNLOCKING", "HIDEOUT_FOUND", "RAID_ACTIVE"].includes(String(event.phase))) {
    return null;
  }

  let stamp = await prisma.raidPasswordStamp.findFirst({
    where: { raidEventId: event.id, userId, active: true },
    select: { displayedCode: true, greenIndex: true },
  }).catch(() => null);

  if (!stamp) {
    await ensureOrderPasswordStamps(event.id).catch(() => null);
    stamp = await prisma.raidPasswordStamp.findFirst({
      where: { raidEventId: event.id, userId, active: true },
      select: { displayedCode: true, greenIndex: true },
    }).catch(() => null);
  }

  if (!stamp) {
    stamp = await ensureSingleOrderPasswordStamp(event.id, userId).catch(() => null);
  }

  return stamp;
}

export const ORDER_STEP_SABOTAGE_TARGETS: Partial<Record<OrderMysteryStepKey, Array<{
  systemKey: string;
  sabotageType?: string;
  effectKind?: string;
}>>> = {
  ZIKALOOT_FAKE_NUMBER: [{ systemKey: "ZIKALOOT", sabotageType: "ZIKALOOT_FAKE_NUMBER" }],
  BAZAR_SLOT_SIX_CLICKS: [
    { systemKey: "BAZAR", sabotageType: "BLOCK_BAZAR_SLOT" },
    { systemKey: "ZIKASHOP", sabotageType: "INCREASE_PRICE" },
  ],
  LAB_SMOKE_TO_MACHINE: [{ systemKey: "LABORATORY", sabotageType: "DISABLE_LAB_ANALYSIS" }],
  MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS: [{ systemKey: "MASCOT_LEAGUE", effectKind: "WEEKLY_LEAGUE_SLOT_DEBUFF" }],
  MASCOTS_EQUIPPED_WHISPER: [{ systemKey: "MASCOTS", effectKind: "RANDOM_MASCOT_INJURY" }],
};

export async function deactivateOrderSabotagesForStep(raidEventId: string, stepKey: OrderMysteryStepKey) {
  const targets = ORDER_STEP_SABOTAGE_TARGETS[stepKey] ?? [];
  const now = new Date();
  let deactivated = 0;

  for (const target of targets) {
    const activeSabotages = await prisma.raidSabotage.findMany({
      where: {
        raidEventId,
        active: true,
        systemKey: target.systemKey as never,
        ...(target.sabotageType ? { sabotageType: target.sabotageType as never } : {}),
      },
      select: { id: true, effectJson: true },
    });

    const ids = activeSabotages
      .filter((sabotage) => !target.effectKind || readJsonRecord(sabotage.effectJson).kind === target.effectKind)
      .map((sabotage) => sabotage.id);

    if (!ids.length) continue;

    const result = await prisma.raidSabotage.updateMany({
      where: { id: { in: ids } },
      data: { active: false, endsAt: now },
    });
    deactivated += result.count;
  }

  return { deactivated };
}

export const ORDER_STARTER_CLUES = [
  { clueText: "“A Ordem da Trapaça roubou as recompensas da ZikaLoot!”", rarity: "COMMON", quality: "GOOD", relatedStepKey: "ZIKALOOT_FAKE_NUMBER" },
  { clueText: "“A ZikaLoot está trancada. O painel foi adulterado por trapaceiros.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: "ZIKALOOT_FAKE_NUMBER" },
  { clueText: "“As recompensas de hoje sumiram em uma nuvem de fumaça roxa.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: "ZIKALOOT_FAKE_NUMBER" },
  { clueText: "“O sorteio foi interrompido. Alguém passou aqui antes da Liga.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: "ZIKALOOT_FAKE_NUMBER" },
  { clueText: "“O painel da ZikaLoot está bloqueado por uma trapaça descarada.”", rarity: "COMMON", quality: "OK", relatedStepKey: "ZIKALOOT_FAKE_NUMBER" },
  { clueText: "“Os números foram apagados. No lugar deles, ficou o símbolo da Ordem.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: "ZIKALOOT_FAKE_NUMBER" },
  { clueText: "“A ZikaLoot foi invadida. As recompensas estão temporariamente indisponíveis.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: "ZIKALOOT_FAKE_NUMBER" },
  { clueText: "“Um bilhete rasgado diz: ‘Obrigado pelos prêmios. Ass: Ordem da Trapaça.’”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: "ZIKALOOT_FAKE_NUMBER" },
  { clueText: "“A máquina da sorte está parada. Parece que roubaram até o azar.”", rarity: "UNCOMMON", quality: "OK", relatedStepKey: "ZIKALOOT_FAKE_NUMBER" },
  { clueText: "“A ZikaLoot não pode ser usada enquanto essa travessura estiver ativa.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "ZIKALOOT_FAKE_NUMBER" },
  { clueText: "“O slot do meio do Bazar foi sabotado.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: "BAZAR_SLOT_SIX_CLICKS" },
  { clueText: "“Essa oferta parece real, mas está corrompida pela Ordem da Trapaça.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: "BAZAR_SLOT_SIX_CLICKS" },
  { clueText: "“O item do meio está visível, mas a compra foi bloqueada.”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: "BAZAR_SLOT_SIX_CLICKS" },
  { clueText: "“Uma oferta falsa apareceu no centro do Bazar.”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: "BAZAR_SLOT_SIX_CLICKS" },
  { clueText: "“A Ordem colocou um anúncio trapaceiro no Bazar.”", rarity: "UNCOMMON", quality: "OK", relatedStepKey: "BAZAR_SLOT_SIX_CLICKS" },
  { clueText: "“O slot do meio está preso em uma trapaça.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: "BAZAR_SLOT_SIX_CLICKS" },
  { clueText: "“Esse item pisca como oferta, mas não pode ser comprado.”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: "BAZAR_SLOT_SIX_CLICKS" },
  { clueText: "“O Bazar está vendendo uma mentira no slot central.”", rarity: "UNCOMMON", quality: "OK", relatedStepKey: "BAZAR_SLOT_SIX_CLICKS" },
  { clueText: "“A compra falhou. O slot do meio está adulterado.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "BAZAR_SLOT_SIX_CLICKS" },
  { clueText: "“A Ordem da Trapaça deixou um selo falso nessa oferta.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "BAZAR_SLOT_SIX_CLICKS" },
  { clueText: "“A máquina de análise foi travada pela Ordem da Trapaça.”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: "LAB_SMOKE_TO_MACHINE" },
  { clueText: "“Uma fumaça roxa bloqueia o Laboratório.”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: "LAB_SMOKE_TO_MACHINE" },
  { clueText: "“A análise de mascotes está temporariamente indisponível.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "LAB_SMOKE_TO_MACHINE" },
  { clueText: "“O Laboratório está tossindo fumaça suspeita.”", rarity: "RARE", quality: "OK", relatedStepKey: "LAB_SMOKE_TO_MACHINE" },
  { clueText: "“A máquina não responde. Algo foi adulterado por dentro.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "LAB_SMOKE_TO_MACHINE" },
  { clueText: "“A Ordem sabotou os sensores de análise.”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: "LAB_SMOKE_TO_MACHINE" },
  { clueText: "“A tela do Laboratório mostra apenas símbolos corrompidos.”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: "LAB_SMOKE_TO_MACHINE" },
  { clueText: "“A análise falhou antes mesmo de começar.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "LAB_SMOKE_TO_MACHINE" },
  { clueText: "“A fumaça parece estar escondendo uma mensagem.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "LAB_SMOKE_TO_MACHINE" },
  { clueText: "“O Laboratório está trancado por uma travessura técnica.”", rarity: "VERY_RARE", quality: "OK", relatedStepKey: "LAB_SMOKE_TO_MACHINE" },
  { clueText: "“A Ordem da Trapaça adulterou a Liga Semanal.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS" },
  { clueText: "“Os três primeiros slots das equipes estão com atributos reduzidos.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS" },
  { clueText: "“Mascotes nos slots 1, 2 e 3 estão lutando com metade da força.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS" },
  { clueText: "“A tabela da Liga Semanal foi corrompida.”", rarity: "VERY_RARE", quality: "OK", relatedStepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS" },
  { clueText: "“A Ordem mexeu nos cálculos dos primeiros slots.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS" },
  { clueText: "“Os primeiros mascotes de cada equipe foram enfraquecidos por trapaça.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS" },
  { clueText: "“A Liga Semanal está sob interferência da Ordem.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS" },
  { clueText: "“Os atributos dos slots iniciais foram cortados pela metade.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS" },
  { clueText: "“O começo das equipes foi sabotado.”", rarity: "VERY_RARE", quality: "OK", relatedStepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS" },
  { clueText: "“A Ordem transformou estratégia em confusão.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS" },
  { clueText: "“A Ordem da Trapaça está atacando mascotes desavisados.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "MASCOTS_EQUIPPED_WHISPER" },
  { clueText: "“Alguns mascotes podem aparecer feridos durante o evento.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "MASCOTS_EQUIPPED_WHISPER" },
  { clueText: "“Mascotes estão voltando machucados sem terem entrado em batalha.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: "MASCOTS_EQUIPPED_WHISPER" },
  { clueText: "“A Ordem está causando confusão entre os companheiros.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: "MASCOTS_EQUIPPED_WHISPER" },
  { clueText: "“Há relatos de mascotes feridos por ataques surpresa.”", rarity: "VERY_RARE", quality: "OK", relatedStepKey: "MASCOTS_EQUIPPED_WHISPER" },
  { clueText: "“Os mascotes estão inquietos. Algo está acontecendo.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "MASCOTS_EQUIPPED_WHISPER" },
  { clueText: "“A Ordem deixou armadilhas espalhadas pela Liga.”", rarity: "RARE", quality: "GOOD", relatedStepKey: "MASCOTS_EQUIPPED_WHISPER" },
  { clueText: "“Alguns companheiros foram atingidos pelas travessuras da Ordem.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: "MASCOTS_EQUIPPED_WHISPER" },
  { clueText: "“Os mascotes equipados parecem saber mais do que estão dizendo.”", rarity: "VERY_RARE", quality: "OK", relatedStepKey: "MASCOTS_EQUIPPED_WHISPER" },
  { clueText: "“A Liga registrou ferimentos estranhos em mascotes durante o dia.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: "MASCOTS_EQUIPPED_WHISPER" },
  { clueText: "“Uma nova anotação sobre a Ordem da Trapaça foi encontrada.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Alguém encontrou uma pista suspeita.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Uma pista caiu no painel da investigação.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Um bilhete estranho foi adicionado às anotações.”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: null },
  { clueText: "“A Liga encontrou mais um fragmento do mistério.”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Uma nova pista foi compartilhada com todos os jogadores.”", rarity: "UNCOMMON", quality: "OK", relatedStepKey: null },
  { clueText: "“As anotações da investigação foram atualizadas.”", rarity: "RARE", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Mais uma pista apareceu no caso da Ordem da Trapaça.”", rarity: "RARE", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Um mascote encontrou um bilhete importante.”", rarity: "RARE", quality: "OK", relatedStepKey: null },
  { clueText: "“A investigação ganhou uma nova anotação.”", rarity: "RARE", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Seu mascote encontrou uma pista importante sobre a Ordem da Trapaça.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Depois da atividade, um bilhete suspeito caiu no chão.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Você encontrou uma anotação que foi enviada ao painel da investigação.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Uma pista foi descoberta e compartilhada com todos.”", rarity: "VERY_RARE", quality: "OK", relatedStepKey: null },
  { clueText: "“Seu mascote farejou algo estranho e revelou uma nova anotação.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Um símbolo roxo apareceu no rodapé de uma página antiga da Liga.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: null },
  { clueText: "“As pistas não apontam para um lugar só; elas parecem se somar.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Um mascote voltou carregando um papel com marcas de fumaça.”", rarity: "COMMON", quality: "GOOD", relatedStepKey: null },
  { clueText: "“A Ordem deixou pistas espalhadas em atividades rápidas.”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: null },
  { clueText: "“O painel da investigação brilhou por um instante e registrou uma nova nota.”", rarity: "UNCOMMON", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Nada foi resolvido ainda, mas o desenho do mistério ficou menos confuso.”", rarity: "UNCOMMON", quality: "OK", relatedStepKey: null },
  { clueText: "“A assinatura da Ordem apareceu em uma pista sem destino específico.”", rarity: "RARE", quality: "GOOD", relatedStepKey: null },
  { clueText: "“O próximo passo depende de juntar pistas gerais com pistas de uma travessura.”", rarity: "RARE", quality: "GOOD", relatedStepKey: null },
  { clueText: "“Uma anotação diz: ‘quando todos olham juntos, a trapaça aparece’.”", rarity: "RARE", quality: "GOOD", relatedStepKey: null },
  { clueText: "“A Liga encontrou um fragmento que ajuda qualquer parte da investigação.”", rarity: "VERY_RARE", quality: "GOOD", relatedStepKey: null },
] as const;

export type OrderEventPageData = {
  schemaReady: boolean;
  cluePagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  event: {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    localOnly: boolean;
    phase: string;
    villainGroupName: string;
    bossName: string;
    bossMascotName: string;
    bossPokemonId: number;
    bossMegaPokemonId: number;
    bossHpMax: number;
    bossHpCurrent: number;
    megaThresholdPercent: number;
    startsAt: string | null;
    raidStartsAt: string | null;
    raidEndsAt: string | null;
    hideoutFoundAt: string | null;
  } | null;
  stats: {
    visibleClues: number;
    totalClues: number;
    resolvedSteps: number;
    totalSteps: number;
    activeSabotages: number;
    battleAttempts: number;
  };
  clues: Array<{
    id: string;
    clueText: string;
    rarity: string;
    quality: string;
    relatedStepKey: string | null;
    visible: boolean;
    releasedAt: string | null;
    discoveredAt: string | null;
    discoveredByName: string | null;
    sortOrder: number;
  }>;
  clueProgress: Array<{
    stepKey: string;
    pageKey: string;
    label: string;
    requiredGeneralClues: number;
    requiredSpecificClues: number;
    visibleGeneralClues: number;
    visibleSpecificClues: number;
    solutionUnlocked: boolean;
    resolvedAt: string | null;
    clues: Array<{
      id: string;
      clueText: string;
      rarity: string;
      quality: string;
      visible: boolean;
      releasedAt: string | null;
      sortOrder: number;
    }>;
  }>;
  sabotages: Array<{
    id: string;
    systemKey: string;
    sabotageType: string;
    title: string;
    description: string | null;
    effectJson: unknown;
    active: boolean;
    visibleToPlayers: boolean;
    severity: number;
    startsAt: string | null;
    endsAt: string | null;
  }>;
  steps: Array<{
    id: string;
    stepKey: string;
    pageKey: string;
    requiredVisibleClues: number;
    requiredPreviousStepKey: string | null;
    interactionType: string;
    targetKey: string;
    resolvedAt: string | null;
    resolvedByUserId: string | null;
    resolvedByName: string | null;
    active: boolean;
  }>;
  rankings: Array<{
    id: string;
    playerId: string;
    playerName: string;
    totalDamage: number;
    battleCount: number;
    highestSingleDamage: number;
    participationPoints: number;
    megaPhaseAttempts: number;
  }>;
  clueRankings: Array<{
    playerId: string;
    playerName: string;
    clueCount: number;
    lastDiscoveredAt: string | null;
  }>;
};

export type ActiveRaidSabotage = {
  id: string;
  systemKey: string;
  sabotageType: string;
  title: string;
  description: string | null;
  effectJson: unknown;
  severity: number;
  visibleToPlayers: boolean;
};

export type WeeklyLeagueSabotageConfig = {
  id: string;
  title: string;
  description: string | null;
  affectedSlots: number[];
  statMultiplier: number;
  affectedStats: Array<"force" | "agility" | "instinct" | "vitality" | "charisma">;
};

export type RandomMascotInjurySabotageConfig = {
  id: string;
  title: string;
  description: string | null;
  dailyLimit: number;
  emergencyDisabled: boolean;
  avoidFavorites: boolean;
  maxPerPlayerPerDay: number;
};

export function getBossHpPercent(event: NonNullable<OrderEventPageData["event"]>) {
  if (event.bossHpMax <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((event.bossHpCurrent / event.bossHpMax) * 100)));
}

function mascotRaidPower(mascot: {
  level: number;
  statForce: number;
  statAgility: number;
  statInstinct: number;
  statVitality: number;
  statCharisma: number;
}) {
  const stats = mascot.statForce + mascot.statAgility + mascot.statInstinct + mascot.statVitality + mascot.statCharisma;
  return Math.max(25, Math.round(stats * (1 + mascot.level / 28)));
}

export async function estimateOrderRaidBossHp() {
  const players = await prisma.player.findMany({
    where: { active: true, user: { status: "ACTIVE", role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } },
    select: {
      mascots: {
        where: { arenaState: { not: "INJURED" } },
        select: {
          level: true,
          statForce: true,
          statAgility: true,
          statInstinct: true,
          statVitality: true,
          statCharisma: true,
        },
        orderBy: [{ level: "desc" }, { statForce: "desc" }],
        take: 12,
      },
    },
  }).catch(() => []);

  const teamPowers = players
    .map((player) => player.mascots
      .map(mascotRaidPower)
      .sort((a, b) => b - a)
      .slice(0, 6)
      .reduce((sum, power) => sum + power, 0))
    .filter((power) => power > 0)
    .sort((a, b) => b - a)
    .slice(0, 50);

  const strongest = teamPowers[0] ?? 1400;
  const topAverage = teamPowers.reduce((sum, power) => sum + power, 0) / Math.max(1, teamPowers.length);
  const expectedActivePlayers = Math.max(6, Math.min(24, teamPowers.length || 6));
  const targetAttacksPerPlayer = 7;
  const targetDamagePerAttack = Math.max(strongest * 3.4, topAverage * 4.2);
  return Math.max(180_000, Math.round(targetDamagePerAttack * expectedActivePlayers * targetAttacksPerPlayer));
}

export async function getOrderEventPageData(options: { cluePage?: number; cluePageSize?: number } = {}): Promise<OrderEventPageData> {
  const cluePageSize = Math.min(Math.max(options.cluePageSize ?? 12, 6), 30);
  const cluePage = Math.max(1, options.cluePage ?? 1);
  const clueSkip = (cluePage - 1) * cluePageSize;
  let event;
  try {
    event = await prisma.raidEvent.findUnique({
      where: { slug: ORDER_EVENT_SLUG },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        localOnly: true,
        phase: true,
        villainGroupName: true,
        bossName: true,
        bossMascotName: true,
        bossPokemonId: true,
        bossMegaPokemonId: true,
        bossHpMax: true,
        bossHpCurrent: true,
        megaThresholdPercent: true,
        startsAt: true,
        raidStartsAt: true,
        raidEndsAt: true,
        hideoutFoundAt: true,
      },
    });
  } catch {
    return {
      schemaReady: false,
      cluePagination: { page: 1, pageSize: cluePageSize, total: 0, totalPages: 1 },
      event: null,
      stats: { visibleClues: 0, totalClues: 0, resolvedSteps: 0, totalSteps: 0, activeSabotages: 0, battleAttempts: 0 },
      clues: [],
      clueProgress: [],
      sabotages: [],
      steps: [],
      rankings: [],
      clueRankings: [],
    };
  }

  if (!event) {
    return {
      schemaReady: true,
      cluePagination: { page: 1, pageSize: cluePageSize, total: 0, totalPages: 1 },
      event: null,
      stats: { visibleClues: 0, totalClues: 0, resolvedSteps: 0, totalSteps: 0, activeSabotages: 0, battleAttempts: 0 },
      clues: [],
      clueProgress: [],
      sabotages: [],
      steps: [],
      rankings: [],
      clueRankings: [],
    };
  }

  const [clues, allCluesForProgress, totalClues, steps, sabotages, battleAttempts, rankings, discoveredClues] = await Promise.all([
    prisma.raidClue.findMany({
      where: { raidEventId: event.id },
      select: {
        id: true,
        clueText: true,
        rarity: true,
        quality: true,
        relatedStepKey: true,
        visible: true,
        releasedAt: true,
        discoveredAt: true,
        sortOrder: true,
        discoveredBy: { select: { displayName: true } },
      },
      orderBy: [{ visible: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      skip: clueSkip,
      take: cluePageSize,
    }),
    prisma.raidClue.findMany({
      where: { raidEventId: event.id },
      select: { id: true, clueText: true, rarity: true, quality: true, relatedStepKey: true, visible: true, releasedAt: true, sortOrder: true },
      orderBy: [{ visible: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.raidClue.count({
      where: { raidEventId: event.id },
    }),
    prisma.raidMysteryStep.findMany({
      where: { raidEventId: event.id, active: true, stepKey: { in: [...ORDER_MYSTERY_STEP_KEYS] } },
      select: {
        id: true,
        stepKey: true,
        pageKey: true,
        requiredVisibleClues: true,
        requiredPreviousStepKey: true,
        interactionType: true,
        targetKey: true,
        resolvedAt: true,
        resolvedByUserId: true,
        active: true,
      },
      orderBy: { requiredVisibleClues: "asc" },
    }),
    prisma.raidSabotage.findMany({
      where: { raidEventId: event.id },
      select: {
        id: true,
        systemKey: true,
        sabotageType: true,
        title: true,
        description: true,
        effectJson: true,
        active: true,
        visibleToPlayers: true,
        severity: true,
        startsAt: true,
        endsAt: true,
      },
      orderBy: [{ active: "desc" }, { severity: "desc" }, { createdAt: "desc" }],
      take: 30,
    }),
    prisma.raidBattleAttempt.count({ where: { raidEventId: event.id } }),
    prisma.raidDamageRanking.findMany({
      where: { raidEventId: event.id },
      select: {
        id: true,
        playerId: true,
        totalDamage: true,
        battleCount: true,
        highestSingleDamage: true,
        participationPoints: true,
        megaPhaseAttempts: true,
        player: { select: { displayName: true } },
      },
      orderBy: [{ battleCount: "desc" }, { totalDamage: "desc" }, { participationPoints: "desc" }],
      take: 50,
    }),
    prisma.raidClue.findMany({
      where: { raidEventId: event.id, discoveredByPlayerId: { not: null } },
      select: {
        discoveredAt: true,
        discoveredByPlayerId: true,
        discoveredBy: { select: { displayName: true } },
      },
      orderBy: { discoveredAt: "desc" },
    }),
  ]);

  const visibleGeneralClues = allCluesForProgress.filter((clue) => clue.visible && !clue.relatedStepKey).length;
  const cluesByStep = new Map<string, typeof allCluesForProgress>();
  const resolvedSteps = new Set(steps.filter((step) => step.resolvedAt).map((step) => step.stepKey));
  for (const clue of allCluesForProgress) {
    if (!clue.relatedStepKey) continue;
    const list = cluesByStep.get(clue.relatedStepKey) ?? [];
    list.push(clue);
    cluesByStep.set(clue.relatedStepKey, list);
  }

  const clueProgress = steps.map((step) => {
    const config = ORDER_STEP_CONFIG[step.stepKey as OrderMysteryStepKey];
    const stepClues = cluesByStep.get(step.stepKey) ?? [];
    const visibleSpecificClues = stepClues.filter((clue) => clue.visible).length;
    const requiredGeneralClues = config?.requiredGeneralClues ?? 0;
    const requiredSpecificClues = config?.requiredSpecificClues ?? step.requiredVisibleClues;
    const requiredPreviousStepKey = config ? config.requiredPreviousStepKey : step.requiredPreviousStepKey;
    const previousResolved = !requiredPreviousStepKey || resolvedSteps.has(requiredPreviousStepKey);
    return {
      stepKey: step.stepKey,
      pageKey: step.pageKey,
      label: config?.pageKey ?? step.pageKey,
      requiredGeneralClues,
      requiredSpecificClues,
      visibleGeneralClues,
      visibleSpecificClues,
      solutionUnlocked: !!step.resolvedAt || (previousResolved && visibleGeneralClues >= requiredGeneralClues && visibleSpecificClues >= requiredSpecificClues),
      resolvedAt: step.resolvedAt?.toISOString() ?? null,
      clues: stepClues.map((clue) => ({
        id: clue.id,
        clueText: clue.clueText,
        rarity: String(clue.rarity),
        quality: String(clue.quality),
        visible: clue.visible,
        releasedAt: clue.releasedAt?.toISOString() ?? null,
        sortOrder: clue.sortOrder,
      })),
    };
  });
  const resolvedUserIds = steps
    .map((step) => step.resolvedByUserId)
    .filter((id): id is string => Boolean(id));
  const resolvedPlayers = resolvedUserIds.length
    ? await prisma.player.findMany({
        where: { userId: { in: resolvedUserIds } },
        select: { userId: true, displayName: true },
      })
    : [];
  const resolvedNameByUserId = new Map(resolvedPlayers.map((player) => [player.userId, player.displayName]));
  const clueRankingMap = new Map<string, { playerId: string; playerName: string; clueCount: number; lastDiscoveredAt: Date | null }>();
  for (const clue of discoveredClues) {
    if (!clue.discoveredByPlayerId) continue;
    const current = clueRankingMap.get(clue.discoveredByPlayerId);
    if (current) {
      current.clueCount += 1;
      if (clue.discoveredAt && (!current.lastDiscoveredAt || clue.discoveredAt > current.lastDiscoveredAt)) {
        current.lastDiscoveredAt = clue.discoveredAt;
      }
    } else {
      clueRankingMap.set(clue.discoveredByPlayerId, {
        playerId: clue.discoveredByPlayerId,
        playerName: clue.discoveredBy?.displayName ?? "Jogador",
        clueCount: 1,
        lastDiscoveredAt: clue.discoveredAt,
      });
    }
  }
  const clueRankings = [...clueRankingMap.values()]
    .sort((a, b) => b.clueCount - a.clueCount || (b.lastDiscoveredAt?.getTime() ?? 0) - (a.lastDiscoveredAt?.getTime() ?? 0))
    .slice(0, 10);

  return {
    schemaReady: true,
    cluePagination: {
      page: cluePage,
      pageSize: cluePageSize,
      total: totalClues,
      totalPages: Math.max(1, Math.ceil(totalClues / cluePageSize)),
    },
    event: {
      ...event,
      phase: String(event.phase),
      startsAt: event.startsAt?.toISOString() ?? null,
      raidStartsAt: event.raidStartsAt?.toISOString() ?? null,
      raidEndsAt: event.raidEndsAt?.toISOString() ?? null,
      hideoutFoundAt: event.hideoutFoundAt?.toISOString() ?? null,
    },
    stats: {
      visibleClues: allCluesForProgress.filter((clue) => clue.visible).length,
      totalClues,
      resolvedSteps: steps.filter((step) => step.resolvedAt).length,
      totalSteps: steps.length,
      activeSabotages: sabotages.filter((sabotage) => sabotage.active).length,
      battleAttempts,
    },
    clues: clues.map((clue) => ({
      ...clue,
      rarity: String(clue.rarity),
      quality: String(clue.quality),
      releasedAt: clue.releasedAt?.toISOString() ?? null,
      discoveredAt: clue.discoveredAt?.toISOString() ?? null,
      discoveredByName: clue.discoveredBy?.displayName ?? null,
    })),
    clueProgress,
    sabotages: sabotages.map((sabotage) => ({
      ...sabotage,
      systemKey: String(sabotage.systemKey),
      sabotageType: String(sabotage.sabotageType),
      startsAt: sabotage.startsAt?.toISOString() ?? null,
      endsAt: sabotage.endsAt?.toISOString() ?? null,
    })),
    steps: steps.map((step) => ({
      ...step,
      interactionType: String(step.interactionType),
      resolvedAt: step.resolvedAt?.toISOString() ?? null,
      resolvedByName: step.resolvedByUserId ? resolvedNameByUserId.get(step.resolvedByUserId) ?? "Jogador" : null,
    })),
    rankings: rankings
      .map((row) => ({ ...row, playerName: row.player.displayName, averageDamage: Math.round(row.totalDamage / Math.max(1, row.battleCount)) }))
      .sort((a, b) => b.battleCount - a.battleCount || b.averageDamage - a.averageDamage || b.totalDamage - a.totalDamage)
      .slice(0, 10),
    clueRankings: clueRankings.map((row) => ({
      ...row,
      lastDiscoveredAt: row.lastDiscoveredAt?.toISOString() ?? null,
    })),
  };
}

export async function getActiveRaidSabotages(systemKey: string): Promise<ActiveRaidSabotage[]> {
  const now = new Date();
  try {
    const event = await prisma.raidEvent.findUnique({
      where: { slug: ORDER_EVENT_SLUG },
      select: { id: true, active: true, phase: true },
    });
    if (!event?.active || event.phase === "RAID_ACTIVE" || event.phase === "RAID_DEFEATED" || event.phase === "RAID_FAILED" || event.phase === "ENDED") {
      return [];
    }

    const sabotages = await prisma.raidSabotage.findMany({
      where: {
        raidEventId: event.id,
        active: true,
        systemKey: systemKey as never,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      select: {
        id: true,
        systemKey: true,
        sabotageType: true,
        title: true,
        description: true,
        effectJson: true,
        severity: true,
        visibleToPlayers: true,
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 5,
    });

    return sabotages.map((sabotage) => ({
      ...sabotage,
      systemKey: String(sabotage.systemKey),
      sabotageType: String(sabotage.sabotageType),
    }));
  } catch {
    return [];
  }
}

export type OrderStepUnlockState = {
  active: boolean;
  unlocked: boolean;
  resolved: boolean;
  generalClues: number;
  specificClues: number;
  requiredGeneralClues: number;
  requiredSpecificClues: number;
};

export async function getOrderStepUnlockState(stepKey: OrderMysteryStepKey): Promise<OrderStepUnlockState> {
  const fallback: OrderStepUnlockState = {
    active: false,
    unlocked: false,
    resolved: false,
    generalClues: 0,
    specificClues: 0,
    requiredGeneralClues: ORDER_STEP_CONFIG[stepKey]?.requiredGeneralClues ?? 0,
    requiredSpecificClues: ORDER_STEP_CONFIG[stepKey]?.requiredSpecificClues ?? 0,
  };

  try {
    const event = await prisma.raidEvent.findUnique({
      where: { slug: ORDER_EVENT_SLUG },
      select: { id: true, active: true, phase: true },
    });
    if (!event?.active || event.phase === "ANNOUNCED" || event.phase === "ENDED") return fallback;

    const step = await prisma.raidMysteryStep.findFirst({
      where: { raidEventId: event.id, stepKey, active: true },
      select: { resolvedAt: true, requiredPreviousStepKey: true },
    });
    if (!step) return fallback;

    const config = ORDER_STEP_CONFIG[stepKey];
    const [generalClues, specificClues, previous] = await Promise.all([
      prisma.raidClue.count({ where: { raidEventId: event.id, visible: true, relatedStepKey: null } }),
      prisma.raidClue.count({ where: { raidEventId: event.id, visible: true, relatedStepKey: stepKey } }),
      config.requiredPreviousStepKey
        ? prisma.raidMysteryStep.findFirst({
            where: { raidEventId: event.id, stepKey: config.requiredPreviousStepKey },
            select: { resolvedAt: true },
          })
        : Promise.resolve(null),
    ]);

    const requiredGeneralClues = config.requiredGeneralClues;
    const requiredSpecificClues = config.requiredSpecificClues;
    const previousResolved = !config.requiredPreviousStepKey || !!previous?.resolvedAt;
    const unlocked = !!step.resolvedAt || (previousResolved && generalClues >= requiredGeneralClues && specificClues >= requiredSpecificClues);

    return {
      active: true,
      unlocked,
      resolved: !!step.resolvedAt,
      generalClues,
      specificClues,
      requiredGeneralClues,
      requiredSpecificClues,
    };
  } catch {
    return fallback;
  }
}

async function selectNextUsefulOrderClueId(eventId: string) {
  const steps = await prisma.raidMysteryStep.findMany({
    where: { raidEventId: eventId, active: true, stepKey: { in: [...ORDER_MYSTERY_STEP_KEYS] }, resolvedAt: null },
    select: { stepKey: true },
    orderBy: { requiredVisibleClues: "asc" },
  });

  const visibleGeneral = await prisma.raidClue.count({
    where: { raidEventId: eventId, visible: true, relatedStepKey: null },
  });

  for (const step of steps) {
    const config = ORDER_STEP_CONFIG[step.stepKey as OrderMysteryStepKey];
    if (!config) continue;

    if (visibleGeneral < config.requiredGeneralClues) {
      const general = await prisma.raidClue.findFirst({
        where: { raidEventId: eventId, visible: false, relatedStepKey: null },
        select: { id: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      if (general) return general.id;
    }

    const visibleSpecific = await prisma.raidClue.count({
      where: { raidEventId: eventId, visible: true, relatedStepKey: step.stepKey },
    });
    if (visibleSpecific < config.requiredSpecificClues) {
      const specific = await prisma.raidClue.findFirst({
        where: { raidEventId: eventId, visible: false, relatedStepKey: step.stepKey },
        select: { id: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
      if (specific) return specific.id;
    }
  }

  const any = await prisma.raidClue.findFirst({
    where: { raidEventId: eventId, visible: false },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return any?.id ?? null;
}

export async function maybeRevealOrderClueFromExpedition(params: {
  playerId: string;
  mascotId: string;
  durationKey: string;
  mode: string;
}) {
  if (!["30min", "1h"].includes(params.durationKey)) return null;
  if (!["STANDARD", "ITEMS"].includes(params.mode)) return null;

  const event = await prisma.raidEvent.findUnique({
    where: { slug: ORDER_EVENT_SLUG },
    select: { id: true, active: true, phase: true },
  }).catch(() => null);
  if (!event?.active || event.phase !== "INVESTIGATION") return null;

  const chance = params.durationKey === "30min" ? 0.2975 : 0.4675;
  if (Math.random() > chance) return null;

  const clueId = await selectNextUsefulOrderClueId(event.id);
  if (!clueId) return null;

  const clue = await prisma.raidClue.update({
    where: { id: clueId },
    data: { visible: true, releasedAt: new Date(), discoveredAt: new Date(), discoveredByPlayerId: params.playerId },
    select: { id: true, clueText: true, relatedStepKey: true },
  });

  await prisma.mascotEvent.create({
    data: {
      mascotId: params.mascotId,
      emoji: "PISTA",
      description: `Encontrou uma pista importante sobre a Ordem da Trapaca: ${clue.clueText}`,
    },
  }).catch(() => null);

  return clue;
}

export async function maybeRevealOrderClueFromArenaPvp(params: {
  playerId: string;
  mascotId?: string | null;
  won: boolean;
}) {
  const event = await prisma.raidEvent.findUnique({
    where: { slug: ORDER_EVENT_SLUG },
    select: { id: true, active: true, phase: true },
  }).catch(() => null);
  if (!event?.active || event.phase !== "INVESTIGATION") return null;

  const chance = params.won ? 0.12 : 0.06;
  if (Math.random() > chance) return null;

  const clueId = await selectNextUsefulOrderClueId(event.id);
  if (!clueId) return null;

  const clue = await prisma.raidClue.update({
    where: { id: clueId },
    data: { visible: true, releasedAt: new Date(), discoveredAt: new Date(), discoveredByPlayerId: params.playerId },
    select: { id: true, clueText: true, relatedStepKey: true },
  });

  if (params.mascotId) {
    await prisma.mascotEvent.create({
      data: {
        mascotId: params.mascotId,
        emoji: "PISTA",
        description: `Encontrou uma pista importante sobre a Ordem da Trapaça na Arena PvP: ${clue.clueText}`,
      },
    }).catch(() => null);
  }

  return clue;
}

export async function grantOrderStepRewardToAll(raidEventId: string, stepKey: OrderMysteryStepKey, resolverUserId?: string | null) {
  const notificationType = ORDER_STEP_REWARD_NOTIFICATION[stepKey];
  if (!notificationType) return { granted: 0 };
  if (!process.env.VERCEL) {
    return { granted: 0, dryRun: true };
  }

  const players = await prisma.player.findMany({
    where: { active: true, user: { status: "ACTIVE" } },
    select: { id: true, userId: true },
  });
  let granted = 0;

  await prisma.$transaction(async (tx) => {
    for (const player of players) {
      const existing = await tx.userRaidNotification.findUnique({
        where: {
          raidEventId_userId_notificationType: {
            raidEventId,
            userId: player.userId,
            notificationType: notificationType as never,
          },
        },
        select: { id: true },
      });
      if (existing) continue;

      await creditCoins(tx as Prisma.TransactionClient, {
        playerId: player.id,
        type: ZikaCoinTxType.ADMIN_ADJUSTMENT,
        amount: 500,
        description: `Bonus da Ordem da Trapaca: ${ORDER_STEP_PUBLIC_REWARD_LABELS[notificationType] ?? stepKey}`,
      });
      await tx.mascotEgg.create({
        data: {
          playerId: player.id,
          type: "EVENT",
          origin: `Ordem da Trapaca - ${stepKey}`,
        },
      });
      await tx.userRaidNotification.create({
        data: {
          raidEventId,
          userId: player.userId,
          notificationType: notificationType as never,
          seenAt: player.userId === resolverUserId ? null : null,
        },
      });
      granted++;
    }
  }, { timeout: 30000, maxWait: 10000 });

  return { granted };
}

async function grantOrderRaidDefeatedRewardToAll(raidEventId: string) {
  if (!process.env.VERCEL) {
    return { granted: 0, dryRun: true };
  }

  const players = await prisma.player.findMany({
    where: { active: true, user: { status: "ACTIVE" } },
    select: { id: true, userId: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const player of players) {
      const existing = await tx.userRaidNotification.findUnique({
        where: {
          raidEventId_userId_notificationType: {
            raidEventId,
            userId: player.userId,
            notificationType: "RAID_DEFEATED",
          },
        },
        select: { id: true },
      });
      if (existing) continue;

      await tx.mascotEgg.createMany({
        data: [
          { playerId: player.id, type: "SPECIAL", origin: "Ordem da Trapaca derrotada" },
          { playerId: player.id, type: "SPECIAL", origin: "Ordem da Trapaca derrotada" },
        ],
      });
      await tx.userRaidNotification.create({
        data: {
          raidEventId,
          userId: player.userId,
          notificationType: "RAID_DEFEATED",
          seenAt: null,
        },
      });
    }
  }, { timeout: 30000, maxWait: 10000 });
}

export async function submitOrderRaidPassword(userId: string, rawPassword: string) {
  const password = rawPassword.replace(/\D/g, "").slice(0, ORDER_RAID_PASSWORD.length);
  const event = await prisma.raidEvent.findUnique({
    where: { slug: ORDER_EVENT_SLUG },
    select: { id: true, active: true, phase: true, bossHpMax: true },
  });
  if (!event?.active) return { ok: false as const, message: "Evento inativo." };
  if (event.phase !== "HIDEOUT_FOUND") return { ok: false as const, message: "A porta ainda nao esta pronta para a senha." };

  const passwordRecord = await prisma.raidPassword.findFirst({
    where: { raidEventId: event.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, passwordHash: true, solvedAt: true },
  });
  if (!passwordRecord) {
    await ensureOrderPasswordStamps(event.id);
  }

  const record = passwordRecord ?? await prisma.raidPassword.findFirst({
    where: { raidEventId: event.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, passwordHash: true, solvedAt: true },
  });
  if (!record) return { ok: false as const, message: "A fechadura da Ordem ainda nao foi montada." };
  if (record.solvedAt) return { ok: true as const, message: "A porta ja foi aberta." };
  if (hashRaidPassword(password) !== record.passwordHash) {
    return { ok: false as const, message: "Algo me diz que tem como descobrir isso com um pouco de investigação." };
  }

  const now = new Date();
  const raidEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.raidPassword.update({
      where: { id: record.id },
      data: { solvedAt: now, solvedByUserId: userId },
    }),
    prisma.raidEvent.update({
      where: { id: event.id },
      data: {
        phase: "RAID_ACTIVE",
        hideoutFoundAt: now,
        raidStartsAt: now,
        raidEndsAt,
        bossHpCurrent: event.bossHpMax,
      },
    }),
    prisma.userRaidNotification.upsert({
      where: {
        raidEventId_userId_notificationType: {
          raidEventId: event.id,
          userId,
          notificationType: "HIDEOUT_FOUND",
        },
      },
      create: { raidEventId: event.id, userId, notificationType: "HIDEOUT_FOUND" },
      update: { seenAt: null },
    }),
  ]);

    return { ok: true as const, message: "Senha correta. O esconderijo da Ordem foi aberto!" };
}

export async function runOrderRaidBattle(userId: string, selectedMascotIds: string[] = [], selectedRoles: Record<string, string> = {}) {
  const now = new Date();
  const cooldownMs = 30 * 60 * 1000;
  const event = await prisma.raidEvent.findUnique({
    where: { slug: ORDER_EVENT_SLUG },
    select: {
      id: true,
      active: true,
      phase: true,
      bossName: true,
      bossMascotName: true,
      bossPokemonId: true,
      bossMegaPokemonId: true,
      bossHpMax: true,
      bossHpCurrent: true,
      megaThresholdPercent: true,
      megaActivatedAt: true,
    },
  });
  if (!event?.active || event.phase !== "RAID_ACTIVE") {
    return { ok: false as const, message: "O confronto contra a Ordem ainda não começou." };
  }
  if (event.bossHpCurrent <= 0) {
    return { ok: false as const, message: "A Ordem já foi derrotada." };
  }

  const player = await prisma.player.findUnique({
    where: { userId },
    select: { id: true, displayName: true },
  });
  if (!player) return { ok: false as const, message: "Perfil de jogador não encontrado." };

  const lastAttempt = await prisma.raidBattleAttempt.findFirst({
    where: { raidEventId: event.id, playerId: player.id },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (lastAttempt && now.getTime() - lastAttempt.createdAt.getTime() < cooldownMs) {
    const remainingMs = cooldownMs - (now.getTime() - lastAttempt.createdAt.getTime());
    return {
      ok: false as const,
      message: `A equipe precisa se reagrupar. Tente novamente em ${Math.ceil(remainingMs / 60000)} min.`,
      cooldownUntil: new Date(lastAttempt.createdAt.getTime() + cooldownMs).toISOString(),
    };
  }

  const uniqueMascotIds = [...new Set(selectedMascotIds)].slice(0, 6);
  if (uniqueMascotIds.length !== 6) {
    return { ok: false as const, message: "Monte uma equipe completa com 6 mascotes para atacar a Ordem." };
  }

  const mascots = await prisma.mascot.findMany({
    where: {
      id: { in: uniqueMascotIds },
      playerId: player.id,
      arenaState: "FREE",
      expeditions: { none: { status: "ACTIVE" } },
    },
    select: {
      id: true,
      pokemonId: true,
      nickname: true,
      level: true,
      statForce: true,
      statAgility: true,
      statInstinct: true,
      statVitality: true,
      statCharisma: true,
      battleWins: true,
    },
  });
  if (mascots.length !== 6) {
    return { ok: false as const, message: "A equipe precisa ter 6 mascotes livres para atacar a Ordem." };
  }

  const startingBossHp = event.bossHpCurrent;
  const isMegaPhase = event.megaActivatedAt != null || getBossHpPercent({
    ...event,
    phase: String(event.phase),
    startsAt: null,
    raidStartsAt: null,
    raidEndsAt: null,
    hideoutFoundAt: null,
    slug: ORDER_EVENT_SLUG,
    name: "Ordem da Trapaça",
    villainGroupName: "Ordem da Trapaça",
    localOnly: true,
  }) <= event.megaThresholdPercent;

  const mascotOrder = new Map(uniqueMascotIds.map((id, index) => [id, index]));
  const orderedMascots = [...mascots].sort((a, b) => (mascotOrder.get(a.id) ?? 999) - (mascotOrder.get(b.id) ?? 999));
  const roleDamageMultiplier: Record<CombatRole, number> = {
    ATTACKER: 1.12,
    FLANK: 1.08,
    OPPORTUNIST: 1.06,
    ENCOURAGER: 0.82,
    GUARDIAN: 0.88,
    DUELIST: 1.1,
    SABOTEUR: 1.04,
    HEALER: 0.78,
    SCOUT: 0.95,
    PROVOKER: 0.92,
    SPECIALIST: 1.08,
    SURVIVOR: 0.98,
    DEFENDER: 0.9,
  };
  const roleDefenseMultiplier: Record<CombatRole, number> = {
    DEFENDER: 0.74,
    GUARDIAN: 0.8,
    SURVIVOR: 0.82,
    PROVOKER: 0.9,
    SCOUT: 0.92,
    HEALER: 0.94,
    ENCOURAGER: 0.96,
    FLANK: 0.96,
    DUELIST: 0.98,
    SPECIALIST: 0.97,
    ATTACKER: 1,
    OPPORTUNIST: 1,
    SABOTEUR: 1,
  };

  const mascotStates = orderedMascots.map((mascot) => {
    const power = mascotRaidPower(mascot);
    const combatRole = normalizeCombatRole(selectedRoles[mascot.id]);
    const hp = Math.max(120, Math.round(mascot.statVitality * 9 + mascot.level * 16 + power * 0.8));
    return { ...mascot, combatRole, name: mascot.nickname ?? getPokemonName(mascot.pokemonId), power, hp, maxHp: hp, damage: 0, defeated: false };
  });
  const hpPercentAtStart = event.bossHpMax > 0 ? Math.max(0, Math.min(1, startingBossHp / event.bossHpMax)) : 1;
  const baseBossAdvantage = 0.1 + (1 - hpPercentAtStart) * 0.1;
  const megaBossAdvantage = isMegaPhase ? 0.1 : 0;
  const teamAveragePower = mascotStates.reduce((sum, mascot) => sum + mascot.power, 0) / Math.max(1, mascotStates.length);
  const bossPower = Math.max(180, Math.round(teamAveragePower * (1 + baseBossAdvantage + megaBossAdvantage)));
  const log: Array<Record<string, unknown>> = [];
  let simulatedBossHp = startingBossHp;
  let totalDamage = 0;
  let lastTurn = 0;

  for (let turn = 1; turn <= 80 && mascotStates.some((m) => !m.defeated); turn++) {
    lastTurn = turn;
    for (const mascot of mascotStates.filter((m) => !m.defeated)) {
      const variance = randomInt(85, 121) / 100;
      const crit = randomInt(100) < Math.min(22, 4 + Math.floor(mascot.statInstinct / 8)) ? 1.55 : 1;
      const damage = Math.max(1, Math.round(mascot.power * variance * crit * roleDamageMultiplier[mascot.combatRole]));
      mascot.damage += damage;
      totalDamage += damage;
      if (simulatedBossHp > 0) {
        simulatedBossHp = Math.max(0, simulatedBossHp - damage);
      }
      log.push({ turn, actor: mascot.name, actorId: mascot.id, actorPokemonId: mascot.pokemonId, actorRole: mascot.combatRole, action: "ATTACK", damage, crit: crit > 1, bossHp: simulatedBossHp });
    }

    const living = mascotStates.filter((m) => !m.defeated);
    if (living.length === 0) break;
    const target = living[randomInt(living.length)];
    const defenseSoak = Math.round(target.statVitality * 1.4 + target.statAgility * 0.4);
    const minimumHit = Math.max(20, Math.round(target.maxHp * (isMegaPhase ? 0.18 : 0.14)));
    const bossDamage = Math.max(
      minimumHit,
      Math.round((bossPower * (randomInt(90, 121) / 100)) * roleDefenseMultiplier[target.combatRole]) - defenseSoak,
    );
    target.hp = Math.max(0, target.hp - bossDamage);
    log.push({ turn, actor: isMegaPhase ? event.bossMascotName : event.bossName, action: "BOSS_ATTACK", target: target.name, targetId: target.id, targetPokemonId: target.pokemonId, targetRole: target.combatRole, damage: bossDamage, targetHp: target.hp });
    if (target.hp <= 0) {
      target.defeated = true;
      log.push({ turn, actor: target.name, actorId: target.id, action: "KO" });
    }
  }

  if (mascotStates.some((m) => !m.defeated)) {
    const turn = lastTurn + 1;
    for (const target of mascotStates.filter((m) => !m.defeated)) {
      const bossDamage = target.hp;
      target.hp = 0;
      target.defeated = true;
      log.push({ turn, actor: isMegaPhase ? event.bossMascotName : event.bossName, action: "BOSS_ATTACK", target: target.name, targetId: target.id, targetPokemonId: target.pokemonId, targetRole: target.combatRole, damage: bossDamage, targetHp: 0 });
      log.push({ turn, actor: target.name, actorId: target.id, action: "KO" });
    }
  }

  totalDamage = Math.min(totalDamage, startingBossHp);
  const defeatedMascotIds = mascotStates.filter((m) => m.defeated).map((m) => m.id);
  const bossHpAfter = Math.max(0, startingBossHp - totalDamage);
  const megaJustActivated = !event.megaActivatedAt && bossHpAfter > 0 && event.bossHpMax > 0 && (bossHpAfter / event.bossHpMax) * 100 <= event.megaThresholdPercent;
  const result = bossHpAfter <= 0 ? "WIN" : defeatedMascotIds.length === mascotStates.length ? "LOSS" : "DRAW";
  const participationPoints = Math.max(1, Math.floor(totalDamage / 5000) + mascots.length);

  await prisma.$transaction(async (tx) => {
    await tx.raidBattleAttempt.create({
      data: {
        raidEventId: event.id,
        playerId: player.id,
        teamSnapshotJson: mascotStates.map((m) => ({
          id: m.id,
          pokemonId: m.pokemonId,
          name: m.name,
          level: m.level,
          combatRole: m.combatRole,
          maxHp: m.maxHp,
          remainingHp: m.hp,
          damage: m.damage,
          defeated: m.defeated,
        })),
        bossSnapshotJson: {
          name: isMegaPhase ? event.bossMascotName : event.bossName,
          pokemonId: isMegaPhase ? event.bossMegaPokemonId : event.bossPokemonId,
          hpBefore: startingBossHp,
          hpAfter: bossHpAfter,
          maxHp: event.bossHpMax,
          megaPhase: isMegaPhase,
        },
        damageToBoss: totalDamage,
        participationPoints,
        result,
        replayJson: JSON.parse(JSON.stringify({ log })),
        resolvedAt: now,
      },
    });

    await tx.raidDamageRanking.upsert({
      where: { raidEventId_playerId: { raidEventId: event.id, playerId: player.id } },
      create: {
        raidEventId: event.id,
        playerId: player.id,
        totalDamage,
        battleCount: 1,
        highestSingleDamage: totalDamage,
        participationPoints,
        megaPhaseAttempts: isMegaPhase ? 1 : 0,
        lastBattleAt: now,
      },
      update: {
        totalDamage: { increment: totalDamage },
        battleCount: { increment: 1 },
        participationPoints: { increment: participationPoints },
        megaPhaseAttempts: isMegaPhase ? { increment: 1 } : undefined,
        lastBattleAt: now,
      },
    });
    await tx.raidDamageRanking.updateMany({
      where: { raidEventId: event.id, playerId: player.id, highestSingleDamage: { lt: totalDamage } },
      data: { highestSingleDamage: totalDamage },
    });

    await tx.raidEvent.update({
      where: { id: event.id },
      data: {
        bossHpCurrent: bossHpAfter,
        megaActivatedAt: megaJustActivated ? now : undefined,
        phase: bossHpAfter <= 0 ? "RAID_DEFEATED" : undefined,
        active: bossHpAfter <= 0 ? false : undefined,
      },
    });

    if (defeatedMascotIds.length > 0) {
      await tx.mascot.updateMany({
        where: { id: { in: defeatedMascotIds }, playerId: player.id },
        data: { arenaState: "INJURED", injuredAt: now, restingUntil: null, isEquipped: false, battleLosses: { increment: 1 } },
      });
      for (const mascot of mascotStates.filter((m) => m.defeated)) {
        await tx.mascotEvent.create({
          data: {
            mascotId: mascot.id,
            emoji: "RAID",
            description: `${mascot.name} foi derrotado pela Ordem da Trapaça e precisa de Atendimento SUS.`,
          },
        });
      }
    }
  });

  if (bossHpAfter <= 0) {
    await grantOrderRaidDefeatedRewardToAll(event.id).catch(() => null);
  }

  return {
    ok: true as const,
    message: bossHpAfter <= 0 ? "A Ordem caiu!" : "Ataque registrado contra a Ordem.",
    damage: totalDamage,
    bossHpAfter,
    defeatedMascots: mascotStates.filter((m) => m.defeated).map((m) => m.name),
    team: mascotStates.map((m) => ({ id: m.id, pokemonId: m.pokemonId, name: m.name, level: m.level, maxHp: m.maxHp, remainingHp: m.hp, damage: m.damage, defeated: m.defeated, combatRole: m.combatRole })),
    boss: { name: isMegaPhase ? event.bossMascotName : event.bossName, pokemonId: isMegaPhase ? event.bossMegaPokemonId : event.bossPokemonId, hpBefore: startingBossHp, hpAfter: bossHpAfter, maxHp: event.bossHpMax, megaPhase: isMegaPhase },
    replay: log,
    cooldownUntil: new Date(now.getTime() + cooldownMs).toISOString(),
    megaJustActivated,
    result,
  };
}

export function readSabotageNumber(effectJson: unknown, key: string, fallback: number) {
  if (!effectJson || typeof effectJson !== "object") return fallback;
  const value = (effectJson as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readNumberArray(value: unknown, fallback: number[]) {
  return Array.isArray(value)
    ? value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
    : fallback;
}

function readStatArray(value: unknown): WeeklyLeagueSabotageConfig["affectedStats"] {
  const allowed = new Set(["force", "agility", "instinct", "vitality", "charisma"]);
  const fallback: WeeklyLeagueSabotageConfig["affectedStats"] = ["force", "agility", "instinct", "vitality", "charisma"];
  if (!Array.isArray(value)) return fallback;
  const stats = value.filter((entry): entry is WeeklyLeagueSabotageConfig["affectedStats"][number] => typeof entry === "string" && allowed.has(entry));
  return stats.length ? stats : fallback;
}

export async function getActiveWeeklyLeagueSabotage(): Promise<WeeklyLeagueSabotageConfig | null> {
  const event = await prisma.raidEvent.findUnique({
    where: { slug: ORDER_EVENT_SLUG },
    select: { id: true, active: true, phase: true },
  }).catch(() => null);
  if (!event?.active || event.phase === "ENDED") return null;

  const step = await prisma.raidMysteryStep.findFirst({
    where: {
      raidEventId: event.id,
      stepKey: "MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS",
      active: true,
    },
    select: { resolvedAt: true },
  }).catch(() => null);
  if (step?.resolvedAt) return null;

  const sabotage = (await getActiveRaidSabotages("MASCOT_LEAGUE"))
    .find((entry) => readJsonRecord(entry.effectJson).kind === "WEEKLY_LEAGUE_SLOT_DEBUFF");
  if (!sabotage) return null;

  const effect = readJsonRecord(sabotage.effectJson);
  const multiplier = Number(effect.statMultiplier);
  return {
    id: sabotage.id,
    title: sabotage.title,
    description: sabotage.description,
    affectedSlots: readNumberArray(effect.affectedSlots, [1, 2, 3]),
    statMultiplier: Number.isFinite(multiplier) ? Math.max(0.1, Math.min(1, multiplier)) : 0.5,
    affectedStats: readStatArray(effect.affectedStats),
  };
}

export async function getRandomMascotInjurySabotage(): Promise<RandomMascotInjurySabotageConfig | null> {
  const sabotage = (await getActiveRaidSabotages("MASCOTS"))
    .find((entry) => readJsonRecord(entry.effectJson).kind === "RANDOM_MASCOT_INJURY");
  if (!sabotage) return null;

  const effect = readJsonRecord(sabotage.effectJson);
  const dailyLimit = Number(effect.dailyLimit);
  return {
    id: sabotage.id,
    title: sabotage.title,
    description: sabotage.description,
    dailyLimit: Number.isFinite(dailyLimit) ? Math.max(0, Math.min(5, dailyLimit)) : 2,
    emergencyDisabled: effect.emergencyDisabled === true,
    avoidFavorites: false,
    maxPerPlayerPerDay: Number.isFinite(Number(effect.maxPerPlayerPerDay))
      ? Math.max(1, Math.min(3, Number(effect.maxPerPlayerPerDay)))
      : 1,
  };
}

function todayBrtKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export async function applyRandomMascotInjurySabotage(options: { force?: boolean } = {}) {
  const sabotage = await getRandomMascotInjurySabotage();
  if (!sabotage) return { ok: true as const, skipped: "inactive", injured: 0 };
  if (sabotage.emergencyDisabled && !options.force) {
    return { ok: true as const, skipped: "emergency-disabled", injured: 0 };
  }

  const dayKey = todayBrtKey();
  const marker = `[ORDER_RANDOM_INJURY:${dayKey}]`;
  const alreadyToday = await prisma.mascotEvent.count({
    where: { description: { contains: marker } },
  });
  if (!options.force && alreadyToday >= sabotage.dailyLimit) {
    return { ok: true as const, skipped: "daily-limit", injured: 0, alreadyToday };
  }

  const injuredToday = sabotage.maxPerPlayerPerDay > 0
    ? await prisma.mascotEvent.findMany({
        where: { description: { contains: marker } },
        select: { description: true },
      })
    : [];
  const injuredByPlayer = new Map<string, number>();
  for (const event of injuredToday) {
    const match = event.description.match(/\[PLAYER:([^\]]+)\]/);
    if (!match?.[1]) continue;
    injuredByPlayer.set(match[1], (injuredByPlayer.get(match[1]) ?? 0) + 1);
  }

  const candidates = await prisma.mascot.findMany({
    where: {
      arenaState: "FREE",
      expeditions: { none: { status: "ACTIVE" } },
      player: {
        active: true,
        user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
      },
    },
    select: {
      id: true,
      pokemonId: true,
      nickname: true,
      level: true,
      playerId: true,
      isEquipped: true,
      isFavorite: true,
      statForce: true,
      statAgility: true,
      statInstinct: true,
      statVitality: true,
      statCharisma: true,
      player: { select: { displayName: true } },
    },
    orderBy: [
      { isFavorite: "desc" },
      { isEquipped: "desc" },
      { level: "desc" },
      { statForce: "desc" },
      { statInstinct: "desc" },
    ],
    take: 160,
  });

  const eligibleCandidates = candidates.filter((candidate) => {
    return (injuredByPlayer.get(candidate.playerId) ?? 0) < sabotage.maxPerPlayerPerDay;
  });

  if (eligibleCandidates.length === 0) return { ok: true as const, skipped: "no-candidates", injured: 0 };

  const weightedCandidates = eligibleCandidates.flatMap((candidate) => {
    const statTotal = candidate.statForce + candidate.statAgility + candidate.statInstinct + candidate.statVitality + candidate.statCharisma;
    const weight =
      1 +
      (candidate.isFavorite ? 5 : 0) +
      (candidate.isEquipped ? 4 : 0) +
      Math.min(5, Math.floor(candidate.level / 15)) +
      Math.min(3, Math.floor(statTotal / 120));
    return Array.from({ length: weight }, () => candidate);
  });

  const mascot = weightedCandidates[randomInt(weightedCandidates.length)];
  const name = mascot.nickname ?? `Mascote #${mascot.pokemonId}`;
  const description = `${marker}[PLAYER:${mascot.playerId}] A Ordem da Trapaça atacou ${name} de surpresa. Use Atendimento SUS para iniciar a recuperação.`;

  await prisma.$transaction([
    prisma.mascot.update({
      where: { id: mascot.id },
      data: { arenaState: "INJURED", injuredAt: new Date(), restingUntil: null, isEquipped: false },
    }),
    prisma.mascotEvent.create({
      data: { mascotId: mascot.id, emoji: "⚠️", description },
    }),
  ]);

  return {
    ok: true as const,
    injured: 1,
    mascotId: mascot.id,
    mascotName: name,
    playerId: mascot.playerId,
    playerName: mascot.player.displayName,
    alreadyToday: alreadyToday + 1,
  };
}
