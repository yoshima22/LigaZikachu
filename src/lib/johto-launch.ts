import { prisma } from "@/lib/prisma";
import { JOHTO_INVITATION_LAUNCH_AT } from "@/lib/johto-invitation-copy";
import { prepareJohtoInvitationCampaign, runJohtoInvitationLaunch } from "@/lib/johto-invitation";
import { createJohtoEvent, getJohtoEvent, openNextLeaderWindow, setJohtoRaidVisible } from "@/lib/johto-raid";

const RELEASED_KEY = "johto-launch-released-2026";

/** Runs from the existing five-minute weekly cron. The release marker leaves later admin changes alone. */
export async function runJohtoLaunch(now = new Date()): Promise<{ launched: boolean; sent: number }> {
  if (now < JOHTO_INVITATION_LAUNCH_AT) return { launched: false, sent: 0 };

  await prepareJohtoInvitationCampaign({ publish: true, now });
  const released = await prisma.appSetting.findUnique({ where: { key: RELEASED_KEY }, select: { value: true } });
  if (released?.value !== true) {
    const event = await getJohtoEvent() ?? await createJohtoEvent();
    await setJohtoRaidVisible(true);
    await prisma.johtoRaidEvent.updateMany({ where: { id: event.id, active: false }, data: { active: true } });
    const started = await prisma.johtoRaidLeader.count({ where: { eventId: event.id, startedAt: { not: null } } });
    if (started === 0) {
      await openNextLeaderWindow(event.id, now);
    }
    await prisma.appSetting.upsert({
      where: { key: RELEASED_KEY },
      create: { key: RELEASED_KEY, value: true },
      update: { value: true },
    });
  }

  const push = await runJohtoInvitationLaunch(now);
  return { launched: true, sent: push.sent };
}
