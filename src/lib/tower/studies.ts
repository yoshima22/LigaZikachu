export const TOWER_STUDY_TARGET = 25;

export const TOWER_COMMUNITY_STUDIES = [
  {
    key: "WARD",
    title: "Reforçar proteções",
    effect: "A expedição começa com 2 pontos de proteção contra Pressão.",
  },
  {
    key: "INSIGHT",
    title: "Decifrar mecanismos",
    effect: "Enigmas revelam uma pista adicional registrada pelo Arquivo.",
  },
  {
    key: "MAP",
    title: "Mapear corredores",
    effect:
      "Os nomes e tipos das rotas adjacentes ficam visíveis antes da escolha.",
  },
  {
    key: "BULWARK",
    title: "Arquitetura defensiva",
    effect: "A expedição começa com mais 1 ponto de proteção contra Pressão.",
  },
  {
    key: "SABOTAGE",
    title: "Sabotagem reversa",
    effect: "Erros em mecanismos geram 1 ponto de Pressão a menos.",
  },
  {
    key: "MEDIC",
    title: "Primeiros socorros",
    effect: "Salas de descanso recuperam 10% a mais de HP.",
  },
  {
    key: "SCOUT",
    title: "Rede de observadores",
    effect: "Rotas bloqueadas exibem a causa do bloqueio no mapa.",
  },
  {
    key: "FORTUNE",
    title: "Catálogo de relíquias",
    effect: "Interações de sorte recebem uma pequena melhoria de resultado.",
  },
  {
    key: "RESCUE",
    title: "Protocolo Anti-Psicose",
    effect: "Salas de resgate podem libertar até 3 mascotes em vez de 2.",
  },
  {
    key: "RALLY",
    title: "Sinais de reunião",
    effect: "A primeira divisão de caminhos da run perde 1 ponto de Pressão.",
  },
] as const;

export type TowerStudyKey = (typeof TOWER_COMMUNITY_STUDIES)[number]["key"];

export function isTowerStudyKey(value: string): value is TowerStudyKey {
  return TOWER_COMMUNITY_STUDIES.some((study) => study.key === value);
}
