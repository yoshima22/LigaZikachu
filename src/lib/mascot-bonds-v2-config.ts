// Constantes de balanceamento do Laços Alpha. Módulo PURO (sem Prisma): pode ser
// importado por componentes cliente sem puxar código de servidor para o bundle.
export const BONDS_V2_BALANCE = {
  friend: { minScore: 40, expeditionTimeReductionPct: 3, trainingExpPct: 5 },
  superFriend: { minScore: 80, expeditionTimeReductionPct: 7, trainingExpPct: 10 },
  enemy: { maxScore: -50, damagePct: 5 },
  nemesis: { maxScore: -80, damagePct: 8, directRounds: 3 },
  motivation: { activationsPerMascotPerDay: 1 },
  caps: { expeditionTimeReductionPct: 8, trainingExpPct: 10 },
  publicSpaces: {
    maxMascotsPerPlayer: 8,
    maxMascotsPerPlayerInSameLocation: 3,
    moveCooldownMinutes: 120,
    automaticEventIntervalHours: 4,
  },
} as const;
