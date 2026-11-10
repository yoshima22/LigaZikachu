// Camada de banco do Rei do Rio (servidor). Toda mutação crítica é idempotente:
// a rodada é "reivindicada" (PENDING->PROCESSING) por um único processo, calculada em memória
// e persistida numa única transação com advisory lock. Se algo falhar, nada parcial é gravado.
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { COMPETITION_DAYS, TOTAL_ROUNDS, mergeConfig, type ReiConfig } from "./config";
import { buildRoundPlan, canTransition, freezeAt, isLastRoundOfDay, lockAt, type Phase } from "./schedule";
import { autoBuild, type Preset } from "./auto-build";
import { initialStandings, runRound, type MatchSummary, type Runtime } from "./engine";
import { makeBotRoster, type BotTier } from "./simulate";
import type { StandRow } from "./standings";
import { sumAggs, type MascotAgg } from "./scoring";
import { freshDayState, validateFormation, type DayState, type Formation, type MascotSnap, type Strategy } from "./team";

const J = (v: unknown) => v as Prisma.InputJsonValue;

/** Só ADMIN/SUPER_ADMIN (nunca GM) — o modo é fechado ao público nesta etapa. */
export async function getReiAdmin() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) return null;
  const player = await getSessionPlayer(user.id);
  return player ? { userId: user.id, playerId: player.id, displayName: player.displayName } : null;
}

// ── Coleção do jogador -> snapshots ───────────────────────────────────────────

const toSnap = (m: { id: string; pokemonId: number; nickname: string | null; level: number; statForce: number; statAgility: number; statInstinct: number; statVitality: number; statCharisma: number; personality: string | null; speciesNameOverride: string | null; primaryTypeOverride: string | null; secondaryTypeOverride: string | null; preferredCombatRole: string | null; stanceUnlocks: { stanceKey: string }[] }): MascotSnap => ({
  id: m.id, pokemonId: m.pokemonId, nickname: m.nickname, level: m.level,
  statForce: m.statForce, statAgility: m.statAgility, statInstinct: m.statInstinct, statVitality: m.statVitality, statCharisma: m.statCharisma,
  personality: m.personality, speciesNameOverride: m.speciesNameOverride, primaryTypeOverride: m.primaryTypeOverride, secondaryTypeOverride: m.secondaryTypeOverride,
  preferredCombatRole: m.preferredCombatRole, unlocked: m.stanceUnlocks.map((s) => s.stanceKey),
});

export async function loadPlayerPool(playerId: string): Promise<MascotSnap[]> {
  const rows = await prisma.mascot.findMany({
    where: { playerId },
    select: { id: true, pokemonId: true, nickname: true, level: true, statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true, personality: true, speciesNameOverride: true, primaryTypeOverride: true, secondaryTypeOverride: true, preferredCombatRole: true, stanceUnlocks: { select: { stanceKey: true } } },
    orderBy: { level: "desc" },
  });
  return rows.map(toSnap);
}

// ── Edição ────────────────────────────────────────────────────────────────────

export async function createEdition(input: { name: string; mondayDate: string; isTest: boolean; autoRun: boolean; config?: Partial<ReiConfig> }) {
  const plan = buildRoundPlan(input.mondayDate);
  return prisma.reiRioEdition.create({
    data: {
      name: input.name.trim() || "Trono de Natal", isTest: input.isTest, autoRun: input.autoRun,
      mondayDate: input.mondayDate, configJson: J(input.config ?? {}),
      rounds: { create: plan.map((r) => ({ roundIndex: r.roundIndex, dayIndex: r.dayIndex, slotInDay: r.slotInDay, scheduledAt: r.at })) },
    },
  });
}

async function setPhase(editionId: string, from: Phase | Phase[], to: Phase, extra: Prisma.ReiRioEditionUpdateManyMutationInput = {}) {
  const froms = Array.isArray(from) ? from : [from];
  for (const f of froms) if (!canTransition(f, to)) throw new Error(`Transição inválida ${f} → ${to}`);
  const res = await prisma.reiRioEdition.updateMany({ where: { id: editionId, phase: { in: froms } }, data: { phase: to, ...extra } });
  return res.count > 0;
}

export async function addBots(editionId: string, count: number, mix?: { tier?: BotTier; preset?: Preset }) {
  const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
  if (!ed.isTest) throw new Error("Bots só podem entrar em edições de teste.");
  if (ed.phase !== "PREPARATION") throw new Error("Bots só entram antes do fechamento.");
  const have = await prisma.reiRioParticipant.count({ where: { editionId, isBot: true } });
  const presets: Preset[] = ["BALANCED", "OFFENSIVE", "ENDURANCE", "CONTROL"];
  const tiers: BotTier[] = ["FRACO", "MEDIO", "FORTE"];
  const rows: Prisma.ReiRioParticipantCreateManyInput[] = [];
  for (let i = 0; i < count; i++) {
    const n = have + i + 1;
    const key = `bot:${editionId.slice(-5)}-${n}`;
    const preset = mix?.preset ?? presets[n % presets.length];
    const tier = mix?.tier ?? tiers[n % tiers.length];
    const strategy: Strategy = n % 2 ? "KEEP" : "PRESERVE";
    const roster = makeBotRoster(key, tier);
    const built = autoBuild(roster, preset, strategy);
    if (!built.ok) throw new Error(built.error);
    const ids = new Set(built.formation.slots.flatMap((s) => s.mascotIds));
    rows.push({ editionId, playerKey: key, displayName: `Teste ${n} · ${preset.slice(0, 3)}/${tier.slice(0, 1)}`, isBot: true, originalJson: J(built.formation), rosterJson: J(roster.filter((m) => ids.has(m.id))) });
  }
  await prisma.reiRioParticipant.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

/** Inscrição/atualização (antes das 21h de segunda). Valida no servidor, nunca só na tela. */
export async function saveRegistration(editionId: string, playerId: string, displayName: string, formation: Formation) {
  const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
  if (ed.phase !== "PREPARATION" || !ed.registrationOpen) return { ok: false as const, errors: ["As inscrições estão encerradas."] };
  const pool = await loadPlayerPool(playerId);
  const errors = validateFormation(formation, new Map(pool.map((m) => [m.id, m])));
  if (errors.length) return { ok: false as const, errors };
  await prisma.reiRioParticipant.upsert({
    where: { editionId_playerKey: { editionId, playerKey: playerId } },
    create: { editionId, playerKey: playerId, displayName, originalJson: J(formation) },
    update: { originalJson: J(formation), displayName },
  });
  return { ok: true as const };
}

export async function withdraw(editionId: string, playerId: string) {
  const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
  if (ed.phase !== "PREPARATION") return false;
  await prisma.reiRioParticipant.deleteMany({ where: { editionId, playerKey: playerId } });
  return true;
}

/** Encerra inscrições: congela os 18 mascotes (snapshot) e a formação original. Irreversível. */
export async function lockEdition(editionId: string) {
  const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
  if (ed.phase !== "PREPARATION") return { dropped: [] as string[], canceled: ed.phase === "CANCELED" };
  const parts = await prisma.reiRioParticipant.findMany({ where: { editionId } });
  const dropped: string[] = [];
  for (const p of parts) {
    if (p.isBot) { await prisma.reiRioParticipant.update({ where: { id: p.id }, data: { lockedAt: new Date() } }); continue; }
    const f = p.originalJson as unknown as Formation;
    const pool = await loadPlayerPool(p.playerKey);
    const errors = validateFormation(f, new Map(pool.map((m) => [m.id, m])));
    if (errors.length) { dropped.push(`${p.displayName}: ${errors[0]}`); await prisma.reiRioParticipant.delete({ where: { id: p.id } }); continue; }
    const ids = new Set(f.slots.flatMap((s) => s.mascotIds));
    await prisma.reiRioParticipant.update({ where: { id: p.id }, data: { rosterJson: J(pool.filter((m) => ids.has(m.id))), lockedAt: new Date() } });
  }
  const cfg = (ed.configJson ?? {}) as Record<string, unknown>;
  const remaining = await prisma.reiRioParticipant.count({ where: { editionId } });
  const min = mergeConfig(ed.configJson).minParticipants;
  if (remaining < min) {
    // Poucos inscritos: o evento da semana é cancelado (nada é processado, ninguém perde nada).
    await setPhase(editionId, "PREPARATION", "CANCELED", { lockedAt: new Date(), registrationOpen: false, finishedAt: new Date(), configJson: J({ ...cfg, lockDropped: dropped, canceledReason: `Apenas ${remaining} de ${min} inscritos necessários.` }) });
    return { dropped, canceled: true as const };
  }
  await setPhase(editionId, "PREPARATION", "LOCKED", { lockedAt: new Date(), registrationOpen: false, configJson: J({ ...cfg, lockDropped: dropped }) });
  await ensureDayStates(editionId, 1);
  return { dropped, canceled: false as const };
}

const rosterOf = (p: { rosterJson: unknown }) => new Map(((p.rosterJson as MascotSnap[] | null) ?? []).map((m) => [m.id, m]));

/** Formação efetiva do dia: edição noturna se existir, senão a ORIGINAL de segunda. */
export function effectiveFormation(p: { originalJson: unknown; dayPlansJson: unknown }, day: number): Formation {
  const plans = (p.dayPlansJson ?? {}) as Record<string, { formation: Formation }>;
  return plans[String(day)]?.formation ?? (p.originalJson as unknown as Formation);
}

/** Congela a formação do dia e devolve HP cheio (recuperação noturna). Idempotente. */
export async function ensureDayStates(editionId: string, day: number) {
  const edCfg = mergeConfig((await prisma.reiRioEdition.findUnique({ where: { id: editionId }, select: { configJson: true } }))?.configJson);
  const parts = await prisma.reiRioParticipant.findMany({ where: { editionId, rosterJson: { not: Prisma.DbNull } } });
  const have = new Set((await prisma.reiRioDayState.findMany({ where: { dayIndex: day, participantId: { in: parts.map((p) => p.id) } }, select: { participantId: true } })).map((d) => d.participantId));
  const rows = parts.filter((p) => !have.has(p.id)).map((p) => {
    const f = effectiveFormation(p, day);
    return { participantId: p.id, dayIndex: day, formationJson: J(f), stateJson: J(freshDayState(f, rosterOf(p), edCfg.hpMultiplier)) };
  });
  if (rows.length) await prisma.reiRioDayState.createMany({ data: rows, skipDuplicates: true });
}

export async function freezeDay(editionId: string, day: number) {
  await ensureDayStates(editionId, day);
  await setPhase(editionId, ["LOCKED", "REST"], "RUNNING", { restDay: null });
}

/** Salva a configuração noturna do dia seguinte (janela de descanso, até as 08h). */
export async function saveDayPlan(editionId: string, playerKey: string, formation: Formation, now = new Date()) {
  const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
  if (ed.phase !== "REST" || !ed.restDay) return { ok: false as const, errors: ["A janela de descanso não está aberta."] };
  if (!ed.isTest && now >= freezeAt(ed.mondayDate, ed.restDay)) return { ok: false as const, errors: ["A formação deste dia já foi congelada (08h)."] };
  const p = await prisma.reiRioParticipant.findUnique({ where: { editionId_playerKey: { editionId, playerKey } } });
  if (!p?.rosterJson) return { ok: false as const, errors: ["Você não está inscrito nesta edição."] };
  const roster = rosterOf(p);
  // Os 18 inscritos em segunda são a única referência: nada entra nem sai do conjunto.
  const lockedIds = new Set((p.originalJson as unknown as Formation).slots.flatMap((s) => s.mascotIds));
  const errors = validateFormation(formation, roster, lockedIds);
  if (errors.length) return { ok: false as const, errors };
  const plans = { ...((p.dayPlansJson ?? {}) as Record<string, unknown>), [String(ed.restDay)]: { formation, savedAt: new Date().toISOString() } };
  await prisma.reiRioParticipant.update({ where: { id: p.id }, data: { dayPlansJson: J(plans) } });
  return { ok: true as const };
}

export async function clearDayPlan(editionId: string, playerKey: string) {
  const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
  if (ed.phase !== "REST" || !ed.restDay) return false;
  const p = await prisma.reiRioParticipant.findUnique({ where: { editionId_playerKey: { editionId, playerKey } } });
  if (!p) return false;
  const plans = { ...((p.dayPlansJson ?? {}) as Record<string, unknown>) };
  delete plans[String(ed.restDay)];
  await prisma.reiRioParticipant.update({ where: { id: p.id }, data: { dayPlansJson: J(plans) } });
  return true;
}

// ── Processamento de rodada ───────────────────────────────────────────────────

const STALE_MS = 5 * 60_000;

export async function recoverStaleRounds(editionId: string, now = new Date()) {
  const res = await prisma.reiRioRound.updateMany({
    where: { editionId, status: "PROCESSING", startedAt: { lt: new Date(now.getTime() - STALE_MS) } },
    data: { status: "PENDING", claimToken: null, error: "Recuperada após interrupção do processamento." },
  });
  return res.count;
}

export async function processNextRound(editionId: string, now = new Date()): Promise<{ status: "done" | "busy" | "none" | "wait" | "error"; round?: number; error?: string }> {
  const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
  if (ed.phase !== "RUNNING") return { status: "wait" };
  const next = await prisma.reiRioRound.findFirst({ where: { editionId, status: { in: ["PENDING", "PROCESSING"] } }, orderBy: { roundIndex: "asc" } });
  if (!next) return { status: "none" };
  if (next.status === "PROCESSING") return { status: "busy" };

  const token = randomUUID();
  const claim = await prisma.reiRioRound.updateMany({ where: { id: next.id, status: "PENDING" }, data: { status: "PROCESSING", claimToken: token, startedAt: now, error: null } });
  if (claim.count === 0) return { status: "busy" };

  try {
    const cfg = mergeConfig(ed.configJson);
    await ensureDayStates(editionId, next.dayIndex);
    const [parts, prevRound, pastRows] = await Promise.all([
      prisma.reiRioParticipant.findMany({ where: { editionId, rosterJson: { not: Prisma.DbNull } }, include: { dayStates: { where: { dayIndex: next.dayIndex } } } }),
      next.roundIndex > 1 ? prisma.reiRioRound.findUnique({ where: { editionId_roundIndex: { editionId, roundIndex: next.roundIndex - 1 } }, select: { standingsJson: true } }) : null,
      prisma.reiRioMatch.findMany({ where: { editionId }, select: { participantAId: true, participantBId: true, dayIndex: true } }),
    ]);
    const idByPid = new Map(parts.map((p) => [p.id, p]));
    const players: Runtime[] = parts.map((p) => {
      const ds = p.dayStates[0];
      return {
        pid: p.id, name: p.displayName, isBot: p.isBot, roster: rosterOf(p),
        formation: ds.formationJson as unknown as Formation, state: ds.stateJson as unknown as DayState,
        aggs: (p.scoresJson ?? {}) as Record<string, MascotAgg>, wins: p.wins, losses: p.losses, draws: p.draws, byes: p.byes, damage: p.damageDealt,
      };
    });
    if (players.length === 0) throw new Error("Nenhum participante com equipe congelada.");
    const snapshot = (prevRound?.standingsJson as unknown as StandRow[] | null) ?? initialStandings(players, cfg);
    // Só participantes que existiam no snapshot entram no pareamento (consistência com a classificação congelada).
    const known = new Set(snapshot.map((r) => r.pid));
    const active = players.filter((p) => known.has(p.pid));
    const past = pastRows.map((m) => ({ a: m.participantAId, b: m.participantBId, day: m.dayIndex }));
    const res = runRound({ editionId, roundIndex: next.roundIndex, dayIndex: next.dayIndex, cfg, snapshot, players: active, past });

    const lastOfDay = isLastRoundOfDay(next.roundIndex);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"rdr:" + editionId}))`;
      const cur = await tx.reiRioRound.findUnique({ where: { id: next.id }, select: { status: true, claimToken: true } });
      if (cur?.status !== "PROCESSING" || cur.claimToken !== token) throw new Error("Rodada reivindicada por outro processo; resultado descartado.");
      await tx.reiRioMatch.createMany({
        data: res.matches.map((m) => ({
          editionId, roundId: next.id, roundIndex: next.roundIndex, dayIndex: next.dayIndex, participantAId: m.aId, participantBId: m.bId,
          winnerId: m.winnerId, isDraw: m.isDraw, seed: m.seed, summaryJson: J(m.summary), statsJson: J(m.stats), replayJson: m.replay ? J(m.replay) : Prisma.JsonNull,
        })),
        skipDuplicates: true,
      });
      // Duas queries em lote (antes: 2 por participante). Arrays paralelos + unnest.
      const ps = res.players;
      if (ps.length) {
        await tx.$executeRaw`
          UPDATE "rdr_participants" p SET
            "scoresJson" = v.s::jsonb, "totalScore" = v.t, "wins" = v.w, "losses" = v.l, "draws" = v.d, "byes" = v.b, "damageDealt" = v.dmg, "updatedAt" = NOW()
          FROM unnest(${ps.map((r) => r.pid)}::text[], ${ps.map((r) => JSON.stringify(r.aggs))}::text[], ${ps.map((r) => sumAggs(r.aggs))}::int[],
            ${ps.map((r) => r.wins)}::int[], ${ps.map((r) => r.losses)}::int[], ${ps.map((r) => r.draws)}::int[], ${ps.map((r) => r.byes)}::int[], ${ps.map((r) => Math.round(r.damage))}::int[])
            AS v(id, s, t, w, l, d, b, dmg)
          WHERE p."id" = v.id`;
        await tx.$executeRaw`
          UPDATE "rdr_day_states" d SET "stateJson" = v.s::jsonb, "updatedAt" = NOW()
          FROM unnest(${ps.map((r) => idByPid.get(r.pid)!.dayStates[0].id)}::text[], ${ps.map((r) => JSON.stringify(r.state))}::text[]) AS v(id, s)
          WHERE d."id" = v.id`;
      }
      await tx.reiRioRound.update({ where: { id: next.id }, data: { status: "DONE", finishedAt: new Date(), snapshotJson: J(snapshot), standingsJson: J(res.standings), claimToken: null } });
      if (next.roundIndex >= TOTAL_ROUNDS) {
        await tx.reiRioEdition.update({ where: { id: editionId }, data: { phase: "FINISHED", finishedAt: new Date(), championKey: res.standings[0]?.pid ?? null, restDay: null } });
      } else if (lastOfDay) {
        // Só abre o descanso DEPOIS de a última rodada do dia estar consolidada (mesma transação).
        await tx.reiRioEdition.update({ where: { id: editionId }, data: { phase: "REST", restDay: next.dayIndex + 1 } });
      }
    }, { timeout: 120_000, maxWait: 15_000 });
    return { status: "done", round: next.roundIndex };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.reiRioRound.updateMany({ where: { id: next.id, claimToken: token }, data: { status: "PENDING", claimToken: null, error: msg.slice(0, 1000) } });
    console.error("[ReiDoRio] rodada falhou", editionId, next.roundIndex, e);
    return { status: "error", round: next.roundIndex, error: msg };
  }
}

/**
 * Avança o relógio da edição. `force` ignora horários (ferramentas de teste).
 * `maxRounds` limita quantas rodadas rodam numa chamada (limite de tempo da função serverless).
 */
export async function tick(editionId: string, opts: { now?: Date; force?: boolean; maxRounds?: number } = {}) {
  const now = opts.now ?? new Date();
  const force = !!opts.force;
  const maxRounds = opts.maxRounds ?? 4;
  const log: string[] = [];
  await recoverStaleRounds(editionId, now);
  let processed = 0;
  for (let guard = 0; guard < 30; guard++) {
    const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
    if (ed.phase === "FINISHED" || ed.phase === "CANCELED") break;
    if (ed.phase === "PREPARATION") {
      if (force || now >= lockAt(ed.mondayDate)) { const r = await lockEdition(editionId); log.push(r.canceled ? "Edição CANCELADA: menos inscritos que o mínimo." : `Inscrições encerradas${r.dropped.length ? ` (${r.dropped.length} fora)` : ""}.`); continue; }
      break;
    }
    if (ed.phase === "LOCKED" || ed.phase === "REST") {
      const day = ed.phase === "LOCKED" ? 1 : ed.restDay ?? 1;
      if (force || now >= freezeAt(ed.mondayDate, day)) { await freezeDay(editionId, day); log.push(`Formação do dia ${day} congelada.`); continue; }
      break;
    }
    if (processed >= maxRounds) break;
    const next = await prisma.reiRioRound.findFirst({ where: { editionId, status: { in: ["PENDING", "PROCESSING"] } }, orderBy: { roundIndex: "asc" } });
    if (!next) break;
    if (!force && next.scheduledAt > now) break;
    const r = await processNextRound(editionId, now);
    if (r.status !== "done") { log.push(`Rodada ${next.roundIndex}: ${r.status}${r.error ? ` — ${r.error}` : ""}`); break; }
    processed++; log.push(`Rodada ${r.round} concluída.`);
    if (force && opts.maxRounds === undefined) break;
  }
  return { processed, log };
}

/** Cron: só edições com relógio real ligado. */
export async function tickAutoEditions(now = new Date()) {
  const eds = await prisma.reiRioEdition.findMany({ where: { autoRun: true, phase: { notIn: ["FINISHED", "CANCELED"] } }, select: { id: true } });
  const out: Record<string, string[]> = {};
  for (const e of eds) out[e.id] = (await tick(e.id, { now })).log;
  return out;
}

// ── Integridade ───────────────────────────────────────────────────────────────

export async function verifyEdition(editionId: string) {
  const issues: string[] = [];
  const [parts, rounds, matches] = await Promise.all([
    prisma.reiRioParticipant.findMany({ where: { editionId } }),
    prisma.reiRioRound.findMany({ where: { editionId }, orderBy: { roundIndex: "asc" } }),
    prisma.reiRioMatch.findMany({ where: { editionId }, select: { roundId: true, roundIndex: true, participantAId: true, participantBId: true, statsJson: true, winnerId: true, isDraw: true, replayJson: true, summaryJson: true } }),
  ]);
  const done = rounds.filter((r) => r.status === "DONE");
  for (const r of rounds) if (r.status === "PROCESSING") issues.push(`Rodada ${r.roundIndex} presa em PROCESSING.`);
  for (let i = 0; i < done.length; i++) if (done[i].roundIndex !== i + 1) issues.push(`Rodadas concluídas fora de ordem (faltou a ${i + 1}).`);
  const perRound = new Map<number, Map<string, number>>();
  for (const m of matches) {
    const mm = perRound.get(m.roundIndex) ?? new Map<string, number>();
    for (const id of [m.participantAId, m.participantBId]) if (id) mm.set(id, (mm.get(id) ?? 0) + 1);
    perRound.set(m.roundIndex, mm);
    if (m.participantBId && !m.replayJson && !(m.summaryJson as { exhausted?: unknown }).exhausted) issues.push(`Partida da rodada ${m.roundIndex} sem replay.`);
  }
  const eligible = parts.filter((p) => p.rosterJson);
  for (const r of done) {
    const mm = perRound.get(r.roundIndex) ?? new Map();
    for (const p of eligible) if ((mm.get(p.id) ?? 0) !== 1) issues.push(`Rodada ${r.roundIndex}: ${p.displayName} aparece ${(mm.get(p.id) ?? 0)}x (esperado 1).`);
  }
  for (const p of parts) {
    const aggs = (p.scoresJson ?? {}) as Record<string, MascotAgg>;
    if (sumAggs(aggs) !== p.totalScore) issues.push(`${p.displayName}: pontuação geral (${p.totalScore}) ≠ soma dos mascotes (${sumAggs(aggs)}).`);
    const fromMatches = matches.reduce((acc, m) => {
      const s = m.statsJson as { A: { total: number }[]; B: { total: number }[] };
      if (m.participantAId === p.id) return acc + (s.A ?? []).reduce((a, x) => a + x.total, 0);
      if (m.participantBId === p.id) return acc + (s.B ?? []).reduce((a, x) => a + x.total, 0);
      return acc;
    }, 0);
    if (fromMatches !== p.totalScore) issues.push(`${p.displayName}: pontos das partidas (${fromMatches}) ≠ acumulado (${p.totalScore}).`);
    const games = p.wins + p.losses + p.draws + p.byes;
    if (games !== done.length && p.rosterJson) issues.push(`${p.displayName}: ${games} resultados para ${done.length} rodadas.`);
  }
  return { ok: issues.length === 0, issues, rounds: done.length, matches: matches.length, participants: parts.length };
}

export async function deleteTestEdition(editionId: string) {
  const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
  if (!ed.isTest) throw new Error("Só edições de teste podem ser apagadas.");
  await prisma.reiRioEdition.delete({ where: { id: editionId } });
}

/** Reinicia uma edição de teste para a preparação (mantém participantes, apaga resultados). */
export async function resetTestEdition(editionId: string) {
  const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
  if (!ed.isTest) throw new Error("Só edições de teste podem ser reiniciadas.");
  await prisma.$transaction([
    prisma.reiRioMatch.deleteMany({ where: { editionId } }),
    prisma.reiRioDayState.deleteMany({ where: { participant: { editionId } } }),
    prisma.reiRioRound.updateMany({ where: { editionId }, data: { status: "PENDING", claimToken: null, startedAt: null, finishedAt: null, snapshotJson: Prisma.JsonNull, standingsJson: Prisma.JsonNull, error: null } }),
    prisma.reiRioParticipant.updateMany({ where: { editionId }, data: { scoresJson: {}, dayPlansJson: {}, totalScore: 0, wins: 0, losses: 0, draws: 0, byes: 0, damageDealt: 0, lockedAt: null } }),
    prisma.reiRioEdition.update({ where: { id: editionId }, data: { phase: "PREPARATION", registrationOpen: true, restDay: null, lockedAt: null, finishedAt: null, championKey: null } }),
  ]);
  // Reais perdem o roster congelado; bots mantêm o seu (já faz parte da inscrição).
  await prisma.reiRioParticipant.updateMany({ where: { editionId, isBot: false }, data: { rosterJson: Prisma.JsonNull } });
}

export const DAYS = COMPETITION_DAYS;
