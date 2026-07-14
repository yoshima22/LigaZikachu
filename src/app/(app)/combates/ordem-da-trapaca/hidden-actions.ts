"use server";

import { revalidatePath } from "next/cache";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { deactivateOrderSabotagesForStep, ensureOrderPasswordStamps, grantOrderStepRewardToAll, ORDER_EVENT_SLUG, ORDER_MYSTERY_STEP_KEYS, ORDER_STEP_CONFIG, type OrderMysteryStepKey } from "@/lib/raid-event";

const EVENT_PATH = "/combates/ordem-da-trapaca";

const STEP_FEEDBACK: Record<string, string> = {
  ZIKALOOT_FAKE_NUMBER: "A ZikaLoot foi recuperada. As recompensas roubadas voltaram para a Liga.",
  BAZAR_SLOT_SIX_CLICKS: "O slot corrompido abriu por um instante. A Ordem passou pelo Bazar.",
  LAB_SMOKE_TO_MACHINE: "A maquina engoliu a fumaca e revelou um rastro do esconderijo.",
  SYNC_HIDDEN_DRAG_BUTTON: "O fundo falso cedeu. Ha um botao escondido na Arena Sincronizada.",
  MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS: "A sabotagem da Liga Semanal foi removida. Os tres primeiros slots voltaram ao normal.",
  MASCOTS_EQUIPPED_WHISPER: "Os ataques aos mascotes foram interrompidos. A Ordem deixou um rastro para a proxima fase.",
};

export type ResolveMysteryStepState = {
  ok: boolean;
  message?: string;
};

export async function resolveOrderMysteryStepAction(
  _state: ResolveMysteryStepState,
  formData: FormData,
): Promise<ResolveMysteryStepState> {
  const session = await getAppSession();
  if (!session?.user) return { ok: false, message: "Faça login para investigar." };

  const stepKey = String(formData.get("stepKey") ?? "");
  const returnPath = String(formData.get("returnPath") ?? EVENT_PATH);
  if (!stepKey) return { ok: false, message: "Nada aconteceu." };

  const event = await prisma.raidEvent.findUnique({
    where: { slug: ORDER_EVENT_SLUG },
    select: { id: true, active: true, phase: true },
  });
  if (!event?.active || event.phase === "ANNOUNCED" || event.phase === "ENDED") {
    return { ok: false, message: "A investigação ainda não está ativa." };
  }

  const step = await prisma.raidMysteryStep.findFirst({
    where: { raidEventId: event.id, stepKey, active: true },
    select: {
      id: true,
      stepKey: true,
      requiredVisibleClues: true,
      requiredPreviousStepKey: true,
      resolvedAt: true,
      successFeedback: true,
      earlyFeedback: true,
    },
  });
  if (!step) return { ok: false, message: "Essa pista não pertence à investigação atual." };
  if (step.resolvedAt) {
    await deactivateOrderSabotagesForStep(event.id, step.stepKey as OrderMysteryStepKey);
    await grantOrderStepRewardToAll(event.id, step.stepKey as OrderMysteryStepKey, session.user.id);
    revalidatePath(EVENT_PATH);
    revalidatePath(returnPath);
    return { ok: true, message: STEP_FEEDBACK[step.stepKey] ?? "Esta etapa já foi descoberta." };
  }

  const config = ORDER_STEP_CONFIG[step.stepKey as OrderMysteryStepKey];
  const [generalClues, specificClues] = await Promise.all([
    prisma.raidClue.count({ where: { raidEventId: event.id, visible: true, relatedStepKey: null } }),
    prisma.raidClue.count({ where: { raidEventId: event.id, visible: true, relatedStepKey: step.stepKey } }),
  ]);
  const requiredGeneral = config?.requiredGeneralClues ?? 0;
  const requiredSpecific = config?.requiredSpecificClues ?? step.requiredVisibleClues;
  if (generalClues < requiredGeneral || specificClues < requiredSpecific) {
    return {
      ok: false,
      message: "Nada parece acontecer ainda.",
    };
  }

  if (config?.requiredPreviousStepKey) {
    const previous = await prisma.raidMysteryStep.findFirst({
      where: { raidEventId: event.id, stepKey: config.requiredPreviousStepKey },
      select: { resolvedAt: true },
    });
    if (!previous?.resolvedAt) {
      return { ok: false, message: "Nada parece acontecer ainda." };
    }
  }

  await prisma.raidMysteryStep.update({
    where: { id: step.id },
    data: { resolvedAt: new Date(), resolvedByUserId: session.user.id },
  });
  await deactivateOrderSabotagesForStep(event.id, step.stepKey as OrderMysteryStepKey);
  await grantOrderStepRewardToAll(event.id, step.stepKey as OrderMysteryStepKey, session.user.id);

  const unresolvedCount = await prisma.raidMysteryStep.count({
    where: { raidEventId: event.id, active: true, stepKey: { in: [...ORDER_MYSTERY_STEP_KEYS] }, resolvedAt: null },
  });
  if (unresolvedCount === 0 && event.phase !== "HIDEOUT_FOUND" && event.phase !== "RAID_ACTIVE") {
    await prisma.raidEvent.update({
      where: { id: event.id },
      data: { phase: "HIDEOUT_FOUND", hideoutFoundAt: new Date(), hideoutFoundByUserId: session.user.id },
    });
    await ensureOrderPasswordStamps(event.id);
  }

  revalidatePath(EVENT_PATH);
  revalidatePath(returnPath);
  return { ok: true, message: step.successFeedback ?? STEP_FEEDBACK[step.stepKey] ?? "Etapa descoberta." };
}
