import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";

export type ManualContentMap = Record<string, string>;

// Textos padrão do manual — usados quando a chave não existe no banco
export const MANUAL_DEFAULTS: ManualContentMap = {
  // ── Mascotes & EXP ──────────────────────────────────────────────────────────
  "mascotes.intro":
    "Cada mascote possui um medidor de EXP que avança com atividades. O EXP necessário para subir de nível é calculado como 100 + (nível atual × 20) EXP.",
  "mascotes.pos.note":
    "Mascotes na bancada recebem 50% do EXP em expedições e ações em massa. Promova à Equipe Favorita para maximizar o ganho.",

  // ── Evoluções ───────────────────────────────────────────────────────────────
  "evolucoes.intro":
    "Mascotes evoluem automaticamente ao atingir os níveis determinados pela linha evolutiva de cada Pokémon. A evolução é detectada na hora que o mascote sobe de nível — não precisa de ação manual.",
  "evolucoes.eggs":
    "Ovos são obtidos em expedições, como recompensa de partidas e pelo bazar. Ao receber um ovo, ele entra automaticamente na incubadora (duração: 10 minutos). Ao chocar, você recebe um mascote aleatório do pool correspondente.",
  "evolucoes.note":
    "Ovos são o item mais valioso das expedições longas (6h modo Itens). Em expedições de 6h no modo Itens, ovos são o drop dominante.",

  // ── Interações ──────────────────────────────────────────────────────────────
  "interacoes.social":
    "Relacionamentos com outros mascotes adicionam bônus de EXP em interações, com cap de +25%.",
  "interacoes.note":
    "O humor do mascote afeta o EXP ganho. ANGRY e TIRED bloqueiam interações; CONFIDENT e COMPETITIVE concedem bônus extras.",

  // ── Expedições ──────────────────────────────────────────────────────────────
  "expedicoes.modos":
    "A Arena Z possui salas com limite máximo de nível. Mascotes acima do limite não podem entrar. Cada sala tem uma atmosfera diferente e influencia o tipo de adversário.",
  "expedicoes.formula":
    "EXP final = Base (50) × multiplicador de duração × (1 + bônus de nível) × (1 + bônus de aliados)",
  "expedicoes.qualidade.note":
    "Instinto efetivo = statInstinct + floor(nível/5). Com Amuleto da Sorte ativo, o valor dobra.",
  "expedicoes.especiais.note":
    "Percentuais dentro do pool de \"Item Especial\". Política de Fraqueza e Ovo da Sorte só caem em 6h (Padrão e Itens).",
  "expedicoes.padrao.note":
    "Pesos aproximados para mascote nível 10, sem buff de sorte, sem aliados.",
  "expedicoes.itens.note":
    "Ovos são o drop mais frequente em expedições longas (6h).",

  // ── Itens & Buffs ────────────────────────────────────────────────────────────
  "itens.buffs.note":
    "A Cesta de Piquenique afeta somente expedições. A redução de 30% combina com a redução de Agilidade e é consumida ao iniciar a próxima expedição.",
  "itens.calc":
    "EXP base = 25 · fator de posição (1.5 se companheiro, 1.25 se favorito, 1.0 se banco) · bônus social (0–+25%) · Vitamina (+25% se ativa)",
  "itens.calc.exemplo":
    "Exemplo: Companheiro com Vitamina + 2 aliados = 25 × 1.5 × 1.25 × 1.10 ≈ 52 EXP",

  // ── Arena Z ──────────────────────────────────────────────────────────────────
  "arena.intro":
    "A Arena Z possui salas com limite máximo de nível. Mascotes acima do limite não podem entrar. Cada sala tem uma atmosfera diferente e influencia o tipo de adversário.",
  "arena.batalha":
    "O dano é calculado com base nos atributos do mascote: Força, Agilidade, Carisma, Instinto e Vitalidade. Vantagens de tipo (como Fogo > Grama) concedem multiplicador de 1.5× no ataque.",
  "arena.pve.note":
    "Existe um limite de ZikaCoins que pode ser ganho via PvE por dia. O contador reseta automaticamente à meia-noite (horário de Brasília).",
  "arena.note":
    "Um mascote ferido (INJURED) ou em arena (ARENA) não pode participar de expedições ou interações até ser liberado.",

  // ── Economia ─────────────────────────────────────────────────────────────────
  "economia.note":
    "As taxas do Bazar vão para o cofre do Miauvadão, que usa esse saldo para financiar descontos maiores nas ofertas diárias.",

  // ── Bazar ────────────────────────────────────────────────────────────────────
  "bazar.intro":
    "O Bazar é o mercado de jogadores: venda, compra e troca de mascotes, ovos e itens com outros participantes.",
  "bazar.miauvadao":
    "O Miauvadão atualiza 3 ofertas às 04:00, 10:00, 16:00 e 22:00 (horário de Brasília). Cada jogador possui duas cargas de compra, que recarregam individualmente 10 minutos após o uso. Uma vez por rotação, qualquer jogador pode pagar 250 ZC para trocar um único slot para todos.",

  // ── TCG ──────────────────────────────────────────────────────────────────────
  "tcg.premios":
    "Cada vitória concede prêmios à escolha do adversário (normalmente 3 cartas do baralho do perdedor). Prêmios são registrados manualmente no sistema pela administração.",
  "tcg.insignias":
    "Insígnias são mantidas por um detentor até serem conquistadas por um desafiante em partida oficial. Cada insígnia vale 3 pontos enquanto possuída. Defender ou conquistar uma insígnia gera EXP ao mascote companheiro.",

  // ── Torneios ─────────────────────────────────────────────────────────────────
  "torneios.ranking":
    "O ranking combina pontos de vitórias, prêmios capturados e pontos de insígnias possuídas. O Top do Dia é definido pelo melhor desempenho na semana atual.",
  "torneios.conquistas":
    "Conquistas são desbloqueadas realizando feitos específicos em partidas (ex: vencer com baralho completo de Habilidades, capturar 4 prêmios em uma investida, etc.). Bronze vale 5 pts · Prata vale 7 pts · Ouro vale 10 pts. Cada conquista tem apenas um detentor por vez.",

  // ── Passe Apoiador ───────────────────────────────────────────────────────────
  "apoiador.note":
    "O Passe Apoiador é ativado por código. Os dias de bônus são liberados por calendário BRT (horário de Brasília), não por período de 24h corridas.",

  // Rodapé
  "footer":
    "Manual da Liga Zikachu — versão interna. Valores podem ser ajustados pelo admin via ZikaShop ou configurações.",
};

const CONTENT_ID = "manual";

const fetchManualContent = unstable_cache(
  async (): Promise<ManualContentMap> => {
    try {
      const record = await prisma.siteContent.findUnique({ where: { id: CONTENT_ID } });
      if (!record) return { ...MANUAL_DEFAULTS };
      const stored = record.data as ManualContentMap;
      return { ...MANUAL_DEFAULTS, ...stored };
    } catch {
      return { ...MANUAL_DEFAULTS };
    }
  },
  ["manual-content"],
  { tags: ["manual-content"] }
);

export async function getManualContent(): Promise<ManualContentMap> {
  return fetchManualContent();
}

export async function saveManualContent(
  key: string,
  value: string,
  updatedBy: string
): Promise<void> {
  await prisma.siteContent.upsert({
    where: { id: CONTENT_ID },
    update: {
      data: { [key]: value },
      updatedBy,
    },
    create: {
      id: CONTENT_ID,
      data: { [key]: value },
      updatedBy,
    },
  });
}

export async function saveAllManualContent(
  data: ManualContentMap,
  updatedBy: string
): Promise<void> {
  // Carrega conteúdo atual e faz merge
  let current: ManualContentMap = {};
  try {
    const record = await prisma.siteContent.findUnique({ where: { id: CONTENT_ID } });
    if (record) current = record.data as ManualContentMap;
  } catch { /* tabela ainda não existe */ }

  await prisma.siteContent.upsert({
    where: { id: CONTENT_ID },
    update: { data: { ...current, ...data }, updatedBy },
    create: { id: CONTENT_ID, data: { ...current, ...data }, updatedBy },
  });
}
