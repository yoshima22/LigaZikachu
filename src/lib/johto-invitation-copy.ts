export const JOHTO_INVITATION_LAUNCH_AT = new Date("2026-10-14T11:00:00.000Z");

export const JOHTO_VOTE_QUESTIONS = [
  { key: "most_creative", label: "Quem é o jogador mais criativo dessa edição?" },
  { key: "breakthrough", label: "Quem foi a grande revelação dessa edição?" },
  { key: "most_tactical", label: "Quem foi o jogador mais tático dessa edição?" },
  { key: "most_underrated", label: "Quem foi o jogador mais injustiçado dessa edição?" },
  { key: "deserved_champion", label: "Quem merecia ser o campeão dessa edição?" },
  { key: "most_overpowered", label: "Quem foi o jogador mais apelão dessa edição?" },
] as const;

export type JohtoVoteQuestionKey = (typeof JOHTO_VOTE_QUESTIONS)[number]["key"];

export const JOHTO_INVITATION_COPY = {
  title: "Convite especial de Johto",
  greeting: "Olá, Treinador!",
  pages: [
    {
      paragraphs: [
        "Os Líderes de Ginásio de Johto estão animados com a Liga Zikachu TCG acontecendo nas proximidades e querem dar mais um grande show de batalhas para apoiar esta etapa final.",
        "Por isso, Falkner, Bugsy, Whitney, Morty, Chuck, Jasmine, Pryce e Clair desafiaram toda a comunidade da Liga Zikachu.",
      ],
    },
    {
      heading: "Como funcionam os Ginásios de Johto",
      paragraphs: [
        "Os oito líderes são enfrentados em sequência. Cada líder tem seis mascotes e uma barra de vida compartilhada por toda a comunidade.",
        "Cada líder fica disponível por até cinco dias. Se o tempo acabar, não há recompensa por esse líder.",
        "Sua equipe usa até seis mascotes, e o dano causado é coletivo.",
      ],
    },
    {
      heading: "Atenção à recuperação",
      paragraphs: [
        "Depois de atacar, aguarde 20 minutos para poder atacar de novo.",
        "Mascotes que caírem vão para o SUS, como na Arena-Z, e podem ser recuperados.",
      ],
    },
    {
      heading: "Recompensas",
      paragraphs: [
        "Quem participar recebe ZC e escolhe um mascote do líder. As recompensas do pódio são maiores, e o golpe final garante um ovo especial com raridade extra.",
      ],
    },
    {
      heading: "Prepare sua equipe",
      paragraphs: ["O evento está disponível em Combates → Líderes de Johto. Prepare sua equipe e acompanhe o progresso coletivo dos líderes por lá."],
    },
    {
      paragraphs: [
        "Johto está em festa. Reúna sua equipe, ajude a comunidade e deixe sua marca nesta reta final da Liga Zikachu TCG!",
        "— Professor Enguiça",
      ],
    },
  ],
  voting: {
    title: "Antes de partir para Johto…",
    description: "Esta é uma votação opcional e confidencial de reconhecimento dos jogadores da Liga Zikachu TCG 3ª Edição. São seis categorias e você pode enviar suas escolhas apenas uma vez.",
    participateLabel: "Participar da votação",
    continueLabel: "Continuar para os Ginásios",
  },
} as const;
