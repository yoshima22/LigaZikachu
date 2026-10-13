import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
export const getChampionHighlights = unstable_cache(async (leagueId: string, championPlayerId: string) => {
    let topAttacker: {
        name: string;
        pokemonId: number;
        damageDealt: number;
    } | null = null;
    let topDefender: {
        name: string;
        pokemonId: number;
        damageTaken: number;
    } | null = null;
    let topSupport: {
        name: string;
        pokemonId: number;
        heals: number;
    } | null = null;
    const champMatches = await (prisma as any).weeklyMascotLeagueMatch.findMany({
        where: { leagueId, replayJson: { not: Prisma.DbNull }, OR: [{ playerAId: championPlayerId }, { playerBId: championPlayerId }] },
        select: { replayJson: true },
    });
    const champStats = new Map<string, {
        name: string;
        pokemonId: number;
        damageDealt: number;
        damageTaken: number;
        heals: number;
    }>();
    for (const m of champMatches) {
        const turns = (m.replayJson ?? []) as any[];
        for (const t of turns) {
            if (t.actorOwnerId === championPlayerId && t.action === "ATTACK" && t.damage > 0) {
                const s = champStats.get(t.actorId) ?? { name: t.actorName, pokemonId: t.actorPokemonId ?? 0, damageDealt: 0, damageTaken: 0, heals: 0 };
                s.damageDealt += t.damage;
                champStats.set(t.actorId, s);
            }
            if (t.targetOwnerId === championPlayerId && t.action === "ATTACK" && t.damage > 0) {
                const s = champStats.get(t.targetId) ?? { name: t.targetName, pokemonId: t.targetPokemonId ?? 0, damageDealt: 0, damageTaken: 0, heals: 0 };
                s.damageTaken += t.damage;
                champStats.set(t.targetId, s);
            }
            if (t.actorOwnerId === championPlayerId && (t.action === "HEAL" || t.action === "DEFEND") && t.effect?.includes("curou")) {
                const s = champStats.get(t.actorId) ?? { name: t.actorName, pokemonId: t.actorPokemonId ?? 0, damageDealt: 0, damageTaken: 0, heals: 0 };
                s.heals++;
                champStats.set(t.actorId, s);
            }
        }
    }
    const statsArr = [...champStats.values()];
    const byDmg = statsArr.filter(s => s.damageDealt > 0).sort((a, b) => b.damageDealt - a.damageDealt);
    const byTank = statsArr.filter(s => s.damageTaken > 0).sort((a, b) => b.damageTaken - a.damageTaken);
    const byHeal = statsArr.filter(s => s.heals > 0).sort((a, b) => b.heals - a.heals);
    if (byDmg[0])
        topAttacker = { name: byDmg[0].name, pokemonId: byDmg[0].pokemonId, damageDealt: byDmg[0].damageDealt };
    if (byTank[0])
        topDefender = { name: byTank[0].name, pokemonId: byTank[0].pokemonId, damageTaken: byTank[0].damageTaken };
    if (byHeal[0])
        topSupport = { name: byHeal[0].name, pokemonId: byHeal[0].pokemonId, heals: byHeal[0].heals };
    return { topAttacker, topDefender, topSupport };
}, ["weekly-champion-highlights-v1"], { revalidate: 3600, tags: ["weekly-league-highlights"] });
export const getWeeklyHighlights = unstable_cache(async (leagueId: string) => {
    const allMatches = await (prisma as any).weeklyMascotLeagueMatch.findMany({
        where: { leagueId, status: "RESOLVED" },
        select: { replayJson: true, resultJson: true, playerAId: true, playerBId: true, winnerId: true },
    });
    // Compute per-mascot stats from replay logs
    const mascotStats = new Map<string, {
        id: string;
        name: string;
        pokemonId: number;
        ownerId: string;
        role: string;
        damageDealt: number;
        damageTaken: number;
        kosDealt: number;
        heals: number;
        attackActions: number;
        matches: number;
        wins: number;
    }>();
    for (const match of allMatches as any[]) {
        if (!match.replayJson || !Array.isArray(match.replayJson))
            continue;
        const hpTracker = new Map<string, number>();
        const maxHpOf = new Map<string, number>();
        const guardianByKey = new Map<string, string>(); // "dono|nome" -> id (o log só cita o Guardião pelo nome)
        // Inicializa o HP de cada mascote pelo maxHp do lineup — sem isso os KOs
        // nunca eram detectados (o placeholder anterior começava em 9999).
        const rj = (match.resultJson as any) ?? {};
        for (const f of [...(Array.isArray(rj.lineupA) ? rj.lineupA : []), ...(Array.isArray(rj.lineupB) ? rj.lineupB : [])]) {
            if (f?.id) {
                hpTracker.set(f.id, Number(f.maxHp) || Number(f.hp) || 0);
                maxHpOf.set(f.id, Number(f.maxHp) || Number(f.hp) || 0);
                guardianByKey.set(`${f.ownerId}|${f.name}`, f.id);
            }
        }
        const seen = new Map<string, {
            name: string;
            pokemonId?: number;
            ownerId?: string;
            role?: string;
        }>();
        for (const t of match.replayJson as any[]) {
            if (!seen.has(t.actorId))
                seen.set(t.actorId, { name: t.actorName, pokemonId: t.actorPokemonId, ownerId: t.actorOwnerId, role: t.actorRole });
            if (!seen.has(t.targetId))
                seen.set(t.targetId, { name: t.targetName, pokemonId: t.targetPokemonId, ownerId: t.targetOwnerId, role: t.targetRole });
            if (t.action === "ATTACK") {
                const attackerStat = mascotStats.get(t.actorId) ?? { id: t.actorId, name: t.actorName, pokemonId: t.actorPokemonId ?? 0, ownerId: t.actorOwnerId ?? "", role: t.actorRole ?? "Atacante", damageDealt: 0, damageTaken: 0, kosDealt: 0, heals: 0, attackActions: 0, matches: 0, wins: 0 };
                attackerStat.attackActions++;
                mascotStats.set(t.actorId, attackerStat);
            }
            // Cura devolve HP (senão o mascote curado era contado como derrotado de novo a cada golpe).
            if (t.action === "HEAL" && t.damage > 0) {
                const cap = maxHpOf.get(t.targetId) ?? Infinity;
                hpTracker.set(t.targetId, Math.min(cap, (hpTracker.get(t.targetId) ?? 0) + t.damage));
            }
            if (t.action === "ATTACK" && t.damage > 0) {
                const prev = hpTracker.get(t.targetId) ?? 9999;
                const newHp = prev - t.damage;
                hpTracker.set(t.targetId, newHp);
                // O Guardião absorve parte do golpe: o dano dele não aparece em `damage`, só no texto.
                const guard = /Guardião (.+?) absorveu (\d+) de dano/.exec(t.effect ?? "");
                const guardId = guard ? guardianByKey.get(`${t.targetOwnerId}|${guard[1]}`) : undefined;
                let guardKo = false;
                const absorbed = guard && guardId ? Number(guard[2]) : 0;
                if (guard && guardId) {
                    const gPrev = hpTracker.get(guardId) ?? 0;
                    hpTracker.set(guardId, gPrev - Number(guard[2]));
                    guardKo = gPrev > 0 && gPrev - Number(guard[2]) <= 0;
                }
                const key = t.actorId;
                const stat = mascotStats.get(key) ?? { id: t.actorId, name: t.actorName, pokemonId: t.actorPokemonId ?? 0, ownerId: t.actorOwnerId ?? "", role: t.actorRole ?? "Atacante", damageDealt: 0, damageTaken: 0, kosDealt: 0, heals: 0, attackActions: 0, matches: 0, wins: 0 };
                stat.damageDealt += t.damage + absorbed; // inclui o que o Guardião absorveu
                // Só conta o K.O. na queda de HP > 0 para <= 0 (golpes seguintes não repetem).
                if ((prev > 0 && newHp <= 0) || guardKo)
                    stat.kosDealt += (prev > 0 && newHp <= 0 ? 1 : 0) + (guardKo ? 1 : 0);
                mascotStats.set(key, stat);
                const tgtStat = mascotStats.get(t.targetId) ?? { id: t.targetId, name: t.targetName, pokemonId: t.targetPokemonId ?? 0, ownerId: t.targetOwnerId ?? "", role: t.targetRole ?? "Atacante", damageDealt: 0, damageTaken: 0, kosDealt: 0, heals: 0, attackActions: 0, matches: 0, wins: 0 };
                tgtStat.damageTaken += t.damage;
                mascotStats.set(t.targetId, tgtStat);
                if (absorbed > 0 && guardId) {
                    const gStat = mascotStats.get(guardId) ?? { id: guardId, name: guard![1], pokemonId: 0, ownerId: t.targetOwnerId ?? "", role: "Guardião", damageDealt: 0, damageTaken: 0, kosDealt: 0, heals: 0, attackActions: 0, matches: 0, wins: 0 };
                    gStat.damageTaken += absorbed;
                    mascotStats.set(guardId, gStat);
                }
            }
            if ((t.action === "HEAL" || t.action === "DEFEND") && t.effect?.includes("curou")) {
                const stat = mascotStats.get(t.actorId) ?? { id: t.actorId, name: t.actorName, pokemonId: t.actorPokemonId ?? 0, ownerId: t.actorOwnerId ?? "", role: t.actorRole ?? "Cuidador", damageDealt: 0, damageTaken: 0, kosDealt: 0, heals: 0, attackActions: 0, matches: 0, wins: 0 };
                stat.heals++;
                mascotStats.set(t.actorId, stat);
            }
        }
        // Mark matches played and wins
        for (const [id, info] of seen) {
            const stat = mascotStats.get(id);
            if (stat) {
                stat.matches++;
                if (info.ownerId === match.winnerId)
                    stat.wins++;
                if (info.pokemonId && !stat.pokemonId)
                    stat.pokemonId = info.pokemonId;
                if (info.name && (stat.name.startsWith("#") || !stat.name))
                    stat.name = info.name;
            }
        }
    }
    const highlightOwnerIds = [...new Set([...mascotStats.values()].map((stat) => stat.ownerId).filter(Boolean))];
    const highlightOwners = highlightOwnerIds.length
        ? await prisma.player.findMany({ where: { id: { in: highlightOwnerIds } }, select: { id: true, displayName: true } })
        : [];
    const highlightOwnerNames = new Map(highlightOwners.map((owner) => [owner.id, owner.displayName]));
    return [...mascotStats.values()].map((stat) => ({
        ...stat,
        ownerName: highlightOwnerNames.get(stat.ownerId) ?? "Jogador",
    }));
}, ["weekly-highlights-v1"], { revalidate: 60, tags: ["weekly-league-highlights"] });
