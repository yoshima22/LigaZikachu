export type EnguicaContract = {
  key: string;
  title: string;
  description: string;
};

export const ENGUICA_CONTRACTS: readonly EnguicaContract[] = [
  { key: "ARSENAL_TATICO", title: "Arsenal Tático", description: "O deck registrado contém pelo menos 28 cartas de Treinador." },
  { key: "RESERVA_ESPECIAL", title: "Reserva Especial", description: "Finalize a partida com pelo menos 4 Energias Especiais no descarte." },
  { key: "ATAQUE_CARREGADO", title: "Ataque Carregado", description: "Finalize a partida com um ataque cujo custo impresso seja de pelo menos 3 Energias e esteja totalmente pago." },
  { key: "BANCO_SOB_PRESSAO", title: "Banco Sob Pressão", description: "Tenha 5 Pokémon no Banco e pegue pelo menos 3 Prêmios no mesmo turno." },
  { key: "SEM_RECUAR", title: "Sem Recuar", description: "Vença sem realizar recuo e sem usar efeitos que troquem o Pokémon Ativo." },
  { key: "RECICLAGEM_ENGUICADA", title: "Reciclagem Enguiçada", description: "Recupere pelo menos 7 cartas do descarte para a mão ou para o baralho durante a partida." },
  { key: "PRESSAO_CONSTANTE", title: "Pressão Constante", description: "Pegue pelo menos 1 Prêmio em 3 turnos consecutivos." },
  { key: "MURALHA_IMPROVISADA", title: "Muralha Improvisada", description: "Vença defendendo 4 ou mais Prêmios." },
  { key: "INVESTIDA_QUADRUPLA", title: "Investida Quádrupla", description: "Pegue 4 ou mais Prêmios em uma única investida." },
  { key: "VIRADA_IMPROVAVEL", title: "Virada Improvável", description: "Vença depois que o adversário chegar a 2 ou menos Prêmios restantes." },
  { key: "SOBRECARGA_ESPECIAL", title: "Sobrecarga Especial", description: "Tenha 5 ou mais Energias Especiais no descarte em qualquer momento da partida." },
  { key: "GOLPE_COLOSSAL", title: "Golpe Colossal", description: "Cause pelo menos 300 de dano em um único ataque com 4 ou mais Energias anexadas ao atacante." },
  { key: "CAMPO_VAZIO", title: "Campo Vazio", description: "Vença sem nenhum Pokémon no Banco no momento do golpe final." },
  { key: "ERA_DOS_NAO_EX", title: "Era dos Não-Ex", description: "Vença usando um deck que não contenha Pokémon ex." },
  { key: "ESCADA_EVOLUTIVA", title: "Escada Evolutiva", description: "Realize pelo menos 4 evoluções durante a partida e vença." },
  { key: "DOMINIO_DO_ESTADIO", title: "Domínio do Estádio", description: "Coloque 3 Estádios em jogo durante a partida, com pelo menos 2 nomes diferentes, e termine com um Estádio seu em campo." },
  { key: "QUEDA_DO_GINASIO", title: "Queda do Ginásio", description: "Substitua ou descarte um Estádio do adversário em 2 momentos diferentes da mesma partida." },
  { key: "CONTROLE_DE_RECURSOS", title: "Controle de Recursos", description: "Vença com pelo menos 6 cartas de Treinador no descarte e 6 cartas de Treinador na mão." },
  { key: "ESPECIALISTA_MONOTIPO", title: "Especialista Monotipo", description: "Use somente Pokémon que compartilhem um mesmo tipo de Pokédex durante toda a partida e vença." },
  { key: "ENERGIA_TOTAL", title: "Energia Total", description: "Tenha pelo menos 8 Energias anexadas aos seus Pokémon ao mesmo tempo durante a partida." },
  { key: "MAO_VAZIA", title: "Mão Vazia", description: "Termine um dos seus turnos sem nenhuma carta na mão e ainda assim vença a partida." },
  { key: "BANCO_EVOLUIDO", title: "Banco Evoluído", description: "Tenha simultaneamente pelo menos 3 Pokémon evoluídos no Banco." },
  { key: "PREMIO_CIRURGICO", title: "Prêmio Cirúrgico", description: "Pegue exatamente 2 Prêmios em um ataque e termine a partida vencendo por esse mesmo ataque." },
  { key: "ROTA_ALTERNATIVA", title: "Rota Alternativa", description: "Vença sem usar o ataque de maior dano impresso entre os Pokémon do seu deck." },
] as const;

export const ENGUICA_BOX_REWARD_LABEL = "250 ZC · 30 Comidas · 15 Doces · 2 Tickets ZikaLoot garantidos";

export function getEnguicaContract(key?: string | null) {
  return ENGUICA_CONTRACTS.find((contract) => contract.key === key) ?? null;
}

export function drawEnguicaContract(previousKey?: string | null) {
  const eligible = ENGUICA_CONTRACTS.filter((contract) => contract.key !== previousKey);
  return eligible[Math.floor(Math.random() * eligible.length)];
}
