import Link from "next/link";
import { Activity, ArrowLeft, ChevronLeft, ChevronRight, Search, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";
import { getWeeklyLeagueLockedMascotIds } from "@/lib/weekly-league-locks";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;
const DEFAULT_WINDOW_DAYS = 30;
const SOURCES = [
  { id: "activity", label: "Atividades", description: "Ledger detalhado das novas operações" },
  { id: "zc", label: "ZikaCoins", description: "Créditos, débitos e saldo" },
  { id: "bazar", label: "Bazar", description: "Vendas, trocas e leilões" },
  { id: "expeditions", label: "Expedições", description: "Duração, status e recompensas" },
  { id: "gifts", label: "Presentes", description: "Geração e resgate de recompensas" },
  { id: "mascots", label: "Mascotes", description: "Eventos e alterações registradas" },
  { id: "diagnostic", label: "Diagnóstico de Mascote", description: "Disponibilidade, travas e motivo de não aparecer no Bazar" },
  { id: "audit", label: "Sistema", description: "Auditoria administrativa e técnica" },
] as const;
type SourceId = (typeof SOURCES)[number]["id"];

type LogRow = {
  id: string;
  createdAt: Date;
  playerId?: string | null;
  playerName: string;
  category: string;
  summary: string;
  source?: string | null;
  amount?: number | null;
  unit?: string | null;
  entity?: string | null;
};

function sourceId(value?: string): SourceId {
  return SOURCES.some((source) => source.id === value) ? value as SourceId : "activity";
}

function dateRange(from?: string, to?: string) {
  const gte = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00-03:00`) : undefined;
  const lte = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999-03:00`) : undefined;
  return gte || lte ? { gte, lte } : undefined;
}

function validDateInput(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function defaultFromDate() {
  const date = new Date(Date.now() - (DEFAULT_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildHref(input: { source: SourceId; page?: number; q?: string; from?: string; to?: string; category?: string; detail?: string; view?: string }) {
  const params = new URLSearchParams({ source: input.source });
  if (input.page && input.page > 1) params.set("page", String(input.page));
  if (input.q) params.set("q", input.q);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.category) params.set("category", input.category);
  if (input.detail) params.set("detail", input.detail);
  if (input.view && input.view !== "simple") params.set("view", input.view);
  return `/admin/logs?${params.toString()}`;
}

function formatJson(value: unknown) {
  return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, 2);
}

const SIMPLE_LABELS: Record<string, string> = {
  id: "ID", playerId: "ID do jogador", pokemonId: "ID do Pokémon", nickname: "Apelido",
  displayName: "Jogador", level: "Nível", personality: "Personalidade", arenaState: "Estado na Arena",
  bazarListed: "Anunciado no Bazar", isEquipped: "Equipado", isFavorite: "Favorito",
  operationsLocked: "Proteção de operações", restingUntil: "Repouso até", createdAt: "Criado em",
  updatedAt: "Atualizado em", startedAt: "Iniciado em", finishAt: "Finaliza em", status: "Status",
  before: "Antes", after: "Depois", metadata: "Informações adicionais", rewardJson: "Recompensa",
  blockers: "Impedimentos encontrados", canListInBazar: "Pode anunciar no Bazar",
};

function simpleValue(value: unknown): string {
  if (value === null || value === undefined) return "Não informado";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value instanceof Date) return value.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (typeof value === "object") return "";
  return String(value);
}

function simplifiedLines(value: unknown): Array<{ label: string; value: string; depth: number }> {
  const rows: Array<{ label: string; value: string; depth: number }> = [];
  const walk = (item: unknown, path: string, depth: number) => {
    if (Array.isArray(item)) {
      if (!item.length) rows.push({ label: path, value: "Nenhum", depth });
      else item.forEach((entry, index) => walk(entry, `${path} ${index + 1}`, depth));
      return;
    }
    if (item && typeof item === "object" && !(item instanceof Date)) {
      for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
        const label = SIMPLE_LABELS[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
        if (child && typeof child === "object") {
          rows.push({ label, value: "", depth });
          walk(child, label, depth + 1);
        } else rows.push({ label, value: simpleValue(child), depth });
      }
      return;
    }
    rows.push({ label: path || "Valor", value: simpleValue(item), depth });
  };
  walk(value, "", 0);
  return rows;
}

async function matchingPlayerIds(query: string) {
  if (!query) return null;
  const players = await prisma.player.findMany({
    where: {
      OR: [
        { displayName: { contains: query, mode: "insensitive" } },
        { ptcglNick: { contains: query, mode: "insensitive" } },
        { user: { email: { contains: query, mode: "insensitive" } } },
      ],
    },
    select: { id: true },
    take: 100,
  });
  return players.map((player) => player.id);
}

async function loadRows(input: { source: SourceId; page: number; q: string; from?: string; to?: string; category?: string }): Promise<{ rows: LogRow[]; total: number }> {
  const skip = (input.page - 1) * PAGE_SIZE;
  const createdAt = dateRange(input.from, input.to);
  if (input.source === "diagnostic") {
    const tokens = input.q.split(/\s+/).map((token) => token.trim()).filter(Boolean).slice(0, 6);
    if (!tokens.length) return { rows: [], total: 0 };
    const tokenFilters = await Promise.all(tokens.map(async (token) => {
      const tokenPlayerIds = await matchingPlayerIds(token);
      const numericId = /^\d+$/.test(token) ? Number(token) : null;
      const normalizedToken = token.toLocaleLowerCase("pt-BR");
      const nameIds = Array.from({ length: 1025 }, (_, index) => index + 1)
        .filter((id) => getPokemonName(id).toLocaleLowerCase("pt-BR").includes(normalizedToken))
        .slice(0, 80);
      return {
        OR: [
          ...(tokenPlayerIds?.length ? [{ playerId: { in: tokenPlayerIds } }] : []),
          { nickname: { contains: token, mode: "insensitive" as const } },
          { speciesNameOverride: { contains: token, mode: "insensitive" as const } },
          ...((numericId || nameIds.length) ? [{ pokemonId: { in: [...new Set([...(numericId ? [numericId] : []), ...nameIds])] } }] : []),
        ],
      };
    }));
    const where = tokens.length ? { AND: tokenFilters } : {};
    const [total, mascots] = await Promise.all([
      prisma.mascot.count({ where }),
      prisma.mascot.findMany({
        where, orderBy: { hatchedAt: "desc" }, skip, take: PAGE_SIZE,
        select: {
          id: true, playerId: true, pokemonId: true, nickname: true, speciesNameOverride: true, level: true, hatchedAt: true,
          operationsLocked: true, bazarListed: true, isEquipped: true, arenaState: true, restingUntil: true,
          player: { select: { displayName: true } },
          expeditions: { where: { status: "ACTIVE" }, take: 1, select: { id: true } },
          arenaTeamMembers: { where: { team: { status: "ACTIVE" } }, take: 1, select: { id: true } },
        },
      }),
    ]);
    const lockedByPlayer = new Map<string, Set<string>>();
    await Promise.all([...new Set(mascots.map((mascot) => mascot.playerId))].map(async (playerId) => {
      lockedByPlayer.set(playerId, await getWeeklyLeagueLockedMascotIds(prisma, playerId));
    }));
    return {
      total,
      rows: mascots.map((mascot) => {
        const blockers = [
          mascot.operationsLocked ? "Protegido por cadeado" : null,
          mascot.bazarListed ? "Já reservado no Bazar" : null,
          mascot.isEquipped ? "Equipado como companheiro" : null,
          mascot.arenaState !== "FREE" ? `Estado da Arena: ${mascot.arenaState}` : null,
          mascot.restingUntil && mascot.restingUntil > new Date() ? `Repouso até ${mascot.restingUntil.toLocaleString("pt-BR")}` : null,
          lockedByPlayer.get(mascot.playerId)?.has(mascot.id) ? "Escalado/travado na Liga Semanal" : null,
          mascot.expeditions.length ? "Em expedição ativa" : null,
          mascot.arenaTeamMembers.length ? "Em equipe ativa da Arena" : null,
        ].filter(Boolean) as string[];
        const name = mascot.nickname ?? mascot.speciesNameOverride ?? getPokemonName(mascot.pokemonId);
        return {
          id: mascot.id, createdAt: mascot.hatchedAt, playerId: mascot.playerId, playerName: mascot.player.displayName,
          category: blockers.length ? "BLOQUEADO" : "DISPONÍVEL",
          summary: `${name} · Nv.${mascot.level} · ${blockers.length ? blockers.join("; ") : "Pode ser anunciado no Bazar"}`,
          source: `Pokémon #${mascot.pokemonId}`,
          entity: `mascot:${mascot.id}`,
        };
      }),
    };
  }
  // O ledger consulta texto e jogador em uma unica query. As fontes legadas
  // ainda precisam traduzir a busca do jogador para os IDs relacionados.
  const playerIds = input.source === "activity" ? null : await matchingPlayerIds(input.q);
  const noPlayerMatch = playerIds !== null && playerIds.length === 0;

  if (input.source === "activity") {
    const where = {
      ...(createdAt ? { createdAt } : {}),
      ...(input.category ? { category: input.category.toUpperCase() } : {}),
      ...(input.q ? {
        OR: [
          { summary: { contains: input.q, mode: "insensitive" as const } },
          { action: { contains: input.q, mode: "insensitive" as const } },
          { category: { contains: input.q, mode: "insensitive" as const } },
          { source: { contains: input.q, mode: "insensitive" as const } },
          { entityType: { contains: input.q, mode: "insensitive" as const } },
          { entityId: { contains: input.q, mode: "insensitive" as const } },
          {
            player: {
              is: {
                OR: [
                  { displayName: { contains: input.q, mode: "insensitive" as const } },
                  { ptcglNick: { contains: input.q, mode: "insensitive" as const } },
                  { user: { email: { contains: input.q, mode: "insensitive" as const } } },
                ],
              },
            },
          },
        ],
      } : {}),
    };
    const [total, records] = await Promise.all([
      prisma.playerActivityLog.count({ where }),
      prisma.playerActivityLog.findMany({
        where, orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE,
        select: { id: true, createdAt: true, playerId: true, category: true, action: true, summary: true, source: true, amount: true, unit: true, entityType: true, entityId: true, player: { select: { displayName: true } } },
      }),
    ]);
    return { total, rows: records.map((row) => ({ id: row.id, createdAt: row.createdAt, playerId: row.playerId, playerName: row.player?.displayName ?? "Jogador removido", category: row.category, summary: row.summary, source: row.source ?? row.action, amount: row.amount, unit: row.unit, entity: row.entityType && row.entityId ? `${row.entityType}:${row.entityId}` : null })) };
  }

  if (input.source === "zc") {
    if (noPlayerMatch) return { rows: [] as LogRow[], total: 0 };
    const where = { ...(createdAt ? { createdAt } : {}), ...(playerIds ? { wallet: { playerId: { in: playerIds } } } : {}) };
    const [total, records] = await Promise.all([
      prisma.zikaCoinTransaction.count({ where }),
      prisma.zikaCoinTransaction.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE, select: { id: true, createdAt: true, type: true, amount: true, balanceBefore: true, balanceAfter: true, description: true, wallet: { select: { playerId: true, player: { select: { displayName: true } } } } } }),
    ]);
    return { total, rows: records.map((row) => ({ id: row.id, createdAt: row.createdAt, playerId: row.wallet.playerId, playerName: row.wallet.player.displayName, category: "ZC", summary: row.description ?? row.type, source: row.type, amount: row.amount, unit: "ZC", entity: `saldo ${row.balanceBefore} → ${row.balanceAfter}` })) };
  }

  if (input.source === "bazar") {
    const where = {
      ...(createdAt ? { createdAt } : {}),
      ...(input.q ? { OR: [{ sellerName: { contains: input.q, mode: "insensitive" as const } }, { buyerName: { contains: input.q, mode: "insensitive" as const } }] } : {}),
    };
    const [total, records] = await Promise.all([
      prisma.bazarTransaction.count({ where }),
      prisma.bazarTransaction.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE }),
    ]);
    return { total, rows: records.map((row) => ({ id: row.id, createdAt: row.createdAt, playerName: `${row.sellerName} ↔ ${row.buyerName}`, category: "BAZAR", summary: row.description, source: row.category, amount: row.coinsAmount, unit: "ZC", entity: `anúncio:${row.listingId}` })) };
  }

  if (input.source === "expeditions") {
    if (noPlayerMatch) return { rows: [] as LogRow[], total: 0 };
    const where = { ...(createdAt ? { startedAt: createdAt } : {}), ...(playerIds ? { mascot: { playerId: { in: playerIds } } } : {}) };
    const [total, records] = await Promise.all([
      prisma.mascotExpedition.count({ where }),
      prisma.mascotExpedition.findMany({ where, orderBy: { startedAt: "desc" }, skip, take: PAGE_SIZE, select: { id: true, startedAt: true, finishAt: true, status: true, mascot: { select: { id: true, nickname: true, pokemonId: true, playerId: true, player: { select: { displayName: true } } } } } }),
    ]);
    return { total, rows: records.map((row) => ({ id: row.id, createdAt: row.startedAt, playerId: row.mascot.playerId, playerName: row.mascot.player.displayName, category: "EXPEDIÇÃO", summary: `${row.mascot.nickname ?? `Pokémon #${row.mascot.pokemonId}`} · ${row.status}`, source: row.status, entity: `mascot:${row.mascot.id} · termina ${row.finishAt.toLocaleString("pt-BR")}` })) };
  }

  if (input.source === "gifts") {
    if (noPlayerMatch) return { rows: [] as LogRow[], total: 0 };
    const where = { ...(createdAt ? { createdAt } : {}), ...(playerIds ? { playerId: { in: playerIds } } : {}) };
    const [total, records] = await Promise.all([
      prisma.playerGift.count({ where }),
      prisma.playerGift.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE, select: { id: true, createdAt: true, playerId: true, type: true, title: true, status: true, claimedAt: true, player: { select: { displayName: true } } } }),
    ]);
    return { total, rows: records.map((row) => ({ id: row.id, createdAt: row.createdAt, playerId: row.playerId, playerName: row.player.displayName, category: "PRESENTE", summary: row.title, source: `${row.type} · ${row.status}`, entity: row.claimedAt ? `resgatado ${row.claimedAt.toLocaleString("pt-BR")}` : null })) };
  }

  if (input.source === "mascots") {
    if (noPlayerMatch) return { rows: [] as LogRow[], total: 0 };
    const where = { ...(createdAt ? { createdAt } : {}), ...(playerIds ? { mascot: { playerId: { in: playerIds } } } : {}) };
    const [total, records] = await Promise.all([
      prisma.mascotEvent.count({ where }),
      prisma.mascotEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE, select: { id: true, createdAt: true, emoji: true, description: true, mascot: { select: { id: true, nickname: true, pokemonId: true, playerId: true, player: { select: { displayName: true } } } } } }),
    ]);
    return { total, rows: records.map((row) => ({ id: row.id, createdAt: row.createdAt, playerId: row.mascot.playerId, playerName: row.mascot.player.displayName, category: "MASCOTE", summary: `${row.emoji} ${row.mascot.nickname ?? `Pokémon #${row.mascot.pokemonId}`}: ${row.description}`, source: "MASCOT_EVENT", entity: `mascot:${row.mascot.id}` })) };
  }

  const actorUserIds = playerIds ? (await prisma.player.findMany({ where: { id: { in: playerIds } }, select: { userId: true } })).map((player) => player.userId) : null;
  if (actorUserIds && actorUserIds.length === 0) return { rows: [] as LogRow[], total: 0 };
  const where = { ...(createdAt ? { createdAt } : {}), ...(actorUserIds ? { actorUserId: { in: actorUserIds } } : {}) };
  const [total, records] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: PAGE_SIZE, select: { id: true, createdAt: true, entityType: true, entityId: true, action: true, actor: { select: { id: true, name: true, email: true, player: { select: { id: true, displayName: true } } } } } }),
  ]);
  return { total, rows: records.map((row) => ({ id: row.id, createdAt: row.createdAt, playerId: row.actor?.player?.id, playerName: row.actor?.player?.displayName ?? row.actor?.name ?? row.actor?.email ?? "Sistema", category: "SISTEMA", summary: row.action, source: row.entityType, entity: `${row.entityType}:${row.entityId}` })) };
}

async function loadDetail(source: SourceId, id?: string) {
  if (!id) return null;
  if (source === "diagnostic") {
    const mascot = await prisma.mascot.findUnique({
      where: { id },
      include: {
        player: { select: { displayName: true, ptcglNick: true } },
        expeditions: { where: { status: "ACTIVE" }, select: { id: true, startedAt: true, finishAt: true, status: true } },
        arenaTeamMembers: { where: { team: { status: "ACTIVE" } }, select: { id: true, team: { select: { id: true, roomLevel: true, status: true } } } },
      },
    });
    if (!mascot) return null;
    const weeklyLocked = (await getWeeklyLeagueLockedMascotIds(prisma, mascot.playerId)).has(mascot.id);
    const blockers = [
      mascot.operationsLocked ? "Protegido por cadeado" : null,
      mascot.bazarListed ? "Já reservado no Bazar" : null,
      mascot.isEquipped ? "Equipado como companheiro" : null,
      mascot.arenaState !== "FREE" ? `Estado da Arena: ${mascot.arenaState}` : null,
      mascot.restingUntil && mascot.restingUntil > new Date() ? `Repouso até ${mascot.restingUntil.toLocaleString("pt-BR")}` : null,
      weeklyLocked ? "Escalado/travado na Liga Semanal" : null,
      mascot.expeditions.length ? "Em expedição ativa" : null,
      mascot.arenaTeamMembers.length ? "Em equipe ativa da Arena" : null,
    ].filter(Boolean);
    return {
      diagnostic: {
        canListInBazar: blockers.length === 0,
        blockers,
        checkedAt: new Date(),
      },
      mascot,
    };
  }
  if (source === "activity") return prisma.playerActivityLog.findUnique({ where: { id }, include: { player: { select: { displayName: true, ptcglNick: true } }, actor: { select: { name: true, email: true } } } });
  if (source === "zc") return prisma.zikaCoinTransaction.findUnique({ where: { id }, include: { wallet: { include: { player: { select: { displayName: true } } } } } });
  if (source === "bazar") return prisma.bazarTransaction.findUnique({ where: { id } });
  if (source === "expeditions") return prisma.mascotExpedition.findUnique({ where: { id }, include: { mascot: { include: { player: { select: { displayName: true } } } } } });
  if (source === "gifts") return prisma.playerGift.findUnique({ where: { id }, include: { player: { select: { displayName: true } } } });
  if (source === "mascots") return prisma.mascotEvent.findUnique({ where: { id }, include: { mascot: { include: { player: { select: { displayName: true } } } } } });
  return prisma.auditLog.findUnique({ where: { id }, include: { actor: { select: { name: true, email: true, player: { select: { displayName: true } } } } } });
}

export default async function AdminLogsPage({ searchParams: searchParamsPromise }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const params = await searchParamsPromise;
  const source = sourceId(params.source);
  const q = params.q?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const category = params.category?.trim().slice(0, 40) ?? "";
  const view = params.view === "raw" ? "raw" : "simple";
  const from = validDateInput(params.from) ? params.from : defaultFromDate();
  const to = validDateInput(params.to) ? params.to : undefined;
  const [{ rows, total }, detail] = await Promise.all([
    loadRows({ source, page, q, from, to, category }),
    loadDetail(source, params.detail),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const common = { source, q, from, to, category, view };

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-slate-950 to-cyan-950/20 p-5">
        <Link href="/admin" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300"><ArrowLeft size={13} /> Painel administrativo</Link>
        <div className="flex items-start gap-3"><div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300"><ShieldCheck size={21} /></div><div><h1 className="font-pixel text-sm text-cyan-300">Auditoria de jogadores</h1><p className="mt-1 text-xs text-slate-400">Fontes separadas, paginação no servidor e detalhes carregados somente quando solicitados.</p></div></div>
      </header>

      <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SOURCES.map((item) => <Link key={item.id} href={buildHref({ source: item.id, q, from, to })} className={`rounded-xl border p-3 transition ${source === item.id ? "border-cyan-400/50 bg-cyan-400/10" : "border-border bg-slate-950/40 hover:border-cyan-400/20"}`}><p className={`text-xs font-bold ${source === item.id ? "text-cyan-300" : "text-slate-300"}`}>{item.label}</p><p className="mt-1 text-[10px] text-slate-500">{item.description}</p></Link>)}
      </nav>

      <form className="grid gap-2 rounded-2xl border border-border bg-slate-950/40 p-4 md:grid-cols-[minmax(220px,1fr)_150px_150px_150px_auto]">
        <input type="hidden" name="source" value={source} />
        <label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input name="q" defaultValue={q} placeholder={source === "diagnostic" ? "Ex.: Juninho Cubchoo, apelido ou ID..." : "Jogador, ação, item, origem..."} className="h-10 w-full rounded-xl border border-border bg-slate-900 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-cyan-400/50" /></label>
        <input type="date" name="from" defaultValue={from} title="Data inicial" className="h-10 rounded-xl border border-border bg-slate-900 px-3 text-xs text-slate-300" />
        <input type="date" name="to" defaultValue={to} title="Data final" className="h-10 rounded-xl border border-border bg-slate-900 px-3 text-xs text-slate-300" />
        {source === "activity" ? <select name="category" defaultValue={category} className="h-10 rounded-xl border border-border bg-slate-900 px-3 text-xs text-slate-300"><option value="">Todas categorias</option>{["ARENA", "EXP", "EXPEDITION", "EGG", "ITEM", "GIFT", "ZC", "BAZAR"].map((value) => <option key={value}>{value}</option>)}</select> : <span className="hidden md:block" />}
        <button className="h-10 rounded-xl bg-cyan-400 px-4 text-xs font-bold text-slate-950 hover:bg-cyan-300">Consultar</button>
      </form>
      <p className="-mt-3 text-[10px] text-slate-600">{source === "diagnostic" ? "Combine jogador e mascote na mesma busca. O diagnóstico consulta o estado atual e explica cada trava que impede o anúncio no Bazar." : `Sem período informado, a consulta usa automaticamente os últimos ${DEFAULT_WINDOW_DAYS} dias. Busca, categoria, contagem e paginação são aplicadas diretamente no banco.`}</p>

      {detail && <section className="rounded-2xl border border-cyan-400/30 bg-slate-950/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Detalhes do registro</h2>
          <div className="flex items-center gap-2">
            <Link href={buildHref({ ...common, page, detail: params.detail, view: "simple" })} className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold ${view === "simple" ? "border-cyan-400 bg-cyan-400/10 text-cyan-200" : "border-border text-slate-500"}`}>Leitura simplificada</Link>
            <Link href={buildHref({ ...common, page, detail: params.detail, view: "raw" })} className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold ${view === "raw" ? "border-cyan-400 bg-cyan-400/10 text-cyan-200" : "border-border text-slate-500"}`}>JSON original</Link>
            <Link href={buildHref({ ...common, page })} className="text-xs text-slate-400 hover:text-white">Fechar</Link>
          </div>
        </div>
        {view === "raw" ? (
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-all rounded-xl bg-black/30 p-3 text-[10px] leading-5 text-slate-300">{formatJson(detail)}</pre>
        ) : (
          <div className="max-h-[520px] space-y-1 overflow-auto rounded-xl bg-black/20 p-3">
            {simplifiedLines(detail).map((line, index) => <div key={`${line.label}-${index}`} className={`grid gap-2 rounded-lg px-2 py-1.5 text-xs ${line.value ? "grid-cols-[minmax(120px,220px)_1fr] bg-slate-900/50" : "mt-2 bg-cyan-400/5"}`} style={{ marginLeft: Math.min(line.depth, 4) * 12 }}><span className="font-semibold capitalize text-slate-400">{line.label}</span>{line.value && <span className="break-words text-slate-200">{line.value}</span>}</div>)}
          </div>
        )}
      </section>}

      <div className="flex items-center justify-between"><p className="text-xs text-slate-500"><strong className="text-slate-300">{total}</strong> registros · carregando no máximo {PAGE_SIZE} por consulta</p><p className="text-[10px] text-slate-600">Página {Math.min(page, totalPages)} de {totalPages}</p></div>
      {rows.length === 0 ? <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-slate-500">Nenhum registro encontrado nesta fonte.</div> : <div className="space-y-2">{rows.map((row) => <article key={row.id} className="rounded-xl border border-border/70 bg-slate-950/45 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold text-cyan-300">{row.category}</span><strong className="text-xs text-slate-200">{row.playerName}</strong>{row.source && <span className="text-[10px] text-slate-600">{row.source}</span>}</div><p className="mt-1.5 break-words text-xs text-slate-400">{row.summary}</p>{row.entity && <p className="mt-1 truncate font-mono text-[9px] text-slate-700">{row.entity}</p>}</div><div className="text-right">{typeof row.amount === "number" && <p className={`text-xs font-bold ${row.amount > 0 ? "text-emerald-400" : row.amount < 0 ? "text-red-400" : "text-slate-400"}`}>{row.amount > 0 ? "+" : ""}{row.amount.toLocaleString("pt-BR")} {row.unit}</p>}<p className="mt-1 text-[9px] text-slate-600">{row.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p><Link href={buildHref({ ...common, page, detail: row.id })} className="mt-2 inline-block text-[10px] font-semibold text-cyan-400 hover:underline">Ver detalhes</Link></div></div></article>)}</div>}

      {totalPages > 1 && <div className="flex items-center justify-center gap-3 pt-2">{page > 1 ? <Link href={buildHref({ ...common, page: page - 1 })} className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-xs text-slate-300"><ChevronLeft size={13} /> Anterior</Link> : <span />}{page < totalPages ? <Link href={buildHref({ ...common, page: page + 1 })} className="inline-flex items-center gap-1 rounded-xl border border-border px-4 py-2 text-xs text-slate-300">Próxima <ChevronRight size={13} /></Link> : <span />}</div>}
      <p className="flex items-center gap-2 text-[10px] text-slate-600"><Activity size={12} /> Registros anteriores ao ledger são exibidos nas fontes especializadas quando os dados originais ainda existem.</p>
    </div>
  );
}
