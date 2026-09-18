import { Activity, Archive, Brain, HeartHandshake, LockKeyhole, Network, Sparkles, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getSpriteUrl, PERSONALITY_LABEL } from "@/lib/mascot-data";
import { REFUGE_LOCATIONS, relationEffectV2, relationTierV2, type RefugeLocation } from "@/lib/mascot-bonds-v2";
import { normalizeBondOptions } from "@/lib/mascot-bonds";
import { BONDS_V2_BALANCE } from "@/lib/mascot-bonds-v2-balance";
import { BondsV2SectionTabs, BondDirectoryV2, BondInventoryV2, BondsTutorial, ImportantMomentsList, RefugeLocationsTabs, TrainerBondExplorer } from "./bonds-v2-controls";
import { BOND_ITEM_CATALOG, BOND_SHOP_ITEM_TYPES } from "@/lib/shop-config";

function mascotName(mascot: { pokemonId: number; nickname: string | null }) {
  return mascot.nickname ?? getPokemonName(mascot.pokemonId);
}

export async function BondsV2Admin({ playerId }: { playerId: string }) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60_000);
  const [mascots, publicRoutines, relations, memoriesByLocation, pendingEvents, recentEvents, settings, bondInventory] = await Promise.all([
    prisma.mascot.findMany({
      where: { playerId },
      orderBy: [{ isEquipped: "desc" }, { isFavorite: "desc" }, { level: "desc" }],
      take: 60,
      select: {
        id: true, pokemonId: true, nickname: true, level: true, personality: true,
        routine: { select: { locationType: true, status: true, startedAt: true, updatedAt: true } },
      },
    }),
    prisma.mascotRoutine.findMany({
      where: { status: "ACTIVE" },
      orderBy: { lastProcessedAt: "desc" },
      take: 192,
      select: {
        locationType: true, startedAt: true, updatedAt: true,
        mascot: { select: { id: true, pokemonId: true, nickname: true, level: true, personality: true, playerId: true, player: { select: { displayName: true } } } },
      },
    }),
    prisma.mascotRelation.findMany({
      where: { mascotA: { playerId }, isActive: true },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      take: 100,
      select: {
        id: true, relationshipScore: true, isActive: true, dormantAt: true, interactionCount: true, updatedAt: true,
        mascotA: { select: { pokemonId: true, nickname: true, player: { select: { displayName: true } } } },
        mascotB: { select: { pokemonId: true, nickname: true, player: { select: { displayName: true } } } },
      },
    }),
    Promise.all((Object.keys(REFUGE_LOCATIONS) as RefugeLocation[]).map((location) => prisma.mascotBondMemory.findMany({
      where: { sourceType: "REFUGE", metadata: { path: ["location"], equals: location } },
      orderBy: { createdAt: "desc" },
      // O limite é individual por região: uma Horta lotada não apaga o
      // histórico visível de Descanso, Treino ou Pátio.
      take: 250,
      include: {
        mascotA: { select: { pokemonId: true, nickname: true, player: { select: { displayName: true } } } },
        mascotB: { select: { pokemonId: true, nickname: true, player: { select: { displayName: true } } } },
      },
    }))),
    prisma.mascotSocialEvent.findMany({
      where: { ownerId: playerId, status: "PENDING" },
      orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
      take: 20,
      include: { mascotA: { select: { pokemonId: true, nickname: true } }, mascotB: { select: { pokemonId: true, nickname: true } } },
    }),
    prisma.mascotSocialEvent.count({ where: { ownerId: playerId, createdAt: { gte: since } } }),
    prisma.siteContent.findUnique({ where: { id: "bonds-v2-settings" }, select: { data: true } }),
    // A leitura do inventário não deve derrubar toda a página enquanto uma
    // implantação ainda está aplicando os novos valores do enum ShopItemType.
    // Assim que a migração termina, a consulta volta a preencher a bolsa.
    prisma.shopItem.findMany({ where: { type: { in: [...BOND_SHOP_ITEM_TYPES] as never[] } }, orderBy: { sortOrder: "asc" }, select: { id: true, type: true, name: true, description: true, rarity: true, ownerships: { where: { playerId }, select: { quantity: true }, take: 1 } } }).catch(() => []),
  ]);

  const rawSettings = settings?.data && typeof settings.data === "object" && !Array.isArray(settings.data)
    ? settings.data as Record<string, unknown>
    : {};
  const backgrounds = rawSettings.backgrounds && typeof rawSettings.backgrounds === "object" && !Array.isArray(rawSettings.backgrounds)
    ? rawSettings.backgrounds as Record<string, unknown>
    : {};
  const recentMemories = memoriesByLocation.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 30);
  const changedRelations = relations.filter((relation) => relation.updatedAt >= since).length;
  const activeCount = relations.filter((relation) => relation.isActive).length;
  const ownMascots = mascots.map((mascot) => ({
    id: mascot.id,
    name: mascotName(mascot),
    sprite: getSpriteUrl(mascot.pokemonId),
    level: mascot.level,
    personality: PERSONALITY_LABEL[mascot.personality] ?? mascot.personality,
    owner: "Você",
    own: true,
    location: mascot.routine?.status === "ACTIVE" ? mascot.routine.locationType : null,
    startedAt: mascot.routine?.status === "ACTIVE" ? mascot.routine.startedAt.toISOString() : null,
    moveAvailableAt: mascot.routine ? new Date(mascot.routine.updatedAt.getTime() + BONDS_V2_BALANCE.publicSpaces.moveCooldownMinutes * 60_000).toISOString() : null,
  }));
  const bondItems = relations.map((relation) => ({
    id: relation.id,
    a: mascotName(relation.mascotA),
    b: mascotName(relation.mascotB),
    owner: relation.mascotB.player.displayName,
    ownerA: relation.mascotA.player.displayName,
    ownerB: relation.mascotB.player.displayName,
    spriteA: getSpriteUrl(relation.mascotA.pokemonId),
    spriteB: getSpriteUrl(relation.mascotB.pokemonId),
    score: relation.relationshipScore,
    tier: relationTierV2(relation.relationshipScore),
    effect: relationEffectV2(relation.relationshipScore),
    interactions: relation.interactionCount,
    active: relation.isActive,
    transitionAt: relation.dormantAt?.toISOString() ?? null,
  }));
  const friendCircles = Object.values(relations.filter((relation) => relation.isActive && relation.relationshipScore >= 15).reduce<Record<string, { leader: string; sprite: string; members: Array<{ name: string; sprite: string; score: number }> }>>((groups, relation) => {
    const key = mascotName(relation.mascotA);
    groups[key] ??= { leader: key, sprite: getSpriteUrl(relation.mascotA.pokemonId), members: [] };
    groups[key].members.push({ name: mascotName(relation.mascotB), sprite: getSpriteUrl(relation.mascotB.pokemonId), score: relation.relationshipScore });
    return groups;
  }, {})).filter((group) => group.members.length >= 2).sort((a, b) => b.members.length - a.members.length).slice(0, 4);
  const rivalClubs = Object.values(relations.filter((relation) => relation.isActive && relation.relationshipScore <= -15).reduce<Record<string, { leader: string; sprite: string; members: Array<{ name: string; sprite: string; score: number }> }>>((groups, relation) => {
    const key = mascotName(relation.mascotA);
    groups[key] ??= { leader: key, sprite: getSpriteUrl(relation.mascotA.pokemonId), members: [] };
    groups[key].members.push({ name: mascotName(relation.mascotB), sprite: getSpriteUrl(relation.mascotB.pokemonId), score: relation.relationshipScore });
    return groups;
  }, {})).filter((group) => group.members.length >= 2).sort((a, b) => b.members.length - a.members.length).slice(0, 4);
  const strongestFriend = relations.filter((relation) => relation.isActive && relation.relationshipScore >= 15).sort((a, b) => b.relationshipScore - a.relationshipScore)[0];
  const strongestRival = relations.filter((relation) => relation.isActive && relation.relationshipScore <= -15).sort((a, b) => a.relationshipScore - b.relationshipScore)[0];
  const inventoryItems = BOND_ITEM_CATALOG.map((definition) => {
    const item = bondInventory.find((candidate) => candidate.type === definition.type);
    return { id: item?.id ?? definition.type, type: definition.type, name: definition.name, description: definition.description, rarity: item?.rarity ?? definition.rarity, quantity: item?.ownerships[0]?.quantity ?? 0 };
  });
  const importantMoments = pendingEvents.map((event) => {
    const locationKey = (Object.keys(REFUGE_LOCATIONS) as RefugeLocation[]).find((location) => event.eventType.includes(`REFUGE_${location}`));
    const nameA = mascotName(event.mascotA);
    const nameB = event.mascotB ? mascotName(event.mascotB) : null;
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      context: locationKey ? `${REFUGE_LOCATIONS[locationKey].icon} ${REFUGE_LOCATIONS[locationKey].label}` : "Refúgio",
      participants: nameB ? `${nameA} e ${nameB}` : nameA,
      spriteA: getSpriteUrl(event.mascotA.pokemonId),
      spriteB: event.mascotB ? getSpriteUrl(event.mascotB.pokemonId) : null,
      options: normalizeBondOptions(event.optionsJson),
    };
  });
  const refugeTabs = (Object.keys(REFUGE_LOCATIONS) as RefugeLocation[]).map((location, locationIndex) => {
    const occupants = publicRoutines.filter((routine) => routine.locationType === location).map((routine) => ({
      id: routine.mascot.id,
      name: mascotName(routine.mascot),
      sprite: getSpriteUrl(routine.mascot.pokemonId),
      level: routine.mascot.level,
      personality: PERSONALITY_LABEL[routine.mascot.personality] ?? routine.mascot.personality,
      owner: routine.mascot.playerId === playerId ? "Você" : routine.mascot.player.displayName,
      own: routine.mascot.playerId === playerId,
      location,
      startedAt: routine.startedAt.toISOString(),
      moveAvailableAt: new Date(routine.updatedAt.getTime() + BONDS_V2_BALANCE.publicSpaces.moveCooldownMinutes * 60_000).toISOString(),
    }));
    const stories = memoriesByLocation[locationIndex].map((memory) => {
      const metadata = memory.metadata && typeof memory.metadata === "object" && !Array.isArray(memory.metadata) ? memory.metadata as Record<string, unknown> : {};
      const nameA = mascotName(memory.mascotA);
      const nameB = memory.mascotB ? mascotName(memory.mascotB) : null;
      const participants = nameB ? `${nameA} e ${nameB}` : nameA;
      const owners = [...new Set([memory.mascotA.player.displayName, memory.mascotB?.player.displayName].filter((name): name is string => Boolean(name)))];
      return {
        id: memory.id,
        title: memory.title,
        description: memory.description,
        conflict: metadata.conflict === true,
        participants,
        owners: owners.join(" · "),
        scoreDelta: typeof metadata.scoreDelta === "number" ? metadata.scoreDelta : null,
        when: memory.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      };
    });
    return { location, occupants, backgroundUrl: typeof backgrounds[location] === "string" ? backgrounds[location] as string : "", stories };
  });

  return <div className="space-y-8 font-sans antialiased">
    <header className="relative overflow-hidden rounded-3xl border border-fuchsia-400/25 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,.24),transparent_40%),linear-gradient(135deg,#070d1d,#120826)] p-6 shadow-2xl shadow-fuchsia-950/20">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-amber-200"><LockKeyhole size={12} className="mr-1 inline" /> Prévia exclusiva do admin</div>
        <BondsTutorial />
      </div>
      <p className="text-xs font-black uppercase tracking-[.25em] text-fuchsia-300">Laços 2.0 · vida social dos mascotes</p>
      <h1 className="mt-3 max-w-2xl text-3xl font-black text-white">Veja onde eles vivem. Entenda por que se importam.</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">O Refúgio é público: mascotes de treinadores diferentes dividem lugares, criam histórias e transformam convivência em amizade, rivalidade e memórias.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Acontecimentos", value: recentEvents, icon: Activity },
          { label: "Relações mudaram", value: changedRelations, icon: HeartHandshake },
          { label: "Laços ativos", value: activeCount, icon: Sparkles },
          { label: "Decisões aguardando", value: pendingEvents.length, icon: Brain },
        ].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3"><Icon size={15} className="text-fuchsia-300" /><p className="mt-2 text-2xl font-black text-white">{value}</p><p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p></div>)}
      </div>
    </header>

    <BondsV2SectionTabs
      pendingCount={pendingEvents.length}
      bondCount={relations.length}
      itemCount={inventoryItems.reduce((total, item) => total + item.quantity, 0)}
      refuge={<>
    <section>
      <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300">Espaços públicos e persistentes</p><h2 className="text-2xl font-black text-white">Explore o Refúgio</h2><p className="mt-1 max-w-3xl text-sm text-slate-400">Cada local favorece acontecimentos diferentes. Procure um mascote, envie-o para uma rotina e observe quem está dividindo o espaço com ele.</p></div>
      <RefugeLocationsTabs locations={refugeTabs} ownMascots={ownMascots} />
    </section>
      </>}
      moments={<>
    <section>
      <div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">Escolhas que mudam histórias</p><h2 className="text-xl font-black text-white">Momentos importantes</h2><p className="mt-1 text-xs text-slate-500">Acontecimentos comuns entram no diário. Somente decisões de impacto pedem sua intervenção.</p></div>
      {pendingEvents.length === 0 ? <Empty text="Nenhuma decisão importante aguarda resposta." /> : <ImportantMomentsList moments={importantMoments} />}
    </section>
      </>}
      inventory={<BondInventoryV2 items={inventoryItems} />}
      social={<>
    <section className="rounded-3xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,.08),transparent_35%),rgba(2,6,23,.65)] p-5">
      <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Além das duplas</p><h2 className="text-xl font-semibold text-white">Mapa social e outros treinadores</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Aqui você compara sua rede por treinador. Círculos de amizade e Clubes da Luta são explicados e filtrados diretamente em “Laços e efeitos”, onde seus benefícios também aparecem.</p></div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div><h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><Network size={15} className="text-fuchsia-300" /> Possíveis grupos de amigos</h3>{friendCircles.length === 0 ? <Empty text="Quando um mascote tiver dois ou mais Laços Ativos positivos, um grupo aparecerá aqui." /> : <div className="grid gap-2 sm:grid-cols-2">{friendCircles.map((group) => <article key={group.leader} className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-300/[.035] p-3"><div className="flex items-center gap-2"><img src={group.sprite} alt="" className="h-11 w-11 rounded-full bg-slate-900 object-contain" /><div><p className="text-xs font-black uppercase tracking-wider text-fuchsia-300">Ponto de encontro</p><p className="font-bold text-white">Círculo de {group.leader}</p></div></div><div className="mt-3 flex flex-wrap gap-1.5">{group.members.map((member) => <span key={member.name} className="flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] text-slate-300"><img src={member.sprite} alt="" className="h-5 w-5 object-contain" />{member.name} · +{member.score}</span>)}</div></article>)}</div>}</div>
        <div><h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-white"><Users size={15} className="text-cyan-300" /> Afinidade por treinador</h3><TrainerBondExplorer relations={bondItems} /></div>
      </div>
    </section>
      </>}
      bonds={<div className="space-y-6">
    <section className="rounded-3xl border border-white/10 bg-slate-950/65 p-5">
      <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">Consequência, não decoração</p><h2 className="text-xl font-black text-white">Impactos em teste</h2><p className="mt-1 text-xs text-slate-400">Valores experimentais da prévia administrativa. Bônus de amizade já podem ser validados em expedições e treinos sem afetar jogadores comuns.</p></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ImpactCard tone="emerald" title="Parceiros de jornada" value={strongestFriend ? (strongestFriend.relationshipScore >= BONDS_V2_BALANCE.superFriend.minScore ? "−7% de tempo" : strongestFriend.relationshipScore >= BONDS_V2_BALANCE.friend.minScore ? "−3% de tempo" : "Colega · sem bônus") : "Sem vínculo elegível"} text={strongestFriend ? `${mascotName(strongestFriend.mascotA)} e ${mascotName(strongestFriend.mascotB)} formam a melhor dupla atual. Basta estarem em expedições simultâneas; apenas o melhor vínculo conta.` : "Amigos em expedições simultâneas ativam o efeito."} />
        <ImpactCard tone="cyan" title="Parceiros de treino" value={strongestFriend ? (strongestFriend.relationshipScore >= BONDS_V2_BALANCE.superFriend.minScore ? "+10% EXP" : strongestFriend.relationshipScore >= BONDS_V2_BALANCE.friend.minScore ? "+5% EXP" : "Colega · sem bônus") : "Sem vínculo elegível"} text="Vale exclusivamente no modo Treino, não acumula e respeita o teto global de 10%." />
        <ImpactCard tone="rose" title="Algo a provar" value={strongestRival && strongestRival.relationshipScore <= -50 ? "+5% contra o Inimigo" : "Rivalidade em formação"} text={strongestRival ? `${mascotName(strongestRival.mascotA)} reage especificamente a ${mascotName(strongestRival.mascotB)}; não é um bônus contra toda equipe.` : "Inimigos podem ativar um bônus ofensivo pessoal e situacional."} />
        <ImpactCard tone="fuchsia" title="Acerto de contas" value={strongestRival && strongestRival.relationshipScore <= -80 ? "+8% · 3 turnos" : "Nenhum Nêmesis"} text="Efeito simétrico apenas entre os dois Nêmesis. Termina após 3 turnos diretos, K.O. ou substituição." />
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-3xl border border-emerald-300/15 bg-emerald-300/[.035] p-5"><h2 className="text-lg font-semibold text-white">Círculos de amizade</h2><p className="mt-2 text-sm leading-6 text-slate-300">Quando um mascote possui pelo menos dois vínculos positivos presentes e o grupo se reúne no mesmo espaço, forma um círculo. Fora do Campo de Treino, o círculo acrescenta <strong className="text-emerald-200">10 pontos percentuais</strong> à chance de produzir um item comum de Laços e também favorece Momentos importantes coletivos.</p>{friendCircles.length === 0 ? <div className="mt-3"><Empty text="Nenhum círculo formado. São necessários dois amigos ou colegas ligados ao mesmo mascote." /></div> : <div className="mt-3 space-y-2">{friendCircles.map((group) => <div key={group.leader} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-sm font-semibold text-white">Círculo de {group.leader}</p><p className="mt-1 text-xs text-slate-400">{group.members.map((member) => member.name).join(" · ")}</p></div>)}</div>}</div>
      <div className="rounded-3xl border border-rose-300/15 bg-rose-300/[.035] p-5"><h2 className="text-lg font-semibold text-white">Clubes da Luta</h2><p className="mt-2 text-sm leading-6 text-slate-300">Quando um mascote mantém pelo menos duas rivalidades presentes e eles se encontram no Campo de Treino, nasce um Clube da Luta. O clube acrescenta <strong className="text-rose-200">10 pontos percentuais</strong> à chance de produzir um item comum de competição e favorece desafios e decisões coletivas.</p>{rivalClubs.length === 0 ? <div className="mt-3"><Empty text="Nenhum clube formado. São necessários dois Rivais, Inimigos ou Nêmesis ligados ao mesmo mascote." /></div> : <div className="mt-3 space-y-2">{rivalClubs.map((group) => <div key={group.leader} className="rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-sm font-semibold text-white">Clube de {group.leader}</p><p className="mt-1 text-xs text-slate-400">{group.members.map((member) => member.name).join(" · ")}</p></div>)}</div>}</div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <div><div className="mb-3"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-fuchsia-300">Rede social dos mascotes</p><h2 className="text-xl font-black text-white">Laços e efeitos</h2><p className="mt-1 text-xs text-slate-500">Relações são direcionais: o que um mascote sente pode não ser correspondido.</p></div><BondDirectoryV2 relations={bondItems} /></div>
      <div><div className="mb-3 flex items-center gap-2"><Archive size={16} className="text-amber-300" /><div><h2 className="font-bold text-white">Histórias recentes do Refúgio</h2><p className="text-xs text-slate-500">Resumo cronológico; o diário completo e filtrável fica dentro de cada região.</p></div></div><div className="relative space-y-3 border-l border-fuchsia-400/20 pl-4">{recentMemories.length === 0 ? <Empty text="Simule um momento no Refúgio para iniciar o diário." /> : recentMemories.map((memory) => <article key={memory.id} className="relative rounded-xl border border-white/10 bg-slate-950/70 p-3 before:absolute before:-left-[21px] before:top-5 before:h-2 before:w-2 before:rounded-full before:bg-fuchsia-400"><p className="text-[10px] uppercase tracking-wider text-fuchsia-300">{({ REFUGE: "Refúgio", REFUGE_REWARD: "Recompensa do Refúgio", BOND_MANAGEMENT: "Gestão de vínculo", SOCIAL: "Interação social", COMBAT: "Combate", TRAINING: "Treino", EXPEDITION: "Expedição" } as Record<string, string>)[memory.sourceType] ?? "Acontecimento"} · intensidade {memory.intensity}</p><h3 className="mt-1 text-sm font-bold text-white">{memory.title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{memory.description}</p><div className="mt-2 rounded-lg bg-white/[.025] px-2 py-1.5 text-[10px] text-slate-500">{mascotName(memory.mascotA)}{memory.mascotB ? ` com ${mascotName(memory.mascotB)}` : ""} · {memory.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div></article>)}</div></div>
    </section>
      </div>}
    />
  </div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">{text}</div>;
}

function ImpactCard({ tone, title, value, text }: { tone: "emerald" | "cyan" | "rose" | "fuchsia"; title: string; value: string; text: string }) {
  const tones = { emerald: "border-emerald-400/20 text-emerald-300", cyan: "border-cyan-400/20 text-cyan-300", rose: "border-rose-400/20 text-rose-300", fuchsia: "border-fuchsia-400/20 text-fuchsia-300" };
  return <article className={`rounded-2xl border bg-white/[.025] p-4 ${tones[tone]}`}><p className="text-[10px] font-black uppercase tracking-wider">{title}</p><p className="mt-2 text-lg font-black text-white">{value}</p><p className="mt-2 text-xs leading-5 text-slate-400">{text}</p></article>;
}
