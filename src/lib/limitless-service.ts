/**
 * Limitless TCG API Service
 * Docs: https://docs.limitlesstcg.com/developer.html
 * Fornece dados reais de torneios competitivos de Pokémon TCG.
 * Configure LIMITLESS_API_KEY nas variáveis de ambiente.
 */

const BASE = "https://api.limitlesstcg.com";

function headers(): Record<string, string> {
  const key = process.env.LIMITLESS_API_KEY;
  if (key) return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  return { "Content-Type": "application/json" };
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  try {
    const url = new URL(`${BASE}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: headers(),
      next: { revalidate: 1800 } // cache 30min
    });
    if (!res.ok) {
      console.warn(`[Limitless] ${res.status} ${path}`);
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
  country?: string;
  organizer?: string;
  format?: string;
}

export interface LimitlessDeck {
  archetype?: string;
  name?: string;
  placement?: number;
  player?: string;
  list?: Record<string, number>; // card name → quantity
}

export interface LimitlessStanding {
  placement: number;
  name: string;
  record: { wins: number; losses: number; ties: number };
  archetype?: string;
  deck?: LimitlessDeck;
}

export interface MetaArchetype {
  name: string;
  count: number;
  topFinishes: number;
  winRate?: number;
  sampleList?: string[]; // card names from the archetype
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/** Torneios recentes de Pokémon TCG */
export async function getRecentTournaments(limit = 10): Promise<LimitlessTournament[]> {
  const data = await get<{ data: LimitlessTournament[] }>("/tcg/tournaments", {
    game: "PTCG",
    limit: String(limit),
    format: "standard"
  });
  return data?.data ?? [];
}

/** Standings de um torneio específico */
export async function getTournamentStandings(id: string): Promise<LimitlessStanding[]> {
  const data = await get<{ data: LimitlessStanding[] }>(`/tcg/tournaments/${id}/standings`);
  return data?.data ?? [];
}

/** Decklists de um torneio */
export async function getTournamentDecks(id: string): Promise<LimitlessDeck[]> {
  const data = await get<{ data: LimitlessDeck[] }>(`/tcg/tournaments/${id}/decks`);
  return data?.data ?? [];
}

// ── Análise de Meta ────────────────────────────────────────────────────────────

/**
 * Busca snapshot do meta atual:
 * - Pega os N torneios mais recentes
 * - Agrega os arquétipos mais usados no top 8/16
 * - Retorna os mais populares com win rates
 */
export async function getMetaSnapshot(tournamentCount = 5): Promise<MetaArchetype[]> {
  const tournaments = await getRecentTournaments(tournamentCount);
  if (tournaments.length === 0) return [];

  const archetypeMap = new Map<string, { count: number; topFinishes: number }>();

  await Promise.allSettled(
    tournaments.slice(0, 3).map(async (t) => {
      const standings = await getTournamentStandings(t.id);
      for (const s of standings) {
        if (!s.archetype) continue;
        const arch = s.archetype;
        const current = archetypeMap.get(arch) ?? { count: 0, topFinishes: 0 };
        current.count++;
        if (s.placement <= 8) current.topFinishes++;
        archetypeMap.set(arch, current);
      }
    })
  );

  return Array.from(archetypeMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.topFinishes - a.topFinishes || b.count - a.count)
    .slice(0, 10);
}

/**
 * Busca decklists reais de um arquétipo específico em torneios recentes
 */
export async function getArchetypeDecks(
  archetypeName: string,
  limit = 3
): Promise<{ tournament: string; placement: number; deck: LimitlessDeck }[]> {
  const tournaments = await getRecentTournaments(5);
  const results: { tournament: string; placement: number; deck: LimitlessDeck }[] = [];

  for (const t of tournaments.slice(0, 3)) {
    const standings = await getTournamentStandings(t.id);
    const matching = standings.filter(s =>
      s.archetype?.toLowerCase().includes(archetypeName.toLowerCase()) ||
      archetypeName.toLowerCase().includes((s.archetype ?? "").toLowerCase())
    );

    for (const s of matching.slice(0, 2)) {
      if (s.deck) {
        results.push({ tournament: t.name, placement: s.placement, deck: s.deck });
      }
    }

    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}

/**
 * Contexto de meta para o Professor Enguiça
 * Retorna texto formatado para usar como contexto da IA
 */
export async function buildMetaContext(query: string): Promise<string> {
  const key = process.env.LIMITLESS_API_KEY;
  if (!key) return ""; // sem chave, não adiciona contexto

  const lower = query.toLowerCase();

  // Pergunta sobre meta geral
  if (/meta|tier|melhor deck|que está ganhando|top deck|mais forte/.test(lower)) {
    const meta = await getMetaSnapshot(4);
    if (meta.length === 0) return "";

    return `DADOS REAIS DO META (Limitless TCG):\n` +
      meta.slice(0, 6).map((a, i) =>
        `${i + 1}. ${a.name} — ${a.count} aparições, ${a.topFinishes} top 8`
      ).join("\n");
  }

  // Pergunta sobre arquétipo específico
  const archetypeKeywords = [
    "charizard", "gardevoir", "dragapult", "raging bolt", "iron hands",
    "miraidon", "lugia", "regidrago", "espathra", "terapagos",
    "pidgeot", "comfey", "snorlax", "flareon", "gyarados"
  ];

  const mentionedArch = archetypeKeywords.find(k => lower.includes(k));
  if (mentionedArch) {
    const decks = await getArchetypeDecks(mentionedArch, 2);
    if (decks.length === 0) return "";

    return `DECKLISTS REAIS DE TORNEIO (${mentionedArch.toUpperCase()}):\n` +
      decks.map(d =>
        `${d.tournament} — ${d.placement}º lugar${d.deck.list
          ? `\nCartas principais: ${Object.entries(d.deck.list).slice(0, 8).map(([c, q]) => `${q}x ${c}`).join(", ")}`
          : ""
        }`
      ).join("\n---\n");
  }

  return "";
}
