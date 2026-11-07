import type { JournalChapter } from "./types";

// Conteúdo de exemplo — substitua/expanda com a lore real. Imagens extras em public/journal/.
export const JOURNAL_CHAPTERS: JournalChapter[] = [
  {
    id: "cap-1-faiscas",
    title: "Capítulo I — Faíscas na Floresta",
    subtitle: "Os primeiros registros de campo da Liga",
    accent: "#FFCB05",
    entries: [
      {
        id: "pikachu-primeira-noite",
        pokemonId: 25,
        title: "A primeira noite de tempestade",
        story: [
          "Os treinadores mais antigos contam que o primeiro Pikachu da Liga apareceu numa noite de tempestade, atraído pelo brilho das lanternas do acampamento.",
          "Em vez de fugir dos trovões, ele os absorveu — e o acampamento inteiro acendeu por três minutos."
        ],
        facts: [
          "Suas bochechas armazenam eletricidade.",
          "No anime, o Pikachu de Ash se recusa a entrar na Poké Bola desde o primeiro episódio.",
          "É o mascote da franquia e aparece no título de vários filmes, como Detetive Pikachu (2019, live-action)."
        ],
        unlock: [{ type: "mascot", pokemonId: 25 }, { type: "sticker", pokemonId: 25 }]
      },
      {
        id: "eevee-pedra-misteriosa",
        pokemonId: 133,
        title: "O diário da pedra misteriosa",
        story: [
          "Uma página rasgada do diário de um pesquisador descreve um Eevee que mudava de forma conforme o lugar onde dormia.",
          "Ninguém sabe se a pedra influenciou — ou se foi o próprio Eevee quem escolheu."
        ],
        facts: [
          "Seu DNA é instável e reage ao ambiente.",
          "Tem 8 evoluções: Vaporeon, Jolteon e Flareon (Geração 1), Espeon e Umbreon (2), Leafeon e Glaceon (4) e Sylveon (6).",
          "No anime, Eevee evoluiu de formas diferentes para treinadores diferentes, incluindo a Eevee de Gary."
        ],
        unlock: [{ type: "mascot", pokemonId: 133 }, { type: "albumGen", generation: 1, percent: 50 }]
      },
      {
        id: "mewtwo-laboratorio",
        pokemonId: 150,
        title: "Relatório selado nº 150",
        story: [
          "O relatório foi lacrado por ordem superior. Só quem encontrar o Mewtwo — ou completar o álbum de Kanto — poderá ler o que restou dele."
        ],
        facts: [
          "Nos jogos, Mewtwo foi criado a partir do DNA de Mew.",
          "É o protagonista de Pokémon: O Filme 1 — Mewtwo Contra-Ataca (1998), refeito em 2019 como Mewtwo Strikes Back: Evolution."
        ],
        unlock: [{ type: "albumGen", generation: 1, percent: 100 }]
      }
    ]
  },
  {
    id: "cap-2-iniciais",
    title: "Capítulo II — Os Três Caminhos",
    subtitle: "Cartas de um velho professor aos novos treinadores",
    accent: "#7ac36a",
    entries: [
      {
        id: "bulbasaur-semente",
        pokemonId: 1,
        title: "A semente que cresce junto",
        story: [
          "Dizem que o Bulbasaur nasce com uma semente já plantada nas costas, e que ela amadurece no mesmo passo que o coração do treinador.",
          "Nos dias de sol ele fica parado por horas, de olhos fechados. Não é preguiça: é a semente conversando com a luz."
        ],
        facts: [
          "A semente das costas cresce com o Pokémon.",
          "É o nº 001 da Pokédex Nacional, o primeiro registro de todos.",
          "No anime, o Bulbasaur de Ash liderou os Bulbasaur de uma vila escondida, onde tomou conta de Pokémon órfãos."
        ],
        unlock: [{ type: "mascot", pokemonId: 1 }, { type: "sticker", pokemonId: 1 }]
      },
      {
        id: "charmander-chama",
        pokemonId: 4,
        title: "A chama que não se apaga",
        story: [
          "A chama na ponta da cauda do Charmander é um espelho: queima forte quando ele está feliz e vacila quando está doente ou triste.",
          "Um velho guarda-parque jurava ter visto um deles sentado na chuva, protegendo a própria chama com a folha de uma árvore."
        ],
        facts: [
          "A chama da cauda reflete a saúde e o humor dele.",
          "Nos jogos, é um dos três iniciais de Kanto, junto com Bulbasaur e Squirtle.",
          "No anime, Ash encontrou seu Charmander abandonado numa rocha; ele evoluiu até Charizard."
        ],
        unlock: [{ type: "mascot", pokemonId: 4 }, { type: "sticker", pokemonId: 4 }]
      },
      {
        id: "squirtle-casco",
        pokemonId: 7,
        title: "O casco e a maré",
        story: [
          "Quando percebe perigo, o Squirtle se recolhe no casco e lança jatos de água com precisão de arqueiro.",
          "Os pescadores de Kanto dizem que um bando deles, em linha na praia, anuncia a mudança da maré antes de qualquer barômetro."
        ],
        facts: [
          "O casco é leve, mas muito resistente.",
          "Nos jogos, é um dos três iniciais de Kanto.",
          "No anime, o Squirtle de Ash era líder do Esquadrão Squirtle antes de se juntar a ele."
        ],
        unlock: [{ type: "mascot", pokemonId: 7 }, { type: "sticker", pokemonId: 7 }]
      }
    ]
  },
  {
    id: "cap-3-aves",
    title: "Capítulo III — Lendas do Céu",
    subtitle: "Três sombras nas asas do horizonte",
    accent: "#6fb1e6",
    entries: [
      {
        id: "articuno-neve",
        pokemonId: 144,
        title: "A visitante da nevasca",
        story: [
          "Montanhistas perdidos contam que, no auge da nevasca, uma ave de gelo desenha um caminho no ar e os guia de volta à trilha.",
          "Ninguém jamais a viu pousar. Só o rastro de cristais que ela deixa para trás."
        ],
        facts: [
          "Segundo a lenda, ela aparece para quem se perde nas montanhas nevadas.",
          "Aparece em Pokémon: O Filme 2000, junto com Zapdos e Moltres.",
          "Em Galar, ganhou uma forma regional Psíquico/Voador."
        ],
        unlock: [{ type: "mascot", pokemonId: 144 }, { type: "albumGen", generation: 1, percent: 75 }]
      },
      {
        id: "zapdos-trovao",
        pokemonId: 145,
        title: "O coração da tempestade",
        story: [
          "Zapdos vive dentro das nuvens carregadas e se alimenta dos raios que o atingem.",
          "Os antigos tratavam as tempestades como sinais dele, e ninguém ousava ficar em campo aberto quando as asas amarelas riscavam o céu."
        ],
        facts: [
          "Ele ganha poder ao ser atingido por relâmpagos.",
          "Aparece em Pokémon: O Filme 2000, junto com Articuno e Moltres.",
          "Em Galar, ganhou uma forma regional Lutador/Voador."
        ],
        unlock: [{ type: "mascot", pokemonId: 145 }, { type: "albumGen", generation: 1, percent: 75 }]
      },
      {
        id: "moltres-vulcao",
        pokemonId: 146,
        title: "A fênix do vulcão",
        story: [
          "Quando Moltres se fere, ele mergulha na cratera de um vulcão e renasce das chamas, ainda mais forte.",
          "No inverno, o bater de suas asas incendeia o ar e anuncia a chegada da primavera."
        ],
        facts: [
          "Diz a lenda que ele se cura mergulhando em lava.",
          "Aparece em Pokémon: O Filme 2000, junto com Articuno e Zapdos.",
          "Em Galar, ganhou uma forma regional Sombrio/Voador."
        ],
        unlock: [{ type: "mascot", pokemonId: 146 }, { type: "albumGen", generation: 1, percent: 75 }]
      }
    ]
  }
];
