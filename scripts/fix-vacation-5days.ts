import { prisma } from "@/lib/prisma";

const NEW_DAYS = 5;
const NEW_EXP = 4500;
const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_DESCRIPTION =
  "Envia o mascote de férias por 5 dias. Ao voltar, recebe 4.500 EXP (mais um pequeno bônus que cresce conforme o nível), felicidade máxima, volta empanturrado e ainda tem chance de trazer um Ovo Comum de presente.";

async function main() {
  // 1) Atualiza o item na loja: metadata (dias/exp) + descrição.
  const item = await prisma.shopItem.findFirst({ where: { type: "VACATION_TICKET" } });
  if (item) {
    const meta = (item.metadata ?? {}) as Record<string, number>;
    await prisma.shopItem.update({
      where: { id: item.id },
      data: {
        description: NEW_DESCRIPTION,
        metadata: { ...meta, vacationDays: NEW_DAYS, expBonus: NEW_EXP, eggChancePct: meta.eggChancePct ?? 30 },
      },
    });
    console.log(`[ok] Item atualizado: vacationDays=${NEW_DAYS}, expBonus=${NEW_EXP}`);
  } else {
    console.log("[aviso] VACATION_TICKET não encontrado na loja.");
  }

  // 2) Reduz as férias em progresso: remove o tempo extra (original - 5 dias).
  const active = await prisma.mascotExpedition.findMany({
    where: { status: "ACTIVE" },
  });
  const now = new Date();
  let ready = 0;
  let shortened = 0;
  for (const exp of active) {
    const reward = (exp.rewardJson ?? {}) as Record<string, unknown>;
    if (reward.mode !== "VACATION") continue;
    const originalDays = Number(String(reward.durationKey ?? "7d").replace(/d$/, "")) || 7;
    const removeMs = Math.max(0, originalDays - NEW_DAYS) * DAY_MS;
    if (removeMs === 0) continue;
    const newFinish = new Date(exp.finishAt.getTime() - removeMs);
    if (newFinish <= now) {
      await prisma.mascotExpedition.update({
        where: { id: exp.id },
        data: { finishAt: now, rewardJson: { ...reward, durationKey: `${NEW_DAYS}d` } },
      });
      ready++;
    } else {
      await prisma.mascotExpedition.update({
        where: { id: exp.id },
        data: { finishAt: newFinish, rewardJson: { ...reward, durationKey: `${NEW_DAYS}d` } },
      });
      shortened++;
    }
  }
  console.log(`[ok] Férias em progresso: ${shortened} encurtadas, ${ready} prontas para coleta.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
