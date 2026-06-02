/**
 * Limitless TCG API Service
 * Docs: https://docs.limitlesstcg.com/developer.html
 *
 * Base URL: https://play.limitlesstcg.com/api
 *
 * A maioria dos endpoints é PÚBLICA — não precisa de chave.
 * Apenas /games/{id}/decks precisa de chave (dada só a projetos públicos).
 *
 * Variável opcional: LIMITLESS_API_KEY (para /games/{id}/decks e rate limit maior)
 */

const BASE = "https://play.limitlesstcg.com/api";

function buildHeaders(): Record<string, string> {
  const key = process.env.LIMITLESS_API_KEY;
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (key) h["X-Access-Key"] = key;
  return h;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  try {
    const url = new URL(`${BASE}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: buildHeaders(),
      next: { revalidate: 1800 } // cache 30min
    });
    if (!res.ok) {
      console.warn(`[Limitless] ${res.status} ${url.toString()}`);
      return null;
    }
    return res.json() as Promise<T>;
  } catch (e) {
    console.warn("[Limitless] fetch error:", e);
    return null;
  }
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface LimitlessTournament {
  id: string;
  name: string;
  date: string;
  players: number;
  format?: string;
  game?: string;
}

export interface LimitlessStanding {
  player: string;     // username
  name: string;       // display name
  placing: number;
  record: { wins: number; losses: number; ties: number };
  decklist?: unknown; // formato varia por jogo
  deck?: { id: string; name: string; icons?: string[] };
  drop?: number;
}

export interface LimitlessGame {
  id: string;
  name: string;
  formats: Record<string, string>;
  platforms: Record<string, string>;
  metagame: boolean;
}

export interface LimitlessDeckRule {
  identifier: string;
  name: string;
  icons: string[];
  cards: { count: number; name: string; set?: string; number?: string }[];
  priority: number;
}

export interface MetaArchetype {
  name: string;
  count: number;
  topFinishes: number;
  icons?: string[];
}

// ── Endpoints públicos (sem chave) ────────────────────────────────────────────

/** Lista todos os jogos suportados (inclui PTCG, VGC etc.) */
export async function getGames(): Promise<LimitlessGame[]> {
  return (await get<LimitlessGame[]>("/games")) ?? [];
}

/** Torneios recentes de Pokémon TCG */
export async function getRecentTournaments(limit = 10, format?: string): Promise<LimitlessTournament[]> {
  const params: Record<string, string> = { game: "PTCG", limit: String(limit) };
  if (format) params.format = format;
  return (await get<LimitlessTournament[]>("/tournaments", params)) ?? [];
}

/** Detalhes de um torneio */
export async function getTournamentDetails(id: string) {
  return get<Record<string, unknown>>(`/tournaments/${id}/details`);
}

/** Standings de um torneio específico */
export async function getTournamentStandings(id: string): Promise<LimitlessStanding[]> {
  return (await get<LimitlessStanding[]>(`/tournaments/${id}/standings`)) ?? [];
}

/** Pairings (todas as partidas) de um torneio */
export async function getTournamentPairings(id: string) {
  return get<unknown[]>(`/tournaments/${id}/pairings`);
}

// ── Endpoint que requer chave ──────────────────────────────────────────────────

/** Regras de categorização de decks para um jogo (requer LIMITLESS_API_KEY) */
export async function getGameDecks(gameId = "PTCG"): Promise<LimitlessDeckRule[]> {
  if (!process.env.LIMITLESS_API_KEY) return [];
  return (await get<LimitlessDeckRule[]>(`/games/${gameId}/decks`)) ?? [];
}

// ── Análise de meta ───────────────────────────────────────────────────────────

/**
 * Snapshot do meta atual:
 * - Agrega arquétipos dos N torneios mais recentes
 * - Retorna os mais populares com top finishes
 */
export async function getMetaSnapshot(tournamentCount = 5): Promise<MetaArchetype[]> {
  const tournaments = await getRecentTournaments(tournamentCount);
  if (tournaments.length === 0) return [];

  const archetypeMap = new Map<string, { count: number; topFinishes: number; icons?: string[] }>();

  await Promise.allSettled(
    tournaments.slice(0, 3).map(async (t) => {
      const standings = await getTournamentStandings(t.id);
      for (const s of standings) {
        const deckName = s.deck?.name;
        if (!deckName) continue;
        const cur = archetypeMap.get(deckName) ?? { count: 0, topFinishes: 0, icons: s.deck?.icons };
        cur.count++;
        if (s.placing <= 8) cur.topFinishes++;
        archetypeMap.set(deckName, cur);
      }
    })
  );

  return Array.from(archetypeMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.topFinishes - a.topFinishes || b.count - a.count)
    .slice(0, 10);
}

/**
 * Decklists reais de um arquétipo em torneios recentes.
 * Retorna os melhores placings encontrados.
 */
export async function getArchetypeResults(
  archetypeName: string,
  limit = 3
): Promise<{ tournament: string; placing: number; player: string; record: string }[]> {
  const tournaments = await getRecentTournaments(5);
  const results: { tournament: string; placing: number; player: string; record: string }[] = [];

  for (const t of tournaments.slice(0, 4)) {
    const standings = await getTournamentStandings(t.id);
    const matching = standings.filter(s => {
      const name = (s.deck?.name ?? "").toLowerCase();
      const query = archetypeName.toLowerCase();
      return name.includes(query) || query.includes(name.split(" ")[0]);
    });

    for (const s of matching.slice(0, 2)) {
      results.push({
        tournament: t.name,
        placing: s.placing,
        player: s.name,
        record: `${s.record.wins}W-${s.record.losses}L-${s.record.ties}T`,
      });
    }

    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}

/**
 * Contexto de meta para o Professor Enguiça.
 * Funciona SEM chave de API — usa endpoints públicos.
 * Retorna texto pronto para contexto da IA.
 */
export async function buildMetaContext(query: string): Promise<string> {
  const lower = query.toLowerCase();

  // Pergunta sobre meta geral
  if (/meta|tier|melhor deck|que (está|ta) ganhando|top deck|mais forte|dominando/.test(lower)) {
    const meta = await getMetaSnapshot(4);
    if (meta.length === 0) return "";
    return "DADOS REAIS DO META (Limitless TCG — torneios recentes):\n" +
      meta.slice(0, 6).map((a, i) =>
        `${i + 1}. ${a.name} — ${a.count} aparições, ${a.topFinishes} top 8`
      ).join("\n");
  }

  // Pergunta sobre arquétipo específico (lista expandida)
  const archetypeKeywords = [
    "charizard", "gardevoir", "dragapult", "raging bolt", "iron hands",
    "miraidon", "lugia", "regidrago", "espathra", "terapagos",
    "pidgeot", "comfey", "snorlax", "flareon", "gyarados",
    "roaring moon", "iron valiant", "chien-pao", "baxcalibur",
    "giratina", "lost box", "arceus", "mew", "palkia",
    "togekiss", "flygon", "bloodmoon ursaluna", "pecharunt",
    "gouging fire", "walking wake", "raichu", "entei",
  ];

  const mentionedArch = archetypeKeywords.find(k => lower.includes(k));
  if (mentionedArch) {
    const results = await getArchetypeResults(mentionedArch, 3);
    if (results.length === 0) return "";
    return `RESULTADOS REAIS DE TORNEIO (${mentionedArch.toUpperCase()}):\n` +
      results.map(r =>
        `${r.tournament} — ${r.placing}º lugar · ${r.player} · ${r.record}`
      ).join("\n");
  }

  return "";
}
