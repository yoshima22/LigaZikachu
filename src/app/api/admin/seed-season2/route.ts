/**
 * Endpoint unico de importacao — Liga Zikachu 2a Edicao
 * GET /api/admin/seed-season2
 * Protegido: so admins autenticados. Idempotente: pode rodar multiplas vezes.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { WeekMode } from "@prisma/client";

// ── Conquistas da 2a Edicao ───────────────────────────────────────────────────

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

// ── Semanas do torneio ────────────────────────────────────────────────────────

const WEEKS = [
  { num:1, mode:"PADRAO"               as WeekMode, label:"Semana 1 — Padrão",               start:"2025-12-08", end:"2025-12-08" },
  { num:2, mode:"GLC"                  as WeekMode, label:"Semana 2 — GLC",                  start:"2025-12-15", end:"2025-12-15" },
  { num:3, mode:"PADRAO"               as WeekMode, label:"Semana 3 — Padrão",               start:"2026-01-12", end:"2026-01-13" },
  { num:4, mode:"DUPLAS_SINCRONIZADAS" as WeekMode, label:"Semana 4 — Duplas Sincronizadas", start:"2026-01-26", end:"2026-01-26" },
  { num:5, mode:"PADRAO"               as WeekMode, label:"Semana 5 — Padrão",               start:"2026-02-04", end:"2026-02-04" },
  { num:6, mode:"CONSTRUTOR_MISTERIOSO"as WeekMode, label:"Semana 6 — Construtor Misterioso",start:"2026-03-16", end:"2026-03-16" },
  { num:7, mode:"GUERRA_DE_TIMES"      as WeekMode, label:"Semana 7 — Guerra de Times",      start:"2026-05-20", end:"2026-05-20" },
  { num:8, mode:"BATALHA_FINAL"        as WeekMode, label:"Semana 8 — Batalha Final",          start:"2026-06-03", end:"2026-06-03" },
];

// ── Partidas (63 no total) ────────────────────────────────────────────────────
// pA e pB = displayName dos jogadores; winner = displayName do vencedor

const MATCHES: Array<{ w:number; pA:string; pB:string; winner:string; prizes:number; date:string; notes?:string }> = [
  // Semana 1 — Padrão (08/12/2025) — 11 partidas
  { w:1, pA:"Luiz",    pB:"Rodrigo",  winner:"Luiz",    prizes:3, date:"2025-12-08" },
  { w:1, pA:"Moises",  pB:"Erick",    winner:"Moises",  prizes:6, date:"2025-12-08" },
  { w:1, pA:"Cristian",pB:"Alan",     winner:"Cristian",prizes:3, date:"2025-12-08" },
  { w:1, pA:"Nakaima", pB:"Alan",     winner:"Alan",    prizes:4, date:"2025-12-08" },
  { w:1, pA:"Moises",  pB:"Rodrigo",  winner:"Moises",  prizes:4, date:"2025-12-08" },
  { w:1, pA:"Nakaima", pB:"Cristian", winner:"Cristian",prizes:4, date:"2025-12-08" },
  { w:1, pA:"Luiz",    pB:"Moises",   winner:"Luiz",    prizes:1, date:"2025-12-08" },
  { w:1, pA:"Erick",   pB:"Cristian", winner:"Cristian",prizes:6, date:"2025-12-15", notes:"Partida reposição" },
  { w:1, pA:"Luiz",    pB:"Erick",    winner:"Luiz",    prizes:6, date:"2025-12-08" },
  { w:1, pA:"Alan",    pB:"Rodrigo",  winner:"Rodrigo", prizes:6, date:"2025-12-08" },
  { w:1, pA:"Erick",   pB:"Rodrigo",  winner:"Rodrigo", prizes:6, date:"2025-12-08" },
  // Semana 2 — GLC (15/12/2025) — 7 partidas
  { w:2, pA:"Luiz",    pB:"Moises",   winner:"Luiz",    prizes:3, date:"2025-12-15" },
  { w:2, pA:"Cristian",pB:"Alan",     winner:"Cristian",prizes:6, date:"2025-12-15" },
  { w:2, pA:"Nakaima", pB:"Luiz",     winner:"Luiz",    prizes:3, date:"2025-12-15" },
  { w:2, pA:"Alan",    pB:"Rodrigo",  winner:"Rodrigo", prizes:6, date:"2025-12-15" },
  { w:2, pA:"Moises",  pB:"Erick",    winner:"Erick",   prizes:6, date:"2025-12-15" },
  { w:2, pA:"Nakaima", pB:"Rodrigo",  winner:"Rodrigo", prizes:6, date:"2025-12-15" },
  { w:2, pA:"Erick",   pB:"Cristian", winner:"Erick",   prizes:5, date:"2025-12-15" },
  // Semana 3 — Padrão (12-13/01/2026) — 11 partidas
  { w:3, pA:"Luiz",    pB:"Erick",    winner:"Erick",   prizes:2, date:"2026-01-12" },
  { w:3, pA:"Nakaima", pB:"Erick",    winner:"Erick",   prizes:5, date:"2026-01-12" },
  { w:3, pA:"Moises",  pB:"Rodrigo",  winner:"Rodrigo", prizes:2, date:"2026-01-12" },
  { w:3, pA:"Luiz",    pB:"Cristian", winner:"Luiz",    prizes:5, date:"2026-01-12" },
  { w:3, pA:"Nakaima", pB:"Moises",   winner:"Moises",  prizes:4, date:"2026-01-12" },
  { w:3, pA:"Erick",   pB:"Cristian", winner:"Erick",   prizes:6, date:"2026-01-12", notes:"W/o - Energia caiu" },
  { w:3, pA:"Alan",    pB:"Rodrigo",  winner:"Rodrigo", prizes:2, date:"2026-01-12" },
  { w:3, pA:"Nakaima", pB:"Luiz",     winner:"Nakaima", prizes:2, date:"2026-01-12" },
  { w:3, pA:"Moises",  pB:"Alan",     winner:"Moises",  prizes:6, date:"2026-01-12" },
  { w:3, pA:"Luiz",    pB:"Moises",   winner:"Moises",  prizes:2, date:"2026-01-13" },
  { w:3, pA:"Nakaima", pB:"Cristian", winner:"Cristian",prizes:1, date:"2026-01-13" },
  // Semana 4 — Duplas (26/01/2026) — 7 partidas
  { w:4, pA:"Erick",   pB:"Rodrigo",  winner:"Erick",   prizes:3, date:"2026-01-26" },
  { w:4, pA:"Luiz",    pB:"Moises",   winner:"Luiz",    prizes:6, date:"2026-01-26" },
  { w:4, pA:"Moises",  pB:"Cristian", winner:"Moises",  prizes:5, date:"2026-01-26" },
  { w:4, pA:"Nakaima", pB:"Alan",     winner:"Alan",    prizes:6, date:"2026-01-26" },
  { w:4, pA:"Rodrigo", pB:"Luiz",     winner:"Rodrigo", prizes:2, date:"2026-01-26" },
  { w:4, pA:"Nakaima", pB:"Cristian", winner:"Nakaima", prizes:4, date:"2026-01-26" },
  { w:4, pA:"Erick",   pB:"Alan",     winner:"Alan",    prizes:4, date:"2026-01-26" },
  // Semana 5 — Padrão (04/02/2026) — 11 partidas
  { w:5, pA:"Luiz",    pB:"Rodrigo",  winner:"Luiz",    prizes:6, date:"2026-02-04" },
  { w:5, pA:"Erick",   pB:"Cristian", winner:"Erick",   prizes:6, date:"2026-02-04" },
  { w:5, pA:"Cristian",pB:"Rodrigo",  winner:"Cristian",prizes:6, date:"2026-02-04" },
  { w:5, pA:"Nakaima", pB:"Alan",     winner:"Nakaima", prizes:6, date:"2026-02-04" },
  { w:5, pA:"Moises",  pB:"Rodrigo",  winner:"Moises",  prizes:2, date:"2026-02-04" },
  { w:5, pA:"Nakaima", pB:"Cristian", winner:"Cristian",prizes:4, date:"2026-02-04" },
  { w:5, pA:"Luiz",    pB:"Moises",   winner:"Luiz",    prizes:3, date:"2026-02-04" },
  { w:5, pA:"Erick",   pB:"Alan",     winner:"Alan",    prizes:6, date:"2026-02-04" },
  { w:5, pA:"Nakaima", pB:"Erick",    winner:"Erick",   prizes:6, date:"2026-02-04" },
  { w:5, pA:"Cristian",pB:"Alan",     winner:"Cristian",prizes:4, date:"2026-02-04" },
  { w:5, pA:"Alan",    pB:"Rodrigo",  winner:"Alan",    prizes:2, date:"2026-02-04" },
  // Semana 6 — Construtor Misterioso (16/03/2026) — 7 partidas
  { w:6, pA:"Luiz",    pB:"Cristian", winner:"Luiz",    prizes:6, date:"2026-03-16" },
  { w:6, pA:"Moises",  pB:"Alan",     winner:"Moises",  prizes:6, date:"2026-03-16" },
  { w:6, pA:"Erick",   pB:"Rodrigo",  winner:"Rodrigo", prizes:3, date:"2026-03-16" },
  { w:6, pA:"Nakaima", pB:"Cristian", winner:"Cristian",prizes:4, date:"2026-03-16" },
  { w:6, pA:"Moises",  pB:"Rodrigo",  winner:"Rodrigo", prizes:4, date:"2026-03-16" },
  { w:6, pA:"Luiz",    pB:"Alan",     winner:"Luiz",    prizes:6, date:"2026-03-16" },
  { w:6, pA:"Nakaima", pB:"Erick",    winner:"Erick",   prizes:6, date:"2026-03-16" },
  // Semana 7 — Guerra de Times (20/05/2026) — 9 partidas
  { w:7, pA:"Erick",   pB:"Rodrigo",  winner:"Rodrigo", prizes:6, date:"2026-05-20" },
  { w:7, pA:"Luiz",    pB:"Alan",     winner:"Luiz",    prizes:3, date:"2026-05-20" },
  { w:7, pA:"Moises",  pB:"Cristian", winner:"Moises",  prizes:2, date:"2026-05-20" },
  { w:7, pA:"Erick",   pB:"Alan",     winner:"Alan",    prizes:5, date:"2026-05-20" },
  { w:7, pA:"Nakaima", pB:"Rodrigo",  winner:"Nakaima", prizes:3, date:"2026-05-20" },
  { w:7, pA:"Luiz",    pB:"Cristian", winner:"Luiz",    prizes:5, date:"2026-05-20" },
  { w:7, pA:"Erick",   pB:"Cristian", winner:"Erick",   prizes:4, date:"2026-05-20" },
  { w:7, pA:"Moises",  pB:"Rodrigo",  winner:"Moises",  prizes:6, date:"2026-05-20" },
  { w:7, pA:"Nakaima", pB:"Alan",     winner:"Nakaima", prizes:4, date:"2026-05-20" },
  // Semana 8 — Batalha Final (03/06/2026) — 11 partidas agendadas, sem resultado ainda
  // winner:"" indica partida ainda não jogada (será criada como PENDING_CONFIRMATION)
  { w:8, pA:"Luiz",    pB:"Alan",     winner:"", prizes:0, date:"2026-06-03" },
  { w:8, pA:"Nakaima", pB:"Moises",   winner:"", prizes:0, date:"2026-06-03" },
  { w:8, pA:"Erick",   pB:"Rodrigo",  winner:"", prizes:0, date:"2026-06-03" },
  { w:8, pA:"Nakaima", pB:"Luiz",     winner:"", prizes:0, date:"2026-06-03" },
  { w:8, pA:"Cristian",pB:"Rodrigo",  winner:"", prizes:0, date:"2026-06-03" },
  { w:8, pA:"Luiz",    pB:"Moises",   winner:"", prizes:0, date:"2026-06-03" },
  { w:8, pA:"Erick",   pB:"Cristian", winner:"", prizes:0, date:"2026-06-03" },
  { w:8, pA:"Alan",    pB:"Moises",   winner:"", prizes:0, date:"2026-06-03" },
  { w:8, pA:"Nakaima", pB:"Alan",     winner:"", prizes:0, date:"2026-06-03" },
  { w:8, pA:"Erick",   pB:"Luiz",     winner:"", prizes:0, date:"2026-06-03" },
  { w:8, pA:"Moises",  pB:"Nakaima",  winner:"", prizes:0, date:"2026-06-03" },
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
      where: { OR: [{ email: "alan@ligazikachu.com" }, { player: { displayName: "Alan" } }] }
    });

    if (!alanExists) {
      const hash = await hashPassword("LigaZikachu123");
      const alanUser = await prisma.user.create({
        data: { name: "Alan", email: "alan@ligazikachu.com", passwordHash: hash, status: "ACTIVE", role: "PLAYER" }
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
          description: "Campeonato histórico registrado retroativamente. 7 semanas, 7 jogadores, formato presencial com insígnias e conquistas.",
          format: "IN_PERSON",
          status: "IN_PROGRESS",
          startDate: new Date("2025-12-08"),
          endDate: new Date("2026-06-03"),
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
    let achCreated = 0, achAssigned = 0;

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
        achCreated++;
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
            achAssigned++;
            log.push(`  ✓ "${ach.name}" → ${ach.owner}`);
          } else {
            log.push(`  - "${ach.name}" → ${ach.owner} (já atribuída)`);
          }
        } else {
          log.push(`  ⚠ Jogador "${ach.owner}" não encontrado`);
        }
      }
    }

    log.push(`\n✓ ${achCreated} conquistas criadas, ${achAssigned} atribuídas`);

    // ── 4. Mapear jogadores por displayName (insensível a acentos) ──────────

    // Busca todos os jogadores ativos e faz match por nome normalizado em JS
    // para evitar problemas com acentos (ex: "Moisés" vs "Moises")
    const SEED_NAMES = ["Rodrigo","Erick","Luiz","Moises","Alan","Nakaima","Cristian"];
    const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
    const seedNamesNorm = SEED_NAMES.map(normalize);

    const candidatePlayers = await prisma.player.findMany({
      select: { id: true, displayName: true }
    });

    // Monta o mapa usando o nome normalizado como chave de lookup
    // mas registra também pelo nome "seed" (sem acento) para as partidas
    const playerMap = new Map<string, string>();
    const foundPlayers: string[] = [];
    for (const p of candidatePlayers) {
      const norm = normalize(p.displayName);
      const seedIdx = seedNamesNorm.indexOf(norm);
      if (seedIdx !== -1) {
        playerMap.set(SEED_NAMES[seedIdx], p.id); // chave sem acento, ex: "Moises"
        playerMap.set(p.displayName, p.id);        // chave original, ex: "Moisés"
        foundPlayers.push(p.displayName);
      }
    }
    log.push(`\n✓ Jogadores encontrados: ${foundPlayers.join(", ")}`);

    // ── 5. Registrar jogadores no torneio ────────────────────────────────────

    // Filtra só os jogadores que foram mapeados (pertencentes à liga)
    const mappedPlayers = candidatePlayers.filter(p =>
      seedNamesNorm.includes(normalize(p.displayName))
    );

    let regCreated = 0;
    for (const player of mappedPlayers) {
      const existing = await prisma.tournamentRegistration.findUnique({
        where: { tournamentId_playerId: { tournamentId: tournament.id, playerId: player.id } }
      });
      if (!existing) {
        await prisma.tournamentRegistration.create({
          data: {
            tournamentId: tournament.id,
            playerId: player.id,
            status: "APPROVED",
            registeredAt: new Date("2025-12-08"),
            decidedAt: new Date("2025-12-08"),
            decidedById: adminUser.id
          }
        });
        regCreated++;
      }
    }
    log.push(`✓ ${regCreated} registros de jogadores criados`);

    // ── 6. Criar semanas do torneio ──────────────────────────────────────────

    const weekIdMap = new Map<number, string>();
    let weeksCreated = 0;

    for (const w of WEEKS) {
      const existing = await prisma.tournamentWeek.findUnique({
        where: { tournamentId_weekNumber: { tournamentId: tournament.id, weekNumber: w.num } }
      });
      if (existing) {
        weekIdMap.set(w.num, existing.id);
        // Para a Semana 8, sempre atualiza horários mesmo se já existir
        if (w.num === 8) {
          await prisma.tournamentWeek.update({
            where: { id: existing.id },
            data: {
              status:     "OPEN",
              lockAt:     new Date("2026-06-03T20:00:00-03:00"),
              deckLockAt: new Date("2026-06-03T19:00:00-03:00"),
              label:      w.label
            }
          });
          log.push(`  ↻ Semana 8 atualizada (20h BRT início, 19h BRT deck lock)`);
        } else {
          log.push(`  - Semana ${w.num} já existe`);
        }
      } else {
        // Semana 8 fica OPEN (acontece em 03/06/2026), demais CLOSED
      const weekStatus = w.num === 8 ? "OPEN" : "CLOSED";
      const week = await prisma.tournamentWeek.create({
          data: {
            tournamentId: tournament.id,
            weekNumber: w.num,
            label: w.label,
            mode: w.mode,
            status: weekStatus,
            startDate: new Date(w.start),
            endDate: new Date(w.end),
            // Semana 8: partidas às 20h BRT, envio de decks até 19h BRT
            lockAt:     w.num === 8 ? new Date("2026-06-03T20:00:00-03:00") : undefined,
            deckLockAt: w.num === 8 ? new Date("2026-06-03T19:00:00-03:00") : undefined
          }
        });
        weekIdMap.set(w.num, week.id);
        weeksCreated++;
        log.push(`  ✓ ${w.label}`);
      }
    }
    log.push(`✓ ${weeksCreated} semanas criadas`);

    // ── 7. Criar partidas ────────────────────────────────────────────────────

    let matchesCreated = 0, matchesSkipped = 0;

    for (const m of MATCHES) {
      const playerAId = playerMap.get(m.pA);
      const playerBId = playerMap.get(m.pB);
      const weekId    = weekIdMap.get(m.w);
      const isPending = !m.winner; // semana 8 ainda sem resultado

      if (!playerAId || !playerBId || !weekId) {
        log.push(`  ⚠ Partida S${m.w} ${m.pA} vs ${m.pB}: jogador ou semana não encontrado`);
        matchesSkipped++;
        continue;
      }

      if (!isPending && !playerMap.get(m.winner)) {
        log.push(`  ⚠ Partida S${m.w} ${m.pA} vs ${m.pB}: vencedor "${m.winner}" não encontrado`);
        matchesSkipped++;
        continue;
      }

      // Idempotente: checar se já existe partida entre esses dois nesta semana
      const existing = await prisma.match.findFirst({
        where: { tournamentWeekId: weekId, playerAId, playerBId }
      });
      if (existing) {
        matchesSkipped++;
        continue;
      }

      if (isPending) {
        // Partida agendada — sem resultado ainda (Semana 8)
        await prisma.match.create({
          data: {
            tournamentWeekId: weekId,
            playerAId,
            playerBId,
            bestOf: 1,
            status: "PENDING_CONFIRMATION",
            resultSource: "MANUAL",
            scheduledAt: new Date(`${m.date}T20:00:00-03:00`),
            createdById: adminUser.id
          }
        });
      } else {
        const winnerId = playerMap.get(m.winner)!;
        const loserId  = m.winner === m.pA ? playerBId : playerAId;
        const playerAWins = m.winner === m.pA ? 1 : 0;
        const playerBWins = m.winner === m.pB ? 1 : 0;

        await prisma.match.create({
          data: {
            tournamentWeekId: weekId,
            playerAId,
            playerBId,
            winnerPlayerId: winnerId,
            loserPlayerId: loserId,
            playerAWins,
            playerBWins,
            winnerDefendedPrizes: m.prizes,
            bestOf: 1,
            status: "CONFIRMED",
            resultSource: "MANUAL",
            playedAt: new Date(m.date),
            reportedAt: new Date(m.date),
            confirmedAt: new Date(m.date),
            reportedById: adminUser.id,
            confirmedById: adminUser.id,
            createdById: adminUser.id,
            notes: m.notes ?? null
          }
        });
      }
      matchesCreated++;
    }

    log.push(`✓ ${matchesCreated} partidas criadas, ${matchesSkipped} ignoradas`);

    // ── 8. Aplicar bônus manuais via bonusRule nas semanas ───────────────────
    //
    // Semana 4 — bônus de Duplas (Rodrigo+Alan = equipe vencedora)
    // Semana 7 — bônus extras gerais de campeonato (pontos finais da planilha)
    // Penalidades de ginásio NÃO incluídas aqui — serão cobertas pelos
    // registros de desafio quando forem criados.

    const DUPLAS_BONUSES = [
      { name:"Rodrigo", points:3, reason:"Equipe vencedora Semana 4 (Duplas)" },
      { name:"Alan",    points:3, reason:"Equipe vencedora Semana 4 (Duplas)" },
    ];
    const EXTRAS_BONUSES = [
      { name:"Rodrigo",  points:4, reason:"Bônus manual final de campeonato" },
      { name:"Erick",    points:4, reason:"Bônus manual final de campeonato" },
      { name:"Luiz",     points:6, reason:"Bônus manual final de campeonato" },
      { name:"Moises",   points:4, reason:"Bônus manual final de campeonato" },
      { name:"Nakaima",  points:2, reason:"Bônus manual final de campeonato" },
      { name:"Cristian", points:2, reason:"Bônus manual final de campeonato" },
    ];

    const applyBonusToWeek = async (weekNum: number, bonuses: typeof DUPLAS_BONUSES) => {
      const weekId = weekIdMap.get(weekNum);
      if (!weekId) return;
      const week = await prisma.tournamentWeek.findUnique({ where: { id: weekId }, select: { bonusRule: true } });
      const existing = (week?.bonusRule && typeof week.bonusRule === "object" && !Array.isArray(week.bonusRule))
        ? (week.bonusRule as Record<string, unknown>)
        : {};
      const existingBonuses = Array.isArray(existing.manualBonuses) ? existing.manualBonuses as Record<string, unknown>[] : [];
      const newBonuses = bonuses
        .map(b => ({ playerId: playerMap.get(b.name), playerName: b.name, points: b.points, reason: b.reason }))
        .filter(b => b.playerId);
      // Evitar duplicatas pelo reason
      const merged = [
        ...existingBonuses.filter(e => !newBonuses.some(n => n.playerName === e.playerName && n.reason === e.reason)),
        ...newBonuses
      ];
      // Cast explícito para satisfazer o tipo Prisma InputJsonValue
      const bonusRuleJson = { ...existing, manualBonuses: merged } as Parameters<typeof prisma.tournamentWeek.update>[0]["data"]["bonusRule"];
      await prisma.tournamentWeek.update({ where: { id: weekId }, data: { bonusRule: bonusRuleJson } });
    };

    // Penalidades de ginásio — aplicadas como bônus negativo na Semana 1
    // pois os registros de Challenge ainda nao foram criados.
    // Quando os desafios forem importados, remover estas entradas para evitar
    // dupla contagem (o sistema ja aplica -2 por derrota em Challenge.REJECTED).
    const GYM_PENALTY_BONUSES = [
      { name:"Erick",    points:-4, reason:"Penalidade ginasio (2 derrotas em ginasio x -2pts)" },
      { name:"Cristian", points:-6, reason:"Penalidade ginasio (3 derrotas em ginasio x -2pts)" },
    ];

    await applyBonusToWeek(4, DUPLAS_BONUSES);
    await applyBonusToWeek(7, EXTRAS_BONUSES);
    await applyBonusToWeek(1, GYM_PENALTY_BONUSES);
    log.push(`✓ Bônus manuais aplicados:`);
    log.push(`  - S4: duplas Rodrigo+3, Alan+3`);
    log.push(`  - S7: extras finais (Rodrigo+4, Erick+4, Luiz+6, Moises+4, Nakaima+2, Cristian+2)`);
    log.push(`  - S1: penalidades ginasio (Erick -4, Cristian -6)`);
    log.push(`\n🎉 Importação da 2ª Edição concluída!`);
    log.push(`📌 Torneio: /torneios/segunda-edicao`);
    log.push(`📌 Conquistas: /conquistas`);
    log.push(`📌 Alan: alan@ligazikachu.com | LigaZikachu123`);
    log.push(`📌 Semana 8 (Batalha Final): 03/06/2026 às 19h — status OPEN`);
    log.push(`📌 Partidas históricas: ${matchesCreated - 11}/63 | Agendadas S8: 11`);

    return NextResponse.json({ success: true, log }, { status: 200 });
  } catch (err) {
    console.error("[seed-season2]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
