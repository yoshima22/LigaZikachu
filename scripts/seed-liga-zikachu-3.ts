import "dotenv/config";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { AchievementRarity, PrismaClient, TournamentStatus, WeekMode, WeekStatus } from "@prisma/client";
import { JOHTO_REWARD_CONFIG } from "../src/lib/tcg-tournament-rewards";

const prisma = new PrismaClient();
const TOURNAMENT_SLUG = "liga-zikachu-3-edicao-rumo-a-johto";
const SEASON_SLUG = "liga-zikachu-3-edicao";
const ADMIN_EMAIL = "admin@ligazikachu.com";
const START = new Date("2026-08-05T20:00:00-03:00");
const END = new Date("2026-09-25T23:59:59-03:00");

const manualNames = ["Luiz", "Rodrigo", "Erick", "Moises", "Alan", "Filemon", "Nakaima", "Cristian", "Glauco", "Allana", "Christiano"] as const;
const aliases: Record<(typeof manualNames)[number], string> = {
  Luiz: "Luiz", Rodrigo: "Rodrigo", Erick: "Érick Diniz", Moises: "Moisés", Alan: "Alan", Filemon: "Filemon",
  Nakaima: "Nakaima", Cristian: "Shira", Glauco: "Glauco", Allana: "Allana", Christiano: "Christiano Walter Prates de Lemos",
};

type FixedSide = { name?: (typeof manualNames)[number]; rank?: number };
type FixedMatch = { game: number; day: "WED" | "THU"; a: FixedSide; b: FixedSide };

const named = (game: number, day: "WED" | "THU", a: (typeof manualNames)[number], b: (typeof manualNames)[number]): FixedMatch => ({ game, day, a: { name: a }, b: { name: b } });
const ranked = (game: number, a: number, b: number): FixedMatch => ({ game, day: "THU", a: { rank: a }, b: { rank: b } });

const schedules: Record<number, FixedMatch[]> = {
  1: [named(1,"WED","Luiz","Cristian"),named(2,"WED","Erick","Nakaima"),named(3,"WED","Rodrigo","Glauco"),named(4,"THU","Rodrigo","Alan"),named(5,"THU","Erick","Filemon"),named(6,"THU","Luiz","Allana"),named(7,"THU","Moises","Christiano")],
  2: [named(1,"THU","Christiano","Luiz"),named(2,"THU","Luiz","Allana"),named(3,"THU","Allana","Rodrigo"),named(4,"THU","Rodrigo","Glauco"),named(5,"THU","Glauco","Erick"),named(6,"THU","Erick","Cristian"),named(7,"THU","Cristian","Moises"),named(8,"THU","Moises","Nakaima"),named(9,"THU","Nakaima","Alan"),named(10,"THU","Alan","Filemon"),named(11,"THU","Filemon","Christiano")],
  3: [named(1,"WED","Moises","Cristian"),named(2,"WED","Alan","Nakaima"),named(3,"WED","Filemon","Christiano"),named(4,"THU","Luiz","Glauco"),named(5,"THU","Erick","Moises"),named(6,"THU","Rodrigo","Allana"),named(7,"THU","Alan","Filemon")],
  4: [ranked(1,11,2),ranked(2,2,1),ranked(3,1,3),ranked(4,3,10),ranked(5,10,4),ranked(6,4,9),ranked(7,9,5),ranked(8,5,8),ranked(9,8,6),ranked(10,6,7),ranked(11,7,11)],
  5: [named(1,"WED","Luiz","Alan"),named(2,"WED","Allana","Christiano"),named(3,"WED","Filemon","Glauco"),named(4,"WED","Erick","Cristian"),named(5,"THU","Cristian","Allana"),named(6,"THU","Glauco","Christiano"),named(7,"THU","Rodrigo","Nakaima"),named(8,"THU","Moises","Nakaima")],
  6: [named(1,"THU","Christiano","Erick"),named(2,"THU","Erick","Rodrigo"),named(3,"THU","Rodrigo","Moises"),named(4,"THU","Moises","Luiz"),named(5,"THU","Luiz","Alan"),named(6,"THU","Alan","Allana"),named(7,"THU","Allana","Filemon"),named(8,"THU","Filemon","Glauco"),named(9,"THU","Glauco","Nakaima"),named(10,"THU","Nakaima","Cristian"),named(11,"THU","Cristian","Christiano")],
  7: [ranked(1,1,3),ranked(2,1,2),ranked(3,3,4),ranked(4,5,2),ranked(5,5,6),ranked(6,7,4),ranked(7,7,8),ranked(8,9,6),ranked(9,9,10),ranked(10,11,8),ranked(11,11,10)],
  8: [ranked(1,11,5),ranked(2,5,4),ranked(3,4,6),ranked(4,6,3),ranked(5,3,7),ranked(6,7,2),ranked(7,2,8),ranked(8,8,1),ranked(9,1,9),ranked(10,9,10),ranked(11,10,11)],
};

const weekDefs = [
  { n:1, label:"Semana 1 - Formato Padrao", mode:WeekMode.PADRAO, notes:"Sem restricao e sem bonus. Jogos de quarta e quinta conforme o regulamento." },
  { n:2, label:"Semana 2 - GLC Ajustado", mode:WeekMode.GLC, notes:"Deck monotipo de Pokedex. Cada vitoria vale 3 + 1 ponto." },
  { n:3, label:"Semana 3 - Formato Padrao", mode:WeekMode.PADRAO, notes:"Sem restricao e sem bonus. Rotacao de carga definida no regulamento." },
  { n:4, label:"Semana 4 - Duplas Sincronizadas", mode:WeekMode.DUPLAS_SINCRONIZADAS, notes:"Duplas por ranking bloqueado: 1+11, 2+10, 3+9, 4+8, 5+7 e Ranking 6 como Espelho. Campeoes recebem +3 cada." },
  { n:5, label:"Semana 5 - Formato Padrao", mode:WeekMode.PADRAO, notes:"Semana padrao sem multiplicadores ou pontos coletivos." },
  { n:6, label:"Semana 6 - Construtor Misterioso", mode:WeekMode.CONSTRUTOR_MISTERIOSO, notes:"Tres listas com pelo menos 15 cartas diferentes; o adversario escolhe. Cada vitoria vale 3 + 1 ponto." },
  { n:7, label:"Semana 7 - Guerra de Times", mode:WeekMode.GUERRA_DE_TIMES, notes:"Vanguarda Psiquica: ranks impares. Distrito Draconico: ranks pares. Equipe vencedora por media recebe +2 por integrante." },
  { n:8, label:"Semana 8 - Batalha Final", mode:WeekMode.BATALHA_FINAL, notes:"Bonus por vitoria congelado pelo ranking inicial da semana: +1 a +6 conforme a faixa." },
];

const achievements = [
  ["ATAQUE_IMPECAVEL","Ataque Impecavel","Venca sem recuar e sem usar efeitos que troquem o Pokemon Ativo.","COMMON",2],
  ["FIDELIDADE_ESTILO","Fidelidade de Estilo","Venca as duas partidas oficiais da mesma semana com a mesma lista de 60 cartas.","COMMON",2],
  ["BANCO_COMPLETO","Banco Completo","Venca depois de manter cinco Pokemon no Banco ao mesmo tempo.","COMMON",2],
  ["EVOLUCAO_PLANEJADA","Evolucao Planejada","Venca depois de colocar em jogo tres Pokemon evoluidos diferentes.","COMMON",2],
  ["MESTRE_ESTADIOS","Mestre dos Estadios","Venca depois de jogar tres Estadios de nomes diferentes.","COMMON",2],
  ["RECICLADOR_EXPERIENTE","Reciclador Experiente","Venca apos recuperar pelo menos seis cartas do descarte.","COMMON",2],
  ["VITORIA_SEM_EX","Vitoria Sem Ex","Venca sem usar Pokemon ex no deck.","COMMON",2],
  ["ULTIMO_RECURSO","Ultimo Recurso","Venca com cinco ou menos cartas restantes no baralho.","COMMON",2],
  ["FINALIZADOR_AGIL","Finalizador Agil","Pegue quatro ou mais Premios em uma unica investida.","RARE",3],
  ["VIRADA_ZIKACHU","Virada Zikachu","Venca depois que o adversario chegou a dois ou menos Premios.","RARE",3],
  ["CACADOR_FORMAS","Cacador de Formas","Nocauteie dois Pokemon ex ou Mega Evolucoes e venca.","RARE",3],
  ["RESERVA_ELEMENTAL","Reserva Elemental","Venca terminando com pelo menos quatro Energias Especiais no descarte.","RARE",3],
  ["MINIMALISTA_ESTRATEGICO","Minimalista Estrategico","Venca com no maximo oito cartas de Treinador no deck.","RARE",3],
  ["CONTROLE_MESA","Controle de Mesa","Venca defendendo cinco ou mais Premios.","RARE",3],
  ["LINHA_PRODUCAO","Linha de Producao","Coloque em jogo uma linha completa de Basico, Estagio 1 e Estagio 2 e venca.","RARE",3],
  ["INVENCIVEL_DIA","Invencivel do Dia","Venca as duas partidas do dia cedendo no maximo dois Premios no total.","LEGENDARY",4],
  ["MILAGRE_FINAL","Milagre Final","Venca exatamente no turno em que comprou a ultima carta do baralho.","LEGENDARY",4],
  ["ACHEI_FACIL","Achei Facil","Venca com menos de cinco cartas no baralho e sem Pokemon no Banco no golpe final.","LEGENDARY",4],
  ["HABILIDADE_VITALIDADE","Habilidade e Vitalidade","Venca usando apenas Pokemon com Habilidade impressa.","LEGENDARY",4],
  ["SENHOR_JOHTO","Senhor de Johto","Seja o primeiro jogador a possuir tres Insignias de Johto diferentes.","LEGENDARY",4],
] as const;

const badgeDefs = [
  ["Zephyr Badge", "Voador", "image2.png", "zephyr-badge.png"], ["Hive Badge", "Inseto", "image3.png", "hive-badge.png"],
  ["Plain Badge", "Normal", "image4.png", "plain-badge.png"], ["Fog Badge", "Fantasma", "image5.png", "fog-badge.png"],
  ["Storm Badge", "Lutador", "image6.png", "storm-badge.png"], ["Mineral Badge", "Aco", "image7.png", "mineral-badge.png"],
  ["Glacier Badge", "Gelo", "image8.png", "glacier-badge.png"], ["Rising Badge", "Dragao", "image9.png", "rising-badge.png"],
] as const;

async function uploadBadges() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase Storage nao configurado.");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const mediaDir = path.resolve(".codex-tmp/regulamento-unpacked-20260803/word/media");
  const urls = new Map<string, string>();
  for (const [name, , source, target] of badgeDefs) {
    const storagePath = `tournaments/${TOURNAMENT_SLUG}/insignias/${target}`;
    const sourcePath = path.join(mediaDir, source);
    const sourceAvailable = await access(sourcePath).then(() => true).catch(() => false);
    if (sourceAvailable) {
      const buffer = await readFile(sourcePath);
      const { error } = await supabase.storage.from("assets").upload(storagePath, buffer, { contentType: "image/png", upsert: true, cacheControl: "31536000" });
      if (error) throw new Error(`${name}: ${error.message}`);
    } else {
      console.warn(`${name}: arquivo local nao encontrado; mantendo o endereco permanente ja enviado ao Supabase.`);
    }
    urls.set(name, supabase.storage.from("assets").getPublicUrl(storagePath).data.publicUrl);
  }
  return urls;
}

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) throw new Error("Conta admin nao encontrada.");
  const players = await prisma.player.findMany({ where: { displayName: { in: Object.values(aliases) } } });
  const playerByManualName = new Map(manualNames.map((name) => [name, players.find((player) => player.displayName === aliases[name])]));
  const missing = manualNames.filter((name) => !playerByManualName.get(name));
  if (missing.length) throw new Error(`Jogadores nao encontrados: ${missing.join(", ")}`);
  const badgeUrls = await uploadBadges();

  const season = await prisma.season.upsert({
    where: { slug: SEASON_SLUG },
    update: { name: "Liga Zikachu - 3ª Edição", startDate: START, endDate: END, status: "DRAFT" },
    create: { name: "Liga Zikachu - 3ª Edição", slug: SEASON_SLUG, description: "Rumo a Johto", startDate: START, endDate: END, status: "DRAFT", rankingConfig: { win: 3, loss: 0, draw: 0 }, createdById: admin.id },
  });

  const tournament = await prisma.tournament.upsert({
    where: { slug: TOURNAMENT_SLUG },
    update: {
      name: "Liga Zikachu — 3ª Edição: Rumo a Johto", edition: "3ª Edição", description: "Oito semanas, 14 partidas por treinador, Jornadas das Insígnias de Johto, Contratos do Professor Enguiça e Missão de Mascote. Quinta-feira é o dia principal; quarta-feira recebe jogos da rotação.",
      status: TournamentStatus.DRAFT, startDate: START, endDate: END, maxPlayers: 11, matchesPerPlayer: 14,
      requiresDeckSubmission: true, mascotMissionEnabled: true, enguicaContractsEnabled: true, seasonId: season.id,
      rankingConfig: { winPoints: 3, lossPoints: 0, noDraws: true, defendedPrizesTiebreaker: true, achievementPointsCap: 15 },
      challengeConfig: { badgeChallenge: true, freeChallenge: false, pointsPerBadge: 3, pointsToChallenge: 3, challengerPenalty: 2, maxChallengesReceivedPerWeek: 1 },
      betConfig: { enabled: true, maxBetPerPlayerPerMatch: 1500, settleAfterValidation: true }, rewardConfig: JOHTO_REWARD_CONFIG,
      themeMetadata: { theme: "Rumo a Johto", manualVersion: "0.5", fixedSchedule: true, finalStage: { top4: "Chave de Sobrevivencia Z", consolation: "Copa Johto de Recompensas" }, miauvadaoFund: 81530 },
      createdById: admin.id,
    },
    create: {
      name: "Liga Zikachu — 3ª Edição: Rumo a Johto", slug: TOURNAMENT_SLUG, edition: "3ª Edição", description: "Oito semanas, 14 partidas por treinador, Jornadas das Insígnias de Johto, Contratos do Professor Enguiça e Missão de Mascote. Quinta-feira é o dia principal; quarta-feira recebe jogos da rotação.",
      status: TournamentStatus.DRAFT, format: "ONLINE", startDate: START, endDate: END, maxPlayers: 11, matchesPerPlayer: 14,
      requiresDeckSubmission: true, mascotMissionEnabled: true, enguicaContractsEnabled: true, seasonId: season.id,
      rankingConfig: { winPoints: 3, lossPoints: 0, noDraws: true, defendedPrizesTiebreaker: true, achievementPointsCap: 15 },
      challengeConfig: { badgeChallenge: true, freeChallenge: false, pointsPerBadge: 3, pointsToChallenge: 3, challengerPenalty: 2, maxChallengesReceivedPerWeek: 1 },
      betConfig: { enabled: true, maxBetPerPlayerPerMatch: 1500, settleAfterValidation: true }, rewardConfig: JOHTO_REWARD_CONFIG,
      themeMetadata: { theme: "Rumo a Johto", manualVersion: "0.5", fixedSchedule: true, finalStage: { top4: "Chave de Sobrevivencia Z", consolation: "Copa Johto de Recompensas" }, miauvadaoFund: 81530 },
      createdById: admin.id,
    },
  });

  for (const player of players) {
    await prisma.tournamentRegistration.upsert({ where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: player.id } }, update: { status: "APPROVED", decidedById: admin.id, decidedAt: new Date() }, create: { tournamentId: tournament.id, playerId: player.id, status: "APPROVED", decidedById: admin.id, decidedAt: new Date() } });
    await prisma.seasonPlayer.upsert({ where: { seasonId_playerId: { seasonId: season.id, playerId: player.id } }, update: { isActive: true }, create: { seasonId: season.id, playerId: player.id, isActive: true } });
  }

  const weekIds = new Map<number, string>();
  for (const def of weekDefs) {
    const startDate = new Date(START); startDate.setUTCDate(startDate.getUTCDate() + (def.n - 1) * 7);
    const endDate = new Date(startDate); endDate.setUTCDate(endDate.getUTCDate() + 2); endDate.setUTCHours(2, 59, 59, 999);
    const fixedMatchups = schedules[def.n].map((entry) => ({
      game: entry.game, label: `Jogo ${entry.game}`, dayOffset: entry.day === "THU" ? 1 : 0,
      ...(entry.a.name ? { playerAId: playerByManualName.get(entry.a.name)!.id } : { playerARank: entry.a.rank }),
      ...(entry.b.name ? { playerBId: playerByManualName.get(entry.b.name)!.id } : { playerBRank: entry.b.rank }),
    }));
    const week = await prisma.tournamentWeek.upsert({
      where: { tournamentId_weekNumber: { tournamentId: tournament.id, weekNumber: def.n } },
      update: { label: def.label, mode: def.mode, status: WeekStatus.PLANNED, startDate, endDate, deckLockAt: new Date(startDate.getTime() - 15 * 60_000), notes: def.notes, bonusRule: { fixedMatchups, materializeAtWeekOpen: [4,7,8].includes(def.n), rankingLocked: [4,7,8].includes(def.n) } },
      create: { tournamentId: tournament.id, weekNumber: def.n, label: def.label, mode: def.mode, status: WeekStatus.PLANNED, startDate, endDate, deckLockAt: new Date(startDate.getTime() - 15 * 60_000), notes: def.notes, bonusRule: { fixedMatchups, materializeAtWeekOpen: [4,7,8].includes(def.n), rankingLocked: [4,7,8].includes(def.n) } },
    });
    weekIds.set(def.n, week.id);
  }

  const confirmedMatches = await prisma.match.count({ where: { tournamentWeekId: { in: [...weekIds.values()] }, status: "CONFIRMED" } });
  if (confirmedMatches > 0) throw new Error("O seed nao pode ser reexecutado depois que houver resultados confirmados.");
  await prisma.match.deleteMany({ where: { tournamentWeekId: { in: [...weekIds.values()] } } });
  for (const weekNumber of [1,2,3,5,6]) {
    const weekId = weekIds.get(weekNumber)!;
    const week = await prisma.tournamentWeek.findUniqueOrThrow({ where: { id: weekId } });
    await prisma.match.createMany({ data: schedules[weekNumber].map((entry) => {
      const scheduledAt = new Date(week.startDate); if (entry.day === "THU") scheduledAt.setUTCDate(scheduledAt.getUTCDate() + 1);
      return { tournamentWeekId: weekId, playerAId: playerByManualName.get(entry.a.name!)!.id, playerBId: playerByManualName.get(entry.b.name!)!.id, roundLabel: `Jogo ${entry.game}`, bestOf: 1, status: "PENDING_CONFIRMATION", scheduledAt, createdById: admin.id };
    }) });
  }

  for (const [name, type, ,] of badgeDefs) {
    const fullName = `${name} (${type})`;
    const existing = await prisma.leagueBadge.findFirst({ where: { tournamentId: tournament.id, name: fullName } });
    if (existing) await prisma.leagueBadge.update({ where: { id: existing.id }, data: { imageUrl: badgeUrls.get(name)! } });
    else await prisma.leagueBadge.create({ data: { tournamentId: tournament.id, name: fullName, imageUrl: badgeUrls.get(name)!, createdById: admin.id } });
  }

  for (const [key, name, description, rarity, points] of achievements) {
    await prisma.achievement.upsert({
      where: { seasonId_key: { seasonId: season.id, key: `JOHTO3_${key}` } },
      update: { name, description, rarity: rarity as AchievementRarity, suggestedPoints: points, tournamentId: tournament.id, active: true, criteria: { exclusive: true, proofRequired: true, seasonPointsCap: 15 } },
      create: { seasonId: season.id, key: `JOHTO3_${key}`, name, description, rarity: rarity as AchievementRarity, suggestedPoints: points, tournamentId: tournament.id, active: true, type: "MANUAL", category: "TOURNAMENT", scope: "TOURNAMENT", isRepeatable: false, criteria: { exclusive: true, proofRequired: true, seasonPointsCap: 15 }, createdById: admin.id },
    });
  }

  console.log(JSON.stringify({ tournamentId: tournament.id, slug: tournament.slug, status: tournament.status, registrations: players.length, precreatedMatches: 44, deferredRankingMatches: 33, badges: badgeDefs.length, achievements: achievements.length }, null, 2));
}

main().finally(() => prisma.$disconnect());
