import { prisma } from "@/lib/prisma";
import { sendNotificationToUsers } from "@/lib/notifications";
import {
  JOHTO_INVITATION_LAUNCH_AT,
  JOHTO_VOTE_QUESTIONS,
  type JohtoVoteQuestionKey,
} from "@/lib/johto-invitation-copy";

export const JOHTO_INVITATION_CAMPAIGN_SLUG = "johto-invitation-2026";
export const JOHTO_INVITATION_PUSH = {
  title: "Ginásios de Johto",
  body: "Johto em festa com a etapa final da Liga Zikachu TCG",
  url: "/combates/raid-johto",
} as const;
const TOURNAMENT_SLUG = "liga-zikachu-3-edicao-rumo-a-johto";
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;

type Candidate = { id: string; displayName: string };

export type JohtoInvitationPlayerState = {
  available: boolean;
  openedAt: string | null;
  votingSkippedAt: string | null;
  voteSubmittedAt: string | null;
  candidates: Candidate[];
};

const unavailableState = (): JohtoInvitationPlayerState => ({
  available: false,
  openedAt: null,
  votingSkippedAt: null,
  voteSubmittedAt: null,
  candidates: [],
});

function isEligiblePlayer(player: {
  active: boolean;
  user: { status: string; role: string };
} | null): boolean {
  return !!player && player.active && player.user.status === "ACTIVE" && !ADMIN_ROLES.some((role) => role === player.user.role);
}

async function findTournament() {
  const tournament = await prisma.tournament.findUnique({
    where: { slug: TOURNAMENT_SLUG },
    select: { id: true, name: true },
  });
  if (!tournament) throw new Error("A 3ª edição da Liga Zikachu não foi encontrada.");
  return tournament;
}

async function listCandidates(): Promise<Candidate[]> {
  const tournament = await findTournament();
  const registrations = await prisma.tournamentRegistration.findMany({
    where: { tournamentId: tournament.id, status: "APPROVED" },
    select: { player: { select: { id: true, displayName: true, active: true, user: { select: { status: true, role: true } } } } },
  });
  return registrations
    .map(({ player }) => player)
    .filter((player) => !ADMIN_ROLES.some((role) => role === player.user.role))
    .map(({ id, displayName }) => ({ id, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR") || a.id.localeCompare(b.id));
}

/** Shared, read-only roster for the admin preview and the real ballot. */
export async function getJohtoInvitationPreviewCandidates(): Promise<Candidate[]> {
  return listCandidates();
}

function isLive(campaign: { publishedAt: Date | null; launchAt: Date }, now: Date): boolean {
  return !!campaign.publishedAt && campaign.publishedAt <= now && campaign.launchAt <= now;
}

export async function prepareJohtoInvitationCampaign(input: { publish?: boolean; now?: Date } = {}) {
  await findTournament();
  const now = input.now ?? new Date();
  const prepared = await prisma.johtoInvitationCampaign.upsert({
    where: { slug: JOHTO_INVITATION_CAMPAIGN_SLUG },
    create: {
      slug: JOHTO_INVITATION_CAMPAIGN_SLUG,
      launchAt: JOHTO_INVITATION_LAUNCH_AT,
      publishedAt: null,
    },
    update: {},
  });
  if (input.publish) {
    await prisma.johtoInvitationCampaign.updateMany({
      where: { slug: JOHTO_INVITATION_CAMPAIGN_SLUG, publishedAt: null },
      data: { publishedAt: now },
    });
  }
  const campaign = input.publish
    ? await prisma.johtoInvitationCampaign.findUniqueOrThrow({ where: { id: prepared.id } })
    : prepared;
  if (isLive(campaign, now)) {
    const players = await prisma.player.findMany({
      where: { active: true, user: { status: "ACTIVE", role: { notIn: [...ADMIN_ROLES] } } },
      select: { id: true },
    });
    for (const player of players) {
      await prisma.johtoInvitationRecipient.upsert({
        where: { campaignId_playerId: { campaignId: campaign.id, playerId: player.id } },
        create: { campaignId: campaign.id, playerId: player.id, availableAt: now },
        update: {},
      });
    }
  }
  return campaign;
}

export async function getJohtoInvitationForPlayer(playerId: string, now = new Date()): Promise<JohtoInvitationPlayerState> {
  const campaign = await prisma.johtoInvitationCampaign.findUnique({ where: { slug: JOHTO_INVITATION_CAMPAIGN_SLUG } });
  if (!campaign || !isLive(campaign, now)) return unavailableState();
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { active: true, user: { select: { status: true, role: true } } },
  });
  if (!isEligiblePlayer(player)) return unavailableState();
  const recipient = await prisma.johtoInvitationRecipient.upsert({
    where: { campaignId_playerId: { campaignId: campaign.id, playerId } },
    create: { campaignId: campaign.id, playerId, availableAt: now },
    update: {},
  });
  return {
    available: !!recipient.availableAt,
    openedAt: recipient.openedAt?.toISOString() ?? null,
    votingSkippedAt: recipient.votingSkippedAt?.toISOString() ?? null,
    voteSubmittedAt: recipient.voteSubmittedAt?.toISOString() ?? null,
    candidates: await listCandidates(),
  };
}

export async function openJohtoInvitation(playerId: string, now = new Date()): Promise<JohtoInvitationPlayerState> {
  const state = await getJohtoInvitationForPlayer(playerId, now);
  if (!state.available) throw new Error("Convite de Johto indisponível.");
  const campaign = await prisma.johtoInvitationCampaign.findUnique({ where: { slug: JOHTO_INVITATION_CAMPAIGN_SLUG } });
  if (!campaign) throw new Error("Campanha de Johto indisponível.");
  const recipient = await prisma.johtoInvitationRecipient.findUnique({
    where: { campaignId_playerId: { campaignId: campaign.id, playerId } },
  });
  if (!recipient) throw new Error("Destinatário do convite não encontrado.");
  await prisma.johtoInvitationRecipient.updateMany({
    where: { id: recipient.id, openedAt: null },
    data: { openedAt: now },
  });
  return getJohtoInvitationForPlayer(playerId, now);
}

export async function skipJohtoInvitationVote(playerId: string, now = new Date()): Promise<JohtoInvitationPlayerState> {
  const state = await getJohtoInvitationForPlayer(playerId, now);
  if (!state.available || !state.openedAt) throw new Error("Abra o convite antes de continuar.");
  if (state.voteSubmittedAt) return state;
  const campaign = await prisma.johtoInvitationCampaign.findUnique({ where: { slug: JOHTO_INVITATION_CAMPAIGN_SLUG } });
  if (!campaign) throw new Error("Campanha de Johto indisponível.");
  const recipient = await prisma.johtoInvitationRecipient.findUnique({
    where: { campaignId_playerId: { campaignId: campaign.id, playerId } },
  });
  if (!recipient) throw new Error("Destinatário do convite não encontrado.");
  await prisma.johtoInvitationRecipient.updateMany({
    where: { id: recipient.id, votingSkippedAt: null, voteSubmittedAt: null },
    data: { votingSkippedAt: now },
  });
  return getJohtoInvitationForPlayer(playerId, now);
}

export async function submitJohtoInvitationVote(
  playerId: string,
  answers: Record<JohtoVoteQuestionKey, string>,
  now = new Date(),
): Promise<JohtoInvitationPlayerState> {
  const keys = JOHTO_VOTE_QUESTIONS.map(({ key }) => key);
  if (!answers || Object.keys(answers).length !== keys.length || keys.some((key) => typeof answers[key] !== "string" || !answers[key].trim())) {
    throw new Error("Responda às seis perguntas da votação.");
  }
  const candidates = await listCandidates();
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  if (keys.some((key) => !byId.has(answers[key]))) throw new Error("Candidato inválido para esta edição.");
  const campaign = await prisma.johtoInvitationCampaign.findUnique({ where: { slug: JOHTO_INVITATION_CAMPAIGN_SLUG } });
  if (!campaign || !isLive(campaign, now)) throw new Error("Convite de Johto indisponível.");
  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { active: true, user: { select: { status: true, role: true } } } });
  if (!isEligiblePlayer(player)) throw new Error("Jogador não elegível para esta votação.");
  const recipient = await prisma.johtoInvitationRecipient.findUnique({
    where: { campaignId_playerId: { campaignId: campaign.id, playerId } },
  });
  if (!recipient?.availableAt) throw new Error("Convite de Johto indisponível.");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "johto_invitation_recipients" WHERE "id" = ${recipient.id} AND "campaignId" = ${campaign.id} FOR UPDATE`;
    const locked = await tx.johtoInvitationRecipient.findUnique({ where: { id: recipient.id } });
    if (!locked?.openedAt) throw new Error("Abra o convite antes de votar.");
    if (locked.voteSubmittedAt) throw new Error("O voto já foi enviado e não pode ser alterado.");
    await tx.johtoInvitationVote.createMany({
      data: keys.map((questionKey) => ({
        campaignId: campaign.id,
        recipientId: recipient.id,
        questionKey,
        candidatePlayerId: answers[questionKey],
        candidateDisplayName: byId.get(answers[questionKey])!.displayName,
      })),
    });
    await tx.johtoInvitationRecipient.update({ where: { id: recipient.id }, data: { voteSubmittedAt: now } });
  });
  return getJohtoInvitationForPlayer(playerId, now);
}

export async function canPlayerAccessJohtoRaid(playerId: string, now = new Date()): Promise<boolean> {
  const campaign = await prisma.johtoInvitationCampaign.findUnique({ where: { slug: JOHTO_INVITATION_CAMPAIGN_SLUG } });
  if (!campaign || !isLive(campaign, now)) return false;
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { active: true, user: { select: { status: true, role: true } } },
  });
  if (!isEligiblePlayer(player)) return false;
  const recipient = await prisma.johtoInvitationRecipient.findUnique({
    where: { campaignId_playerId: { campaignId: campaign.id, playerId } },
  });
  return !!recipient?.availableAt && !!recipient.openedAt;
}

export async function runJohtoInvitationLaunch(now = new Date()): Promise<{ sent: number; recipients: number }> {
  const campaign = await prisma.johtoInvitationCampaign.findUnique({ where: { slug: JOHTO_INVITATION_CAMPAIGN_SLUG } });
  if (!campaign || !isLive(campaign, now) || campaign.pushSentAt) return { sent: 0, recipients: 0 };

  await prepareJohtoInvitationCampaign({ now });
  await prisma.johtoInvitationCampaign.updateMany({
    where: { id: campaign.id, pushStartedAt: null },
    data: { pushStartedAt: now },
  });
  const recipients = await prisma.johtoInvitationRecipient.findMany({
    where: {
      campaignId: campaign.id,
      availableAt: { not: null },
      player: { active: true, user: { status: "ACTIVE", role: { notIn: [...ADMIN_ROLES] } } },
    },
    select: { id: true, pushSentAt: true, player: { select: { userId: true } } },
  });
  let sent = 0;
  for (const recipient of recipients) {
    if (recipient.pushSentAt) continue;
    const eventKey = `johto-invitation:${campaign.id}:${recipient.id}`;
    try {
      await prisma.pushNotificationMarker.create({ data: { eventKey } });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") continue;
      throw error;
    }
    try {
      const result = await sendNotificationToUsers([recipient.player.userId], {
        ...JOHTO_INVITATION_PUSH,
        data: { eventKey },
        category: "ANUNCIOS",
      });
      sent += result.sent;
      if (result.sent > 0) {
        await prisma.johtoInvitationRecipient.updateMany({
          where: { id: recipient.id, pushSentAt: null },
          data: { pushSentAt: now },
        });
      }
    } catch (error) {
      console.error("[JohtoInvitation] push", { recipientId: recipient.id, error });
    }
  }
  await prisma.johtoInvitationCampaign.updateMany({
    where: { id: campaign.id, pushSentAt: null },
    data: { pushSentAt: now },
  });
  return { sent, recipients: recipients.length };
}

export async function getJohtoInvitationAdminSummary() {
  const campaign = await prisma.johtoInvitationCampaign.findUnique({ where: { slug: JOHTO_INVITATION_CAMPAIGN_SLUG } });
  const emptyResults = Object.fromEntries(JOHTO_VOTE_QUESTIONS.map(({ key }) => [key, []])) as unknown as Record<JohtoVoteQuestionKey, { candidatePlayerId: string | null; candidateDisplayName: string; count: number }[]>;
  if (!campaign) return { campaign: null, counts: { recipients: 0, delivered: 0, pushSent: 0, opened: 0, skipped: 0, voted: 0 }, results: emptyResults };
  const [recipients, votes] = await Promise.all([
    prisma.johtoInvitationRecipient.findMany({ where: { campaignId: campaign.id }, select: { availableAt: true, openedAt: true, votingSkippedAt: true, voteSubmittedAt: true, pushSentAt: true } }),
    prisma.johtoInvitationVote.findMany({ where: { campaignId: campaign.id }, select: { questionKey: true, candidatePlayerId: true, candidateDisplayName: true } }),
  ]);
  const grouped = new Map<string, { candidatePlayerId: string | null; candidateDisplayName: string; count: number }>();
  for (const vote of votes) {
    if (!JOHTO_VOTE_QUESTIONS.some(({ key }) => key === vote.questionKey)) continue;
    const groupKey = `${vote.questionKey}:${vote.candidatePlayerId ?? `deleted:${vote.candidateDisplayName}`}`;
    const current = grouped.get(groupKey);
    if (current) current.count++;
    else grouped.set(groupKey, { candidatePlayerId: vote.candidatePlayerId, candidateDisplayName: vote.candidateDisplayName, count: 1 });
  }
  for (const [key, result] of grouped) {
    const questionKey = key.slice(0, key.indexOf(":")) as JohtoVoteQuestionKey;
    emptyResults[questionKey].push(result);
  }
  for (const rows of Object.values(emptyResults)) rows.sort((a, b) => b.count - a.count || a.candidateDisplayName.localeCompare(b.candidateDisplayName, "pt-BR"));
  return {
    campaign: { launchAt: campaign.launchAt.toISOString(), publishedAt: campaign.publishedAt?.toISOString() ?? null },
    counts: {
      recipients: recipients.length,
      delivered: recipients.filter((row) => !!row.availableAt).length,
      pushSent: recipients.filter((row) => !!row.pushSentAt).length,
      opened: recipients.filter((row) => !!row.openedAt).length,
      skipped: recipients.filter((row) => !!row.votingSkippedAt).length,
      voted: recipients.filter((row) => !!row.voteSubmittedAt).length,
    },
    results: emptyResults,
  };
}
