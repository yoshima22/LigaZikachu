"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/permissions";

type ModifierSeed = {
  key: string;
  name: string;
  description: string;
  effectJson: object;
};

const MODIFIERS: ModifierSeed[] = [
  // 18.1 Status
  {
    key: "PEQUENOS_GIGANTES",
    name: "Pequenos Gigantes",
    description: "Mascotes abaixo do nível 10 recebem +50 em todos os status nesta partida.",
    effectJson: { type: "LEVEL_BOOST_LOW", maxLevel: 10, value: 50 },
  },
  {
    key: "FORCA_DEMAIS_ATRAPALHA",
    name: "Força Demais Atrapalha",
    description: "O mascote com maior Força da partida tem seus status reduzidos em 40%.",
    effectJson: { type: "HIGHEST_FORCE_PENALTY", value: 0.4 },
  },
  {
    key: "CORRIDA_DOS_LIGEIROS",
    name: "Corrida dos Ligeiros",
    description: "Todos os mascotes com Agilidade acima de 80 recebem +25% de iniciativa.",
    effectJson: { type: "AGILITY_THRESHOLD_BOOST", threshold: 80, value: 0.25 },
  },
  {
    key: "CANSACO_DOS_FORTES",
    name: "Cansaço dos Fortes",
    description: "Mascotes acima do nível 30 perdem 20% de Vitalidade nesta partida.",
    effectJson: { type: "LEVEL_PENALTY_HIGH", minLevel: 30, targetStat: "statVitality", value: -0.2 },
  },
  {
    key: "INSTINTO_SELVAGEM",
    name: "Instinto Selvagem",
    description: "O mascote com maior Instinto de cada dupla recebe +30 em todos os status.",
    effectJson: { type: "TOP_STAT_BOOST_PER_TEAM", stat: "statInstinct", value: 30 },
  },
  {
    key: "CARISMA_DE_PALCO",
    name: "Carisma de Palco",
    description: "A dupla com maior soma de Carisma começa com um escudo equivalente a +20% de Vitalidade.",
    effectJson: { type: "TEAM_CHARISMA_SHIELD", value: 0.2 },
  },
  {
    key: "FRAQUEZA_EXPOSTA",
    name: "Fraqueza Exposta",
    description: "O mascote com menor Vitalidade de cada dupla recebe +60 de Vitalidade defensiva nesta partida.",
    effectJson: { type: "LOWEST_VITALITY_DEFENSE", value: 60 },
  },
  {
    key: "EQUILIBRIO_FORCADO",
    name: "Equilíbrio Forçado",
    description: "O maior status de cada mascote é reduzido em 25% e o menor aumenta em 25%.",
    effectJson: { type: "EQUALIZE_EXTREMES", topPenalty: 0.25, bottomBonus: 0.25 },
  },
  {
    key: "VIRADA_DOS_FRACOS",
    name: "Virada dos Fracos",
    description: "A dupla com menor soma de níveis recebe +20 em todos os status. Empates usam a menor soma total de status.",
    effectJson: { type: "LOWEST_TEAM_LEVEL_BOOST", value: 20 },
  },
  {
    key: "TREINO_RELAMPAGO",
    name: "Treino Relâmpago",
    description: "Todos os mascotes usados pela primeira vez no evento recebem +15 em todos os status.",
    effectJson: { type: "FIRST_EVENT_USE_BOOST", value: 15 },
  },
  // 18.2 Regra
  {
    key: "CONCURSO_DE_CARISMA",
    name: "Concurso de Carisma",
    description: "A dupla com maior soma de Carisma recebe +8% em todos os atributos; o combate completo ainda decide o vencedor.",
    effectJson: { type: "TEAM_STAT_ADVANTAGE", stat: "statCharisma", value: 0.08 },
  },
  {
    key: "QUEDA_DE_BRACO",
    name: "Queda de Braço",
    description: "A dupla com maior soma de Força recebe +8% em todos os atributos; o combate completo ainda decide o vencedor.",
    effectJson: { type: "TEAM_STAT_ADVANTAGE", stat: "statForce", value: 0.08 },
  },
  {
    key: "CORRIDA_DE_AGILIDADE",
    name: "Corrida de Agilidade",
    description: "A dupla com maior soma de Agilidade ataca primeiro em todos os turnos.",
    effectJson: { type: "TEAM_AGILITY_PRIORITY" },
  },
  {
    key: "UNIAO_PERFEITA",
    name: "União Perfeita",
    description: "Se os 6 mascotes da dupla tiverem tipos primários diferentes, recebem +10 em todos os status.",
    effectJson: { type: "TEAM_TYPE_UNIQUE_BOOST", value: 10 },
  },
  {
    key: "TIME_DESAJUSTADO",
    name: "Time Desajustado",
    description: "Se a dupla tiver 3 ou mais mascotes com o mesmo tipo primário, perde 10% de todos os status.",
    effectJson: { type: "TEAM_TYPE_REPEAT_PENALTY", value: 0.1, repeatThreshold: 3 },
  },
  {
    key: "DUELO_LIMPO",
    name: "Duelo Limpo",
    description: "Todos os mascotes ficam com status 50 para este combate.",
    effectJson: { type: "FIXED_STATS", value: 50 },
  },
  {
    key: "VIRADA_FINAL",
    name: "Virada Final",
    description: "Ao ficar com o último mascote de pé, esse mascote garante +20 em Vitalidade.",
    effectJson: { type: "LAST_MASCOT_VITALITY", value: 20 },
  },
  // 18.3 Recompensa
  {
    key: "OVO_NO_CAMPO",
    name: "Ovo no Campo",
    description: "O dono do mascote com maior Instinto entre todos recebe 1 Ovo Comum. Em caso de empate, ambos recebem.",
    effectJson: { type: "REWARD_TOP_INSTINCT", reward: "EGG_COMMON" },
  },
  {
    key: "ACHADO_RARO",
    name: "Achado Raro",
    description: "O dono do mascote com maior Instinto tem chance de 20% de receber 1 Ovo Raro.",
    effectJson: { type: "REWARD_TOP_INSTINCT_CHANCE", reward: "EGG_RARE", chance: 0.2 },
  },
  {
    key: "DOCE_VITORIA",
    name: "Doce Vitória",
    description: "Cada jogador da dupla vencedora recebe 1 Bala de Mel extra.",
    effectJson: { type: "REWARD_WINNER", item: "Bala de Mel" },
  },
  {
    key: "AGUA_NO_INTERVALO",
    name: "Água no Intervalo",
    description: "Todos os jogadores da partida recebem 1 Água Fresca.",
    effectJson: { type: "REWARD_ALL", item: "Água Fresca" },
  },
  {
    key: "ENERGIA_SINCRONIZADA",
    name: "Energia Sincronizada",
    description: "A dupla vencedora recebe 1 Vitamina Chocante para dividir aleatoriamente entre os dois.",
    effectJson: { type: "REWARD_WINNER", item: "Vitamina Chocante", recipient: "RANDOM_WINNER" },
  },
  {
    key: "SORTE_COMPARTILHADA",
    name: "Sorte Compartilhada",
    description: "O jogador com menor pontuação individual no evento recebe 1 Amuleto da Sorte.",
    effectJson: { type: "REWARD_LOWEST_SCORE", item: "Amuleto da Sorte" },
  },
  {
    key: "PREMIO_DO_AZARAO",
    name: "Prêmio do Azarão",
    description: "Se a dupla com menor soma de níveis vencer, recebe +500 ZC por jogador. Empates usam a menor soma total de status.",
    effectJson: { type: "REWARD_UNDERDOG_WIN", reward: "ZC", value: 500 },
  },
  {
    key: "CACADOR_DE_OVOS",
    name: "Caçador de Ovos",
    description: "Se um jogador usar 3 mascotes de gerações diferentes, ganha +10% de chance de Ovo Comum.",
    effectJson: { type: "REWARD_GEN_DIVERSITY", reward: "EGG_COMMON_CHANCE", value: 0.1 },
  },
  {
    key: "ESPECIAL_DO_DIA",
    name: "Especial do Dia",
    description: "5% de chance da partida gerar 1 Ovo de Evento para um jogador aleatório da dupla vencedora.",
    effectJson: { type: "REWARD_CHANCE_WINNER", reward: "EGG_EVENT", chance: 0.05 },
  },
  {
    key: "PRESENTE_DO_PUBLICO",
    name: "Presente do Público",
    description: "Um jogador aleatório da partida recebe 300 ZC.",
    effectJson: { type: "REWARD_RANDOM_PLAYER", reward: "ZC", value: 300 },
  },
  // 18.4 Caóticos
  {
    key: "TROCA_DE_PAPEIS",
    name: "Troca de Papéis",
    description: "O mascote com maior Força usa Carisma no lugar de Força nesta partida.",
    effectJson: { type: "STAT_SWAP_TOP", stat: "statForce", swapTo: "statCharisma" },
  },
  {
    key: "INSTINTO_CONFUSO",
    name: "Instinto Confuso",
    description: "Instinto alto aumenta o risco de erro até 24%, mas também aumenta a chance de crítico de +50% de dano.",
    effectJson: { type: "INSTINCT_CHAOS" },
  },
  {
    key: "TATICA_INVERTIDA",
    name: "Tática Invertida",
    description: "O menor nível de cada equipe recebe prioridade de ataque. Empates usam a menor soma total de status.",
    effectJson: { type: "LOWEST_LEVEL_PRIORITY", tieBreak: "LOWEST_TOTAL_STATS" },
  },
  {
    key: "AULA_DO_ENGUICA",
    name: "Aula do Enguiça",
    description: "Um mascote aleatório de cada dupla recebe um buff alto, mas temporário.",
    effectJson: { type: "RANDOM_MASCOT_BOOST", value: 50 },
  },
  {
    key: "PANE_NA_ARENA",
    name: "Pane na Arena",
    description: "No meio da luta, cada mascote vivo tem um status alterado aleatoriamente entre -20 e +20.",
    effectJson: { type: "MID_BATTLE_REROLL" },
  },
  {
    key: "CLIMA_ESQUISITO",
    name: "Clima Esquisito",
    description: "Um tipo aleatório recebe +20% e outro tipo recebe -20%.",
    effectJson: { type: "RANDOM_TYPE_MODIFIER", boost: 0.2, penalty: 0.2 },
  },
  {
    key: "DUPLA_DESAFINADA",
    name: "Dupla Desafinada",
    description: "Se os dois jogadores da dupla compartilharem algum tipo entre suas escolhas, a dupla perde 15% dos status.",
    effectJson: { type: "SAME_TYPE_PLAYERS_PENALTY", value: 0.15 },
  },
  {
    key: "HARMONIA_TOTAL",
    name: "Harmonia Total",
    description: "Se os 6 mascotes da dupla forem de tipos diferentes, recebem +15 em todos os status.",
    effectJson: { type: "TEAM_TYPE_UNIQUE_BOOST", value: 15 },
  },
  {
    key: "MEDO_DO_FAVORITO",
    name: "Medo do Favorito",
    description: "O mascote de maior nível de cada dupla começa com 50% da Agilidade.",
    effectJson: { type: "HIGHEST_LEVEL_AGILITY_PENALTY", value: 0.5 },
  },
  // 18.5 Bloqueio
  {
    key: "BAIXA_ROTACAO",
    name: "Baixa Rotação",
    description: "Cada jogador pode usar 1 mascote acima do nível 30 normalmente. Outros entram com status reduzidos proporcionalmente ao equivalente do nível 30, sem bloquear a partida.",
    effectJson: { type: "HIGH_LEVEL_LIMIT_SOFT", maxAboveLevel: 1, level: 30 },
  },
  {
    key: "PROIBIDAO_DOS_FORTES",
    name: "Proibidão dos Fortes",
    description: "O mascote com maior status total de cada jogador fica com todos os status em 20 nesta rodada.",
    effectJson: { type: "TOP_TOTAL_STATS_NERF", value: 20 },
  },
  {
    key: "SEM_MASCOTE_PRINCIPAL",
    name: "Sem Mascote Principal",
    description: "O mascote companheiro não deve ser usado. Se for escalado automaticamente ou por falta de opção, entra com todos os status em 20, sem bloquear a partida.",
    effectJson: { type: "EQUIPPED_MASCOT_NERF", value: 20 },
  },
  {
    key: "GERACAO_SORTEADA",
    name: "Geração Sorteada",
    description: "Apenas mascotes de uma geração sorteada recebem bônus de +30 em todos os status.",
    effectJson: { type: "RANDOM_GENERATION_STAT_BOOST", value: 30 },
  },
];

export async function adminSeedModifiersAction(): Promise<{ error?: string; created: number; skipped: number }> {
  try {
    await requireAdmin();

    let created = 0;
    let skipped = 0;

    // Find existing keys first
    const existingKeys = new Set(
      (await prisma.syncEventModifier.findMany({ select: { key: true } })).map((m) => m.key)
    );

    for (const mod of MODIFIERS) {
      await prisma.syncEventModifier.upsert({
        where: { key: mod.key },
        update: { name: mod.name, description: mod.description, effectJson: mod.effectJson },
        create: {
          key: mod.key,
          name: mod.name,
          description: mod.description,
          effectJson: mod.effectJson,
          active: true,
        },
      });

      if (existingKeys.has(mod.key)) {
        skipped++;
      } else {
        created++;
      }
    }

    revalidatePath("/desafio-sincronizado");
    return { created, skipped };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao popular modificadores.", created: 0, skipped: 0 };
  }
}
