// E2E do Rei do Rio contra o banco: edição de TESTE com bots, concorrência, idempotência e integridade. Apaga no fim.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { addBots, createEdition, deleteTestEdition, lockEdition, processNextRound, saveDayPlan, tick, verifyEdition } from "../src/lib/rei-do-rio/service";
import type { Formation } from "../src/lib/rei-do-rio/team";

async function main() {
  const ed = await createEdition({ name: "E2E automático", mondayDate: "2026-11-09", isTest: true, autoRun: false });
  try {
    await addBots(ed.id, 7); // ímpar de propósito: testa BYE
    const lock = await lockEdition(ed.id);
    console.log("lock ok, descartados:", lock.dropped.length);

    // Fase: LOCKED -> RUNNING exige freeze
    const t0 = Date.now();
    let r = await tick(ed.id, { force: true });
    console.log("tick1:", r.log.join(" | "));

    // Concorrência: 4 processadores disputam a próxima rodada; só 1 pode concluir.
    const results = await Promise.all([1, 2, 3, 4].map(() => processNextRound(ed.id)));
    console.log("concorrência:", results.map((x) => x.status).join(","));
    const doneAfterRace = await prisma.reiRioRound.count({ where: { editionId: ed.id, status: "DONE" } });
    if (doneAfterRace !== 2) throw new Error(`esperava 2 rodadas concluídas após a corrida, vi ${doneAfterRace}`);

    // Termina o dia 1 e confere que o descanso só abre depois da rodada das 21h.
    for (let i = 0; i < 3; i++) await tick(ed.id, { force: true });
    let e = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: ed.id } });
    console.log("fase após dia 1:", e.phase, "restDay:", e.restDay);
    if (e.phase !== "REST" || e.restDay !== 2) throw new Error("descanso não abriu após as 5 rodadas");

    // Edição noturna: troca ordem do slot 1; tentativa de trocar mascote fora dos 18 deve falhar.
    const p = await prisma.reiRioParticipant.findFirstOrThrow({ where: { editionId: ed.id, isBot: true } });
    const f = structuredClone(p.originalJson) as unknown as Formation;
    [f.slots[0].mascotIds[0], f.slots[0].mascotIds[1]] = [f.slots[0].mascotIds[1], f.slots[0].mascotIds[0]];
    const ok = await saveDayPlan(ed.id, p.playerKey, f);
    const bad = structuredClone(f); bad.slots[0].mascotIds[2] = "intruso";
    const rej = await saveDayPlan(ed.id, p.playerKey, bad);
    console.log("edição noturna válida:", ok.ok, "| intruso rejeitado:", !rej.ok);
    if (!ok.ok || rej.ok) throw new Error("validação noturna falhou");
    const orig = await prisma.reiRioParticipant.findUniqueOrThrow({ where: { id: p.id } });
    if (JSON.stringify(orig.originalJson) !== JSON.stringify(p.originalJson)) throw new Error("formação original foi alterada!");

    // Semana inteira
    for (let i = 0; i < 40; i++) { const t = await tick(ed.id, { force: true }); if (!t.log.length) break; }
    e = await prisma.reiRioEdition.findUniqueOrThrow({ where: { id: ed.id } });
    console.log("fase final:", e.phase, "| campeão:", e.championKey, "|", ((Date.now() - t0) / 1000).toFixed(1), "s");
    if (e.phase !== "FINISHED") throw new Error("edição não finalizou");

    // Reprocessar não duplica
    const again = await processNextRound(ed.id);
    console.log("reprocessar após fim:", again.status);
    const v = await verifyEdition(ed.id);
    console.log("integridade:", v.ok ? "OK" : v.issues.slice(0, 8), `(${v.rounds} rodadas, ${v.matches} partidas, ${v.participants} participantes)`);
    if (!v.ok) throw new Error("integridade falhou");
  } finally {
    await deleteTestEdition(ed.id);
    console.log("edição de teste apagada");
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error("FALHOU:", e); process.exit(1); });
