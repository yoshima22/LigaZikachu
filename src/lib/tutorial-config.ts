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
  },
  bazar: {
    pageId: "bazar",
    steps: [
      {
        title: "Bazar",
        description: "Aqui os jogadores anunciam itens, mascotes e ofertas para troca. Confira o que esta em escrow antes de propor ou aceitar uma troca.",
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
  }
};

const ROUTE_TUTORIALS: Array<[RegExp, string]> = [
  [/^\/bazar(\/|$)/, "bazar"],
  [/^\/mascotes\/ranking(\/|$)/, "ranking"],
  [/^\/mascotes(\/|$)/, "mascotes"],
  [/^\/arena-z(\/|$)/, "arena-z"],
  [/^\/combates\/liga-semanal(\/|$)/, "liga-semanal"],
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
