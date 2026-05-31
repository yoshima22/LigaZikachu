/**
 * Seed script — Liga Zikachu 2ª Edição
 * Importa conquistas, cria conta do Alan e registra torneio histórico
 *
 * Executar: npx tsx scripts/seed-season2.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────────────────

async function findPlayerByName(name: string) {
  const player = await prisma.player.findFirst({
    where: { displayName: { contains: name, mode: "insensitive" } },
    select: { id: true, userId: true, displayName: true }
  });
  if (!player) console.warn(`⚠️  Jogador "${name}" não encontrado`);
  return player;
}

// ── 1. Criar conta do Alan ─────────────────────────────────────────────────────

async function createAlan() {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: "alan@liga-zikachu.app" }, { name: "Alan" }] }
  });
  if (existing) { console.log("✓ Alan já existe"); return; }

  const hash = await bcrypt.hash("LigaZikachu123", 12);
  const user = await prisma.user.create({
    data: {
      name: "Alan",
      email: "alan@liga-zikachu.app",
      passwordHash: hash,
      status: "ACTIVE",
      role: "PLAYER"
    }
  });
  await prisma.player.create({
    data: { userId: user.id, displayName: "Alan", active: true }
  });
  console.log("✓ Conta do Alan criada (email: alan@liga-zikachu.app, senha: LigaZikachu123)");
}

// ── 2. Criar torneio ───────────────────────────────────────────────────────────

async function createTournament() {
  const existing = await prisma.tournament.findUnique({ where: { slug: "segunda-edicao" } });
  if (existing) { console.log("✓ Torneio já existe"); return existing; }

  // Buscar admin para createdById
  const admin = await prisma.user.findFirst({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } });
  if (!admin) { console.warn("⚠️  Nenhum admin encontrado para criar torneio"); return null; }

  const tournament = await prisma.tournament.create({
    data: {
      name: "Liga Zikachu — 2ª Edição",
      slug: "segunda-edicao",
      edition: "2ª Edição",
      description: "Campeonato histórico da Liga Zikachu, registrado retroativamente. 8 semanas, 7 jogadores, formato presencial.",
      format: "IN_PERSON",
      status: "FINISHED",
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-03-31"),
      matchesPerPlayer: 3,
      requiresDeckSubmission: false,
      rankingConfig: {
        version: "2.0.0",
        format: "MD1",
        winPoints: 3,
        lossPoints: 0,
        tiebreakers: ["wins", "defended_prizes"]
      },
      createdById: admin.id
    }
  });
  console.log(`✓ Torneio "${tournament.name}" criado (slug: segunda-edicao)`);
  return tournament;
}

// ── 3. Criar conquistas ────────────────────────────────────────────────────────

const ACHIEVEMENTS = [
  // BRONZE (COMMON, 5 pts)
  { key: "minimalista_estrategico", name: "Minimalista Estratégico", description: "Vença 2 partidas consecutivas usando no máximo 5 cartas de Apoiador no deck (cópias adicionais contam individualmente).", rarity: "COMMON", points: 5, owner: null },
  { key: "maquinario_perfeito", name: "Maquinário Perfeito", description: "Jogue todas as partidas da semana com um deck contendo 4 cópias de pelo menos 7 Itens diferentes. (Itens com menos de 4 cópias não contam).", rarity: "COMMON", points: 5, owner: "Erick" },
  { key: "fidelidade_de_estilo", name: "Fidelidade de Estilo", description: "Seja o único a jogar todas as partidas da semana com o MESMO deck, sem alterar nenhuma carta.", rarity: "COMMON", points: 5, owner: "Rodrigo" },
  { key: "ataque_impecavel", name: "Ataque Impecável", description: "Vença uma partida sem recuar nenhum Pokémon (Switch e efeitos similares proibidos).", rarity: "COMMON", points: 5, owner: "Rodrigo" },
  { key: "treinador_devoto", name: "Treinador Devoto", description: "Vença uma partida usando uma Habilidade Pokémon como golpe final. (ex.: Dusknoir e Munkidori. Efeitos secundários de ataque não contam).", rarity: "COMMON", points: 5, owner: "Erick" },
  { key: "reciclador_experiente", name: "Reciclador Experiente", description: "Vença uma partida utilizando pelo menos 10 cartas diferentes de recuperação do descarte. (ex.: Super Vara, Recuperação de Energia, PalPad, etc.).", rarity: "COMMON", points: 5, owner: null },
  { key: "finalizador_agil", name: "Finalizador Ágil", description: "Consiga 4 prêmios em uma única investida.", rarity: "COMMON", points: 5, owner: "Luiz" },
  { key: "cacador_de_formas", name: "Caçador de Formas", description: "Elimine 2 Pokémon ex / mega evoluções na mesma partida.", rarity: "COMMON", points: 5, owner: "Alan" },

  // PRATA (RARE, 7 pts)
  { key: "artifice_do_meta", name: "Artífice do Meta", description: "Crie e use um deck completamente diferente do seu deck anterior (nenhuma carta repetida) e vença com ele.", rarity: "RARE", points: 7, owner: "Erick" },
  { key: "invencivel_do_dia", name: "Invencível do Dia", description: "Termine o dia com 3 vitórias \"Perfect\" (sem perder nenhum Pokémon em nenhuma das três partidas).", rarity: "RARE", points: 7, owner: null },
  { key: "jogando_blackjack", name: "Jogando Blackjack", description: "Vença 1 partida com 21 ou mais cartas na mão. (Print obrigatório caso seja necessário contagem manual após o jogo.)", rarity: "RARE", points: 7, owner: "Erick" },
  { key: "mentor_do_caos", name: "Mentor do Caos", description: "Vença uma partida sem causar dano direto com ataques, vencendo apenas com efeitos, condições especiais ou deck-out do oponente, terminando com menos de 5 cartas restantes.", rarity: "RARE", points: 7, owner: null },
  { key: "mestre_da_serie", name: "Mestre da Série", description: "Seja o Top do Dia por 3 semanas consecutivas.", rarity: "RARE", points: 7, owner: "Luiz" },
  { key: "mestre_dos_estadios", name: "Mestre dos Estádios", description: "Vença 3 partidas consecutivas mesmo dia finalizando com o mesmo Estádio ativo ao finalizar a partida.", rarity: "RARE", points: 7, owner: null },
  { key: "reserva_elemental", name: "Reserva Elemental", description: "Vença 1 partida com o banco completamente cheio e com cada Pokémon de um tipo elemental diferente (5 tipos distintos, podendo repetir o ativo).", rarity: "RARE", points: 7, owner: "Rodrigo" },

  // OURO (LEGENDARY, 10 pts)
  { key: "os_ultimos_serao_os_primeiros", name: "Os Últimos Serão os Primeiros", description: "Fique em último lugar no ranking diario por 3 semanas consecutivas.", rarity: "LEGENDARY", points: 10, owner: "Nakaima" },
  { key: "milagre_final", name: "Milagre Final", description: "Vença uma partida após ficar com 0 cartas no baralho, vencendo exatamente no turno em que comprou a última carta.", rarity: "LEGENDARY", points: 10, owner: "Alan" },
  { key: "habilidade_e_vitalidade", name: "Habilidade é Vitalidade", description: "Vença uma partida utilizando apenas Pokémon que possuam Habilidades (nenhum Pokémon sem habilidade pode estar no deck).", rarity: "LEGENDARY", points: 10, owner: "Rodrigo" },
  { key: "achei_facil", name: "Achei Fácil", description: "Vença uma partida com menos de 5 cartas restantes no baralho e sem nenhum Pokémon no banco.", rarity: "LEGENDARY", points: 10, owner: null },
  { key: "lenda_eterna", name: "Lenda Eterna", description: "Conquiste 3 insígnias simultaneamente.", rarity: "LEGENDARY", points: 10, owner: "Erick" },
];

async function createAchievements(tournamentId: string) {
  const admin = await prisma.user.findFirst({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } });
  if (!admin) { console.warn("⚠️  Nenhum admin encontrado"); return; }

  // Temporada da 2ª Edição — pode já existir
  const season = await prisma.season.findFirst({ where: { name: { contains: "2" } } });

  let created = 0, assigned = 0;

  for (const ach of ACHIEVEMENTS) {
    // Criar conquista se não existir
    let achievement = await prisma.achievement.findFirst({ where: { key: ach.key } });
    if (!achievement) {
      achievement = await prisma.achievement.create({
        data: {
          key: ach.key,
          name: ach.name,
          description: ach.description,
          rarity: ach.rarity as any,
          category: "TOURNAMENT" as any,
          type: "MANUAL" as any,
          scope: "TOURNAMENT" as any,
          active: true,
          suggestedPoints: ach.points,
          tournamentId: tournamentId,
          criteria: {},
          createdById: admin.id,
          seasonId: season?.id ?? null
        }
      });
      created++;
    }

    // Atribuir ao dono se existir
    if (ach.owner) {
      const player = await findPlayerByName(ach.owner);
      if (player) {
        const existingAward = await prisma.playerAchievement.findFirst({
          where: { achievementId: achievement.id, playerId: player.id }
        });
        if (!existingAward) {
          await prisma.playerAchievement.create({
            data: {
              achievementId: achievement.id,
              playerId: player.id,
              awardedById: admin.id,
              seasonId: season?.id ?? null,
              notes: "Atribuído retroativamente — 2ª Edição da Liga Zikachu",
              pointsAwarded: ach.points
            }
          });
          assigned++;
          console.log(`  ✓ "${ach.name}" → ${ach.owner} (+${ach.points}pts)`);
        } else {
          console.log(`  - "${ach.name}" → ${ach.owner} (já atribuída)`);
        }
      }
    }
  }

  console.log(`✓ ${created} conquistas criadas, ${assigned} atribuídas`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Iniciando importação da 2ª Edição da Liga Zikachu...\n");

  await createAlan();

  const tournament = await createTournament();
  if (!tournament) { await prisma.$disconnect(); return; }

  console.log("\n📋 Criando conquistas e atribuindo...");
  await createAchievements(tournament.id);

  console.log("\n✅ Importação concluída!");
  console.log(`\n📌 Acesse o torneio em: /torneios/segunda-edicao`);
  console.log(`📌 Gerencie conquistas em: /conquistas`);
  console.log(`📌 Conta do Alan: alan@liga-zikachu.app | senha: LigaZikachu123`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ Erro:", e);
  await prisma.$disconnect();
  process.exit(1);
});
