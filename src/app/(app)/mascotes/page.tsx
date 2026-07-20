import { unstable_cache } from "next/cache";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { recalculateMood } from "@/lib/mascot";
import { getPokemonName } from "@/lib/mascot-data";
import { isAdmin } from "@/lib/auth/permissions";
import { MascotList } from "./_components/mascot-list";
import { IncubatorPanel } from "./_components/incubator-panel";
import { BuffPanel } from "./_components/buff-panel";
import { BulkInteractPanel } from "./_components/bulk-interact-panel";
import { Egg, ShoppingBag, ChevronDown } from "lucide-react";
import Link from "next/link";
import { EGG_SHOP_ITEM_TYPES, MEGA_STONE_SHOP_ITEM_TYPES } from "@/lib/shop-config";
import { getShopItemImages } from "@/lib/shop-cache";
import { cleanupExpiredArenaResting, RETIRE_COOLDOWN_MS } from "@/lib/arena-z";
import { RetirePenaltyBadge } from "./../arena-z/_components/arena-z-buttons";
import { getOrderStepUnlockState, getRandomMascotInjurySabotage } from "@/lib/raid-event";
import { MysteryStepButton } from "@/app/(app)/combates/ordem-da-trapaca/_components/mystery-step-button";
import { getMegaStoneForMegaPokemon } from "@/lib/mega-evolution";

export const dynamic = "force-dynamic";

const BUFF_TYPES_LIST = [
  "MASCOT_BUFF_EXP","MASCOT_BUFF_STAT","MASCOT_BUFF_HAPPY","MASCOT_BUFF_LUCK","MASCOT_BUFF_MOOD",
  "LUCKY_EGG","WEAKNESS_POLICY","PICNIC_BASKET","VACATION_TICKET","XP_SHARE","RAINBOW_FEATHER",
  ...MEGA_STONE_SHOP_ITEM_TYPES,
] as const;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientMascotLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return [
    "Can't reach database server",
    "Timed out",
    "timeout",
    "Connection terminated",
    "ECONNRESET",
    "ETIMEDOUT",
    "P1001",
    "P2024",
  ].some((needle) => message.toLowerCase().includes(needle.toLowerCase()));
}

async function retryMascotLoad<T>(load: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      lastError = error;
      if (!isTransientMascotLoadError(error) || attempt === attempts - 1) break;
      await wait(250 * (attempt + 1));
    }
  }
  throw lastError;
}

async function fetchMascotPageData(playerId: string) {
  const [
    featuredMascots,
    bankMascotCount,
    eggs,
    incubator,
    foods,
    lastRetiredTeam,
    buffInventory,
  ] = await retryMascotLoad(() => Promise.all([
    prisma.mascot.findMany({
      where: {
        playerId,
        OR: [
          { isFavorite: true },
          { isEquipped: true },
          // Mascotes em férias aparecem nos atalhos mesmo que estejam no banco
          { expeditions: { some: { status: "ACTIVE", rewardJson: { path: ["mode"], equals: "VACATION" } } } },
        ],
      },
      select: {
        id: true, pokemonId: true, nickname: true, level: true, exp: true,
        happiness: true, mood: true, personality: true,
        isEquipped: true, isFavorite: true, isShiny: true, evolutionLocked: true, expLocked: true, operationsLocked: true,
        ivRating: true, ivScore: true, performanceTag: true,
        statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true,
        battleWins: true, battleLosses: true,
        arenaState: true, bazarListed: true,
        injuredAt: true, restingUntil: true,
        hatchedAt: true, hatchedFromEggType: true, hatchedFromEggOrigin: true,
        lastInteractedAt: true, lastPlayedAt: true, lastPettedAt: true, lastFedAt: true, socialCooldownUntil: true,
        expeditions: {
          where: { status: "ACTIVE" },
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { id: true, finishAt: true, status: true, rewardJson: true }
        },
      },
      orderBy: [{ isFavorite: "desc" }, { isEquipped: "desc" }, { level: "desc" }, { id: "asc" }],
    }),
    prisma.mascot.count({
      where: { playerId, isFavorite: false, isEquipped: false },
    }),
    prisma.mascotEgg.findMany({
      where: { playerId, incubation: null, NOT: { origin: { startsWith: "bazar:" } } },
      select: { id: true, type: true, obtainedAt: true, origin: true },
      orderBy: { obtainedAt: "asc" }
    }),
    prisma.mascotIncubator.findUnique({
      where: { playerId },
      select: {
        id: true, startedAt: true, finishAt: true, hatched: true,
        egg: { select: { type: true, origin: true } }
      },
    }),
    prisma.mascotFoodItem.findMany({
      where: { playerId },
      select: { type: true, quantity: true },
    }),
    prisma.arenaTeam.findFirst({
      where: { playerId, status: "RETIRED", retiredAt: { gt: new Date(Date.now() - RETIRE_COOLDOWN_MS) } },
      orderBy: { retiredAt: "desc" },
      select: { retiredAt: true },
    }).catch(() => null),
    prisma.playerInventory.findMany({
      where: { playerId, quantity: { gt: 0 }, item: { type: { in: BUFF_TYPES_LIST as unknown as import("@prisma/client").ShopItemType[] } } },
      select: {
        quantity: true,
        item: { select: { id: true, name: true, type: true, description: true, imageUrl: true } }
      },
    }),
  ]));

  const featuredIds = featuredMascots.map(m => m.id);

  const featuredRelationsAll = featuredIds.length > 0 ? await retryMascotLoad(() =>
    prisma.mascotRelation.findMany({
      where: { mascotAId: { in: featuredIds } },
      select: {
        mascotAId: true, type: true, interactionCount: true, relationshipScore: true, specialBondType: true,
        mascotB: {
          select: {
            id: true, pokemonId: true, nickname: true,
            player: { select: { id: true, displayName: true } }
          }
        }
      },
      take: featuredIds.length * 10,
    })
  ).catch((error) => {
    console.error("[Mascotes] Falha ao carregar relacoes; usando fallback.", error);
    return [];
  }) : [];

  // Mascotes nao carrega mais log de eventos; historico social fica em /lacos.
  const relationsByMascot = new Map<string, typeof featuredRelationsAll>();
  for (const r of featuredRelationsAll) {
    const list = [...(relationsByMascot.get(r.mascotAId) ?? [])];
    if (list.length < 10) { list.push(r); relationsByMascot.set(r.mascotAId, list); }
  }

  // Injeta nos mascotes para manter compatibilidade com componentes existentes
  const featuredMascotsEnriched = featuredMascots.map(m => ({
    ...m,
    events: [],
    relationsAsA: (relationsByMascot.get(m.id) ?? []).map(r => ({
      type: r.type, interactionCount: r.interactionCount, relationshipScore: r.relationshipScore,
      specialBondType: r.specialBondType, mascotB: r.mascotB,
    })),
  }));

  const activeMascotBuffs = featuredIds.length > 0 ? await retryMascotLoad(() => prisma.mascotBuff.findMany({
    where: { mascotId: { in: featuredIds }, expiresAt: { gt: new Date() } },
    select: { mascotId: true, type: true, expiresAt: true },
  })).catch((error) => {
    console.error("[Mascotes] Falha ao carregar buffs ativos; usando fallback.", error);
    return [];
  }) : [];
  const proteinBoostedMascots = featuredIds.length > 0 ? await retryMascotLoad(() => prisma.mascotBuff.groupBy({
    by: ["mascotId"],
    where: { type: "STAT_BOOST", mascotId: { in: featuredIds }, expiresAt: { gt: new Date("2090-01-01") } },
    _count: { id: true },
  })).catch((error) => {
    console.error("[Mascotes] Falha ao carregar doses de proteina; usando fallback.", error);
    return [];
  }) : [];

  return { featuredMascots: featuredMascotsEnriched, bankMascots: [], bankMascotCount, eggs, incubator, foods, lastRetiredTeam, buffInventory, activeMascotBuffs, proteinBoostedMascots };
}

const getCachedMascotPageData = (playerId: string) =>
  unstable_cache(
    () => fetchMascotPageData(playerId),
    ["player-mascots", playerId],
    { revalidate: 15, tags: [`player-mascots-${playerId}`] },
  )();

function MascotLoadError({ message }: { message?: string }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-6">
        <p className="text-xs uppercase tracking-widest text-red-300">Mascotes indisponiveis no momento</p>
        <h1 className="mt-2 font-pixel text-base text-[#FFCB05]">Falha temporaria ao carregar</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
          A tela de mascotes tentou carregar seus dados, mas o banco oscilou ou demorou demais para responder.
          Aguarde alguns segundos e atualize a pagina. Suas recompensas e mascotes nao foram perdidos.
        </p>
        {message && (
          <p className="mt-3 rounded-xl border border-red-500/20 bg-slate-950/60 px-3 py-2 text-xs text-red-200">
            Detalhe tecnico: {message}
          </p>
        )}
        <a
          href="/mascotes"
          className="mt-5 inline-flex rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700]"
        >
          Tentar novamente
        </a>
      </div>
    </div>
  );
}

export default async function MascotesPage() {
  const session = await getAppSession();
  if (!session?.user) return null;
  const admin = isAdmin(session.user.role);

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true, mascotSpritePreference: true, megaSpritePreference: true }
  }).catch((error) => {
    console.error("[Mascotes] player lookup failed", { userId: session.user.id, error });
    return null;
  });
  if (!player) return notFound();
  const spritePreferences = {
    mascotSpritePreference: player.mascotSpritePreference,
    megaSpritePreference: player.megaSpritePreference,
  };

  const cleanup = await cleanupExpiredArenaResting(player.id).catch((error) => {
    console.error("[Mascotes] cleanup de repouso/cooldown falhou; seguindo sem travar a pagina.", error);
    return null;
  });
  const cleanupChanged = !!cleanup && (cleanup.releasedResting > 0 || cleanup.clearedCooldowns > 0);

  // Dados de mascote sao cacheados por jogador; se a limpeza mudou estados, pula o cache nesta visita.
  const loadPageData = cleanupChanged
    ? () => fetchMascotPageData(player.id)
    : () => getCachedMascotPageData(player.id);
  const pageData = await loadPageData().catch(async (error) => {
    console.error("[Mascotes] Cache/load falhou; tentando carga direta.", error);
    return retryMascotLoad(() => fetchMascotPageData(player.id), 2);
  }).catch((error) => {
    console.error("[Mascotes] Falha final ao carregar pagina.", error);
    return null;
  });

  if (!pageData) {
    return <MascotLoadError message="carregamento de dados dos mascotes falhou" />;
  }

  const rawEggImages = await getShopItemImages([...EGG_SHOP_ITEM_TYPES]).catch((error) => {
    console.error("[Mascotes] Falha ao carregar imagens de ovos; usando fallback.", error);
    return {} as Record<string, string>;
  });

  const { featuredMascots, bankMascots, bankMascotCount, eggs, incubator, foods, lastRetiredTeam, buffInventory, activeMascotBuffs, proteinBoostedMascots } = pageData;

  const eggImageByType: Record<string, string> = {};
  for (const [type, url] of Object.entries(rawEggImages)) {
    const key = type.replace("EGG_", "");
    eggImageByType[key] = url;
  }

  const buffsByMascotId = new Map<string, { type: string; expiresAt: Date }[]>();
  for (const b of activeMascotBuffs) {
    const arr = buffsByMascotId.get(b.mascotId) ?? [];
    arr.push({ type: b.type, expiresAt: b.expiresAt });
    buffsByMascotId.set(b.mascotId, arr);
  }

  const hasFood    = foods.some(f => f.type === "FOOD"  && f.quantity > 0);
  const hasSweet   = foods.some(f => f.type === "SWEET" && f.quantity > 0);
  const foodCount  = foods.find(f => f.type === "FOOD")?.quantity ?? 0;
  const sweetCount = foods.find(f => f.type === "SWEET")?.quantity ?? 0;
  const favoriteMascotCount = featuredMascots.filter(m => m.isFavorite).length;
  const [orderMascotAttack, orderMascotStepState] = await Promise.all([
    getRandomMascotInjurySabotage().catch((error) => {
      console.error("[Mascotes] Falha ao carregar sabotagem da Ordem; ocultando alerta.", error);
      return null;
    }),
    getOrderStepUnlockState("MASCOTS_EQUIPPED_WHISPER").catch((error) => {
      console.error("[Mascotes] Falha ao carregar etapa da Ordem; usando fallback.", error);
      return {
        active: false,
        resolved: false,
        unlocked: false,
        generalClues: 0,
        specificClues: 0,
        requiredGeneralClues: 25,
        requiredSpecificClues: 4,
      };
    }),
  ]);

  // mascotData: apenas para a Equipe Favorita (renderizada com card completo)
  const mascotData = featuredMascots.map(m => ({
    id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
    level: m.level, exp: m.exp, happiness: m.happiness,
    mood: m.mood, personality: m.personality, isEquipped: m.isEquipped, isFavorite: m.isFavorite,
    statForce: m.statForce, statAgility: m.statAgility, statCharisma: m.statCharisma,
    statInstinct: m.statInstinct, statVitality: m.statVitality,
    battleWins: m.battleWins, battleLosses: m.battleLosses,
    arenaState: m.arenaState,
    bazarListed: m.bazarListed,
    injuredAt: m.injuredAt,
    restingUntil: m.restingUntil,
    hatchedAt: m.hatchedAt,
    hatchedFromEggType: m.hatchedFromEggType,
    hatchedFromEggOrigin: m.hatchedFromEggOrigin,
    megaStoneName: getMegaStoneForMegaPokemon(m.pokemonId)?.stoneName ?? null,
    lastInteractedAt: m.lastInteractedAt,
    lastPlayedAt: m.lastPlayedAt,
    lastPettedAt: m.lastPettedAt,
    lastFedAt: m.lastFedAt,
    socialCooldownUntil: m.socialCooldownUntil,
    evolutionLocked: m.evolutionLocked,
    expLocked: m.expLocked,
    operationsLocked: m.operationsLocked,
    isShiny: m.isShiny,
    ivRating: m.ivRating,
    ivScore: m.ivScore,
    performanceTag: m.performanceTag,
    activeBuffs: buffsByMascotId.get(m.id) ?? [],
    expeditions: m.expeditions.map(e => ({
      id: e.id, finishAt: e.finishAt, status: e.status,
      mode: (e.rewardJson as Record<string,unknown> | null)?.mode as string | undefined ?? "STANDARD",
    })),
    relations: (m.relationsAsA ?? []).map(r => ({
      type: r.type,
      interactionCount: r.interactionCount,
      relationshipScore: r.relationshipScore,
      specialBondType: r.specialBondType,
      mascotB: {
        id: r.mascotB.id,
        pokemonId: r.mascotB.pokemonId,
        nickname: r.mascotB.nickname,
        ownerName: r.mascotB.player.displayName,
        ownerId: r.mascotB.player.id,
      }
    })),
    events: [],
    hasFood, hasSweet,
    // Admin: lista de outros mascotes para trigger de batalha/amizade
    otherMascots: admin ? featuredMascots.filter(o => o.id !== m.id).map(o => ({
      id: o.id,
      name: o.nickname ?? getPokemonName(o.pokemonId),
    })) : undefined,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
          <h1 className="font-pixel text-base text-[#FFCB05]">Mascotes</h1>
          <p className="mt-1 text-sm text-slate-400">
            Seus companheiros Pokémon — cuide deles, eles crescem com você.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-900/50 px-3 py-2 text-xs">
            <span>🍖</span>
            <span className="font-semibold text-slate-300">{foodCount}</span>
            <span className="text-slate-500">comida</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-slate-900/50 px-3 py-2 text-xs">
            <span>🍬</span>
            <span className="font-semibold text-slate-300">{sweetCount}</span>
            <span className="text-slate-500">doces</span>
          </div>
          <Link href="/shop" className="flex items-center gap-1.5 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-2 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20">
            <ShoppingBag size={12}/> Loja
          </Link>
        </div>
      </div>

      {/* Penalidade de retirada da Arena */}
      {lastRetiredTeam?.retiredAt && (
        <RetirePenaltyBadge retiredAt={lastRetiredTeam.retiredAt} />
      )}

      {(orderMascotAttack || (orderMascotStepState.active && orderMascotStepState.unlocked && !orderMascotStepState.resolved)) && (
        <div className="rounded-2xl border border-red-500/45 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.22),transparent_35%),rgba(127,29,29,0.16)] p-4 shadow-[0_0_24px_rgba(239,68,68,0.12)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-200">Alerta da Ordem da Trapaca</p>
              <h2 className="mt-1 text-sm font-black text-white">Mascotes sob ataque</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-red-100/80">
                A Ordem esta ferindo mascotes aleatoriamente durante a investigacao.
              </p>
            </div>
            {orderMascotAttack && (
              <span className="shrink-0 rounded-full border border-red-300/40 bg-red-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-red-100">
                Limite {orderMascotAttack.dailyLimit}/dia
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-red-100/80">
                <span>Pistas gerais</span>
                <span>{orderMascotStepState.generalClues}/{orderMascotStepState.requiredGeneralClues}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-900">
                <div
                  className="h-full rounded-full bg-purple-400"
                  style={{ width: `${Math.min(100, (orderMascotStepState.generalClues / Math.max(1, orderMascotStepState.requiredGeneralClues)) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-red-100/80">
                <span>Pistas dos Mascotes</span>
                <span>{orderMascotStepState.specificClues}/{orderMascotStepState.requiredSpecificClues}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-900">
                <div
                  className="h-full rounded-full bg-[#FFCB05]"
                  style={{ width: `${Math.min(100, (orderMascotStepState.specificClues / Math.max(1, orderMascotStepState.requiredSpecificClues)) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {orderMascotStepState.unlocked ? (
            <div className="mt-4">
              <MysteryStepButton
                stepKey="MASCOTS_EQUIPPED_WHISPER"
                returnPath="/mascotes"
                className="w-full rounded-xl border border-[#FFCB05]/60 bg-[#FFCB05] px-4 py-2 text-xs font-black text-slate-950 shadow-[0_0_18px_rgba(255,203,5,0.22)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                showOnlySuccess
                pendingLabel="Protegendo..."
                title="Interromper os ataques aos mascotes"
              >
                Proteger mascotes
              </MysteryStepButton>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-red-100/75">
              Encontre mais pistas na Arena, Liga Semanal e expedicoes curtas para liberar a protecao.
            </p>
          )}
        </div>
      )}
      {/* Como funciona — explicação para o jogador */}
      <details className="rounded-2xl border border-border bg-slate-950/50 overflow-hidden group">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-300 hover:text-white select-none">
          <span className="flex items-center gap-2">📖 Como funciona o sistema de mascotes?</span>
          <ChevronDown size={14} className="text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-5 py-4 grid gap-4 sm:grid-cols-2 text-xs text-slate-400 leading-relaxed">
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">🥚 Ovos & Incubadora</p>
            <p>Compre ovos na ZikaShop. Coloque um ovo na incubadora e aguarde <strong className="text-slate-300">10 minutos</strong> para chocar. Cada tipo de ovo tem Pokémon diferentes.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">⭐ Nível & Evolução</p>
            <p>Seu mascote ganha EXP em partidas, vitórias, interações e expedições. Ao atingir o nível certo, ele <strong className="text-slate-300">evolui automaticamente</strong>.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">💛 Cuidados diários</p>
            <p><strong className="text-slate-300">Brincar</strong> aumenta felicidade e EXP, é mais intenso e tem cooldown de <strong className="text-slate-300">45 minutos</strong>. <strong className="text-slate-300">Carinho</strong> fortalece o vínculo gradualmente, pode ser recusado e tem cooldown de <strong className="text-slate-300">25 minutos</strong>. <strong className="text-slate-300">Comida</strong> sacia fome e <strong className="text-slate-300">doces</strong> dão bônus de EXP sem usar o cooldown de carinho/brincadeira.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">🗺 Expedições</p>
            <p>Envie o mascote <strong className="text-slate-300">equipado</strong> em expedições de <strong className="text-slate-300">30min, 1h, 3h ou 6h</strong>. Quanto mais longa, mais EXP e loot melhor (6h pode trazer Ovo Especial). Os itens vão para a Caixa de Presentes.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">📊 Status</p>
            <p>Acompanhe <strong className="text-slate-300">Fome</strong> (alimentar quando com fome), <strong className="text-slate-300">Humor</strong> (afeta interações disponíveis) e <strong className="text-slate-300">Desafio</strong> (indica o estado competitivo). Botões são desabilitados quando a ação não está disponível.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">💪 Stats</p>
            <p>Cada mascote tem 5 atributos que crescem com o nível. Passe o mouse sobre eles para ver para que servem. A personalidade influencia quais crescem mais rápido.</p>
          </div>
        </div>
      </details>

      {/* Chances por ovo */}
      <details className="rounded-2xl border border-border bg-slate-950/50 overflow-hidden group">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-300 hover:text-white select-none">
          <span className="flex items-center gap-2">🥚 Quais Pokémon saem de cada ovo?</span>
          <ChevronDown size={14} className="text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-5 py-4 space-y-4 text-xs text-slate-400 leading-relaxed">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3">
              <p className="font-semibold text-slate-200">🥚 Ovo Comum</p>
              <p>Pool: <strong className="text-slate-300">Todas as 9 gerações</strong> (modo aleatório — Caterpie, Sprigatito, Grookey...). Variedade máxima.</p>
              <p className="text-[10px] text-slate-500">Lendário: 1% · Um Pokémon aleatório de qualquer geração</p>
            </div>
            <div className="space-y-1 rounded-xl border border-blue-700/30 bg-blue-900/10 p-3">
              <p className="font-semibold text-blue-300">💙 Ovo Raro</p>
              <p>Pool: Starters e Pokémon populares de Gen 1–2 (Pikachu, Eevee, Dratini, Riolu, Growlithe...).</p>
              <p className="text-[10px] text-slate-500">Lendário: 1% · Foco em Pokémon cobiçados das gens clássicas</p>
            </div>
            <div className="space-y-1 rounded-xl border border-purple-700/30 bg-purple-900/10 p-3">
              <p className="font-semibold text-purple-300">💜 Ovo Especial</p>
              <p>Pool: Pokémon raros e cobiçados (Magikarp→Gyarados, Lapras, Ditto, Larvitar, Fósseis).</p>
              <p className="text-[10px] text-slate-500">Lendário: 2% — maior chance do jogo!</p>
            </div>
            <div className="space-y-1 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 p-3">
              <p className="font-semibold text-[#FFCB05]">⭐ Ovo de Evento</p>
              <p>Pool configurado por evento: starters, Pikachu, Eevee, Dratini — temático.</p>
              <p className="text-[10px] text-slate-500">Lendário: 0,3%</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-slate-200">🌍 Ovos por Geração (Gen 1–9)</p>
            <p>Cada ovo de geração tem apenas Pokémon dessa geração. Você escolhe a geração ao colocar na incubadora. Lendários: 1%.</p>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              {[
                ["Gen 1 · Kanto","Bulbasaur a Mew"],
                ["Gen 2 · Johto","Chikorita a Celebi"],
                ["Gen 3 · Hoenn","Treecko a Deoxys"],
                ["Gen 4 · Sinnoh","Turtwig a Arceus"],
                ["Gen 5 · Unova","Snivy a Genesect"],
                ["Gen 6 · Kalos","Chespin a Volcanion"],
                ["Gen 7 · Alola","Rowlet a Melmetal"],
                ["Gen 8 · Galar","Grookey a Calyrex"],
                ["Gen 9 · Paldea","Sprigatito a Pecharunt"],
              ].map(([gen, range]) => (
                <div key={gen} className="rounded-lg border border-border/40 bg-slate-900/50 px-2 py-1.5">
                  <p className="font-semibold text-slate-300">{gen}</p>
                  <p className="text-slate-500">{range}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3">
            <p className="font-semibold text-slate-200">🌀 Geração Aleatória</p>
            <p>Usa o pool de <strong className="text-slate-300">todas as 9 gerações juntas</strong>. Chance 1% de lendário.</p>
          </div>
          <div className="space-y-1 rounded-xl border border-yellow-700/30 bg-yellow-900/10 p-3">
            <p className="font-semibold text-yellow-300">👑 Pokémon Lendários</p>
            <p>Pool incluem Articuno, Lugia, Rayquaza, Dialga, Reshiram, Xerneas, Solgaleo, Zacian, Koraidon e muitos mais. Muito raros — aproveite quando aparecerem!</p>
          </div>
        </div>
      </details>

      {/* Itens especiais (buffs) */}
      {buffInventory.length > 0 && (
       <BuffPanel
  buffs={buffInventory.map(b => ({
    id: b.item.id,
    name: b.item.name,
    type: b.item.type,
    quantity: b.quantity,
    description: b.item.description ?? undefined,
    imageUrl: b.item.imageUrl ?? undefined,
  }))}
  mascots={mascotData.map(m => ({
    id: m.id,
    name: m.nickname ?? getPokemonName(m.pokemonId),
    pokemonId: m.pokemonId,
    level: m.level,
    isEquipped: m.isEquipped,
    isFavorite: m.isFavorite,
  }))}
  proteinDoses={Object.fromEntries(proteinBoostedMascots.map(b => [b.mascotId, b._count.id]))}
  activeBuffsByMascot={Object.fromEntries([...buffsByMascotId.entries()].map(([id, buffs]) => [id, buffs.map(b => b.type)]))}
/>
      )}

      {/* Incubadora + Ovos */}
      <IncubatorPanel
        incubator={incubator ? {
          id: incubator.id,
          eggType: incubator.egg.type,
          eggOrigin: incubator.egg.origin ?? undefined,
          startedAt: incubator.startedAt,
          finishAt: incubator.finishAt,
          hatched: incubator.hatched,
        } : null}
        eggs={eggs.map(e => ({ id: e.id, type: e.type, obtainedAt: e.obtainedAt, origin: e.origin }))}
        canSkipIncubation={admin}
        eggImages={eggImageByType}
      />

      {/* Ações em massa da Equipe Favorita */}
      {favoriteMascotCount > 0 && (
        <BulkInteractPanel
          scope="FAVORITES"
          mascotIds={featuredMascots.filter(m => m.isFavorite).map(m => m.id)}
        />
      )}

      {/* Meus Mascotes com paginação e filtros */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-200">🐾 Meus Mascotes</h2>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{featuredMascots.length + bankMascotCount}</span>
        </div>

        {featuredMascots.length === 0 && bankMascotCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
            <Egg size={36} className="mx-auto text-slate-600" />
            <p className="text-sm text-slate-500">Você ainda não tem mascotes.</p>
            <p className="text-xs text-slate-600">Consiga um ovo na ZikaShop ou em eventos e coloque na incubadora!</p>
            <Link href="/shop" className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700]">
              <ShoppingBag size={12}/> Ver Ovos na Loja
            </Link>
          </div>
        ) : (
          <MascotList
            mascots={mascotData}
            bankMascots={bankMascots}
            bankMascotCount={bankMascotCount}
            hasFood={hasFood}
            hasSweet={hasSweet}
            isAdmin={admin}
            spritePreferences={spritePreferences}
          />
        )}
      </div>
    </div>
  );
}
