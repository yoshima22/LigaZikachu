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
        facts: ["Suas bochechas armazenam eletricidade.", "Em grupo, Pikachus descarregam raios juntos para afastar predadores."],
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
        facts: ["Seu DNA é instável e reage ao ambiente."],
        unlock: [{ type: "mascot", pokemonId: 133 }, { type: "albumGen", generation: 1, percent: 50 }]
      },
      {
        id: "mewtwo-laboratorio",
        pokemonId: 150,
        title: "Relatório selado nº 150",
        story: [
          "O relatório foi lacrado por ordem superior. Só os treinadores que completarem o álbum de Kanto poderão ler o que restou dele."
        ],
        unlock: [{ type: "albumGen", generation: 1, percent: 100 }]
      }
    ]
  }
];
