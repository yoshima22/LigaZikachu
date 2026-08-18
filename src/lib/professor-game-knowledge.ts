import { COMBAT_ROLE_DESCRIPTIONS, COMBAT_ROLE_LABELS } from "@/lib/combat-roles";
import { getPokemonName, PERSONALITY_DESCRIPTION } from "@/lib/mascot-data";
import { PERSONALITY_DESIGN, STAT_LABEL, DEBUFF_RESISTANCE } from "@/lib/personality-design";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";

const CORE_KNOWLEDGE = `
FONTE DE VERDADE DA LIGA ZIKACHU
- Diferencie o jogo de mascotes da Liga Zikachu do Pokemon TCG. Perguntas sobre Arena, Liga Semanal, expedicoes, laboratorio, ovos, itens, lacos e mascotes referem-se ao jogo do site.
- Nunca invente regra, porcentagem, recompensa, carta, atributo ou dado da conta. Quando o contexto nao trouxer o valor exato, diga claramente que nao consegue confirmar e indique a tela correta.
- Resultados com aleatoriedade sao estimativas: explique a formula e os limites, sem prometer um resultado.
- No TCG Regular, somente cartas com marca de regulacao H, I ou J podem ser recomendadas. Carta rotacionada nao e carta banida.
`;

const COMBAT_KNOWLEDGE = `
COMBATE CONVENCIONAL (Arena e Liga Semanal)
- HP maximo: 55 + nivel x 6 + Vitalidade x 4.
- Ordem de acao: maior Agilidade primeiro, com desempate/variacao aleatoria de -3 a +3.
- Acoes por rodada: 1 normalmente; 2 quando a Agilidade fica pelo menos 60 acima da media adversaria; 3 quando fica pelo menos 140 acima. Maximo 3.
- Dano bruto antes das posturas: (Forca x 1,8 + nivel x 2 + Instinto x 0,7 + aleatorio de 0 a 12).
- Esse dano recebe bonus de Encorajador, Batedor, postura e tipo. A mitigacao base e Vitalidade do alvo x 0,8 + nivel do alvo. O dano minimo e 1.
- Vantagem de tipo multiplica o dano por 1,3. Sem vantagem, o multiplicador e 1,0.
- Cuidador cura um aliado vivo por vez, priorizando o ferido com menor HP. Cura = arredondar((Carisma x 0,35 + Vitalidade x 0,25 + nivel) x 2,5), minimo 15. Limite de curas = 2 + piso((Carisma + Vitalidade) / 40).
- Guardiao intercepta de 15% a 40% do dano dirigido a um aliado. Sobrevivente pode resistir uma vez com 1 HP.
- Um mascote nocauteado nao age, nao recebe cura e nao pode continuar como alvo valido.
POSTURAS:
${Object.entries(COMBAT_ROLE_DESCRIPTIONS).map(([role, description]) => `- ${COMBAT_ROLE_LABELS[role as keyof typeof COMBAT_ROLE_LABELS]}: ${description}`).join("\n")}
`;

const LAB_KNOWLEDGE = `
LABORATORIO E CRESCIMENTO
- A primeira analise custa 100 ZC. Depois de desbloqueada para aquele mascote, novas simulacoes em qualquer nivel sao gratuitas.
- A nota de potencial e permanente enquanto a base do mascote nao for rerrolada; uma Pena Arco-Iris invalida a analise antiga e exige recalculo.
- Nota por score: SSS >=92; SS >=82; S >=72; A >=60; B >=47; C >=34; D >=20; E abaixo de 20.
- Score = 55% da qualidade estimada do roll inicial + 45% do teto da especie/linha evolutiva. Ele nao e simplesmente a soma atual dos atributos.
- A projecao usa o mesmo crescimento do level-up, evolucoes e marcos. Mascotes sem evolucao recebem 3 pontos de maturidade nos niveis 16, 32 e 50. Lendarios nao recebem esses marcos.
- O total atual, a nota e o melhor papel respondem perguntas diferentes: total mede o estado atual; nota mede o teto intrinseco; postura usa a distribuicao dos atributos.
`;

const EXPEDITION_KNOWLEDGE = `
EXPEDICOES
- Treinamento entrega EXP e nao sorteia loot. Itens foca loot e nao entrega EXP base. Padrao combina EXP menor com loot.
- EXP considera base e duracao, bonus por faixas de nivel, +10% por amigo, rivalidade com teto de +15%, Ovo da Sorte quando aplicavel, Vitamina e Cesta de Piquenique.
- Agilidade reduz apenas a segunda metade da duracao. O roll vai de 0% a 13% sobre essa metade, portanto o ganho total maximo por Agilidade e 6,5%. O valor fica estavel por mascote/modo/duracao durante o dia para impedir reroll por cancelamento.
- Cesta reduz 30% da proxima expedicao e acumula com Agilidade. Por 3 horas: Treinamento +25% EXP; Itens +3 pontos percentuais para ovo/item especial; Padrao +12% EXP e +1,5 ponto percentual para ovo/item especial.
- Pedra de mega evolucao somente pode cair em expedicao de Itens de 6 horas. A chance varia de 0,1% a 0,5% conforme Instinto; com Instinto 80 ou mais, fica em 0,5%.
`;

const MASCOT_KNOWLEDGE = `
MASCOTES, INTERACOES E PERSONALIDADES
- EXP para o proximo nivel = 100 + nivel atual x 20. Nivel maximo 100.
- A distribuicao de atributos no level-up usa pesos dos atributos atuais, especie e personalidade, com protecao periodica para um atributo muito atrasado.
- Companheiro/equipado e favorito recebem bonus diferentes em interacoes; a conta nunca pode ultrapassar seis favoritos e o equipado precisa estar entre eles.
- Amigos e rivais podem alterar EXP e gerar eventos sociais. Conhecido nao e rival.
PERSONALIDADES:
${Object.entries(PERSONALITY_DESCRIPTION).map(([key, description]) => `- ${key}: ${description}`).join("\n")}
`;

const PERSONALITY_KNOWLEDGE = `
REFORMULACAO DAS PERSONALIDADES (ativa no jogo)
- Cada personalidade tem afinidade de atributos (muito util / util) que guia o crescimento no level-up (muito util x1,15, util x1,08) e efeitos inteligentes. Caotico nao tem afinidade fixa e concentra pontos (build instavel).
- As tres personalidades novas sao Curioso, Guloso e Sereno; ja entram no sorteio de novos mascotes.
- Os efeitos de combate valem na Arena Z, na Liga Semanal, na Liga Rush e na Arena Sincronizada. Os resultados aleatorios sao rolados uma vez e ficam gravados no replay (reassistir nunca refaz sorteios).
- Resistencia de buff/debuff: a forca do debuff usa o Instinto de quem aplica; a resistencia do alvo usa ${Math.round(DEBUFF_RESISTANCE.targetInstinctWeight * 100)}% de Instinto + ${Math.round(DEBUFF_RESISTANCE.targetVitalityWeight * 100)}% de Vitalidade; o efeito fica entre ${Math.round(DEBUFF_RESISTANCE.minEffect * 100)}% e ${Math.round(DEBUFF_RESISTANCE.maxEffect * 100)}%.
- No Laboratorio, ate 26/08/2026, mascotes Caoticos podem fazer um re-roll caotico de status (uso unico): redistribui o total atual pela regra caotica nivel a nivel, sem inflar.
AFINIDADE E EFEITOS POR PERSONALIDADE:
${PERSONALITY_DESIGN.map((p) => `- ${p.label}${p.isNew ? " (nova)" : ""}: afinidade ${p.affinity.veryUseful ? STAT_LABEL[p.affinity.veryUseful] : "sem preferencia"}/${p.affinity.useful ? STAT_LABEL[p.affinity.useful] : "sem preferencia"}. Interacoes: ${p.interactions} Expedicoes: ${p.expeditions} Combate: ${p.combat}${p.limitation ? ` Limitacao: ${p.limitation}` : ""}`).join("\n")}
`;

const WEEKLY_LEAGUE_KNOWLEDGE = `
LIGA SEMANAL DOS MASCOTES
- Liga automatica de segunda a sexta, aberta a todos os jogadores ativos (nao-casuais). Tres combates por dia (20:00, 20:10, 20:20), equipes de 6 mascotes.
- O jogador monta ate 3 times por dia; pode salvar ate 10 presets de equipe (mascotes + ordem + posturas) reutilizaveis, tambem disponiveis na Arena Z. Um mascote nao pode estar em dois times ao mesmo tempo no dia.
- Pareamento suico: pareia por proximidade na tabela e evita repetir o mesmo adversario no dia e revanches na semana.
- Desempate: pontos, depois vitorias. BYE (folga) e W/O valem 3 pontos e 0 vitorias, entao pesam menos que uma vitoria real.
- Quem terminar a edicao com todas as partidas em W/O nao recebe recompensas e entra no modo casual (pode desligar depois).
- As personalidades e posturas dos mascotes se aplicam no combate. As transmissoes ao vivo ficam na Zika TV.
`;

const ECONOMY_KNOWLEDGE = `
OVOS, BAZAR E ECONOMIA
- Todo tipo de ovo pode gerar qualquer raridade de mascote permitida por suas chances; a raridade do ovo define chances e faixa de atributos, enquanto a geracao limita a especie. Somente formas iniciais nascem.
- Escolha aleatoria de geracao recebe +1 ponto percentual nas chances de classes raras configuradas.
- O Miauvadao troca ofertas as 04:00, 10:00, 16:00 e 22:00 no horario de Brasilia. Cada jogador tem duas cargas de compra, cada uma recarrega 10 minutos apos o uso.
- Compras dos slots do Miauvadao geram 25% para o cofre. Compras entre jogadores geram 10% de dinheiro fantasma no cofre, sem descontar esse adicional das partes.
`;

const TCG_KNOWLEDGE = `
POKEMON TCG E TORNEIOS
- Recomende apenas cartas reais retornadas no catalogo verificado desta requisicao.
- Para partidas regulares desta temporada, a legalidade e estrita: marca H, I ou J. Nunca recomende marcas A-G, cartas sem marca confirmada ou cartas apenas de Expanded.
- Um deck regular tem exatamente 60 cartas e no maximo quatro cartas de mesmo nome, exceto Energias Basicas e regras especificas impressas na carta.
- Ao falar do meta, use somente os dados de torneios fornecidos no contexto. Nao transforme popularidade em garantia de vitoria.
- Se o jogador pedir uma carta fora da rotacao, explique que saiu do Standard; nao diga que foi banida, salvo banimento explicito.
`;

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function buildProfessorGameKnowledge(query: string) {
  const q = normalizeText(query);
  const wantsAll = /regra|como funciona|ajuda|dica|tudo|liga zikachu/.test(q);
  const sections = [CORE_KNOWLEDGE];
  if (wantsAll || /arena|combate|dano|postura|ataque|cura|agilidade|defesa|liga semanal/.test(q)) sections.push(COMBAT_KNOWLEDGE);
  if (wantsAll || /laboratorio|analise|nota|rank|sss|score|potencial|atributo|status|crescimento|maturidade/.test(q)) sections.push(LAB_KNOWLEDGE);
  if (wantsAll || /expedicao|loot|treino|itens|agilidade|pedra|cesta/.test(q)) sections.push(EXPEDITION_KNOWLEDGE);
  if (wantsAll || /mascote|pokemon|personalidade|humor|amigo|rival|laco|exp|nivel|favorito/.test(q)) sections.push(MASCOT_KNOWLEDGE);
  if (wantsAll || /personalidade|afinidade|caotico|guloso|sereno|curioso|leal|orgulhoso|travesso|preguicoso|competitivo|dramatico|brincalhao|eletrico|timid|re-roll|reroll/.test(q)) sections.push(PERSONALITY_KNOWLEDGE);
  if (wantsAll || /liga semanal|preset|pareamento|bye|w\/o|wo|casual/.test(q)) sections.push(WEEKLY_LEAGUE_KNOWLEDGE);
  if (wantsAll || /ovo|bazar|miauvadao|cofre|compra|venda|leilao/.test(q)) sections.push(ECONOMY_KNOWLEDGE);
  if (wantsAll || /tcg|deck|baralho|carta|standard|rotacao|meta|torneio|insignia/.test(q)) sections.push(TCG_KNOWLEDGE);
  return sections.join("\n");
}

function ratingWeight(rating: string | null) {
  return ({ SSS: 8, SS: 7, S: 6, A: 5, B: 4, C: 3, D: 2, E: 1 } as Record<string, number>)[rating ?? ""] ?? 0;
}

export async function buildProfessorPlayerContext(query: string): Promise<string> {
  const q = normalizeText(query);
  if (!/meu|minha|tenho|mascote|pokemon|equipe|time|laboratorio|analise|status|atributo|postura|expedicao/.test(q)) return "";

  const session = await getAppSession();
  if (!session?.user.id) return "CONTA DO JOGADOR: sessao nao identificada; nao afirme dados pessoais.";
  const player = await getSessionPlayer(session.user.id);
  if (!player) return "CONTA DO JOGADOR: perfil de jogador nao encontrado.";

  const mascots = await prisma.mascot.findMany({
    where: { playerId: player.id },
    select: {
      id: true, pokemonId: true, nickname: true, level: true, personality: true,
      statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true,
      happiness: true, mood: true, isEquipped: true, isFavorite: true, arenaState: true,
      analyzedAt: true, ivScore: true, ivRating: true, performanceTag: true,
    },
  });

  const scored = mascots.map((mascot) => {
    const species = getPokemonName(mascot.pokemonId);
    const name = mascot.nickname || species;
    const total = mascot.statForce + mascot.statAgility + mascot.statCharisma + mascot.statInstinct + mascot.statVitality;
    const mentioned = [name, species].some((value) => q.includes(normalizeText(value)));
    return { ...mascot, species, name, total, mentioned };
  }).sort((a, b) => Number(b.mentioned) - Number(a.mentioned) || Number(b.isEquipped) - Number(a.isEquipped) || ratingWeight(b.ivRating) - ratingWeight(a.ivRating) || b.total - a.total);

  const selected = scored.filter((m, index) => m.mentioned || m.isEquipped || m.isFavorite || index < 12).slice(0, 18);
  const wantsAnalysis = /laboratorio|analise|nota|rank|sss|score|potencial|projecao/.test(q);
  const analyses = wantsAnalysis && selected.some((m) => m.analyzedAt)
    ? await prisma.mascot.findMany({ where: { playerId: player.id, id: { in: selected.filter((m) => m.analyzedAt).map((m) => m.id) } }, select: { id: true, analysisJson: true } })
    : [];
  const analysisById = new Map(analyses.map((entry) => [entry.id, entry.analysisJson as Record<string, unknown> | null]));

  const lines = selected.map((m) => {
    const flags = [m.isEquipped ? "companheiro" : null, m.isFavorite ? "favorito" : null, m.arenaState !== "FREE" ? m.arenaState : null].filter(Boolean).join(", ");
    const analysis = analysisById.get(m.id);
    const projected = analysis?.projectedTotal != null ? `; projecao total ${analysis.projectedTotal} no Nv.${analysis.targetLevel}` : "";
    const roles = Array.isArray(analysis?.roleSuggestions)
      ? `; papeis sugeridos ${(analysis.roleSuggestions as Array<{ label?: string }>).slice(0, 3).map((role) => role.label).filter(Boolean).join(", ")}`
      : "";
    return `- ${m.name} (${m.species}, Nv.${m.level}${flags ? `, ${flags}` : ""}): FOR ${m.statForce}, AGI ${m.statAgility}, CAR ${m.statCharisma}, INS ${m.statInstinct}, VIT ${m.statVitality}, total ${m.total}; personalidade ${m.personality}; humor ${m.mood}; felicidade ${m.happiness}; tag ${m.performanceTag}; analise ${m.ivRating ?? "nao realizada"}${m.ivScore != null ? ` (${m.ivScore}/100)` : ""}${projected}${roles}.`;
  });

  return `DADOS PRIVADOS DA CONTA LOGADA (${player.displayName})\nTotal de mascotes: ${mascots.length}. Mostrando os mais relevantes para a pergunta.\n${lines.join("\n")}\nUse somente estes dados ao falar da conta. Se um mascote nao aparece aqui, peça o nome exato.`;
}
