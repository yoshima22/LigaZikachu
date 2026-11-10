"use server";

import { revalidatePath } from "next/cache";
import { mondayOf } from "@/lib/rei-do-rio/schedule";
import { autoBuild, type Preset } from "@/lib/rei-do-rio/auto-build";
import type { Formation, Strategy } from "@/lib/rei-do-rio/team";
import { makeSimPlayer, simulateWeek, type BotTier } from "@/lib/rei-do-rio/simulate";
import {
  addBots, clearDayPlan, createEdition, deleteTestEdition, getReiAdmin, loadPlayerPool, lockEdition, processNextRound,
  resetTestEdition, saveDayPlan, saveRegistration, tick, verifyEdition, withdraw,
} from "@/lib/rei-do-rio/service";
import { getEditionView, listEditions, loadReplay, loadReport } from "@/lib/rei-do-rio/view";
import { prisma } from "@/lib/prisma";

const DENIED = { ok: false as const, error: "Acesso restrito à equipe ADMIN." };
const PATH = "/combates/rei-do-rio";
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Erro inesperado." });

// ── Leitura ───────────────────────────────────────────────────────────────────

export async function loadEditionAction(editionId: string) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try { const view = await getEditionView(editionId, me.playerId); return view ? { ok: true as const, view } : { ok: false as const, error: "Edição não encontrada." }; } catch (e) { return fail(e); }
}

export async function listEditionsAction() {
  if (!(await getReiAdmin())) return DENIED;
  try { return { ok: true as const, editions: await listEditions() }; } catch (e) { return fail(e); }
}

export async function loadReportAction(editionId: string, participantId: string, day: number) {
  if (!(await getReiAdmin())) return DENIED;
  try { const report = await loadReport(editionId, participantId, day); return report ? { ok: true as const, report } : { ok: false as const, error: "Relatório indisponível." }; } catch (e) { return fail(e); }
}

export async function loadReplayAction(matchId: string) {
  if (!(await getReiAdmin())) return DENIED;
  try { const replay = await loadReplay(matchId); return replay ? { ok: true as const, replay } : { ok: false as const, error: "Replay indisponível." }; } catch (e) { return fail(e); }
}

// ── Jogador (admin) ───────────────────────────────────────────────────────────

export async function autoBuildAction(preset: Preset, strategy: Strategy) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try {
    const pool = await loadPlayerPool(me.playerId);
    const r = autoBuild(pool, preset, strategy);
    return r.ok ? { ok: true as const, formation: r.formation, explanation: r.explanation } : { ok: false as const, error: r.error, missing: r.missing };
  } catch (e) { return fail(e); }
}

export async function registerAction(editionId: string, formation: Formation) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try {
    const r = await saveRegistration(editionId, me.playerId, me.displayName, formation);
    revalidatePath(PATH);
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.errors[0], errors: r.errors };
  } catch (e) { return fail(e); }
}

export async function withdrawAction(editionId: string) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try { const ok = await withdraw(editionId, me.playerId); revalidatePath(PATH); return ok ? { ok: true as const } : { ok: false as const, error: "Não é mais possível cancelar a inscrição." }; } catch (e) { return fail(e); }
}

export async function saveRestPlanAction(editionId: string, formation: Formation) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try {
    const r = await saveDayPlan(editionId, me.playerId, formation);
    revalidatePath(PATH);
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.errors[0], errors: r.errors };
  } catch (e) { return fail(e); }
}

export async function clearRestPlanAction(editionId: string) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try { await clearDayPlan(editionId, me.playerId); revalidatePath(PATH); return { ok: true as const }; } catch (e) { return fail(e); }
}

// ── Administração / testes ────────────────────────────────────────────────────

export type BalanceInput = { swapPct?: number; hpMultiplier?: number; maxRounds?: number; winPoints?: number; pressure?: boolean };
function balanceToConfig(b: BalanceInput) {
  const cfg: Record<string, unknown> = {};
  const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined);
  const hp = num(b.hpMultiplier, 0.5, 6), mr = num(b.maxRounds, 3, 150), win = num(b.winPoints, 0, 100);
  if (hp !== undefined) cfg.hpMultiplier = hp;
  if (mr !== undefined) cfg.maxRounds = Math.round(mr);
  if (win !== undefined) cfg.budget = { win };
  if (b.pressure === false) { cfg.pressure = { enabled: false }; cfg.current = { enabled: false }; }
  return cfg;
}

export async function adminCreateEditionAction(input: { name: string; mondayDate?: string; isTest: boolean; autoRun: boolean; bots: number; balance?: BalanceInput }) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try {
    const monday = input.mondayDate && /^\d{4}-\d{2}-\d{2}$/.test(input.mondayDate) ? input.mondayDate : mondayOf(new Date());
    const ed = await createEdition({ name: input.name, mondayDate: monday, isTest: input.isTest, autoRun: input.autoRun, config: balanceToConfig(input.balance ?? {}) });
    const bots = Math.max(0, Math.min(40, Math.floor(input.bots || 0)));
    if (bots && ed.isTest) await addBots(ed.id, bots);
    revalidatePath(PATH);
    return { ok: true as const, editionId: ed.id };
  } catch (e) { return fail(e); }
}

export async function adminAddBotsAction(editionId: string, count: number, tier?: BotTier, preset?: Preset) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try { const n = await addBots(editionId, Math.max(1, Math.min(40, count)), { tier, preset }); revalidatePath(PATH); return { ok: true as const, added: n }; } catch (e) { return fail(e); }
}

export async function adminToggleRegistrationAction(editionId: string, open: boolean) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try {
    const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
    if (ed.phase !== "PREPARATION") return { ok: false as const, error: "Inscrições só mudam na preparação." };
    await prisma.reiRioEdition.update({ where: { id: editionId }, data: { registrationOpen: open } });
    revalidatePath(PATH);
    return { ok: true as const };
  } catch (e) { return fail(e); }
}

export type AdminCommand = "LOCK" | "NEXT_ROUND" | "RUN_DAY" | "RUN_ALL" | "TICK_REAL" | "RESET" | "DELETE" | "VERIFY";

/** Comandos de teste. Reais exigem confirmação textual; destrutivos só valem para edições de teste. */
export async function adminCommandAction(editionId: string, command: AdminCommand, confirm?: string) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try {
    const ed = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
    const destructive = command === "RESET" || command === "DELETE";
    if (destructive && !ed.isTest) return { ok: false as const, error: "Apenas edições de teste podem ser reiniciadas ou apagadas." };
    if (!ed.isTest && command !== "VERIFY" && command !== "TICK_REAL" && confirm !== ed.name) return { ok: false as const, error: `Edição real: digite o nome exato (“${ed.name}”) para confirmar.` };
    let message = "";
    switch (command) {
      case "LOCK": { const r = await lockEdition(editionId); message = `Inscrições encerradas${r.dropped.length ? `; fora: ${r.dropped.join("; ")}` : ""}.`; break; }
      case "NEXT_ROUND": { const r = await tick(editionId, { force: true }); message = r.log.join(" ") || "Nada a processar."; break; }
      case "RUN_DAY": {
        const logs: string[] = [];
        for (let i = 0; i < 6; i++) { // até 5 rodadas + congelamentos/descanso do dia
          const before = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
          if (before.phase === "FINISHED") break;
          if (before.phase === "REST" && logs.length) break; // parou no descanso: o dia terminou
          const r = await tick(editionId, { force: true });
          logs.push(...r.log);
          const after = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } });
          if (after.phase === "REST" || after.phase === "FINISHED") break;
        }
        message = logs.join(" ");
        break;
      }
      case "RUN_ALL": { let n = 0; for (let i = 0; i < 80; i++) { const r = await tick(editionId, { force: true }); if (!r.log.length) break; n++; if ((await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: editionId } })).phase === "FINISHED") break; } message = `Semana simulada (${n} passos).`; break; }
      case "TICK_REAL": { const r = await tick(editionId); message = r.log.join(" ") || "Nada a fazer neste horário."; break; }
      case "RESET": await resetTestEdition(editionId); message = "Edição de teste reiniciada."; break;
      case "DELETE": await deleteTestEdition(editionId); message = "Edição de teste apagada."; break;
      case "VERIFY": { const v = await verifyEdition(editionId); message = v.ok ? `Integridade OK (${v.rounds} rodadas, ${v.matches} partidas).` : `${v.issues.length} problema(s): ${v.issues.slice(0, 6).join(" | ")}`; revalidatePath(PATH); return { ok: v.ok, error: v.ok ? undefined : message, message, issues: v.issues }; }
    }
    revalidatePath(PATH);
    return { ok: true as const, message };
  } catch (e) { return fail(e); }
}

export async function adminRunRoundNowAction(editionId: string) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try { const r = await processNextRound(editionId); revalidatePath(PATH); return { ok: true as const, status: r.status, round: r.round, error: r.error }; } catch (e) { return fail(e); }
}

/** Simulação de balanceamento 100% em memória (sem banco). */
export async function adminSimulateAction(input: { players: number; weeks: number } & BalanceInput) {
  const me = await getReiAdmin();
  if (!me) return DENIED;
  try {
    const n = Math.max(4, Math.min(40, Math.floor(input.players || 12)));
    const weeks = Math.max(1, Math.min(5, Math.floor(input.weeks || 1)));
    const presets = ["BALANCED", "OFFENSIVE", "ENDURANCE", "CONTROL"] as const;
    const tiers = ["FRACO", "MEDIO", "FORTE"] as const;
    const out = [];
    for (let w = 0; w < weeks; w++) {
      const players = Array.from({ length: n }, (_, i) => makeSimPlayer(w * 1000 + i + 1, presets[i % 4], tiers[i % 3], typeof input.swapPct === "number" ? Math.max(0, Math.min(90, Math.round(input.swapPct))) : i % 2 ? "PRESERVE" : "KEEP"));
      const cfg = balanceToConfig(input);
      const sim = simulateWeek(players, { editionId: `sim-${w}`, cfg });
      out.push({ week: w + 1, metrics: sim.metrics, top: sim.standings.slice(0, 5).map((r) => ({ name: r.name, score: r.score, wins: r.wins })) });
    }
    return { ok: true as const, runs: out };
  } catch (e) { return fail(e); }
}
