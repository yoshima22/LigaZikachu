import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock, Heart, ScrollText, Swords, Users } from "lucide-react";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import {
  BOND_BEHAVIOR_LABEL,
  autoResolveExpiredBondEvents,
  createBondEventForPlayer,
  effectiveRelationScore,
  ensureRunawayWarningsForPlayer,
  normalizeBondOptions,
  relationTier,
  type BondBehavior,
  type BondOption,
} from "@/lib/mascot-bonds";
import { BehaviorSelect, RelationsFilter, ResolveBondOptionButton } from "./_components/bond-actions";

export const dynamic = "force-dynamic";

function timeLeft(date: Date | null) {
  if (!date) return "Sem prazo";
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "Expirando";
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
}

function withAvailability(option: BondOption, counts: { food: number; sweet: number; coins: number }) {
  const costs = option.costs ?? (option.cost ? [option.cost] : []);
  if (costs.length === 0) return option;
  const missing = costs.find((cost) => {
    const available =
      cost.kind === "FOOD" ? counts.food :
      cost.kind === "SWEET" ? counts.sweet :
      counts.coins;
    return available < cost.quantity;
  });
  if (!missing) return option;
  return {
    ...option,
    blockedReason: missing.kind === "FOOD"
      ? "Voce precisa de Comida de Mascote."
      : missing.kind === "SWEET"
        ? "Voce precisa de Doce de Mascote."
        : "ZikaCoins insuficientes.",
  };
}

export default async function LacosPage({
  searchParams,
}: {
  searchParams: Promise<{ relPage?: string; relSearch?: string; relSort?: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, mascotBondBehavior: true },
  });
  if (!player) redirect("/dashboard");

  await autoResolveExpiredBondEvents(player.id);
  await ensureRunawayWarningsForPlayer(player.id).catch(() => {});

  // Auto-criar eventos cadenciados: min 4h entre criações, preenche até 5 pendentes
  const [lastEvent, currentPending] = await Promise.all([
    prisma.mascotSocialEvent.findFirst({
      where: { ownerId: player.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }).catch(() => null),
    prisma.mascotSocialEvent.count({
      where: { ownerId: player.id, status: "PENDING" },
    }).catch(() => 7),
  ]);

  const hoursSinceLast = lastEvent
    ? (Date.now() - lastEvent.createdAt.getTime()) / 3_600_000
    : 999;

  if (hoursSinceLast >= 2 && currentPending < 7) {
    const toCreate = Math.min(7 - currentPending, hoursSinceLast >= 8 ? 3 : hoursSinceLast >= 4 ? 2 : 1);
    for (let i = 0; i < toCreate; i++) {
      await createBondEventForPlayer(player.id).catch(() => {});
    }
  }

  const params = await searchParams;
  const relPage = Math.max(1, Number(params.relPage ?? "1") || 1);
  const relSearch = params.relSearch?.trim() ?? "";
  const relSort = params.relSort ?? "";
  const relationsPerPage = 10;

  const relationsWhere = {
    mascotA: { playerId: player.id },
    ...(relSearch ? {
      OR: [
        { mascotA: { nickname: { contains: relSearch, mode: "insensitive" as const } } },
        { mascotB: { nickname: { contains: relSearch, mode: "insensitive" as const } } },
        { mascotB: { player: { displayName: { contains: relSearch, mode: "insensitive" as const } } } },
      ],
    } : {}),
  };

  const relationsOrderBy =
    relSort === "rival" ? [{ relationshipScore: "asc" as const }, { updatedAt: "desc" as const }] :
    relSort === "friend" ? [{ relationshipScore: "desc" as const }, { updatedAt: "desc" as const }] :
    [{ relationshipScore: "desc" as const }, { updatedAt: "desc" as const }];

  // Egress: logs restritos ao próprio jogador + últimos 7 dias de logs públicos
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000);

  const [pendingEvents, relations, relationCount, logs, foods, wallet] = await Promise.all([
    prisma.mascotSocialEvent.findMany({
      where: { ownerId: player.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        mascotA: { select: { id: true, pokemonId: true, nickname: true } },
        mascotB: { select: { id: true, pokemonId: true, nickname: true, player: { select: { displayName: true } } } },
      },
    }).catch(() => []),
    prisma.mascotRelation.findMany({
      where: relationsWhere,
      orderBy: relationsOrderBy,
      skip: (relPage - 1) * relationsPerPage,
      take: relationsPerPage,
      select: {
        id: true,
        relationshipScore: true,
        specialBondType: true,
        type: true,
        interactionCount: true,
        mascotA: { select: { id: true, pokemonId: true, nickname: true } },
        mascotB: { select: { id: true, pokemonId: true, nickname: true, player: { select: { displayName: true } } } },
      },
    }).catch(() => []),
    prisma.mascotRelation.count({ where: relationsWhere }).catch(() => 0),
    prisma.mascotSocialDecisionLog.findMany({
      where: {
        OR: [
          { actorPlayerId: player.id },
          { mascotA: { playerId: player.id } },
          { mascotB: { playerId: player.id } },
          { visibility: "PUBLIC", createdAt: { gte: sevenDaysAgo } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        optionLabel: true,
        optionType: true,
        resolvedBy: true,
        createdAt: true,
        mascotA: { select: { pokemonId: true, nickname: true } },
        mascotB: { select: { pokemonId: true, nickname: true, player: { select: { displayName: true } } } },
        actorPlayer: { select: { displayName: true } },
      },
    }).catch(() => []),
    prisma.mascotFoodItem.findMany({ where: { playerId: player.id }, select: { type: true, quantity: true } }).catch(() => []),
    prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id }, select: { balance: true } }).catch(() => null),
  ]);

  const counts = {
    food: foods.find((f) => f.type === "FOOD")?.quantity ?? 0,
    sweet: foods.find((f) => f.type === "SWEET")?.quantity ?? 0,
    coins: wallet?.balance ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-slate-950/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#FFCB05]">
              <Heart size={14} /> Laços de Mascote
            </p>
            <h1 className="mt-2 font-pixel text-base text-white">Escolhas que mudam relações</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Resolva eventos sociais, fortaleça amizades ou assuma riscos de rivalidade. Opções positivas podem custar recursos; se voce ignorar, o mascote decide sozinho sem gastar seus itens.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
            Eventos aparecem automaticamente
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-400">Comportamento automatico quando voce nao responde</p>
            <BehaviorSelect value={(player.mascotBondBehavior as BondBehavior) ?? "FREE"} />
          </div>
          <div className="rounded-xl border border-border bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
            <span className="text-slate-500">Atual:</span> {BOND_BEHAVIOR_LABEL[(player.mascotBondBehavior as BondBehavior) ?? "FREE"]}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-100"><Clock size={16} /> Eventos Pendentes</h2>
        {pendingEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-slate-500">
            Nenhum evento pendente. Novos eventos aparecem automaticamente quando voce visita esta pagina.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pendingEvents.map((event) => {
              const nameA = event.mascotA.nickname ?? getPokemonName(event.mascotA.pokemonId);
              const nameB = event.mascotB ? event.mascotB.nickname ?? getPokemonName(event.mascotB.pokemonId) : "Outro mascote";
              const ownerB = event.mascotB?.player?.displayName;
              const options = normalizeBondOptions(event.optionsJson).map((option) => withAvailability(option, counts));
              return (
                <article key={event.id} className="rounded-2xl border border-border bg-slate-950/60 p-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getSpriteUrl(event.mascotA.pokemonId)} alt={nameA} className="h-14 w-14 object-contain" style={{ imageRendering: "pixelated" }} />
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-widest text-[#FFCB05]">{event.title}</p>
                      <h3 className="font-semibold text-white">
                        {nameA} e {nameB}
                        {ownerB && ownerB !== player.displayName && (
                          <span className="ml-1 text-xs font-normal text-slate-500">({ownerB})</span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-500">Tempo para responder: {timeLeft(event.expiresAt)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{event.description}</p>
                  <p className="mt-2 text-[11px] text-slate-500">Se expirar, seu mascote decide sozinho. Ele nunca gastara comida, doce, moedas ou itens sem sua permissao.</p>
                  <div className="mt-4 grid gap-2">
                    {options.map((option) => (
                      <ResolveBondOptionButton key={option.id} eventId={event.id} option={option} disabled={!!option.blockedReason} />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-100"><Users size={16} /> Relações Atuais</h2>
            <span className="rounded-full border border-border bg-slate-950 px-2.5 py-1 text-[11px] text-slate-400">{relationCount} laços</span>
          </div>
          <RelationsFilter defaultSearch={relSearch} defaultSort={relSort} />
          <div className="rounded-2xl border border-border bg-slate-950/50 p-3">
            {relations.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Seus mascotes ainda nao possuem laços registrados.</p>
            ) : (
              <div className="grid gap-2">
                {relations.map((rel) => {
                  const a = rel.mascotA.nickname ?? getPokemonName(rel.mascotA.pokemonId);
                  const b = rel.mascotB.nickname ?? getPokemonName(rel.mascotB.pokemonId);
                  const score = effectiveRelationScore(rel);
                  const friendly = score >= 15;
                  const hostile = score <= -15;
                  return (
                    <div key={rel.id} className={`rounded-xl border p-3 ${friendly ? "border-green-500/25 bg-green-500/5" : hostile ? "border-red-500/25 bg-red-500/5" : "border-border bg-slate-900/40"}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getSpriteUrl(rel.mascotA.pokemonId)} alt={a} className="h-10 w-10 rounded-full border border-slate-700 bg-slate-950 object-contain" style={{ imageRendering: "pixelated" }} />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getSpriteUrl(rel.mascotB.pokemonId)} alt={b} className="h-10 w-10 rounded-full border border-slate-700 bg-slate-950 object-contain" style={{ imageRendering: "pixelated" }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{a} <span className="text-slate-500">com</span> {b}</p>
                          <p className="truncate text-[11px] text-slate-500">Dono: {rel.mascotB.player.displayName} | {rel.interactionCount} interações</p>
                        </div>
                        <div className="text-right">
                          <p className={friendly ? "text-green-300" : hostile ? "text-red-300" : "text-slate-300"}>{relationTier(score)}</p>
                          <p className="text-xs text-slate-500">{score > 0 ? "+" : ""}{score}</p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className={`h-full ${friendly ? "bg-green-400" : hostile ? "bg-red-400" : "bg-slate-500"}`} style={{ width: `${Math.min(100, Math.max(0, score + 100) / 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {relationCount > relationsPerPage && (
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-slate-400">
                <Link href={`/lacos?relPage=${Math.max(1, relPage - 1)}`} className={`inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 ${relPage <= 1 ? "pointer-events-none opacity-40" : "hover:border-[#FFCB05]/40 hover:text-[#FFCB05]"}`}>
                  <ChevronLeft size={12} /> Anterior
                </Link>
                <span>Página {relPage} de {Math.max(1, Math.ceil(relationCount / relationsPerPage))}</span>
                <Link href={`/lacos?relPage=${Math.min(Math.max(1, Math.ceil(relationCount / relationsPerPage)), relPage + 1)}`} className={`inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 ${relPage >= Math.ceil(relationCount / relationsPerPage) ? "pointer-events-none opacity-40" : "hover:border-[#FFCB05]/40 hover:text-[#FFCB05]"}`}>
                  Próxima <ChevronRight size={12} />
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-100"><ScrollText size={16} /> Historico Social</h2>
          <div className="rounded-2xl border border-border bg-slate-950/50 divide-y divide-border/50">
            {logs.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Nenhuma decisao social registrada ainda.</p>
            ) : logs.map((log) => {
              const a = log.mascotA.nickname ?? getPokemonName(log.mascotA.pokemonId);
              const b = log.mascotB ? log.mascotB.nickname ?? getPokemonName(log.mascotB.pokemonId) : null;
              return (
                <div key={log.id} className="p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">{log.optionLabel ?? "Decisao automatica"}</p>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-slate-400">{log.resolvedBy}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {a}{b ? ` com ${b}` : ""} | {new Date(log.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Tipo: {log.optionType === "POSITIVE" ? "positiva" : log.optionType === "AGGRESSIVE" ? "rivalidade" : "neutra"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs leading-relaxed text-blue-100">
        <p className="flex items-center gap-2 font-semibold text-blue-200"><Swords size={14} /> Efeito em combate</p>
        <p className="mt-1 text-blue-100/80">
          Laços fortes dentro da mesma equipe dão bonus leve de desempenho na Arena Z. Rivalidades muito negativas dentro da equipe geram penalidade pequena. A regra e intencionalmente baixa para criar consequencia sem quebrar balanceamento.
        </p>
      </div>
    </div>
  );
}
