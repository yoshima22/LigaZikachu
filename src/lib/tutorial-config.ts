export interface TutorialStep {
  title: string;
  description: string;
  target?: string;       // seletor CSS, ex.: "[data-tutorial='nav-perfil']"
  find?: string;         // texto de um título/botão da página a destacar (alternativa ao target)
  position?: "top" | "bottom" | "left" | "right" | "center";
}

export interface PageTutorial {
  pageId: string;
  steps: TutorialStep[];
}

const nav = (id: string, title: string, description: string): TutorialStep => ({
  title, description, target: `[data-tutorial='nav-${id}']`, position: "bottom",
});
// Destaca o bloco da página cujo título/botão contém `find`; sem achar, mostra o cartão central.
const at = (title: string, description: string, find: string): TutorialStep => ({
  title, description, find, position: "bottom",
});
const page = (title: string, description: string): TutorialStep => ({
  title, description, target: "[data-tutorial='page-content']", position: "top",
});
const note = (title: string, description: string): TutorialStep => ({ title, description, position: "center" });
const tut = (pageId: string, steps: TutorialStep[]): PageTutorial => ({ pageId, steps });

const MENU_TOUR_STEPS: TutorialStep[] = [
  nav("dashboard", "Dashboard", "Seu resumo do dia: pendências e avisos."),
  nav("torneios", "Torneios", "Campeonatos de TCG: inscrição, deck e resultados."),
  nav("noticias", "Notícias", "Eventos e avisos oficiais. Bolinha = novidade."),
  nav("combates", "Combates", "Todos os modos de batalha dos mascotes. Rodam sozinhos: monte bem a equipe."),
  nav("ranking", "Ranking", "Geral, Mascotes, Top do Dia e Temporadas."),
  nav("mercado", "Mercado", "Bazar, ZikaShop, ZikaBet, ZikaLoot e Laboratório."),
  nav("colecao", "Coleção", "Seus mascotes, Pokédex, Álbum, Carteira, Inventário e o Manual."),
  nav("perfil", "Perfil", "Mensagens, decks, conquistas e presentes."),
  note("Dúvida em uma tela?", "Toque no ❓ do topo: ele explica a página em que você está."),
];

export const TUTORIALS: Record<string, PageTutorial> = {
  welcome: tut("welcome", [
    note("Bem-vindo à Liga Zikachu! ⚡", "Torneios de TCG + mascotes, combates e mercado. Um giro rápido pelo menu:"),
    ...MENU_TOUR_STEPS,
  ]),
  dashboard: tut("dashboard", [
    note("Sua central ⚡", "Pendências e avisos do dia. Um giro pelo menu:"),
    ...MENU_TOUR_STEPS.slice(1),
  ]),

  // ── Perfil / torneios ───────────────────────────────────────────────
  perfil: tut("perfil", [
    { title: "Avatar e banner", description: "Personalize na ZikaShop.", target: "[data-tutorial='profile-avatar']", position: "right" },
    { title: "Conquistas", description: "Fixe até 10 com ⭐ em Conquistas.", target: "[data-tutorial='profile-achievements']", position: "top" },
    { title: "Partidas", description: "Histórico recente. Toque para ver detalhes.", target: "[data-tutorial='profile-matches']", position: "top" },
    { title: "Decks públicos", description: "Os que você marcar aparecem aqui.", target: "[data-tutorial='profile-decks']", position: "top" },
  ]),
  torneios: tut("torneios", [
    { title: "Filtros", description: "Abertos, em andamento ou encerrados.", target: "[data-tutorial='tournament-filters']", position: "bottom" },
    { title: "Campeonatos", description: "Abra um com inscrição aberta e toque em Inscrever-se.", target: "[data-tutorial='tournament-list']", position: "top" },
  ]),
  torneio: tut("torneio", [
    page("Seu torneio", "Inscrição, dias de jogo, decks e ranking."),
    note("Prazos", "Online: envie o deck antes do bloqueio. Presencial: fluxo mais rápido."),
  ]),
  "torneio-dia": tut("torneio-dia", [
    page("Dia de torneio", "Partidas, decks do dia e Top do Dia."),
  ]),
  partidas: tut("partidas", [
    page("Partidas", "Reporte o resultado. Vale no ranking quando os dois confirmam ou o admin valida."),
  ]),
  conquistas: tut("conquistas", [
    { title: "Suas conquistas", description: "Desbloqueie ao cumprir desafios.", target: "[data-tutorial='achievements-mine']", position: "bottom" },
    { title: "Filtros", description: "Torneio ou sistema (álbum, loja, loot).", target: "[data-tutorial='achievements-filter']", position: "bottom" },
    note("Destaque", "Toque na ⭐ para fixar no perfil (até 10)."),
  ]),
  ranking: tut("ranking", [
    { title: "Temporada", description: "Troque para ver rankings antigos.", target: "[data-tutorial='ranking-season']", position: "bottom" },
    { title: "Classificação", description: "Pontos por vitórias, insígnias e bônus. Insígnia: +3; desafio perdido: −2.", target: "[data-tutorial='ranking-table']", position: "top" },
  ]),
  "ranking-mascotes": tut("ranking-mascotes", [
    page("Ranking de Mascotes", "Compara todos os mascotes. Ganhe EXP em expedições, interações e combates."),
  ]),
  "top-do-dia": tut("top-do-dia", [page("Top do Dia 👑", "Melhores resultados de cada dia de torneio.")]),
  temporadas: tut("temporadas", [page("Temporadas", "Campeões e rankings finais. Abra uma para ver.")]),
  jogadores: tut("jogadores", [page("Jogadores", "Toque num nome para ver o perfil.")]),
  "meus-decks": tut("meus-decks", [page("Meus Decks", "Salve decks e marque como públicos os que quiser exibir.")]),

  // ── Mascotes ────────────────────────────────────────────────────────
  mascotes: tut("mascotes", [
    at("Seus mascotes", "Equipe, favoritos e banco. Toque num card para interagir.", "Meus Mascotes"),
    note("Como evoluem", "EXP vem de expedições, carinho, brincar e combates."),
    note("Botão apagado?", "O mascote está em expedição, repouso ou recuperação. Aguarde o timer."),
  ]),
  lacos: tut("lacos", [page("Laços", "Relações entre mascotes. Suas escolhas podem afetar eventos.")]),
  pokedex: tut("pokedex", [page("Pokédex", "Espécies que você já teve. Descartar não apaga o registro.")]),
  habilidades: tut("habilidades", [
    at("Busca", "Filtre por nome ou categoria.", "Buscar"),
    at("Limites", "Cada categoria tem limite por time.", "Limite por categoria"),
    note("Opinar", "Dê sua opinião nos cards."),
  ]),
  professor: tut("professor", [page("Prof. Enguiça", "Interações especiais e eventos de mascotes, quando disponíveis.")]),
  album: tut("album", [
    at("Progresso", "Colecione figurinhas abrindo pacotes da ZikaShop.", "Progresso por Geracao"),
    note("Favoritas", "Toque numa figurinha para favoritar e exibir no perfil."),
  ]),
  carteira: tut("carteira", [
    page("Carteira 🪙", "Saldo de ZikaCoins e histórico."),
    note("Ganhar ZC", "Torneios, expedições, conquistas e eventos."),
  ]),
  inventario: tut("inventario", [
    at("Itens", "Consumíveis, ovos e tickets.", "Meu Inventario"),
    at("Tickets", "Usados no Desafio Sincronizado.", "Tickets do Desafio"),
  ]),
  codigos: tut("codigos", [page("Códigos TCG", "Seus códigos resgatados.")]),
  resgatar: tut("resgatar", [page("Resgatar código", "Digite o código. O prêmio vai para os Presentes ou inventário.")]),
  presentes: tut("presentes", [page("Presentes", "Resgate um a um ou use Receber todos.")]),
  insignias: tut("insignias", [page("Insígnias 🏅", "Dadas em torneios e eventos. Valem pontos no ranking.")]),
  "passe-apoiador": tut("passe-apoiador", [page("Passe de Apoiador 🎫", "Um prêmio por dia. Volte todo dia para resgatar.")]),
  noticias: tut("noticias", [page("Notícias 📰", "Comunicados oficiais da Liga.")]),
  mensagens: tut("mensagens", [page("Mensagens 💬", "Conversas e avisos do sistema, como propostas do Bazar.")]),
  manual: tut("manual", [page("Manual 📖", "Regras detalhadas de tudo. Consulte quando tiver dúvida.")]),

  // ── Combates ────────────────────────────────────────────────────────
  "arena-z": tut("arena-z", [
    at("Monte a equipe", "PvE, PvP ou misto. O cofre acumula ZC e EXP.", "Montar Equipe"),
    at("Como funciona", "Regras completas aqui.", "Como Funciona a Arena Z"),
    note("Timers", "Cada equipe tem cooldown próprio de PvE, PvP e retirada."),
    note("Nocaute", "Mascotes caídos vão à recuperação. Troque os slots livres."),
  ]),
  "arena-draft": tut("arena-draft", [
    at("Seus times", "12 mascotes. Customizado (4.500 pts) ou Padrão (mascotes reais).", "Meus times"),
    at("Fila pública", "Entre na fila para lutar contra alguém.", "Fila pública"),
    at("Desafio direto", "Chame um jogador específico.", "Desafio direto"),
    note("Luta", "Automática. Nos turnos 20, 35 e 45 você reorganiza em segredo."),
    note("Limite", "Até 5 Megas por time."),
  ]),
  "arena-online": tut("arena-online", [page("Batalha de Terreno", "Combate casual ao vivo. Procure um adversário no matchmaking.")]),
  "liga-semanal": tut("liga-semanal", [
    at("Status", "Sua situação na liga desta semana.", "Status"),
    at("Regras", "Mínimo de 18 mascotes para ser registrado.", "Regras da Liga"),
    at("Confrontos", "Chaves diárias, resolvidas automaticamente.", "Confrontos"),
    at("Destaques", "Melhores da semana.", "Destaques da Semana"),
  ]),
  "liga-rush": tut("liga-rush", [
    at("Seus times", "Inscreva-se e monte as equipes da semana.", "Meus Times"),
    at("Horários", "Quando cada rodada acontece.", "Horários das partidas"),
    at("Destaques", "Melhores mascotes da edição.", "Destaques dos mascotes"),
    note("W/O", "Faltar a todas as partidas = fora da próxima edição."),
    note("Prêmios", "Caixas só no encerramento, na sexta."),
  ]),
  "rei-do-rio": tut("rei-do-rio", [
    page("Rei do Rio 👑", "5 combates automáticos por dia. Mais pontos até sexta = coroa."),
    at("Inscrição", "Entre na lista. Sem time, recebe equipe automática.", "Quero me inscrever"),
    at("Equipe", "Monte ou reorganize até as 21h. Depois trava.", "Montar minha equipe"),
    note("Sem risco", "O HP é só deste modo. Seus mascotes seguem livres."),
  ]),
  "raid-johto": tut("raid-johto", [
    page("Líderes de Johto", "Todo o servidor ataca um líder por vez."),
    at("Prêmios", "Quem fica no pódio ganha prêmio maior.", "Suas recompensas"),
  ]),
  "ordem-da-trapaca": tut("ordem-da-trapaca", [page("Ordem da Trapaça", "Evento por tempo limitado. Leia as regras na página.")]),
  "desafio-sincronizado": tut("desafio-sincronizado", [
    at("Ticket", "Junte tickets de fogo e água e forme dupla.", "Montar ticket completo"),
    at("Agenda", "Quando o evento acontece.", "Agenda do proximo evento"),
    at("Ranking", "Resultado do dia.", "Ranking de hoje"),
    note("Regras", "Ticket gerado por você não conta para você. Não travou a equipe? O sistema escolhe."),
  ]),
  "cacada-de-rastros": tut("cacada-de-rastros", [page("Caçada de Rastros", "Modo de teste admin: um se esconde, outro segue as pistas.")]),

  // ── Mercado ─────────────────────────────────────────────────────────
  bazar: tut("bazar", [
    at("Anúncios", "Compre de outros jogadores. Use os filtros.", "Anúncios ativos"),
    at("Ofertas premium", "Destaques do Miauvadão: mudam e esgotam.", "Ofertas premium"),
    at("Atividade", "Últimas vendas e trocas.", "Atividade recente"),
    note("Propostas", "Itens oferecidos ficam reservados e voltam se recusados."),
  ]),
  shop: tut("shop", [
    page("ZikaShop 🛒", "Troque ZikaCoins por cosméticos, pacotes e tickets."),
    note("Saldo", "Confira suas ZC antes de comprar."),
  ]),
  bet: tut("bet", [
    page("ZikaBet ⚡", "Aposte ZC nas partidas. As odds mudam com as apostas."),
    note("Risco", "Aposta perdida = ZC perdidas. Veja o histórico em Minhas apostas."),
  ]),
  zikaloot: tut("zikaloot", [page("ZikaLoot", "Gaste tickets em sorteios. Veja chances e limites antes.")]),
  laboratorio: tut("laboratorio", [
    at("Máquina de Raridade", "Gaste Pó de Criação para gerar ovos.", "Máquina de Raridade"),
    note("Reciclar", "Mascotes viram Pó; raros rendem mais. A Pokédex mantém o registro."),
  ]),
  "amigo-oculto": tut("amigo-oculto", [
    at("Como funciona", "Regras e datas.", "Como funciona"),
    at("Inscrição", "Inscreva-se dentro do prazo.", "Inscrição"),
    at("Check-in", "Volte todo dia.", "check-in diário"),
  ]),
  ligacash: tut("ligacash", [page("LigaCash", "Moeda premium (dinheiro real). Saldo na Carteira.")]),
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
