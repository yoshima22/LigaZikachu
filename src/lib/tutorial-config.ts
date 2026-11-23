export interface TutorialStep {
  title: string;
  description: string;
  target?: string;       // CSS data attribute selector, e.g. "[data-tutorial='balance']"
  position?: "top" | "bottom" | "left" | "right" | "center";
}

export interface PageTutorial {
  pageId: string;
  steps: TutorialStep[];
}

const MENU_TOUR_STEPS: TutorialStep[] = [
  { title: "Dashboard", description: "Sua central: partidas pendentes, decks da semana, avisos e atalhos. Comece o dia por aqui.", target: "[data-tutorial='nav-dashboard']", position: "bottom" },
  { title: "Torneios", description: "Os campeonatos de TCG da Liga. Inscreva-se, envie seu deck dentro do prazo, reporte resultados e acompanhe o ranking de cada edição.", target: "[data-tutorial='nav-torneios']", position: "bottom" },
  { title: "Notícias", description: "Comunicados oficiais, eventos e atualizações. Uma bolinha vermelha avisa quando há novidade que você ainda não leu.", target: "[data-tutorial='nav-noticias']", position: "bottom" },
  { title: "Combates", description: "Todos os modos de batalha dos mascotes: Arena Z (PvP e PvE), Arena Draft, Liga Semanal, Liga Rush, Rei do Rio e eventos. Os combates rodam sozinhos; seu trabalho é montar bem a equipe. Modos novos aparecem com a etiqueta Beta.", target: "[data-tutorial='nav-combates']", position: "bottom" },
  { title: "Ranking", description: "Ranking Geral dos torneios, Ranking de Mascotes, Top do Dia e Temporadas passadas.", target: "[data-tutorial='nav-ranking']", position: "bottom" },
  { title: "Mercado", description: "Onde as ZikaCoins circulam: Bazar (trocas entre jogadores), ZikaShop, ZikaBet, ZikaLoot, Amigo Oculto, Laboratório e LigaCash.", target: "[data-tutorial='nav-mercado']", position: "bottom" },
  { title: "Coleção", description: "Seus mascotes (o coração do jogo), Laços, Pokédex, Habilidades, Professor, Álbum, Manual, Carteira, Inventário e Resgatar código. Dúvida de regra? O Manual explica tudo.", target: "[data-tutorial='nav-colecao']", position: "bottom" },
  { title: "Perfil", description: "Seu perfil público, mensagens, decks, conquistas, insígnias, presentes recebidos e Passe Apoiador. A bolinha vermelha mostra mensagens e presentes pendentes.", target: "[data-tutorial='nav-perfil']", position: "bottom" },
  { title: "Dica final: o botão ❓", description: "Em qualquer página, o ❓ no topo abre as dicas daquela tela, inclusive de cada modo de combate. Pode voltar a ele quando quiser.", position: "center" },
];

export const TUTORIALS: Record<string, PageTutorial> = {
  welcome: {
    pageId: "welcome",
    steps: [
      {
        title: "Bem-vindo à Liga Zikachu! ⚡",
        description: "A Liga é um campeonato de Pokémon TCG com mascotes, combates, mercado e ranking. Vamos passar pelo menu do topo para você saber onde fica cada coisa.",
        position: "center"
      },
      ...MENU_TOUR_STEPS
    ]
  },
  perfil: {
    pageId: "perfil",
    steps: [
      {
        title: "Seu perfil público",
        description: "Esta é a sua página de jogador. Aqui outros membros podem ver suas conquistas, deck e histórico de partidas.",
        position: "center"
      },
      {
        title: "Personalização",
        description: "Troque seu banner, moldura e título na ZikaShop. Itens cosméticos deixam seu perfil único na liga.",
        target: "[data-tutorial='profile-avatar']",
        position: "right"
      },
      {
        title: "Conquistas em destaque",
        description: "Escolha até 10 conquistas para exibir aqui. Vá em Conquistas e clique ⭐ para destacar as suas favoritas.",
        target: "[data-tutorial='profile-achievements']",
        position: "top"
      },
      {
        title: "Últimas partidas",
        description: "Seu histórico recente fica aqui. Clique em qualquer partida para ver os detalhes da rodada.",
        target: "[data-tutorial='profile-matches']",
        position: "top"
      },
      {
        title: "Seus decks públicos",
        description: "Decks que você marcar como públicos aparecem aqui para a comunidade ver. Salve seus melhores decks na seção de Decks.",
        target: "[data-tutorial='profile-decks']",
        position: "top"
      }
    ]
  },
  torneios: {
    pageId: "torneios",
    steps: [
      {
        title: "Campeonatos da Liga",
        description: "Aqui ficam todos os campeonatos. Você pode se inscrever, acompanhar o ranking e ver os dias de jogo de cada edição.",
        target: "[data-tutorial='tournament-list']",
        position: "top"
      },
      {
        title: "Status dos campeonatos",
        description: "Use os filtros para ver campeonatos abertos para inscrição, em andamento ou encerrados.",
        target: "[data-tutorial='tournament-filters']",
        position: "bottom"
      },
      {
        title: "Entre em um campeonato",
        description: "Abra um campeonato com inscrições abertas e clique em 'Inscrever-se'. Após aprovação você começa a jogar nas datas marcadas.",
        position: "center"
      }
    ]
  },
  conquistas: {
    pageId: "conquistas",
    steps: [
      {
        title: "Suas conquistas",
        description: "Conquistas são desbloqueadas ao completar desafios especiais durante os campeonatos ou usando as funcionalidades do app.",
        target: "[data-tutorial='achievements-mine']",
        position: "bottom"
      },
      {
        title: "Filtros de conquistas",
        description: "Use os filtros para ver conquistas de torneio (ligadas a campeonatos) ou de sistema (álbum, ZikaShop, ZikaLoot, etc.).",
        target: "[data-tutorial='achievements-filter']",
        position: "bottom"
      },
      {
        title: "Destaque no perfil",
        description: "Clique no ⭐ de qualquer conquista para adicioná-la ao seu perfil público. Você pode destacar até 10.",
        position: "center"
      }
    ]
  },
  ranking: {
    pageId: "ranking",
    steps: [
      {
        title: "Ranking Geral",
        description: "O ranking acumula pontos de vitórias, insígnias de ginásio, conquistas e bônus especiais de campeonato.",
        target: "[data-tutorial='ranking-table']",
        position: "top"
      },
      {
        title: "Insígnias de Ginásio",
        description: "Desafie os líderes de ginásio para conquistar insígnias. Cada insígnia vale +3 pontos no ranking. Perca um desafio e perda -2 pontos.",
        target: "[data-tutorial='page-content']",
        position: "top"
      },
      {
        title: "Filtro por temporada",
        description: "Alterne entre temporadas para ver como foi o ranking histórico de cada edição.",
        target: "[data-tutorial='ranking-season']",
        position: "bottom"
      }
    ]
  },
  shop: {
    pageId: "shop",
    steps: [
      {
        title: "ZikaShop 🛒",
        description: "Aqui você troca ZikaCoins por itens cosméticos, pacotes de figurinhas e tickets de ZikaLoot.",
        target: "[data-tutorial='page-content']",
        position: "top"
      },
      {
        title: "Seu saldo de ZikaCoins",
        description: "ZikaCoins são ganhos participando de torneios, apostas e eventos. Fique de olho no seu saldo antes de comprar.",
        target: "[data-tutorial='page-content']",
        position: "bottom"
      },
      {
        title: "Pacotes de figurinhas",
        description: "Compre pacotes para completar seu álbum de figurinhas Pokémon. Figurinhas raras aparecem nos pacotes especiais!",
        position: "center"
      }
    ]
  },
  album: {
    pageId: "album",
    steps: [
      {
        title: "Álbum de Figurinhas 📖",
        description: "Colecione figurinhas de Pokémon do formato Standard. Abra pacotes comprados na ZikaShop para completar sua coleção.",
        target: "[data-tutorial='page-content']",
        position: "bottom"
      },
      {
        title: "Filtre por geração",
        description: "Use os filtros de geração e conjunto para encontrar figurinhas específicas. O filtro 'Faltantes' mostra o que ainda precisa.",
        target: "[data-tutorial='page-content']",
        position: "bottom"
      },
      {
        title: "Figurinhas favoritas",
        description: "Clique em qualquer figurinha para ver detalhes e marcá-la como favorita. As favoritas aparecem no seu perfil como Time dos Sonhos.",
        position: "center"
      }
    ]
  },
  bet: {
    pageId: "bet",
    steps: [
      {
        title: "ZikaBet ⚡",
        description: "Aposte ZikaCoins nas partidas dos campeonatos e torça para ganhar! Apostas abertas ficam nesta aba.",
        target: "[data-tutorial='page-content']",
        position: "bottom"
      },
      {
        title: "Odds e apostas",
        description: "As odds mudam conforme os jogadores fazem suas apostas. Aposte no favorito para ganhar menos ou no azarão para ganhar mais.",
        position: "center"
      },
      {
        title: "Histórico de apostas",
        description: "Veja suas apostas passadas, ganhos e perdas no histórico. Use com responsabilidade — apostas incorretas perdem seus ZikaCoins.",
        target: "[data-tutorial='page-content']",
        position: "top"
      }
    ]
  },
  bazar: {
    pageId: "bazar",
    steps: [
      {
        title: "Bazar",
        description: "Aqui os jogadores anunciam itens, mascotes e ofertas para troca. Confira o que ficara reservado antes de propor ou aceitar uma troca.",
        target: "[data-tutorial='page-content']",
        position: "top"
      },
      {
        title: "Ofertas e propostas",
        description: "Ao criar uma proposta, os itens oferecidos ficam reservados. Se a troca for recusada ou cancelada, eles voltam para voce.",
        position: "center"
      },
      {
        title: "Miauvadao",
        description: "As ofertas especiais do Miauvadao mudam com o tempo e podem esgotar. Use o botao de atualizar quando quiser conferir o estado mais recente.",
        target: "[data-tutorial='page-content']",
        position: "top"
      }
    ]
  },
  mascotes: {
    pageId: "mascotes",
    steps: [
      {
        title: "Seus mascotes",
        description: "Esta pagina concentra mascotes equipados, favoritos, banco, ovos, incubadoras, expedicoes e interacoes como carinho e brincar.",
        target: "[data-tutorial='page-content']",
        position: "top"
      },
      {
        title: "Cooldowns e status",
        description: "Mascotes podem ficar em expedicao, repouso, arena ou recuperacao. Quando um botao estiver apagado, aguarde o timer ou confira o status do mascote.",
        position: "center"
      },
      {
        title: "Banco sob demanda",
        description: "Mascotes guardados carregam aos poucos para economizar dados. Use filtros e paginacao para achar um mascote sem puxar tudo de uma vez.",
        position: "center"
      }
    ]
  },
  "arena-z": {
    pageId: "arena-z",
    steps: [
      {
        title: "Arena Z",
        description: "Monte uma equipe para PvE, PvP ou modo misto. O cofre da equipe acumula ZikaCoins, EXP e espolios enquanto ela permanece ativa.",
        target: "[data-tutorial='page-content']",
        position: "top"
      },
      {
        title: "Cooldowns por equipe",
        description: "Cada equipe tem seus proprios timers de PvE, PvP e retirada. Depois de atacar ou ser atacado, confira os avisos antes de tentar sair da arena.",
        position: "center"
      },
      {
        title: "Recuperacao",
        description: "Mascotes nocauteados vao para recuperacao. Se apenas alguns cairem, troque os slots livres para manter a posicao sem prender o time inteiro.",
        position: "center"
      }
    ]
  },
  "liga-semanal": {
    pageId: "liga-semanal",
    steps: [
      {
        title: "Liga Semanal dos Mascotes",
        description: "A liga cria chaves diarias, aplica modificadores e executa combates automaticamente pelos horarios da semana.",
        target: "[data-tutorial='page-content']",
        position: "top"
      },
      {
        title: "Escalacao e itens",
        description: "Escolha mascotes e use itens do inventario quando o modo permitir. Itens comprados, dropados ou recebidos tambem devem aparecer para uso.",
        position: "center"
      },
      {
        title: "Combates e recompensas",
        description: "Os resultados alimentam ranking e recompensas semanais. As previsualizacoes mostram mais turnos para explicar a luta sem alterar o resultado.",
        position: "center"
      }
    ]
  },
  "desafio-sincronizado": {
    pageId: "desafio-sincronizado",
    steps: [
      {
        title: "Arena Sincronizada",
        description: "Junte os tickets de fogo e agua, forme dupla e trave os 9 mascotes do evento. O sistema organiza a arena unica e avanca as rodadas.",
        target: "[data-tutorial='page-content']",
        position: "top"
      },
      {
        title: "Rodadas automaticas",
        description: "Cada rodada revela o modificador antes da escolha dos 3 mascotes. Se uma dupla nao travar a equipe a tempo, o sistema seleciona automaticamente.",
        position: "center"
      },
      {
        title: "Tickets e bans",
        description: "Tickets gerados pelo proprio jogador nao contam para ele mesmo. Ao entrar no evento, o ticket completo e consumido e as regras de ban passam a valer.",
        position: "center"
      }
    ]
  },
  "cacada-de-rastros": {
    pageId: "cacada-de-rastros",
    steps: [
      {
        title: "Cacada de Rastros",
        description: "Modo oculto de teste para admin. Um jogador se esconde em uma rota e outro tenta seguir pistas, usar itens e reduzir a distancia.",
        target: "[data-tutorial='page-content']",
        position: "top"
      },
      {
        title: "Esconder ou cacar",
        description: "Na simulacao admin, crie uma sala, escolha a rota do escondido e depois teste os movimentos do cacador com feedback de acerto, erro e evento.",
        position: "center"
      }
    ]
  },
  laboratorio: {
    pageId: "laboratorio",
    steps: [
      {
        title: "Laboratorio",
        description: "Transforme mascotes em po de criacao e use recursos para gerar novos ovos. Mascotes raros entregam mais po conforme a raridade configurada.",
        target: "[data-tutorial='page-content']",
        position: "top"
      },
      {
        title: "Historico da Pokedex",
        description: "Mesmo ao descartar um mascote, o historico pode registrar que voce ja teve aquela especie para progresso de colecao.",
        position: "center"
      }
    ]
  },
  zikaloot: {
    pageId: "zikaloot",
    steps: [
      {
        title: "ZikaLoot",
        description: "Use tickets para abrir sorteios de premios. Confira chances, historico e limites antes de gastar seus recursos.",
        target: "[data-tutorial='page-content']",
        position: "top"
      }
    ]
  },
  inventario: {
    pageId: "inventario",
    steps: [
      {
        title: "Inventario",
        description: "Aqui ficam itens consumiveis, tickets, ovos e recursos especiais usados em modos como mascotes, arena, eventos e liga semanal.",
        target: "[data-tutorial='page-content']",
        position: "top"
      }
    ]
  },
  codigos: {
    pageId: "codigos",
    steps: [
      {
        title: "Codigos e recompensas",
        description: "Jogadores veem seus codigos resgatados; admins gerenciam banco, envio, revogacao e correcao de codigos invalidos.",
        target: "[data-tutorial='page-content']",
        position: "top"
      }
    ]
  },
  presentes: {
    pageId: "presentes",
    steps: [
      {
        title: "Caixa de Presentes",
        description: "Premios chegam aqui antes de irem para seu inventario. Resgate individualmente ou use receber todos para pegar tudo de uma vez.",
        target: "[data-tutorial='page-content']",
        position: "top"
      }
    ]
  },
  lacos: {
    pageId: "lacos",
    steps: [
      {
        title: "Lacos dos mascotes",
        description: "Acompanhe relacoes, rivalidades e escolhas narrativas entre mascotes de jogadores diferentes. Decisoes podem afetar eventos e combate.",
        target: "[data-tutorial='page-content']",
        position: "top"
      }
    ]
  },
  torneio: {
    pageId: "torneio",
    steps: [
      {
        title: "Detalhes do torneio",
        description: "Veja inscricoes, dias de jogo, rankings internos, decks liberados e resultados. Torneios online e presenciais seguem fluxos diferentes.",
        target: "[data-tutorial='page-content']",
        position: "top"
      },
      {
        title: "Decks e dias",
        description: "No online, decks respeitam prazo de envio e bloqueio. No presencial, o fluxo e mais rapido e sem confirmacao dupla de resultado.",
        position: "center"
      }
    ]
  },
  "torneio-dia": {
    pageId: "torneio-dia",
    steps: [
      {
        title: "Dia de torneio",
        description: "Aqui ficam partidas, decks do dia, times ou duplas, bonus manuais e Top do Dia. Resultados validados alimentam ranking e premios.",
        target: "[data-tutorial='page-content']",
        position: "top"
      }
    ]
  },
  partidas: {
    pageId: "partidas",
    steps: [
      {
        title: "Partidas",
        description: "Reporte, confirme ou corrija resultados. Quando ambos confirmam ou o admin valida, a partida passa a contar no ranking.",
        target: "[data-tutorial='page-content']",
        position: "top"
      }
    ]
  },
  professor: {
    pageId: "professor",
    steps: [
      {
        title: "Professor",
        description: "Use esta area para interacoes especiais, ferias, testes e eventos ligados aos mascotes quando estiverem disponiveis.",
        target: "[data-tutorial='page-content']",
        position: "top"
      }
    ]
  },
  "ranking-mascotes": {
    pageId: "ranking-mascotes",
    steps: [
      { title: "Ranking de Mascotes", description: "Aqui os mascotes de todos os jogadores são comparados por nível e desempenho. Quanto mais seu mascote treina, luta e evolui, mais ele sobe.", target: "[data-tutorial='page-content']", position: "top" },
      { title: "Como subir", description: "Ganhe EXP em expedições, interações (carinho, brincar) e combates. Mascotes bem alimentados e felizes rendem mais. As regras de EXP estão no Manual.", position: "center" },
    ]
  },
  "arena-draft": {
    pageId: "arena-draft",
    steps: [
      { title: "Arena Draft 🃏", description: "Modo de times de 12 mascotes. Você escolhe entre Customizado (4.500 pontos de status, habilidades livres) e Padrão (seus mascotes reais).", target: "[data-tutorial='page-content']", position: "top" },
      { title: "Monte seu time", description: "Máximo de 5 Megas por time. Escolha a habilidade de cada mascote e ajuste a prioridade delas: a prioridade decide quais ficam ligadas. Dois times não podem ter o mesmo nome.", position: "center" },
      { title: "Luta automática", description: "A luta vai até o fim sozinha. Nos turnos 20, 35 e 45 cada lado reorganiza o time em segredo, então guarde uma boa estratégia para essas janelas.", position: "center" },
      { title: "Aprenda com o replay", description: "O log mostra dano, multiplicador de tipo e habilidades ativadas de cada golpe. Clique num mascote para ver forças e fraquezas e use o ❓ da equipe para a análise.", position: "center" },
    ]
  },
  "arena-online": {
    pageId: "arena-online",
    steps: [
      { title: "Batalha de Terreno", description: "Modo casual de combate ao vivo entre jogadores. Use o matchmaking para achar um adversário e jogar sem pressão de ranking.", target: "[data-tutorial='page-content']", position: "top" },
      { title: "Antes de entrar", description: "Confira sua equipe e o estado dos mascotes. Veja o Manual para entender tipos, posturas e personalidades, que decidem o resultado.", position: "center" },
    ]
  },
  "liga-rush": {
    pageId: "liga-rush",
    steps: [
      { title: "Liga Rush ⚡", description: "Edição semanal com rodadas diárias. Inscreva-se para a edição montar as equipes da semana; resultados e ranking atualizam a cada rodada.", target: "[data-tutorial='page-content']", position: "top" },
      { title: "Compareça!", description: "Se todas as suas partidas de uma semana terminarem em W/O (sem comparecer), você fica de fora da edição seguinte. Participe e mantenha a equipe pronta.", position: "center" },
      { title: "Recompensas", description: "As caixas só são entregues no encerramento oficial, na sexta-feira indicada na página. O mural mostra os destaques conforme os combates terminam.", position: "center" },
    ]
  },
  "rei-do-rio": {
    pageId: "rei-do-rio",
    steps: [
      { title: "Rei do Rio 👑", description: "Disputa PvP semanal com combates automáticos, cinco por dia. Quanto mais seus mascotes lutam, sobrevivem e ajudam o time, mais pontos a equipe soma. Quem tiver mais pontos no fim da sexta é coroado.", target: "[data-tutorial='page-content']", position: "top" },
      { title: "Inscrição e equipe", description: "Inscrever-se coloca você na lista. Se não montar o time, recebe uma equipe equilibrada automática. Às 21h as inscrições fecham, os 18 mascotes ficam travados e as equipes são reveladas.", position: "center" },
      { title: "Seus mascotes continuam livres", description: "O HP deste modo é só dele: expedições, Arena e treinos seguem normais. Os pontos viram saldo para trocar por caixas de prêmios.", position: "center" },
    ]
  },
  "raid-johto": {
    pageId: "raid-johto",
    steps: [
      { title: "Líderes de Johto", description: "Evento cooperativo: o servidor inteiro enfrenta os líderes, um de cada vez. O próximo só começa quando o anterior cair ou vencer.", target: "[data-tutorial='page-content']", position: "top" },
      { title: "Ranking do líder", description: "Cada líder tem seu ranking por dano; empate é decidido pelo maior número de ataques. Quem fica no pódio recebe o prêmio do pódio no lugar do de participante.", position: "center" },
    ]
  },
  "ordem-da-trapaca": {
    pageId: "ordem-da-trapaca",
    steps: [
      { title: "Ordem da Trapaça", description: "Modo de evento disponível por tempo limitado. Leia as regras na própria página antes de participar e fique de olho nos prazos.", target: "[data-tutorial='page-content']", position: "top" },
    ]
  },
  pokedex: {
    pageId: "pokedex",
    steps: [
      { title: "Pokédex", description: "Registro das espécies que você já teve. Mesmo ao descartar um mascote, a espécie continua contando para o progresso da coleção.", target: "[data-tutorial='page-content']", position: "top" },
    ]
  },
  habilidades: {
    pageId: "habilidades",
    steps: [
      { title: "Habilidades passivas", description: "Veja as habilidades que os mascotes podem ter nos combates, com a descrição de cada uma. Procure por nome ou categoria para montar uma equipe com sinergia.", target: "[data-tutorial='page-content']", position: "top" },
      { title: "Dê sua opinião", description: "Use o botão Opinar nos cards para contar à equipe o que achou de cada habilidade.", position: "center" },
    ]
  },
  "top-do-dia": {
    pageId: "top-do-dia",
    steps: [
      { title: "Top do Dia 👑", description: "Os melhores resultados de cada dia de torneio. Resultados validados alimentam o ranking e os prêmios.", target: "[data-tutorial='page-content']", position: "top" },
    ]
  },
  temporadas: {
    pageId: "temporadas",
    steps: [
      { title: "Temporadas", description: "Histórico de cada temporada da Liga: campeões, rankings e resultados finais. Abra uma para ver os detalhes.", target: "[data-tutorial='page-content']", position: "top" },
    ]
  },
  jogadores: {
    pageId: "jogadores",
    steps: [
      { title: "Jogadores", description: "Lista de todos os membros da Liga. Abra um perfil para ver conquistas, decks públicos e histórico de partidas.", target: "[data-tutorial='page-content']", position: "top" },
    ]
  },
  "meus-decks": {
    pageId: "meus-decks",
    steps: [
      { title: "Meus Decks", description: "Salve e organize seus decks. Marque como públicos os que quiser mostrar no seu perfil e reutilize-os ao se inscrever em torneios.", target: "[data-tutorial='page-content']", position: "top" },
    ]
  },
  resgatar: {
    pageId: "resgatar",
    steps: [
      { title: "Resgatar código", description: "Digite aqui um código recebido em eventos ou promoções. A recompensa chega na sua Caixa de Presentes ou inventário.", target: "[data-tutorial='page-content']", position: "top" },
    ]
  },
  "amigo-oculto": {
    pageId: "amigo-oculto",
    steps: [
      { title: "Amigo Oculto 🎁", description: "Inscreva-se dentro do prazo, receba um amigo secreto e envie seu presente. Os kits são entregues na data do evento.", target: "[data-tutorial='page-content']", position: "top" },
    ]
  },
  ligacash: {
    pageId: "ligacash",
    steps: [
      { title: "LigaCash", description: "Moeda premium da Liga, comprada com dinheiro real. Use na loja para itens especiais. O saldo e o histórico ficam na sua carteira.", target: "[data-tutorial='page-content']", position: "top" },
    ]
  },
  dashboard: {
    pageId: "dashboard",
    steps: [
      { title: "Sua central ⚡", description: "O Dashboard reúne o resumo do seu dia: partidas pendentes, decks da semana, avisos e atalhos. Vamos conhecer o menu.", position: "center" },
      ...MENU_TOUR_STEPS.slice(1),
    ]
  },
  carteira: {
    pageId: "carteira",
    steps: [
      { title: "Sua carteira 🪙", description: "Aqui você acompanha seu saldo de ZikaCoins e todo o histórico de créditos e débitos (compras, prêmios, apostas e presentes).", position: "center" },
      { title: "De onde vêm as ZikaCoins?", description: "Você ganha ZC em torneios, expedições, conquistas, presentes de amigos e eventos. Gaste na ZikaShop, no Bazar e na máquina do Miauvadão.", position: "center" },
    ]
  },
  "passe-apoiador": {
    pageId: "passe-apoiador",
    steps: [
      { title: "Passe de Apoiador 🎫", description: "Resgate uma recompensa por dia ao longo do calendário do passe: moedas, ovos, itens e prêmios especiais nos marcos.", position: "center" },
      { title: "Não perca um dia", description: "Cada dia liberado tem seu presente. Volte todo dia para resgatar — alguns passes permitem resgatar dias anteriores pendentes.", position: "center" },
    ]
  },
  insignias: {
    pageId: "insignias",
    steps: [
      { title: "Insígnias 🏅", description: "As insígnias são conquistas de destaque dadas em torneios e eventos. Cada uma vale pontos extras no seu ranking.", position: "center" },
      { title: "Mostre no perfil", description: "Suas insígnias aparecem no seu perfil público para todo mundo ver. Colecione o máximo que puder!", position: "center" },
    ]
  },
  noticias: {
    pageId: "noticias",
    steps: [
      { title: "Notícias 📰", description: "Acompanhe os comunicados oficiais da Liga: eventos, atualizações, resultados e avisos importantes ficam todos aqui.", position: "center" },
    ]
  },
  mensagens: {
    pageId: "mensagens",
    steps: [
      { title: "Mensagens 💬", description: "Converse com outros jogadores por mensagens diretas. Notificações do sistema (como propostas do Bazar) também chegam por aqui.", position: "center" },
    ]
  },
  manual: {
    pageId: "manual",
    steps: [
      { title: "Manual do jogo 📖", description: "O manual reúne as regras detalhadas: expedições, combate, posturas, drops, economia e muito mais. Consulte sempre que tiver dúvida.", position: "center" },
    ]
  }
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
