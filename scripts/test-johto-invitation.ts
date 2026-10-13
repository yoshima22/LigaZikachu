import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import {
  JOHTO_INVITATION_COPY,
  JOHTO_INVITATION_LAUNCH_AT,
  JOHTO_VOTE_QUESTIONS,
} from "../src/lib/johto-invitation-copy";

assert.equal(JOHTO_INVITATION_LAUNCH_AT.toISOString(), "2026-10-14T11:00:00.000Z");
assert.deepEqual(JOHTO_VOTE_QUESTIONS, [
  { key: "most_creative", label: "Quem é o jogador mais criativo dessa edição?" },
  { key: "breakthrough", label: "Quem foi a grande revelação dessa edição?" },
  { key: "most_tactical", label: "Quem foi o jogador mais tático dessa edição?" },
  { key: "most_underrated", label: "Quem foi o jogador mais injustiçado dessa edição?" },
  { key: "deserved_champion", label: "Quem merecia ser o campeão dessa edição?" },
  { key: "most_overpowered", label: "Quem foi o jogador mais apelão dessa edição?" },
]);

assert.deepEqual(JOHTO_INVITATION_COPY, {
  title: "Convite especial de Johto",
  greeting: "Olá, Treinador!",
  pages: [
    {
      paragraphs: [
        "Os Líderes de Ginásio de Johto estão animados com a Liga Zikachu TCG acontecendo nas proximidades e querem dar mais um grande show de batalhas para apoiar esta etapa final.",
        "Por isso, Falkner, Bugsy, Whitney, Morty, Chuck, Jasmine, Pryce e Clair desafiaram toda a comunidade da Liga Zikachu.",
      ],
    },
    {
      heading: "Como funcionam os Ginásios de Johto",
      paragraphs: [
        "Os oito líderes são enfrentados em sequência. Cada líder tem seis mascotes e uma barra de vida compartilhada por toda a comunidade.",
        "Cada líder fica disponível por até cinco dias. Se o tempo acabar, não há recompensa por esse líder.",
        "Sua equipe usa até seis mascotes gratuitos, e o dano causado é coletivo.",
      ],
    },
    {
      heading: "Atenção à recuperação",
      paragraphs: [
        "Depois de atacar, aguarde 20 minutos para poder atacar de novo.",
        "Mascotes que caírem vão para o SUS, como na Arena-Z, e podem ser recuperados.",
      ],
    },
    {
      heading: "Recompensas",
      paragraphs: [
        "Quem participar recebe ZC e escolhe um mascote do líder. As recompensas do pódio são maiores, e o golpe final garante um ovo especial com raridade extra.",
      ],
    },
    {
      heading: "Prepare sua equipe",
      paragraphs: ["Combates → Líderes de Johto"],
    },
    {
      paragraphs: [
        "Johto está em festa. Reúna sua equipe, ajude a comunidade e deixe sua marca nesta reta final da Liga Zikachu TCG!",
        "— Professor Enguiça",
      ],
    },
  ],
  voting: {
    title: "Antes de partir para Johto…",
    description: "A votação é opcional e secreta. Cada voto pode ser enviado apenas uma vez.",
    participateLabel: "Participar da votação",
    continueLabel: "Continuar para os Ginásios",
  },
});

const models = new Map(Prisma.dmmf.datamodel.models.map((model) => [model.name, model]));
const campaign = models.get("JohtoInvitationCampaign");
const recipient = models.get("JohtoInvitationRecipient");
const vote = models.get("JohtoInvitationVote");
assert.ok(campaign && recipient && vote, "Prisma client exposes all invitation models");
assert.ok(campaign.fields.some((field) => field.name === "slug" && field.isUnique), "campaign slug is unique");
assert.ok(recipient.uniqueFields.some((fields) => fields.join(",") === "campaignId,playerId"));
assert.ok(recipient.uniqueFields.some((fields) => fields.join(",") === "id,campaignId"), "recipient exposes a composite key for campaign-scoped vote references");
assert.ok(vote.uniqueFields.some((fields) => fields.join(",") === "campaignId,recipientId,questionKey"));
for (const field of ["availableAt", "openedAt", "votingSkippedAt", "voteSubmittedAt", "pushSentAt"]) {
  assert.ok(recipient.fields.some((candidate) => candidate.name === field), `recipient stores ${field}`);
}
for (const field of ["candidatePlayerId", "candidateDisplayName"]) {
  assert.ok(vote.fields.some((candidate) => candidate.name === field), `vote stores ${field}`);
}
const voteRecipientRelation = vote.fields.find((field) => field.name === "recipient");
assert.deepEqual(voteRecipientRelation?.relationFromFields, ["recipientId", "campaignId"]);
assert.deepEqual(voteRecipientRelation?.relationToFields, ["id", "campaignId"]);
const candidateIdField = vote.fields.find((field) => field.name === "candidatePlayerId");
assert.equal(candidateIdField?.isRequired, false, "candidate deletion leaves the historical vote snapshot intact");
assert.equal(vote.fields.find((field) => field.name === "candidatePlayer")?.relationOnDelete, "SetNull");

const migration = readFileSync(join(process.cwd(), "prisma/migrations-manual/047_johto_invitation.sql"), "utf8");
for (const table of ["johto_invitation_campaigns", "johto_invitation_recipients", "johto_invitation_votes"]) {
  assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS "${table}"`));
  assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`));
}
assert.match(migration, /REFERENCES "players"\("id"\) ON DELETE CASCADE/);
assert.match(migration, /REFERENCES "johto_invitation_campaigns"\("id"\) ON DELETE CASCADE/);
assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "johto_invitation_recipients_campaignId_playerId_key"/);
assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "johto_invitation_recipients_id_campaignId_key"/);
assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS "johto_invitation_votes_campaignId_recipientId_questionKey_key"/);
assert.match(migration, /FOREIGN KEY \("recipientId", "campaignId"\)\s+REFERENCES "johto_invitation_recipients"\("id", "campaignId"\) ON DELETE CASCADE/);
assert.match(migration, /FOREIGN KEY \("candidatePlayerId"\) REFERENCES "players"\("id"\) ON DELETE SET NULL/);

console.log("ok copy, data de lançamento e contrato de persistência do convite de Johto");

(async () => {
if (process.argv.includes("--service")) {
  type Row = Record<string, any>;
  const before = new Date("2026-10-14T10:59:59.999Z");
  const after = new Date("2026-10-14T11:00:00.000Z");
  const questions = JOHTO_VOTE_QUESTIONS.map(({ key }) => key);
  const answers = Object.fromEntries(questions.map((key) => [key, "candidate-1"])) as Record<(typeof questions)[number], string>;
  const players: Row[] = [
    { id: "voter", displayName: "Eleitor", active: true, user: { status: "ACTIVE", role: "PLAYER" } },
    { id: "candidate-1", displayName: "Primeiro", active: true, user: { status: "ACTIVE", role: "PLAYER" } },
    { id: "candidate-2", displayName: "Segundo", active: true, user: { status: "ACTIVE", role: "PLAYER" } },
    { id: "candidate-3", displayName: "Terceiro", active: false, user: { status: "SUSPENDED", role: "PLAYER" } },
    { id: "admin", displayName: "Admin", active: true, user: { status: "ACTIVE", role: "ADMIN" } },
    { id: "pending", displayName: "Pendente", active: true, user: { status: "PENDING_APPROVAL", role: "PLAYER" } },
  ];
  const registrations: Row[] = [
    { tournamentId: "tournament-3", playerId: "candidate-1", status: "APPROVED" },
    { tournamentId: "tournament-3", playerId: "candidate-2", status: "APPROVED" },
    { tournamentId: "tournament-3", playerId: "candidate-3", status: "APPROVED" },
    { tournamentId: "tournament-3", playerId: "admin", status: "APPROVED" },
    { tournamentId: "old-tournament", playerId: "voter", status: "APPROVED" },
  ];
  const campaigns: Row[] = [];
  const recipients: Row[] = [];
  const votes: Row[] = [];
  let tournamentAvailable = true;
  const eligible = (player: Row) => player.active && player.user.status === "ACTIVE" && !["ADMIN", "SUPER_ADMIN"].includes(player.user.role);
  const recipientBy = (campaignId: string, playerId: string) => recipients.find((row) => row.campaignId === campaignId && row.playerId === playerId);
  const database: Row = {
    tournament: {
      findUnique: async ({ where }: Row) => tournamentAvailable && where.slug === "liga-zikachu-3-edicao-rumo-a-johto" ? { id: "tournament-3", name: "Liga Zikachu 3" } : null,
    },
    player: {
      findUnique: async ({ where }: Row) => players.find((row) => row.id === where.id) ?? null,
      findMany: async ({ where }: Row) => players.filter((row) => eligible(row) && (!where?.id?.in || where.id.in.includes(row.id))),
    },
    tournamentRegistration: {
      findMany: async ({ where }: Row) => registrations.filter((row) => row.tournamentId === where.tournamentId && row.status === where.status)
        .map((row) => ({ ...row, player: players.find((player) => player.id === row.playerId) })),
    },
    johtoInvitationCampaign: {
      findUnique: async ({ where }: Row) => campaigns.find((row) => row.slug === where.slug) ?? null,
      upsert: async ({ where, create, update }: Row) => {
        let row = campaigns.find((item) => item.slug === where.slug);
        if (row) Object.assign(row, update);
        else { row = { id: `campaign-${campaigns.length + 1}`, publishedAt: null, ...create }; campaigns.push(row as Row); }
        return row;
      },
    },
    johtoInvitationRecipient: {
      findUnique: async ({ where }: Row) => {
        if (where.campaignId_playerId) return recipientBy(where.campaignId_playerId.campaignId, where.campaignId_playerId.playerId) ?? null;
        return recipients.find((row) => row.id === where.id) ?? null;
      },
      findMany: async ({ where }: Row) => recipients.filter((row) => row.campaignId === where.campaignId),
      upsert: async ({ where, create, update }: Row) => {
        let row = recipientBy(where.campaignId_playerId.campaignId, where.campaignId_playerId.playerId);
        if (row) Object.assign(row, update);
        else { row = { id: `recipient-${recipients.length + 1}`, openedAt: null, votingSkippedAt: null, voteSubmittedAt: null, pushSentAt: null, ...create }; recipients.push(row as Row); }
        return row;
      },
      updateMany: async ({ where, data }: Row) => {
        const rows = recipients.filter((row) => row.id === where.id && Object.entries(where).every(([key, value]) => key === "id" || row[key] === value));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
      update: async ({ where, data }: Row) => {
        const row = recipients.find((item) => item.id === where.id);
        assert.ok(row);
        Object.assign(row, data);
        return row;
      },
    },
    johtoInvitationVote: {
      createMany: async ({ data }: Row) => { votes.push(...data); return { count: data.length }; },
      findMany: async ({ where }: Row) => votes.filter((row) => row.campaignId === where.campaignId),
    },
    $queryRaw: async () => [],
    $transaction: async (callback: (tx: Row) => Promise<unknown>) => {
      const recipientsBefore = recipients.map((row) => ({ ...row }));
      const votesBefore = votes.map((row) => ({ ...row }));
      try { return await callback(database); }
      catch (error) { recipients.splice(0, recipients.length, ...recipientsBefore); votes.splice(0, votes.length, ...votesBefore); throw error; }
    },
  };
  (globalThis as Row).prisma = database;
  const service = await import("../src/lib/johto-invitation");

  await service.prepareJohtoInvitationCampaign({ publish: true, now: before });
  assert.equal(recipients.length, 0, "prelaunch preparation does not deliver invitations");
  assert.equal((await service.getJohtoInvitationForPlayer("voter", before)).available, false);
  await assert.rejects(service.openJohtoInvitation("voter", before));
  assert.equal(recipients.length, 0, "opening before launch does not create a recipient");

  await service.prepareJohtoInvitationCampaign({ now: after });
  assert.deepEqual(recipients.map((row) => row.playerId).sort(), ["candidate-1", "candidate-2", "voter"]);
  assert.deepEqual((await service.getJohtoInvitationForPlayer("voter", after)).candidates.map((candidate: Row) => candidate.id), ["candidate-1", "candidate-2", "candidate-3"], "accepted participants remain candidates even if their accounts later become inactive");
  assert.equal((await service.getJohtoInvitationForPlayer("admin", after)).available, false);
  assert.equal((await service.getJohtoInvitationForPlayer("pending", after)).available, false);

  const opened = await service.openJohtoInvitation("voter", after);
  const firstOpenedAt = opened.openedAt;
  assert.ok(firstOpenedAt);
  assert.equal((await service.openJohtoInvitation("voter", new Date(after.getTime() + 1000))).openedAt, firstOpenedAt);
  assert.equal(await service.canPlayerAccessJohtoRaid("voter", after), true);
  const skipped = await service.skipJohtoInvitationVote("voter", after);
  assert.ok(skipped.votingSkippedAt);
  assert.equal(await service.canPlayerAccessJohtoRaid("voter", after), true);

  await assert.rejects(service.submitJohtoInvitationVote("voter", { ...answers, breakthrough: "" }, after));
  const incomplete = { ...answers } as Row;
  delete incomplete.breakthrough;
  await assert.rejects(service.submitJohtoInvitationVote("voter", incomplete, after));
  await assert.rejects(service.submitJohtoInvitationVote("voter", { ...answers, breakthrough: "admin" }, after));
  await assert.rejects(service.submitJohtoInvitationVote("voter", { ...answers, breakthrough: "voter" }, after));
  assert.equal(votes.length, 0, "invalid votes never partially persist");
  const submitted = await service.submitJohtoInvitationVote("voter", answers, after);
  assert.ok(submitted.voteSubmittedAt);
  assert.equal(votes.length, 6);
  assert.deepEqual(votes.map((row) => row.questionKey), questions);
  assert.ok(votes.every((row) => row.candidatePlayerId === "candidate-1" && row.candidateDisplayName === "Primeiro"));
  await assert.rejects(service.submitJohtoInvitationVote("voter", Object.fromEntries(questions.map((key) => [key, "candidate-2"])) as typeof answers, after));
  assert.ok(votes.every((row) => row.candidatePlayerId === "candidate-1"), "second submit cannot overwrite answers");
  await service.openJohtoInvitation("candidate-2", after);
  const directVote = await service.submitJohtoInvitationVote("candidate-2", answers, after);
  assert.equal(directVote.votingSkippedAt, null, "submitting directly must not record a skip");
  const summary = await service.getJohtoInvitationAdminSummary();
  assert.equal(summary.counts.recipients, 3);
  assert.equal(summary.counts.opened, 2);
  assert.equal(summary.counts.skipped, 1);
  assert.equal(summary.counts.voted, 2);
  assert.equal(summary.results.most_creative[0].count, 2);
  votes[0].candidatePlayerId = null;
  votes[6].candidatePlayerId = null;
  assert.equal((await service.getJohtoInvitationAdminSummary()).results.most_creative[0].candidateDisplayName, "Primeiro");
  assert.equal((await service.getJohtoInvitationAdminSummary()).results.most_creative[0].count, 2, "deleted candidates group by stored name");
  tournamentAvailable = false;
  assert.equal(await service.canPlayerAccessJohtoRaid("voter", after), true, "access depends on the opened invitation, not the later tournament lookup");
  console.log("ok serviço de convite: lançamento, elegibilidade, abertura, acesso, voto único e resumo");
}
})().catch((error) => { console.error(error); process.exitCode = 1; });
