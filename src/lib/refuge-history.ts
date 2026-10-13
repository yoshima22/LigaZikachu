import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";
import type { RefugeLocation } from "@/lib/mascot-bonds-v2";

export const refugeMemoryInclude = {
  mascotA: { select: { pokemonId: true, nickname: true, player: { select: { displayName: true } } } },
  mascotB: { select: { pokemonId: true, nickname: true, player: { select: { displayName: true } } } },
} satisfies Prisma.MascotBondMemoryInclude;

export const publicRefugeWhere = {
  sourceType: "REFUGE",
  mascotA: { player: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } } },
  OR: [{ mascotBId: null }, { mascotB: { player: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } } } }],
} satisfies Prisma.MascotBondMemoryWhereInput;

type Memory = Prisma.MascotBondMemoryGetPayload<{ include: typeof refugeMemoryInclude }>;
export function refugeStory(memory: Memory) {
  const metadata = (memory.metadata ?? {}) as Record<string, any>;
  const name = (m: Memory["mascotA"]) => m.nickname ?? getPokemonName(m.pokemonId);
  return {
    id: memory.id, title: memory.title, description: memory.description,
    conflict: metadata.conflict === true,
    participants: memory.mascotB ? `${name(memory.mascotA)} e ${name(memory.mascotB)}` : name(memory.mascotA),
    owners: [...new Set([memory.mascotA.player.displayName, memory.mascotB?.player.displayName].filter(Boolean))].join(" · "),
    scoreDelta: typeof metadata.scoreDelta === "number" ? metadata.scoreDelta : null,
    fight: metadata.fight && typeof metadata.fight === "object" ? metadata.fight : null,
    when: memory.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
  };
}

// Keep only the latest 25 entries per location/category; search this bounded window.
// Only IDs and a count leave Postgres here; the payload query below reads nine rows.
const getRefugePokemonNames = unstable_cache(async () => {
  const rows = await prisma.$queryRaw<Array<{ pokemonId: number }>>`SELECT DISTINCT "pokemonId" FROM mascots`;
  return rows.map(r => ({ id: r.pokemonId, name: getPokemonName(r.pokemonId).toLocaleLowerCase("pt-BR") }));
}, ["refuge-pokemon-search-v1"], { revalidate: 60 });

export async function getRefugeHistoryPage(location: RefugeLocation, page = 1, query = "", kind = "ALL") {
  const search = query.trim().toLocaleLowerCase("pt-BR").slice(0, 120);
  const pokemonNames = JSON.stringify(search ? Object.fromEntries((await getRefugePokemonNames()).map(p => [p.id, p.name])) : {});
  const requestedPage = Math.max(1, Math.min(50, Math.floor(page) || 1));
  const [result] = await prisma.$queryRaw<Array<{ ids: string[]; total: number; page: number }>>(Prisma.sql`
    WITH recent AS MATERIALIZED (
      SELECT m.id, m.title, m.description, m.metadata, m."createdAt",
        a.nickname AS name_a, b.nickname AS name_b, a."pokemonId" AS pokemon_a, b."pokemonId" AS pokemon_b,
        pa."displayName" AS owner_a, pb."displayName" AS owner_b
      FROM mascot_bond_memories m
      JOIN mascots a ON a.id = m."mascotAId" JOIN players pa ON pa.id = a."playerId" JOIN users ua ON ua.id = pa."userId"
      LEFT JOIN mascots b ON b.id = m."mascotBId" LEFT JOIN players pb ON pb.id = b."playerId" LEFT JOIN users ub ON ub.id = pb."userId"
      WHERE m."sourceType" = 'REFUGE' AND m.metadata->>'location' = ${location}
        AND ua.role::text NOT IN ('ADMIN', 'SUPER_ADMIN')
        AND (m."mascotBId" IS NULL OR ub.role::text NOT IN ('ADMIN', 'SUPER_ADMIN'))
        AND (${kind} = 'ALL' OR COALESCE(m.metadata->'conflict' = 'true'::jsonb, false) = ${kind === "CONFLICT"})
      ORDER BY m."createdAt" DESC, m.id DESC LIMIT ${25}
    ), filtered AS (
      SELECT * FROM recent WHERE
        (${search} = '' OR position(${search} in lower(concat_ws(' ',
          COALESCE(name_a, ${pokemonNames}::jsonb->>pokemon_a::text),
          CASE WHEN pokemon_b IS NOT NULL THEN 'e' END,
          COALESCE(name_b, ${pokemonNames}::jsonb->>pokemon_b::text),
          owner_a, CASE WHEN owner_b IS NOT NULL AND owner_b <> owner_a THEN '·' END,
          CASE WHEN owner_b <> owner_a THEN owner_b END, title, description))) > 0)
    ), totals AS (SELECT count(*)::int AS total FROM filtered), bounds AS (
      SELECT total, least(${requestedPage}::int, greatest(1, ceil(total / 9.0)::int)) AS page FROM totals
    )
    SELECT total, page, ARRAY(SELECT id FROM filtered ORDER BY "createdAt" DESC, id DESC LIMIT 9 OFFSET (page - 1) * 9) AS ids FROM bounds
  `);
  const rows = result.ids.length ? await prisma.mascotBondMemory.findMany({ where: { ...publicRefugeWhere, id: { in: result.ids } }, include: refugeMemoryInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }) : [];
  return { stories: rows.map(refugeStory), total: result.total, page: result.page };
}

// Cache the compact regional report, not the history/replay payloads.
export const getRefugeReport = unstable_cache(async (location: RefugeLocation) => {
  const rows = await prisma.$queryRaw<Array<{ conflict: boolean; delta: number; fight: boolean; name_a: string | null; name_b: string | null; pokemon_a: number; pokemon_b: number | null; owner_a: string; owner_b: string | null }>>(Prisma.sql`
    SELECT COALESCE(m.metadata->'conflict' = 'true'::jsonb, false) AS conflict,
      CASE WHEN jsonb_typeof(m.metadata->'scoreDelta') = 'number' THEN (m.metadata->>'scoreDelta')::float ELSE 0 END AS delta,
      COALESCE(jsonb_typeof(m.metadata->'fight') = 'object', false) AS fight,
      a.nickname AS name_a, b.nickname AS name_b, a."pokemonId" AS pokemon_a, b."pokemonId" AS pokemon_b,
      pa."displayName" AS owner_a, pb."displayName" AS owner_b
    FROM mascot_bond_memories m
    JOIN mascots a ON a.id = m."mascotAId" JOIN players pa ON pa.id = a."playerId" JOIN users ua ON ua.id = pa."userId"
    LEFT JOIN mascots b ON b.id = m."mascotBId" LEFT JOIN players pb ON pb.id = b."playerId" LEFT JOIN users ub ON ub.id = pb."userId"
    WHERE m."sourceType" = 'REFUGE' AND m.metadata->>'location' = ${location}
      AND ua.role::text NOT IN ('ADMIN', 'SUPER_ADMIN') AND (m."mascotBId" IS NULL OR ub.role::text NOT IN ('ADMIN', 'SUPER_ADMIN'))
    ORDER BY m."createdAt" DESC, m.id DESC LIMIT 25
  `);
  const pairs: Record<string, number> = Object.create(null), trainers: Record<string, number> = Object.create(null);
  for (const r of rows) {
    const a = r.name_a ?? getPokemonName(r.pokemon_a);
    const pair = r.pokemon_b === null ? a : `${a} e ${r.name_b ?? getPokemonName(r.pokemon_b)}`;
    pairs[pair] = (pairs[pair] ?? 0) + 1;
    for (const owner of new Set([r.owner_a, r.owner_b].filter((v): v is string => Boolean(v)))) trainers[owner] = (trainers[owner] ?? 0) + 1;
  }
  return { total: rows.length, social: rows.filter(r => !r.conflict).length, conflicts: rows.filter(r => r.conflict).length,
    scoreUp: rows.reduce((n, r) => n + Math.max(0, r.delta), 0), scoreDown: rows.reduce((n, r) => n + Math.max(0, -r.delta), 0), fights: rows.filter(r => r.fight).length,
    pairs: Object.entries(pairs).sort((a,b) => b[1]-a[1]).slice(0,3), trainers: Object.entries(trainers).sort((a,b) => b[1]-a[1]).slice(0,3) };
}, ["refuge-report-v2-last25"], { revalidate: 60, tags: ["refuge-history"] });

export type RefugeReport = Awaited<ReturnType<typeof getRefugeReport>>;
