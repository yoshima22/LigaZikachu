import { prisma } from "../src/lib/prisma";
import { addExp } from "../src/lib/mascot";
import { getPokemonName } from "../src/lib/mascot-data";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const MARKER = "Correção férias Prof. Carvalho";

type VacationMeta = {
  vacationDays?: number;
  expBonus?: number;
  eggChancePct?: number;
};

function readVacationMeta(raw: unknown): Required<VacationMeta> {
  const meta = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as VacationMeta
    : {};
  return {
    vacationDays: Number(meta.vacationDays ?? 7),
    expBonus: Number(meta.expBonus ?? 6000),
    eggChancePct: Number(meta.eggChancePct ?? 30),
  };
}

function isWrongVacationClaim(rewardJson: unknown) {
  if (!rewardJson || typeof rewardJson !== "object" || Array.isArray(rewardJson)) return false;
  const data = rewardJson as Record<string, unknown>;
  if (data.type === "VACATION") return false;
  return data.type === "COINS" || data.type === "FOOD" || data.type === "EGG" || data.type === "BUFF_ITEM" || data.type === "NOTHING";
}

async function main() {
  const shopItem = await prisma.shopItem.findFirst({
    where: { type: "VACATION_TICKET", active: true },
    select: { metadata: true },
  });
  const meta = readVacationMeta(shopItem?.metadata);

  const players = await prisma.player.findMany({
    where: {
      OR: [
        { displayName: { contains: "Luiz", mode: "insensitive" } },
        { ptcglNick: { contains: "Luiz", mode: "insensitive" } },
      ],
    },
    select: { id: true, displayName: true, ptcglNick: true },
  });

  console.log(`Modo: ${APPLY ? "APLICAR" : "DRY-RUN"}`);
  console.log(`Meta férias: ${meta.vacationDays}d, +${meta.expBonus} EXP, ${meta.eggChancePct}% ovo comum`);
  console.log(`Jogadores encontrados: ${players.map(p => `${p.displayName} (${p.ptcglNick ?? "sem nick"})`).join(", ") || "nenhum"}`);

  const candidates = [];
  for (const player of players) {
    const treeckos = await prisma.mascot.findMany({
      where: { playerId: player.id, pokemonId: 252 },
      orderBy: [{ hatchedAt: "desc" }],
      select: {
        id: true,
        playerId: true,
        nickname: true,
        pokemonId: true,
        level: true,
        exp: true,
        happiness: true,
        mood: true,
        hatchedAt: true,
        expeditions: {
          orderBy: { startedAt: "desc" },
          take: 5,
          select: { id: true, status: true, rewardJson: true, startedAt: true, finishAt: true },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 12,
          select: { id: true, description: true, createdAt: true },
        },
      },
    });

    for (const mascot of treeckos) {
      const corrected = mascot.events.some(event => event.description.includes(MARKER));
      const wrongVacationExpedition = mascot.expeditions.find(expedition =>
        expedition.status === "CLAIMED" && isWrongVacationClaim(expedition.rewardJson)
      );
      const score = (wrongVacationExpedition ? 10 : 0) + (corrected ? -100 : 0);
      candidates.push({ player, mascot, corrected, wrongVacationExpedition, score });
    }
  }

  if (candidates.length === 0) {
    console.log("Nenhum Treecko do Luiz encontrado.");
    return;
  }

  for (const entry of candidates) {
    const name = entry.mascot.nickname ?? getPokemonName(entry.mascot.pokemonId);
    console.log([
      `Candidato: ${name}`,
      `player=${entry.player.displayName}`,
      `id=${entry.mascot.id}`,
      `lv=${entry.mascot.level}`,
      `exp=${entry.mascot.exp}`,
      `felicidade=${entry.mascot.happiness}`,
      `nascido=${entry.mascot.hatchedAt.toISOString()}`,
      `corrigido=${entry.corrected}`,
      `expedicaoErrada=${entry.wrongVacationExpedition?.id ?? "nao"}`,
    ].join(" | "));
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const target = sorted[0];
  if (!target || target.corrected && !FORCE) {
    console.log("Compensação já encontrada neste Treecko. Use --force para reaplicar.");
    return;
  }

  if (candidates.length > 1 && !target.wrongVacationExpedition) {
    console.log("Há mais de um Treecko e nenhum tem expedição incorreta clara. Não apliquei para evitar compensar o mascote errado.");
    return;
  }

  const targetName = target.mascot.nickname ?? getPokemonName(target.mascot.pokemonId);
  const eggRoll = Math.random() * 100;
  const gotEgg = eggRoll < meta.eggChancePct;

  console.log(`Alvo: ${targetName} (${target.mascot.id})`);
  console.log(`Recompensa a aplicar: +${meta.expBonus} EXP, felicidade 100, ovo comum=${gotEgg} (roll ${eggRoll.toFixed(2)})`);

  if (!APPLY) {
    console.log("Dry-run: nada foi alterado. Rode com --apply para aplicar.");
    return;
  }

  const expResult = await addExp(target.mascot.id, meta.expBonus, {
    ignoreBenchPenalty: true,
    ignoreExpBoost: true,
  });

  await prisma.$transaction(async (tx) => {
    await tx.mascot.update({
      where: { id: target.mascot.id },
      data: {
        happiness: 100,
        mood: "HAPPY",
        lastFedAt: new Date(),
        lastInteractedAt: new Date(),
      },
    });

    if (gotEgg) {
      await tx.mascotEgg.create({
        data: { playerId: target.player.id, type: "COMMON", origin: "VACATION_REPAIR" },
      });
    }

    await tx.mascotEvent.create({
      data: {
        mascotId: target.mascot.id,
        emoji: "🏖️",
        description: `${MARKER}: +${meta.expBonus} EXP, felicidade máxima${gotEgg ? " e Ovo Comum compensatório" : ""}.`,
      },
    });
  });

  console.log(`Aplicado. Level up=${expResult.leveled}; novo nível=${expResult.newLevel}; evoluiu=${expResult.evolved}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
