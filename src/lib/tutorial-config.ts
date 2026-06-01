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

export const TUTORIALS: Record<string, PageTutorial> = {
  welcome: {
    pageId: "welcome",
    steps: [
      {
        title: "Bem-vindo à Liga Zikachu! ⚡",
        description: "A Liga Zikachu é um campeonato de Pokémon TCG com ranking, insígnias, conquistas e muito mais. Este tutorial rápido vai te mostrar o que tem disponível.",
        position: "center"
      },
      {
        title: "Sua área pessoal",
        description: "No menu 'Perfil' você personaliza seu avatar com molduras, banners e títulos exclusivos conquistados na liga. Suas estatísticas e histórico de partidas ficam lá também.",
        target: "[data-tutorial='nav-perfil']",
        position: "bottom"
      },
      {
        title: "Torneios, Ranking e Coleção",
        description: "Participe de campeonatos, acompanhe sua posição no ranking geral e complete seu álbum de figurinhas. Ganhe ZikaCoins participando e use na ZikaShop!",
        target: "[data-tutorial='nav-torneios']",
        position: "bottom"
      }
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
        target: "[data-tutorial='ranking-badges']",
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
        target: "[data-tutorial='shop-items']",
        position: "top"
      },
      {
        title: "Seu saldo de ZikaCoins",
        description: "ZikaCoins são ganhos participando de torneios, apostas e eventos. Fique de olho no seu saldo antes de comprar.",
        target: "[data-tutorial='shop-balance']",
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
        target: "[data-tutorial='album-progress']",
        position: "bottom"
      },
      {
        title: "Filtre por geração",
        description: "Use os filtros de geração e conjunto para encontrar figurinhas específicas. O filtro 'Faltantes' mostra o que ainda precisa.",
        target: "[data-tutorial='album-filters']",
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
        target: "[data-tutorial='bet-open']",
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
        target: "[data-tutorial='bet-history']",
        position: "top"
      }
    ]
  }
};
