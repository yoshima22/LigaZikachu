export type TowerDisclosureConfig = { requireTicket: boolean };
export type TowerDisclosureInventory = { ticketCount: number; reviveKitCount: number };

export function buildTowerEntryStatus(required: boolean, members: { userId: string; count: number }[]) {
  const missingUserIds = required ? members.filter((member) => member.count < 1).map((member) => member.userId) : [];
  return { required, missingUserIds, canStart: missingUserIds.length === 0 };
}

/** Text shown before Ready must describe the currently wired economy, not a planned one. */
export function buildTowerEventDisclosure(config: TowerDisclosureConfig, inventory: TowerDisclosureInventory) {
  const ticketCount = Math.max(0, Math.floor(inventory.ticketCount || 0));
  const kitCount = Math.max(0, Math.floor(inventory.reviveKitCount || 0));
  return {
    ticket: {
      required: config.requireTicket,
      count: ticketCount,
      consumedAt: config.requireTicket ? "RUN_START" as const : "NEVER" as const,
      explanation: config.requireTicket
        ? "Cada jogador gasta 1 Ticket da Torre somente quando o dono inicia a expedição; criar ou entrar na sala não consome ticket."
        : "A exigência de ticket está desligada nesta configuração; iniciar a expedição não consome ticket.",
      acquisition: "No momento, não há uma fonte automática ou compra ativa de tickets para jogadores. A Torre permanece restrita até a economia do evento ser configurada.",
    },
    recovery: {
      kitCount,
      kitRule: "Um aliado vivo usa o kit na mesma sala do treinador caído. O item é consumido na resolução; os dois mascotes retornam com metade do HP e agem no próximo turno.",
      roomCooldown: "A sala de recuperação pode ser usada uma vez a cada 2 andares. O resgate alcança um aliado caído mesmo distante; não depende de horas de espera.",
      acquisition: "O Kit de Reanimação ainda não possui fonte pública de obtenção; está restrito à configuração administrativa do evento.",
    },
    floorLoot: {
      rule: "Achados de sala ficam pendentes até derrotar o chefe do andar; somente então se tornam garantidos para a equipe elegível.",
      failure: "Se a equipe cair antes do chefe, perde os achados pendentes daquele andar. Achados de andares já vencidos permanecem garantidos.",
      eligibility: "Treinadores caídos recebem espólio garantido. Quem abandonou por AFK não recebe recompensas da tentativa.",
    },
    chests: [
      { name: "Doces", source: "Liga Semanal", active: false, results: [] as never[],
        explanation: "Integração planejada: participação válida na Liga Semanal dará um baú por ciclo. Ainda não há catálogo, probabilidades nem abertura ativos." },
      { name: "Travessuras", source: "Liga Rush", active: false, results: [] as never[],
        explanation: "Integração planejada: participação válida na Liga Rush dará um baú por ciclo. Ainda não há catálogo, probabilidades nem abertura ativos." },
    ],
  };
}
