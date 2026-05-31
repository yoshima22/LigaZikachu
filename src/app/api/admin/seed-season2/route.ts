/**
 * Endpoint único de importação — Liga Zikachu 2ª Edição
 * GET /api/admin/seed-season2
 * Protegido: só admins autenticados. Idempotente: pode rodar múltiplas vezes.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

const ACHIEVEMENTS = [
  { key:"minimalista_estrategico",  name:"Minimalista Estratégico",          desc:"Vença 2 partidas consecutivas usando no máximo 5 cartas de Apoiador no deck.",  rarity:"COMMON",    pts:5,  owner:null },
  { key:"maquinario_perfeito",      name:"Maquinário Perfeito",              desc:"Jogue todas as partidas da semana com um deck contendo 4 cópias de pelo menos 7 Itens diferentes.",  rarity:"COMMON",    pts:5,  owner:"Erick" },
  { key:"fidelidade_de_estilo",     name:"Fidelidade de Estilo",             desc:"Seja o único a jogar todas as partidas da semana com o MESMO deck, sem alterar nenhuma carta.",  rarity:"COMMON",    pts:5,  owner:"Rodrigo" },
  { key:"ataque_impecavel",         name:"Ataque Impecável",                 desc:"Vença uma partida sem recuar nenhum Pokémon (Switch e efeitos similares proibidos).",  rarity:"COMMON",    pts:5,  owner:"Rodrigo" },
  { key:"treinador_devoto",         name:"Treinador Devoto",                 desc:"Vença uma partida usando uma Habilidade Pokémon como golpe final.",  rarity:"COMMON",    pts:5,  owner:"Erick" },
  { key:"reciclador_experiente",    name:"Reciclador Experiente",            desc:"Vença uma partida utilizando pelo menos 10 cartas diferentes de recuperação do descarte.",  rarity:"COMMON",    pts:5,  owner:null },
  { key:"finalizador_agil",         name:"Finalizador Ágil",                 desc:"Consiga 4 prêmios em uma única investida.",  rarity:"COMMON",    pts:5,  owner:"Luiz" },
  { key:"cacador_de_formas",        name:"Caçador de Formas",                desc:"Elimine 2 Pokémon ex / mega evoluções na mesma partida.",  rarity:"COMMON",    pts:5,  owner:"Alan" },
  { key:"artifice_do_meta",         name:"Artífice do Meta",                 desc:"Crie e use um deck completamente diferente do seu deck anterior (nenhuma carta repetida) e vença com ele.",  rarity:"RARE",      pts:7,  owner:"Erick" },
  { key:"invencivel_do_dia",        name:"Invencível do Dia",                desc:"Termine o dia com 3 vitórias Perfect (sem perder nenhum Pokémon em nenhuma das três partidas).",  rarity:"RARE",      pts:7,  owner:null },
  { key:"jogando_blackjack",        name:"Jogando Blackjack",                desc:"Vença 1 partida com 21 ou mais cartas na mão.",  rarity:"RARE",      pts:7,  owner:"Erick" },
  { key:"mentor_do_caos",           name:"Mentor do Caos",                   desc:"Vença uma partida sem causar dano direto com ataques, vencendo apenas com efeitos, condições especiais ou deck-out.",  rarity:"RARE",      pts:7,  owner:null },
  { key:"mestre_da_serie",          name:"Mestre da Série",                  desc:"Seja o Top do Dia por 3 semanas consecutivas.",  rarity:"RARE",      pts:7,  owner:"Luiz" },
  { key:"mestre_dos_estadios",      name:"Mestre dos Estádios",              desc:"Vença 3 partidas consecutivas mesmo dia finalizando com o mesmo Estádio ativo.",  rarity:"RARE",      pts:7,  owner:null },
  { key:"reserva_elemental",        name:"Reserva Elemental",                desc:"Vença 1 partida com o banco completamente cheio e com cada Pokémon de um tipo elemental diferente (5 tipos distintos).",  rarity:"RARE",      pts:7,  owner:"Rodrigo" },
  { key:"os_ultimos_primeiros",     name:"Os Últimos Serão os Primeiros",    desc:"Fique em último lugar no ranking diario por 3 semanas consecutivas.",  rarity:"LEGENDARY", pts:10, owner:"Nakaima" },
  { key:"milagre_final",            name:"Milagre Final",                    desc:"Vença uma partida após ficar com 0 cartas no baralho, vencendo exatamente no turno em que comprou a última carta.",  rarity:"LEGENDARY", pts:10, owner:"Alan" },
  { key:"habilidade_vitalidade",    name:"Habilidade é Vitalidade",          desc:"Vença uma partida utilizando apenas Pokémon que possuam Habilidades (nenhum Pokémon sem habilidade pode estar no deck).",  rarity:"LEGENDARY", pts:10, owner:"Rodrigo" },
  { key:"achei_facil",              name:"Achei Fácil",                      desc:"Vença uma partida com menos de 5 cartas restantes no baralho e sem nenhum Pokémon no banco.",  rarity:"LEGENDARY", pts:10, owner:null },
  { key:"lenda_eterna",             name:"Lenda Eterna",                     desc:"Conquiste 3 insígnias simultaneamente.",  rarity:"LEGENDARY", pts:10, owner:"Erick" },
];

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!adminUser) return NextResponse.json({ error: "Admin not found" }, { status: 400 });

    const log: string[] = [];

    // ── 1. Criar conta do Alan ───────────────────────────────────────────────

    const alanExists = await prisma.user.findFirst({
      where: { OR: [{ email: "alan@liga-zikachu.app" }, { player: { displayName: "Alan" } }] }
    });

    if (!alanExists) {
      const hash = await hashPassword("LigaZikachu123");
      const alanUser = await prisma.user.create({
        data: { name: "Alan", email: "alan@liga-zikachu.app", passwordHash: hash, status: "ACTIVE", role: "PLAYER" }
      });
      await prisma.player.create({ data: { userId: alanUser.id, displayName: "Alan", active: true } });
      log.push("✓ Conta do Alan criada");
    } else {
      log.push("- Alan já existe");
    }

    // ── 2. Criar torneio ─────────────────────────────────────────────────────

    let tournament = await prisma.tournament.findUnique({ where: { slug: "segunda-edicao" } });
    if (!tournament) {
      tournament = await prisma.tournament.create({
        data: {
          name: "Liga Zikachu — 2ª Edição",
          slug: "segunda-edicao",
          edition: "2ª Edição",
          description: "Campeonato histórico registrado retroativamente. 8 semanas, 7 jogadores, formato presencial com insígnias e conquistas.",
          format: "IN_PERSON",
          status: "FINISHED",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-03-31"),
          matchesPerPlayer: 3,
          requiresDeckSubmission: false,
          rankingConfig: { version:"2.0.0", format:"MD1", winPoints:3, lossPoints:0, tiebreakers:["wins","defended_prizes"] },
          createdById: adminUser.id
        }
      });
      log.push(`✓ Torneio criado: ${tournament.name}`);
    } else {
      log.push("- Torneio já existe");
    }

    // ── 3. Criar conquistas e atribuir ───────────────────────────────────────

    const season = await prisma.season.findFirst({ orderBy: { createdAt: "desc" } });
    let created = 0, assigned = 0;

    for (const ach of ACHIEVEMENTS) {
      let achievement = await prisma.achievement.findFirst({ where: { key: ach.key } });

      if (!achievement) {
        achievement = await prisma.achievement.create({
          data: {
            key: ach.key, name: ach.name, description: ach.desc,
            rarity: ach.rarity as "COMMON"|"RARE"|"LEGENDARY",
            category: "TOURNAMENT", type: "MANUAL", scope: "TOURNAMENT",
            active: true, suggestedPoints: ach.pts,
            tournamentId: tournament.id, criteria: {},
            createdById: adminUser.id,
            seasonId: season?.id ?? null
          }
        });
        created++;
      }

      if (ach.owner) {
        const player = await prisma.player.findFirst({
          where: { displayName: { contains: ach.owner, mode: "insensitive" } }
        });
        if (player) {
          const existingAward = await prisma.playerAchievement.findFirst({
            where: { achievementId: achievement.id, playerId: player.id }
          });
          if (!existingAward) {
            await prisma.playerAchievement.create({
              data: {
                achievementId: achievement.id, playerId: player.id,
                awardedById: adminUser.id,
                seasonId: season?.id ?? null,
                notes: "Atribuído retroativamente — 2ª Edição da Liga Zikachu",
                pointsAwarded: ach.pts
              }
            });
            assigned++;
            log.push(`  ✓ "${ach.name}" → ${ach.owner} (+${ach.pts}pts)`);
          } else {
            log.push(`  - "${ach.name}" → ${ach.owner} (já atribuída)`);
          }
        } else {
          log.push(`  ⚠️ Jogador "${ach.owner}" não encontrado — conquista "${ach.name}" não atribuída`);
        }
      }
    }

    log.push(`\n✓ ${created} conquistas criadas`);
    log.push(`✓ ${assigned} conquistas atribuídas`);
    log.push(`\n🎉 Importação concluída!`);
    log.push(`📌 Torneio: /torneios/segunda-edicao`);
    log.push(`📌 Conquistas: /conquistas`);
    log.push(`📌 Alan: alan@liga-zikachu.app | LigaZikachu123`);

    return NextResponse.json({ success: true, log }, { status: 200 });
  } catch (err) {
    console.error("[seed-season2]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
