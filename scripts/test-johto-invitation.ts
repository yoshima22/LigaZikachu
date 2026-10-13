import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInThisContext } from "node:vm";
import { Prisma } from "@prisma/client";
import ts from "typescript";
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
        "Sua equipe usa até seis mascotes, e o dano causado é coletivo.",
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
      paragraphs: ["O evento está disponível em Combates → Líderes de Johto. Prepare sua equipe e acompanhe o progresso coletivo dos líderes por lá."],
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
    description: "Esta é uma votação opcional e confidencial de reconhecimento dos jogadores da Liga Zikachu TCG 3ª Edição. São seis categorias e você pode enviar suas escolhas apenas uma vez.",
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
      findUnique: async ({ where }: Row) => {
        const row = campaigns.find((item) => item.slug === where.slug);
        return row ? { ...row } : null;
      },
      findUniqueOrThrow: async ({ where }: Row) => {
        const row = campaigns.find((item) => item.id === where.id);
        assert.ok(row);
        return { ...row };
      },
      upsert: async ({ where, create, update }: Row) => {
        let row = campaigns.find((item) => item.slug === where.slug);
        if (row) Object.assign(row, update);
        else { row = { id: `campaign-${campaigns.length + 1}`, publishedAt: null, ...create }; campaigns.push(row as Row); }
        return row;
      },
      updateMany: async ({ where, data }: Row) => {
        const rows = campaigns.filter((row) => row.slug === where.slug && row.publishedAt === where.publishedAt);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
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

  assert.deepEqual(await service.getJohtoInvitationPreviewCandidates(), [
    { id: "candidate-1", displayName: "Primeiro" },
    { id: "candidate-2", displayName: "Segundo" },
    { id: "candidate-3", displayName: "Terceiro" },
  ], "admin preview uses actual approved third-edition participant names");
  assert.equal(recipients.length, 0, "reading preview candidates creates no recipients");

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
  tournamentAvailable = true;
  campaigns[0].publishedAt = null;
  await Promise.all([
    service.prepareJohtoInvitationCampaign({ publish: true, now: new Date("2026-10-14T11:00:01.000Z") }),
    service.prepareJohtoInvitationCampaign({ publish: true, now: new Date("2026-10-14T11:00:02.000Z") }),
  ]);
  assert.equal(campaigns[0].publishedAt.toISOString(), "2026-10-14T11:00:01.000Z", "concurrent publication must preserve the first timestamp");
  console.log("ok serviço de convite: lançamento, elegibilidade, abertura, acesso, voto único e resumo");
}
if (process.argv.includes("--actions")) {
  type Row = Record<string, any>;
  let session: Row | null = null;
  const calls: { method: string; playerId?: string; answers?: Row; publish?: boolean }[] = [];
  const revalidated: string[] = [];
  const state = { available: true, openedAt: null, votingSkippedAt: null, voteSubmittedAt: null, candidates: [] };
  const summary = { campaign: null, counts: { recipients: 0, delivered: 0, pushSent: 0, opened: 0, skipped: 0, voted: 0 }, results: {} };
  const service = {
    JOHTO_INVITATION_PUSH: { title: "Ginásios de Johto", body: "Johto em festa com a etapa final da Liga Zikachu TCG", url: "/combates/raid-johto" },
    getJohtoInvitationForPlayer: async (playerId: string) => { calls.push({ method: "get", playerId }); return state; },
    openJohtoInvitation: async (playerId: string) => { calls.push({ method: "open", playerId }); return { ...state, openedAt: "opened" }; },
    skipJohtoInvitationVote: async (playerId: string) => { calls.push({ method: "skip", playerId }); return { ...state, votingSkippedAt: "skipped" }; },
    submitJohtoInvitationVote: async (playerId: string, answers: Row) => { calls.push({ method: "vote", playerId, answers }); return { ...state, voteSubmittedAt: "voted" }; },
    prepareJohtoInvitationCampaign: async ({ publish }: { publish: boolean }) => { calls.push({ method: "prepare", publish }); return {}; },
    getJohtoInvitationAdminSummary: async () => { calls.push({ method: "summary" }); return summary; },
  };
  const testPushes: { userIds: string[] | null; payload: Row }[] = [];
  const mocks: Row = {
    "@/lib/auth/permissions": { getSessionUser: async () => session, isAdmin: (role: string) => role === "ADMIN" || role === "SUPER_ADMIN" },
    "@/lib/prisma": { prisma: { player: { findUnique: async ({ where }: Row) => where.userId === "user-1" ? { id: "player-1" } : where.userId === "admin-user" ? { id: "admin-player" } : null } } },
    "@/lib/johto-invitation": service,
    "@/lib/johto-raid": { getJohtoEvent: async () => null },
    "@/lib/notifications": { sendNotificationToUsers: async (userIds: string[] | null, payload: Row) => {
      testPushes.push({ userIds, payload });
      return { configured: true, users: 1, tokenCount: 1, sent: 1, failed: 0 };
    } },
    "next/cache": { revalidatePath: (path: string, type?: string) => revalidated.push(`${path}:${type ?? "page"}`) },
  };
  function loadAction(file: string): Row {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} as Row };
    const localRequire = (name: string) => {
      if (name in mocks) return mocks[name];
      if (name === "@/lib/johto-invitation-copy") return { JOHTO_VOTE_QUESTIONS };
      throw new Error(`Unexpected action dependency: ${name}`);
    };
    runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  const playerActions = loadAction("src/app/(app)/combates/raid-johto/invitation-actions.ts");
  const raidActions = loadAction("src/app/(app)/combates/raid-johto/actions.ts");
  const emptyForm = new FormData();
  assert.equal(await playerActions.getJohtoInvitationAction(), null, "anonymous reader gets no state");
  assert.equal((await playerActions.openJohtoInvitationAction()).ok, false, "anonymous opener cannot transition");
  assert.equal((await raidActions.johtoAdminAction({ type: "getInvitationAdminSummary" })).ok, false, "anonymous summary is blocked");
  assert.equal(calls.length, 0, "anonymous requests never reach invitation service");

  session = { id: "user-1", role: "PLAYER" };
  assert.equal(await playerActions.getJohtoInvitationAction(), state);
  assert.equal((await raidActions.johtoAdminAction({ type: "getInvitationAdminSummary" })).ok, false, "player summary is blocked");
  assert.equal((await raidActions.johtoAdminAction({ type: "prepareInvitation" })).ok, false, "player campaign preparation is blocked");
  assert.equal((await raidActions.johtoAdminAction({ type: "publishInvitation" })).ok, false, "player publication is blocked");
  assert.equal((await raidActions.johtoAdminAction({ type: "sendInvitationTestPush" })).ok, false, "player test push is blocked");
  assert.deepEqual(calls.map(({ method, playerId }) => ({ method, playerId })), [{ method: "get", playerId: "player-1" }]);

  emptyForm.set("playerId", "other-player");
  await playerActions.openJohtoInvitationAction(emptyForm);
  await playerActions.skipJohtoInvitationVoteAction(emptyForm);
  const voteForm = new FormData();
  voteForm.set("playerId", "other-player");
  for (const { key } of JOHTO_VOTE_QUESTIONS) voteForm.set(key, `candidate-${key}`);
  voteForm.set("unrecognized", "intruder");
  assert.equal((await playerActions.submitJohtoInvitationVoteAction(voteForm)).ok, true);
  const submittedAnswers = calls.at(-1)?.answers;
  assert.deepEqual(calls.slice(1).map(({ method, playerId }) => ({ method, playerId })), [
    { method: "open", playerId: "player-1" }, { method: "skip", playerId: "player-1" }, { method: "vote", playerId: "player-1" },
  ], "all transitions use the authenticated player's ID");
  assert.deepEqual(submittedAnswers, Object.fromEntries(JOHTO_VOTE_QUESTIONS.map(({ key }) => [key, `candidate-${key}`])), "vote action forwards exactly six named answers");
  assert.ok(revalidated.includes("/combates/raid-johto:page"));
  assert.ok(revalidated.includes("/:layout"), "state changes refresh the authenticated layout");

  session = { id: "admin-user", role: "ADMIN" };
  const beforePreview = calls.length;
  const adminSummary = await raidActions.johtoAdminAction({ type: "getInvitationAdminSummary" });
  assert.equal(adminSummary.invitationSummary, summary);
  assert.deepEqual(calls.slice(beforePreview), [{ method: "summary" }], "admin summary/preview does not create recipients or publish");
  await raidActions.johtoAdminAction({ type: "prepareInvitation" });
  await raidActions.johtoAdminAction({ type: "publishInvitation" });
  assert.deepEqual(calls.slice(beforePreview + 1), [{ method: "prepare", publish: false }, { method: "prepare", publish: true }]);
  const beforePush = calls.length;
  const push = await raidActions.johtoAdminAction({ type: "sendInvitationTestPush" });
  assert.equal(push.ok, true, "admin can send a launch-copy test push");
  assert.deepEqual(testPushes, [{ userIds: ["admin-user"], payload: {
    title: "Ginásios de Johto",
    body: "Johto em festa com a etapa final da Liga Zikachu TCG",
    url: "/combates/raid-johto",
    data: { source: "johto-invitation-test" },
    category: "ANUNCIOS",
  } }], "test push has the launch copy and only targets the caller");
  assert.equal(calls.length, beforePush, "test push cannot publish or transition invitation state");
  console.log("ok ações do convite: sessão, escopo individual, admin e prévia sem persistência");
}
if (process.argv.includes("--push")) {
  type Row = Record<string, any>;
  const before = new Date("2026-10-14T10:59:59.999Z");
  const launch = new Date("2026-10-14T11:00:00.000Z");
  const campaign: Row = { id: "campaign-1", slug: "johto-invitation-2026", launchAt: launch, publishedAt: before, pushStartedAt: null, pushSentAt: null };
  const players: Row[] = [
    { id: "player-1", userId: "user-1", active: true, user: { status: "ACTIVE", role: "PLAYER" } },
    { id: "player-2", userId: "user-2", active: true, user: { status: "ACTIVE", role: "PLAYER" } },
    { id: "offline", userId: "offline-user", active: true, user: { status: "ACTIVE", role: "PLAYER" } },
    { id: "admin", userId: "admin-user", active: true, user: { status: "ACTIVE", role: "ADMIN" } },
    { id: "pending", userId: "pending-user", active: true, user: { status: "PENDING_APPROVAL", role: "PLAYER" } },
  ];
  const recipients: Row[] = [];
  const markers = new Set<string>();
  let markerDbDown = false;
  const pushes: { userIds: string[] | null; payload: Row }[] = [];
  const database: Row = {
    tournament: { findUnique: async () => ({ id: "tournament-3", name: "Liga Zikachu 3" }) },
    johtoInvitationCampaign: {
      findUnique: async ({ where }: Row) => where.slug === campaign.slug ? { ...campaign } : null,
      upsert: async () => ({ ...campaign }),
      updateMany: async ({ where, data }: Row) => {
        if (where.id !== campaign.id) return { count: 0 };
        Object.assign(campaign, data);
        return { count: 1 };
      },
    },
    player: { findMany: async () => players.filter((player) => player.active && player.user.status === "ACTIVE" && player.user.role === "PLAYER") },
    johtoInvitationRecipient: {
      upsert: async ({ where, create }: Row) => {
        let row = recipients.find((item) => item.campaignId === where.campaignId_playerId.campaignId && item.playerId === where.campaignId_playerId.playerId);
        if (!row) { row = { id: `recipient-${recipients.length + 1}`, openedAt: null, votingSkippedAt: null, voteSubmittedAt: null, pushSentAt: null, ...create }; recipients.push(row as Row); }
        return row;
      },
      findMany: async ({ where }: Row) => recipients.filter((row) => row.campaignId === where.campaignId && row.availableAt)
        .map((row) => ({ ...row, player: players.find((player) => player.id === row.playerId) })),
      updateMany: async ({ where, data }: Row) => {
        const rows = recipients.filter((row) => row.id === where.id && row.pushSentAt === where.pushSentAt);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    pushNotificationMarker: { create: async ({ data }: Row) => {
      if (markerDbDown) throw new Error("marker database unavailable");
      if (markers.has(data.eventKey)) throw Object.assign(new Error("unique marker"), { code: "P2002" });
      markers.add(data.eventKey);
      return { id: `marker-${markers.size}`, eventKey: data.eventKey };
    } },
  };
  const notifications = { sendNotificationToUsers: async (userIds: string[] | null, payload: Row) => {
    pushes.push({ userIds, payload });
    return userIds?.[0] === "offline-user"
      ? { configured: true, users: 1, tokenCount: 1, sent: 0, failed: 1 }
      : { configured: true, users: 1, tokenCount: 1, sent: 1, failed: 0 };
  } };
  function loadModule(file: string, mocks: Row): Row {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const loaded = { exports: {} as Row };
    const localRequire = (name: string) => {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected push dependency: ${name}`);
    };
    runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }
  const service = loadModule("src/lib/johto-invitation.ts", {
    "@/lib/prisma": { prisma: database },
    "@/lib/johto-invitation-copy": { JOHTO_INVITATION_LAUNCH_AT, JOHTO_VOTE_QUESTIONS },
    "@/lib/notifications": notifications,
  });
  assert.deepEqual(await service.runJohtoInvitationLaunch(before), { sent: 0, recipients: 0 });
  assert.equal(recipients.length, 0, "before 08:00 BRT no letter recipient is written");
  assert.equal(pushes.length, 0, "before 08:00 BRT no push is sent");

  const concurrent = await Promise.all([service.runJohtoInvitationLaunch(launch), service.runJohtoInvitationLaunch(launch)]);
  assert.equal(concurrent.reduce((sum, result) => sum + result.sent, 0), 2, "parallel cron calls deliver once per recipient");
  assert.ok(concurrent.every((result) => result.recipients === 3));
  assert.deepEqual(pushes, ["user-1", "user-2", "offline-user"].map((userId, index) => ({ userIds: [userId], payload: {
    title: "Ginásios de Johto",
    body: "Johto em festa com a etapa final da Liga Zikachu TCG",
    url: "/combates/raid-johto",
    data: { eventKey: `johto-invitation:campaign-1:recipient-${index + 1}` },
    category: "ANUNCIOS",
  } })), "one exact launch push is sent to each eligible user");
  assert.equal(markers.size, 3, "each recipient has a unique claim marker");
  assert.ok(recipients.slice(0, 2).every((row) => row.pushSentAt?.toISOString() === launch.toISOString()));
  assert.equal(recipients[2].pushSentAt, null, "failed delivery is not marked sent");
  assert.ok(recipients[2].availableAt, "failed push still leaves the invitation available");
  assert.ok(recipients.every((row) => !row.openedAt && !row.votingSkippedAt && !row.voteSubmittedAt), "push cannot change invitation or vote state");
  assert.equal(campaign.pushSentAt?.toISOString(), launch.toISOString(), "completed launch is recorded at campaign level");
  players.push({ id: "late-player", userId: "late-user", active: true, user: { status: "ACTIVE", role: "PLAYER" } });
  assert.deepEqual(await service.runJohtoInvitationLaunch(new Date("2026-10-14T12:00:00.000Z")), { sent: 0, recipients: 0 });
  assert.equal(pushes.length, 3, "repeat launch does not send twice");
  assert.equal(recipients.length, 3, "later cron runs do not enroll new players in the one-time launch");
  campaign.pushSentAt = null; // Simulate an interrupted launch before its completion marker was written.
  markerDbDown = true;
  await assert.rejects(service.runJohtoInvitationLaunch(new Date("2026-10-14T11:00:01.000Z")), /marker database unavailable/);
  assert.equal(campaign.pushSentAt, null, "database claim failure leaves the launch retryable");
  markerDbDown = false;
  assert.deepEqual(await service.runJohtoInvitationLaunch(new Date("2026-10-14T11:00:02.000Z")), { sent: 1, recipients: 4 });
  assert.deepEqual(pushes.at(-1)?.userIds, ["late-user"], "retry only sends to the unclaimed recipient");

  const automation = loadModule("src/lib/push-automation.ts", {
    "@/lib/prisma": { prisma: { mascotExpedition: { findMany: async () => [] }, mascotBuff: { findMany: async () => [] }, weeklyMascotLeague: { findFirst: async () => null }, rushLeague: { findFirst: async () => null }, pushNotificationMarker: { deleteMany: async () => ({ count: 0 }) } } },
    "@/lib/notifications": notifications,
    "@/lib/mascot-data": { getPokemonName: () => "" },
    "@/lib/johto-invitation": { runJohtoInvitationLaunch: async (now: Date) => { assert.equal(now, launch); return { sent: 2, recipients: 2 }; } },
  });
  assert.deepEqual(await automation.runPushAutomation(launch), { success: true, sent: 2 }, "cron includes Johto launch delivery");
  console.log("ok push do convite: corte BRT, público elegível, payload, idempotência e cron");
}
if (process.argv.includes("--ui")) {
  const { johtoInvitationUiHarness } = await import("./test-johto-invitation-ui");
  await johtoInvitationUiHarness;
}
})().catch((error) => { console.error(error); process.exitCode = 1; });
