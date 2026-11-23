export interface TutorialStep {
  title: string;
  description: string;
  target?: string;       // seletor CSS, ex.: "[data-tutorial='nav-perfil']"
  find?: string;         // texto da página a destacar (aba/botão ou título/bloco); "@h1" = cabeçalho da página
  position?: "top" | "bottom" | "left" | "right" | "center";
}

export interface PageTutorial {
  pageId: string;
  steps: TutorialStep[];
}

const nav = (id: string, title: string, description: string): TutorialStep => ({
  title, description, target: `[data-tutorial='nav-${id}']`, position: "bottom",
});
// Destaca o botão/aba ou bloco da página que contém `find`; sem achar, mostra o cartão central.
const at = (title: string, description: string, find: string): TutorialStep => ({
  title, description, find, position: "bottom",
});
// Destaca o cabeçalho da página.
const page = (title: string, description: string): TutorialStep => ({
  title, description, find: "@h1", position: "bottom",
});
const note = (title: string, description: string): TutorialStep => ({ title, description, position: "center" });
const tut = (pageId: string, steps: TutorialStep[]): PageTutorial => ({ pageId, steps });

const MENU_TOUR_STEPS: TutorialStep[] = [
  nav("dashboard", "Dashboard", "Seu resumo do dia: partidas pendentes, decks da semana e avisos. Comece por aqui."),
  nav("torneios", "Torneios", "Campeonatos de TCG: inscreva-se, envie seu deck dentro do prazo e reporte os resultados."),
  nav("noticias", "Notícias", "Eventos, atualizações e avisos oficiais. Uma bolinha vermelha indica novidade não lida."),
  nav("combates", "Combates", "Todos os modos de batalha dos mascotes (Arena Z, Draft, Ligas, Rei do Rio…). Os combates rodam sozinhos: seu trabalho é montar bem a equipe."),
  nav("ranking", "Ranking", "Ranking Geral dos torneios, Ranking de Mascotes, Top do Dia e Temporadas passadas."),
  nav("mercado", "Mercado", "Onde as ZikaCoins circulam: Bazar (trocas entre jogadores), ZikaShop, ZikaBet, ZikaLoot e Laboratório."),
  nav("colecao", "Coleção", "Seus mascotes (o coração do jogo), Pokédex, Álbum, Carteira, Inventário e o Manual com todas as regras."),
  nav("perfil", "Perfil", "Seu perfil público, mensagens, decks, conquistas, insígnias e presentes recebidos."),
  note("Dúvida em uma tela?", "Toque no ❓ do topo: ele explica a página em que você está e destaca cada parte."),
];

export const TUTORIALS: Record<string, PageTutorial> = {
  welcome: tut("welcome", [
    note("Bem-vindo à Liga Zikachu! ⚡", "Aqui você joga torneios de TCG e cuida de mascotes que lutam, evoluem e rendem prêmios. Vamos conhecer o menu do topo."),
    ...MENU_TOUR_STEPS,
  ]),
  dashboard: tut("dashboard", [
    note("Sua central ⚡", "Aqui aparecem pendências e avisos do dia. Vamos conhecer o menu do topo."),
    ...MENU_TOUR_STEPS.slice(1),
  ]),

  // ── Perfil / torneios ───────────────────────────────────────────────
  perfil: tut("perfil", [
    { title: "Avatar e banner", description: "Moldura, banner e título deixam seu perfil único. Compre cosméticos na ZikaShop.", target: "[data-tutorial='profile-avatar']", position: "right" },
    { title: "Conquistas", description: "Fixe até 10 conquistas aqui: abra Conquistas e toque na ⭐ das que quiser exibir.", target: "[data-tutorial='profile-achievements']", position: "top" },
    { title: "Últimas partidas", description: "Seu histórico recente. Toque numa partida para ver os detalhes das rodadas.", target: "[data-tutorial='profile-matches']", position: "top" },
    { title: "Decks públicos", description: "Decks que você marcar como públicos aparecem aqui para a comunidade ver.", target: "[data-tutorial='profile-decks']", position: "top" },
  ]),
  torneios: tut("torneios", [
    { title: "Filtros", description: "Veja só os campeonatos abertos para inscrição, em andamento ou encerrados.", target: "[data-tutorial='tournament-filters']", position: "bottom" },
    { title: "Campeonatos", description: "Abra um campeonato com inscrição aberta e toque em Inscrever-se. Depois é só jogar nas datas marcadas.", target: "[data-tutorial='tournament-list']", position: "top" },
  ]),
  torneio: tut("torneio", [
    page("Seu torneio", "Aqui estão inscrição, dias de jogo, decks liberados, ranking interno e resultados."),
    note("Prazos", "No torneio online, envie o deck antes do bloqueio. No presencial o fluxo é mais rápido, sem confirmação dupla do resultado."),
  ]),
  "torneio-dia": tut("torneio-dia", [
    page("Dia de torneio", "Partidas, decks do dia, bônus e Top do Dia. Resultados validados alimentam ranking e prêmios."),
  ]),
  partidas: tut("partidas", [
    page("Partidas", "Reporte o resultado da sua partida. Ela só conta no ranking quando os dois jogadores confirmam ou o admin valida."),
  ]),
  conquistas: tut("conquistas", [
    { title: "Suas conquistas", description: "São desbloqueadas ao cumprir desafios em campeonatos ou ao usar recursos do app.", target: "[data-tutorial='achievements-mine']", position: "bottom" },
    { title: "Filtros", description: "Alterne entre conquistas de torneio e de sistema (álbum, loja, ZikaLoot…).", target: "[data-tutorial='achievements-filter']", position: "bottom" },
    note("Destaque no perfil", "Toque na ⭐ de uma conquista para fixá-la no seu perfil. Dá para fixar até 10."),
  ]),
  ranking: tut("ranking", [
    { title: "Temporada", description: "Troque a temporada para ver como foi o ranking de cada edição.", target: "[data-tutorial='ranking-season']", position: "bottom" },
    { title: "Classificação", description: "Soma pontos de vitórias, insígnias e bônus. Cada insígnia de ginásio vale +3; desafio perdido tira 2.", target: "[data-tutorial='ranking-table']", position: "top" },
  ]),
  "ranking-mascotes": tut("ranking-mascotes", [
    page("Ranking de Mascotes", "Compara os mascotes de todos os jogadores. Para subir, ganhe EXP em expedições, interações e combates."),
  ]),
  "top-do-dia": tut("top-do-dia", [page("Top do Dia 👑", "Os melhores resultados de cada dia de torneio.")]),
  temporadas: tut("temporadas", [page("Temporadas", "Campeões e rankings finais de cada temporada. Abra uma para ver os detalhes.")]),
  jogadores: tut("jogadores", [page("Jogadores", "Todos os membros da Liga. Toque num nome para ver conquistas, decks públicos e partidas.")]),
  "meus-decks": tut("meus-decks", [page("Meus Decks", "Salve seus decks aqui e marque como públicos os que quiser mostrar no perfil. Eles também servem para se inscrever em torneios.")]),

  // ── Mascotes ────────────────────────────────────────────────────────
  mascotes: tut("mascotes", [
    at("Seus mascotes", "Equipe, favoritos e banco. Toque num card para alimentar, dar carinho, brincar ou mandar em expedição.", "Meus Mascotes"),
    at("Ovos e incubadora", "Coloque um ovo na incubadora e aguarde chocar. Ovos vêm da ZikaShop e de eventos.", "incubadora"),
    note("Como evoluem", "Ganham EXP em combates, interações e expedições. Ao atingir o nível certo, evoluem."),
    note("Botão apagado?", "O mascote está em expedição, repouso, arena ou recuperação. Espere o timer acabar."),
  ]),
  lacos: tut("lacos", [page("Laços", "Relações entre mascotes de jogadores diferentes: amizades e rivalidades. Suas escolhas podem afetar eventos e combates.")]),
  pokedex: tut("pokedex", [page("Pokédex", "Registro das espécies que você já teve. Mesmo descartando um mascote, a espécie continua contando.")]),
  habilidades: tut("habilidades", [
    at("Busca", "Procure uma habilidade por nome ou categoria.", "Buscar"),
    at("Limite por categoria", "Um time só pode ter certo número de habilidades de cada categoria. A prioridade decide quais ficam ligadas.", "Limite por categoria"),
    note("Opinar", "Use o botão Opinar nos cards para contar à equipe o que achou de cada habilidade."),
  ]),
  professor: tut("professor", [page("Prof. Enguiça", "Interações especiais e eventos ligados aos mascotes, quando disponíveis. Ele também explica as regras da Arena Z.")]),
  album: tut("album", [
    at("Progresso", "Colecione figurinhas abrindo pacotes comprados na ZikaShop. O progresso é mostrado por geração.", "Progresso por Geracao"),
    note("Favoritas", "Toque numa figurinha para ver detalhes e favoritá-la. As favoritas aparecem no seu perfil."),
  ]),
  carteira: tut("carteira", [
    page("Carteira 🪙", "Seu saldo de ZikaCoins (ZC) e LigaCash (LC), com o histórico de entradas e saídas."),
    note("Como ganhar ZC", "Torneios, expedições, conquistas, presentes e eventos. Gaste na ZikaShop, no Bazar e no Miauvadão."),
  ]),
  inventario: tut("inventario", [
    at("Seus itens", "Consumíveis, ovos e recursos usados em mascotes, arena e eventos.", "Meu Inventario"),
    at("Tickets", "Tickets do Desafio Sincronizado: você precisa de um ticket completo para entrar no evento.", "Tickets do Desafio"),
  ]),
  codigos: tut("codigos", [page("Códigos TCG", "Códigos de cartas que você já resgatou.")]),
  resgatar: tut("resgatar", [page("Resgatar código", "Digite o código recebido em eventos ou promoções. O prêmio chega nos Presentes ou no inventário.")]),
  presentes: tut("presentes", [page("Presentes", "Prêmios chegam aqui antes do inventário. Resgate um a um ou use Receber todos.")]),
  insignias: tut("insignias", [page("Insígnias 🏅", "Conquistas de destaque dadas em torneios e eventos. Cada uma vale pontos no ranking e aparece no seu perfil.")]),
  "passe-apoiador": tut("passe-apoiador", [page("Passe de Apoiador 🎫", "Um prêmio por dia ao longo do calendário. Volte todo dia para resgatar; alguns passes deixam pegar dias pendentes.")]),
  noticias: tut("noticias", [page("Notícias 📰", "Comunicados oficiais: eventos, atualizações e avisos importantes.")]),
  mensagens: tut("mensagens", [page("Mensagens 💬", "Converse com outros jogadores. Avisos do sistema, como propostas do Bazar, também chegam aqui.")]),
  manual: tut("manual", [page("Manual 📖", "Todas as regras detalhadas: EXP, expedições, combate, posturas, habilidades e economia.")]),

  // ── Combates ────────────────────────────────────────────────────────
  "arena-z": tut("arena-z", [
    at("Montar Equipe", "Escolha mascotes saudáveis (não feridos, em expedição ou no Bazar) e o modo da equipe: só PvE (luta contra bots), só PvP (fica exposta a ataques de jogadores) ou misto.", "Montar Equipe"),
    at("Minhas Equipes", "Suas equipes na arena (máx. 3). Cada uma acumula ZC, EXP e itens num cofre; você só recebe ao retirar a equipe.", "Minhas Equipes"),
    at("Salas", "Salas por nível. Escolha seu time e depois o alvo. Cooldown de 10 min entre ataques, e o mesmo time só pode ser atacado de novo após 30 min.", "Salas"),
    note("Cofre e estamina", "Quanto mais tempo na arena, maior o multiplicador do cofre, mas a estamina cai e os mascotes lutam piores. Retirar entre 12h e 24h costuma equilibrar."),
    at("SUS", "Mascote derrotado fica ferido. O Atendimento SUS (10 ZC) cura, e ele descansa 3h antes de voltar ao banco.", "SUS"),
    at("Guia", "Regras completas: cofre, PvP, PvE, drops de ovos e mais. O Prof. Enguiça explica tudo.", "Guia"),
  ]),
  "arena-draft": tut("arena-draft", [
    at("Seus times", "Monte times de 12 mascotes. Customizado: 4.500 pontos de status e habilidades livres. Padrão: seus mascotes reais.", "Meus times"),
    at("Fila pública", "Entre na fila e o sistema encontra um adversário para você.", "Fila pública"),
    at("Desafio direto", "Chame um jogador específico para uma luta.", "Desafio direto"),
    at("Catálogo livre", "Catálogo de mascotes disponíveis para montar times Customizados.", "Catálogo livre"),
    note("Como é a luta", "Automática, até o fim. Nos turnos 20, 35 e 45 cada lado reorganiza o time em segredo: aproveite essas janelas."),
    note("Dicas de montagem", "Máximo de 5 Megas por time. A prioridade das habilidades decide quais ficam ligadas. Clique num mascote para ver forças e fraquezas de tipo."),
  ]),
  "arena-online": tut("arena-online", [page("Batalha de Terreno", "Combate casual ao vivo entre jogadores, sem pressão de ranking. Use o matchmaking para achar um adversário.")]),
  "liga-semanal": tut("liga-semanal", [
    at("Status", "Sua situação na liga desta semana. A liga é automática, de segunda a sexta, aberta a todos.", "Status"),
    at("Montar time", "Monte até 3 times por dia, com 6 mascotes cada e sem repetir mascote entre times. Sem time, o sistema monta sozinho.", "Montar"),
    at("Regras da Liga", "São precisos 18 mascotes diferentes para os 3 combates do dia. Desempate: pontos, vitórias, dano causado, sobreviventes, dano recebido.", "Regras da Liga"),
    at("Confrontos", "Os duelos do dia. Os combates rodam sozinhos nos horários marcados e você acompanha o replay.", "Confrontos"),
    at("Itens da Liga", "Escolha até 2 itens por combate. Ficam reservados e só são gastos quando o combate acontece.", "Itens Positivos"),
    at("Destaques", "Os melhores da semana. A premiação sai no fechamento da semana.", "Destaques da Semana"),
  ]),
  "liga-rush": tut("liga-rush", [
    at("Seus times", "Inscreva-se e monte as equipes da edição da semana.", "Meus Times"),
    at("Horários", "Quando cada rodada diária acontece. Resultados e ranking atualizam a cada rodada.", "Horários das partidas"),
    at("Destaques", "Os melhores mascotes da edição, atualizado conforme os combates terminam.", "Destaques dos mascotes"),
    note("W/O", "Se todas as suas partidas da semana terminarem em W/O (sem comparecer), você fica de fora da próxima edição."),
    note("Prêmios", "As caixas só são entregues no encerramento oficial, na sexta-feira."),
  ]),
  "rei-do-rio": tut("rei-do-rio", [
    page("Rei do Rio 👑", "Disputa semanal PvP: 5 combates automáticos por dia. Quem tiver mais pontos no fim da sexta é coroado."),
    at("Inscrição", "Entre na lista de participantes. Se não montar time, recebe uma equipe equilibrada automática.", "Quero me inscrever"),
    at("Sua equipe", "Monte ou reorganize até as 21h. Depois disso os 18 mascotes ficam travados e as equipes são reveladas.", "Montar minha equipe"),
    note("Sem risco", "O HP deste modo é só dele: expedições, Arena e treinos seguem normais. Os pontos viram saldo para trocar por caixas."),
  ]),
  "raid-johto": tut("raid-johto", [
    page("Líderes de Johto", "Evento cooperativo: o servidor inteiro ataca um líder por vez. O próximo só começa quando o anterior cair ou vencer."),
    at("Prêmios", "Cada líder tem ranking de dano. Quem fica no pódio ganha o prêmio do pódio no lugar do de participante.", "Suas recompensas"),
  ]),
  "ordem-da-trapaca": tut("ordem-da-trapaca", [page("Ordem da Trapaça", "Evento por tempo limitado. Leia as regras na página antes de participar.")]),
  "desafio-sincronizado": tut("desafio-sincronizado", [
    at("Ticket completo", "Junte os tickets de fogo e água, forme dupla e trave 9 mascotes. Um ticket gerado por você não conta para você.", "Montar ticket completo"),
    at("Agenda", "Quando o evento acontece. Cada rodada revela o modificador antes de você escolher 3 mascotes.", "Agenda do proximo evento"),
    at("Ranking", "Resultado do dia. Se a dupla não travar a equipe a tempo, o sistema escolhe por ela.", "Ranking de hoje"),
  ]),
  "cacada-de-rastros": tut("cacada-de-rastros", [page("Caçada de Rastros", "Modo de teste (admin): um jogador se esconde numa rota e outro segue as pistas.")]),

  // ── Mercado ─────────────────────────────────────────────────────────
  bazar: tut("bazar", [
    at("Anúncios", "Itens, ovos e mascotes à venda por outros jogadores. Filtre por tipo, raridade e preço.", "Anúncios ativos"),
    at("Pedidos", "Diga o que quer e quanto paga: quem tiver, vende na hora.", "Peça o que você quer"),
    at("Ofertas premium", "Ofertas do Miauvadão: mudam com o tempo e podem esgotar.", "Ofertas premium"),
    at("Atividade", "Últimas vendas e trocas do Bazar.", "Atividade recente"),
    note("Propostas", "Itens oferecidos numa proposta ficam reservados e voltam para você se ela for recusada ou cancelada."),
  ]),
  shop: tut("shop", [
    page("ZikaShop 🛒", "Troque ZikaCoins ou LigaCash por cosméticos, pacotes de figurinhas, ovos e tickets. Uma carteira nunca substitui a outra automaticamente."),
  ]),
  bet: tut("bet", [
    page("ZikaBet ⚡", "Aposte ZikaCoins nas partidas. As odds mudam conforme os jogadores apostam: favorito paga menos, azarão paga mais."),
    note("Cuidado", "Aposta perdida são ZC perdidas. Veja suas apostas em Minhas apostas."),
  ]),
  zikaloot: tut("zikaloot", [page("ZikaLoot", "Gaste tickets em sorteios de prêmios. Confira chances, histórico e limites antes de usar.")]),
  laboratorio: tut("laboratorio", [
    at("Máquina de Raridade", "Use Pó de Criação para gerar ovos de raridade escolhida.", "Máquina de Raridade"),
    note("Reciclar", "Reciclar um mascote gera Pó de Criação; mascotes raros dão mais. A Pokédex continua registrando a espécie."),
  ]),
  "amigo-oculto": tut("amigo-oculto", [
    at("Como funciona", "Regras e datas do evento.", "Como funciona"),
    at("Inscrição", "Inscreva-se dentro do prazo para entrar no sorteio.", "Inscrição"),
    at("Check-in diário", "Volte todo dia para o check-in.", "check-in diário"),
  ]),
  ligacash: tut("ligacash", [page("LigaCash", "Moeda premium, comprada com dinheiro real. Use na loja para itens especiais; o saldo fica na Carteira.")]),
};

const ROUTE_TUTORIALS: Array<[RegExp, string]> = [
  [/^\/dashboard(\/|$)/, "dashboard"],
  [/^\/carteira(\/|$)/, "carteira"],
  [/^\/passe-apoiador(\/|$)/, "passe-apoiador"],
  [/^\/insignias(\/|$)/, "insignias"],
  [/^\/noticias(\/|$)/, "noticias"],
  [/^\/mensagens(\/|$)/, "mensagens"],
  [/^\/manual(\/|$)/, "manual"],
  [/^\/bazar(\/|$)/, "bazar"],
  [/^\/mascotes\/ranking(\/|$)/, "ranking-mascotes"],
  [/^\/mascotes(\/|$)/, "mascotes"],
  [/^\/arena-z(\/|$)/, "arena-z"],
  [/^\/combates\/liga-semanal(\/|$)/, "liga-semanal"],
  [/^\/combates\/arena-draft(\/|$)/, "arena-draft"],
  [/^\/combates\/arena-online(\/|$)/, "arena-online"],
  [/^\/combates\/liga-rush(\/|$)/, "liga-rush"],
  [/^\/combates\/rei-do-rio(\/|$)/, "rei-do-rio"],
  [/^\/combates\/raid-johto(\/|$)/, "raid-johto"],
  [/^\/combates\/ordem-da-trapaca(\/|$)/, "ordem-da-trapaca"],
  [/^\/pokedex(\/|$)/, "pokedex"],
  [/^\/habilidades(\/|$)/, "habilidades"],
  [/^\/top-do-dia(\/|$)/, "top-do-dia"],
  [/^\/temporadas(\/|$)/, "temporadas"],
  [/^\/resgatar(\/|$)/, "resgatar"],
  [/^\/amigo-oculto(\/|$)/, "amigo-oculto"],
  [/^\/mercado\/ligacoins(\/|$)/, "ligacash"],
  [/^\/perfil\/meus-decks(\/|$)/, "meus-decks"],
  [/^\/jogadores\/?$/, "jogadores"],
  [/^\/desafio-sincronizado(\/|$)/, "desafio-sincronizado"],
  [/^\/combates\/cacada-de-rastros(\/|$)/, "cacada-de-rastros"],
  [/^\/laboratorio(\/|$)/, "laboratorio"],
  [/^\/zikaloot(\/|$)/, "zikaloot"],
  [/^\/zikabet(\/|$)/, "bet"],
  [/^\/shop(\/|$)/, "shop"],
  [/^\/album(\/|$)/, "album"],
  [/^\/inventario(\/|$)/, "inventario"],
  [/^\/codigos(\/|$)/, "codigos"],
  [/^\/caixa-de-presentes(\/|$)/, "presentes"],
  [/^\/lacos(\/|$)/, "lacos"],
  [/^\/conquistas(\/|$)/, "conquistas"],
  [/^\/ranking(\/|$)/, "ranking"],
  [/^\/torneios\/[^/]+\/semanas\/[^/]+\/partidas(\/|$)/, "partidas"],
  [/^\/torneios\/[^/]+\/semanas\/[^/]+(\/|$)/, "torneio-dia"],
  [/^\/torneios\/[^/]+(\/|$)/, "torneio"],
  [/^\/torneios(\/|$)/, "torneios"],
  [/^\/professor(\/|$)/, "professor"],
  [/^\/jogadores\/[^/]+(\/|$)/, "perfil"],
  [/^\/perfil(\/|$)/, "perfil"],
];

export function getTutorialIdForPath(pathname: string | null): string | null {
  if (!pathname) return null;
  return ROUTE_TUTORIALS.find(([pattern]) => pattern.test(pathname))?.[1] ?? null;
}
