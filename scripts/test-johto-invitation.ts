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
