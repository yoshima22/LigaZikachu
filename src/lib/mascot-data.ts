import { MEGA_FORM_IDS, getMegaStoneForMegaPokemon } from "@/lib/mega-evolution";

/**
 * Dados estáticos do sistema de mascotes.
 * Pools de Pokémon por raridade de ovo (gen 1-2, apenas formas iniciais).
 * Evoluções com nível clássico dos jogos.
 */

// ── Pools por tipo de ovo ─────────────────────────────────────────────────────

// IDs da PokéAPI — apenas formas iniciais de cadeia evolutiva ou Pokémon sem evolução
export const EGG_POOLS: Record<string, number[]> = {
  // Ovo Comum — Pokémon comuns da gen 1-2
  COMMON: [
    10, 13, 16, 19, 21, 23, 27, 29, 32, 35, 39, 41, 43, 46, 48, 50,
    52, 54, 56, 60, 69, 72, 74, 77, 79, 81, 84, 86, 88, 90, 96, 98,
    100, 102, 104, 109, 111, 116, 118, 120,
    // Gen 2
    161, 163, 165, 167, 170, 183, 187, 191, 194, 204, 209, 218, 220,
    223, 228, 231, 234, 235,
  ],

  // Ovo Raro — Starters, Pokémon populares
  RARE: [
    1, 4, 7,           // Starters gen 1
    25, 37, 58, 63, 66,  // Populares gen 1
    92, 95, 106, 107, 108, 113, 123, 124, 125, 126, 127, 128,
    // Gen 2
    152, 155, 158,      // Starters gen 2
    172, 173, 174, 175, 179, 190, 193, 196, 197, 198, 200, 203,
    207, 215, 216, 225, 227,
  ],

  // Ovo Especial — Pokémon raros e cobiçados
  SPECIAL: [
    129, 131, 132, 133, 138, 140, 143,  // Magikarp, Lapras, Ditto, Eevee, fósseis, Snorlax
    147,                                  // Dratini
    // Gen 2
    246, 236,                            // Larvitar, Tyrogue
    241, 213, 214, 222, 226, 233,        // Miltank, Shuckle, Heracross, Corsola, Mantine, Porygon2
  ],

  // Ovo de Evento — pool temático (configurado caso a caso; padrão = starters)
  EVENT: [1, 4, 7, 152, 155, 158, 25, 133, 147],

  // Ovos por geração (apenas formas iniciais presentes em COMMON ou RARE)
  EGG_GEN1: [
    // COMMON gen 1
    10, 13, 16, 19, 21, 23, 27, 29, 32, 35, 39, 41, 43, 46, 48, 50,
    52, 54, 56, 60, 69, 72, 74, 77, 79, 81, 84, 86, 88, 90, 96, 98,
    100, 102, 104, 109, 111, 116, 118, 120,
    // RARE gen 1
    1, 4, 7, 25, 37, 58, 63, 66,
    92, 95, 106, 107, 108, 113, 123, 124, 125, 126, 127, 128,
  ],

  EGG_GEN2: [
    161, 163, 165, 167, 170, 183, 187, 191, 194, 204, 209, 218, 220,
    223, 228, 231, 234, 235,
    152, 155, 158, 172, 173, 174, 175, 179, 190, 193, 196, 197, 198, 200, 203,
    207, 215, 216, 225, 227,
  ],

  // Gen 3 (Hoenn) — formas iniciais selecionadas
  EGG_GEN3: [
    252, 255, 258,       // Starters: Treecko, Torchic, Mudkip
    261, 263, 265, 270, 273, 276, 278, 280, 283, 285, 287, 290, 293,
    296, 298, 300, 302, 304, 307, 309, 311, 312, 315, 316, 318, 320,
    322, 325, 327, 328, 331, 333, 335, 336, 337, 338, 339, 341, 343,
    345, 347, 349, 351, 352, 353, 355, 357, 358, 359, 361, 363, 366,
    369, 370, 371, 374, // Bagon, Beldum
  ],

  // Gen 4 (Sinnoh) — formas iniciais selecionadas
  EGG_GEN4: [
    387, 390, 393,       // Starters: Turtwig, Chimchar, Piplup
    396, 399, 401, 403, 406, 408, 410, 412, 415, 417, 418, 420, 422,
    // 424 Ambipom removido (evolução de Aipom), 429 Mismagius (de Misdreavus),
    // 430 Honchkrow (de Murkrow), 461 Weavile (de Sneasel) — forms evoluídas via item
    425, 427, 431, 433, 434, 436, 438, 439, 440, 441,
    442, 443, 446, 447, 449, 451, 453, 455, 456, 458, 459, 479,
  ],

  // Gen 5 (Unova) — formas iniciais selecionadas
  EGG_GEN5: [
    495, 498, 501,       // Starters: Snivy, Tepig, Oshawott
    504, 506, 509, 511, 513, 515, 517, 519, 521, 523, 525, 527, 529,
    531, 532, 535, 537, 538, 539, 540, 543, 546, 548, 550, 551, 554,
    556, 557, 559, 561, 562, 564, 566, 568, 570, 572, 574, 576, 577,
    580, 582, 585, 587, 588, 590, 592, 594, 595, 597, 599, 601, 602,
    605, 607, 609, 610, 613, 615, 616, 618, 619, 621, 622, 624, 626,
    627, 629, 631, 632, 633, 636, 638, 639, 640, 641, 642, 645,
  ],

  // Gen 6 (Kalos)
  EGG_GEN6: [
    650, 653, 656,  // Starters Kalos
    661, 664, 667, 669, 672, 674, 676, 677, 679, 682, 684, 686,
    688, 690, 692, 694, 696, 698, 701, 703, 704, 707, 708, 710, 712,
  ],

  // Gen 7 (Alola) — inclui formas Alolan como variantes da geração
  EGG_GEN7: [
    722, 725, 728,  // Starters Alola
    731, 734, 736, 739, 742, 744, 746, 747, 749, 751, 753, 755, 757,
    759, 761, 767, 769, 777, 781, 782,
    // Formas Alolan — bases (evoluídas filtradas por isBaseForm)
    10091, // Rattata-Alola
    10101, // Sandshrew-Alola
    10103, // Vulpix-Alola
    10105, // Diglett-Alola
    10107, // Meowth-Alola
    10109, // Geodude-Alola
    10112, // Grimer-Alola
  ],

  // Gen 8 (Galar) — inclui formas Galarianas como variantes da geração
  EGG_GEN8: [
    810, 813, 816,  // Starters Galar
    819, 821, 824, 827, 829, 831, 833, 835, 837, 840, 843, 845, 846,
    848, 850, 852, 854, 856, 868, 870, 871, 872, 874, 875, 877,
    878, 885,
    // Removidos: 861 Grimmsnarl (evolução da linha 856→857→861)
    // Formas Galarianas — bases (evoluídas filtradas por isBaseForm)
    10158, // Meowth-Galar
    10159, // Ponyta-Galar
    10161, // Slowpoke-Galar
    10163, // Farfetch'd-Galar
    10164, // Weezing-Galar
    10165, // Mr. Mime-Galar
    10170, // Corsola-Galar
    10171, // Zigzagoon-Galar
    10173, // Darumaka-Galar
    10175, // Yamask-Galar
    10176, // Stunfisk-Galar
  ],

  // Gen 9 (Paldea)
  EGG_GEN9: [
    906, 909, 912,  // Starters Paldea
    915, 917, 919, 921, 924, 926, 928, 931, 932, 935, 938, 940,
    942, 944, 946, 948, 950, 952, 954, 956, 958, 961, 963, 965,
    967, 968, 969, 971, 973, 977, 978, 996,
  ],

  // ── Formas Regionais ──────────────────────────────────────────────────────────
  // Apenas formas BASE (sem evolução interna) — filtradas por isBaseForm abaixo
  EGG_ALOLA: [
    10091, // Rattata-Alola
    10101, // Sandshrew-Alola
    10103, // Vulpix-Alola
    10105, // Diglett-Alola
    10107, // Meowth-Alola
    10109, // Geodude-Alola
    10112, // Grimer-Alola
  ],

  EGG_GALAR: [
    10158, // Meowth-Galar
    10159, // Ponyta-Galar
    10161, // Slowpoke-Galar
    10163, // Farfetch'd-Galar
    10164, // Weezing-Galar (sem evolução — forma final única)
    10165, // Mr. Mime-Galar
    10170, // Corsola-Galar
    10171, // Zigzagoon-Galar
    10173, // Darumaka-Galar
    10175, // Yamask-Galar
    10176, // Stunfisk-Galar (sem evolução — forma final única)
  ],

  EGG_HISUI: [
    10229, // Growlithe-Hisui
    10231, // Voltorb-Hisui
    10234, // Qwilfish-Hisui
    10235, // Sneasel-Hisui
    10238, // Zorua-Hisui
  ],

  // Pool aleatório — inclui todos os gens, garante diversidade
  RANDOM: [] as number[], // preenchido abaixo após todas as definições

  // Gen 6+ legacy alias (mantido para compatibilidade) — somente formas base
  EGG_GEN6PLUS: [
    650, 653, 656,       // Starters Kalos
    661, 664, 667, 669, 672, 674, 676, 677, 679, 682, 684, 686,
    688, 690, 692, 694, 696, 698, 701, 703, 704, 707, 708, 710, 712, 714,
    // Removidos: 681 Aegislash (evolução de Doublade), 700 Sylveon (evolução de Eevee)
    // 716 Xerneas, 720 Hoopa são lendários — não entram em ovos normais
    // Alola
    722, 725, 728, 731, 734, 736, 739, 742, 744, 746, 747, 749, 751,
    753, 755, 757, 759, 761, 764, 765, 766, 767, 769, 771, 774, 775, 778, 781, 782,
    // Removidos: 785-788 Tapus são lendários
    // Galar
    810, 813, 816, 819, 821, 824, 827, 829, 831, 833, 835, 837, 840,
    843, 845, 846, 848, 850, 852, 854, 856, 868, 870, 871, 872, 874, 875, 876,
    877, 878, 880, 881, 882, 883, 884, 885,
    // Removidos: 842 Appletun (evolução de Applin), 858/860/861 linha Hatenna/Impidimp
    // 862 Obstagoon, 863 Perrserker, 864 Cursola, 865 Sirfetch'd, 866 Mr. Rime
    // 867 Runerigus, 869 Alcremie (evoluções Galar por item/amizade)
    // 886 Drakloak, 887 Dragapult (evoluções de Dreepy)
  ],
};

// Pool RANDOM é preenchido após a filtragem de evoluídos (mais abaixo, após EVOLUTION_MAP)

// ── Evoluções por nível ───────────────────────────────────────────────────────
// Formato: { de: pokemonId, para: pokemonId, nivel: number }

export interface Evolution {
  from: number;
  to: number;
  /** Se presente, sorteia aleatoriamente entre essas opções ao evoluir (ignora `to`) */
  toOptions?: number[];
  level: number;
}

export const EVOLUTIONS: Evolution[] = [
  // Gen 1 — starters
  { from: 1,   to: 2,   level: 16 }, { from: 2,   to: 3,   level: 32 },
  { from: 4,   to: 5,   level: 16 }, { from: 5,   to: 6,   level: 36 },
  { from: 7,   to: 8,   level: 16 }, { from: 8,   to: 9,   level: 36 },
  // Insetos
  { from: 10,  to: 11,  level: 7  }, { from: 11,  to: 12,  level: 10 },
  { from: 13,  to: 14,  level: 7  }, { from: 14,  to: 15,  level: 10 },
  // Outros gen 1
  { from: 16,  to: 17,  level: 18 }, { from: 17,  to: 18,  level: 36 },
  { from: 19,  to: 20,  level: 20 },
  { from: 21,  to: 22,  level: 20 },
  { from: 23,  to: 24,  level: 22 },
  { from: 25,  to: 26,  level: 30 }, // Pikachu → Raichu (sem pedra no sistema)
  { from: 27,  to: 28,  level: 22 },
  { from: 29,  to: 30,  level: 16 }, { from: 30,  to: 31,  level: 36 },
  { from: 32,  to: 33,  level: 16 }, { from: 33,  to: 34,  level: 36 },
  { from: 35,  to: 36,  level: 36 },
  { from: 37,  to: 38,  level: 36 },
  { from: 39,  to: 40,  level: 36 },
  { from: 41,  to: 42,  level: 22 },
  { from: 43,  to: 44,  level: 21 }, { from: 44,  to: 45,  toOptions: [45, 182], level: 36 },
  { from: 46,  to: 47,  level: 24 },
  { from: 48,  to: 49,  level: 31 },
  { from: 50,  to: 51,  level: 26 },
  { from: 52,  to: 53,  level: 28 },
  { from: 54,  to: 55,  level: 33 },
  { from: 56,  to: 57,  level: 28 }, { from: 57, to: 979, level: 42 }, // Primeape -> Annihilape
  { from: 58,  to: 59,  level: 36 },
  { from: 60,  to: 61,  level: 25 }, { from: 61,  to: 62,  toOptions: [62, 186], level: 36 },
  { from: 63,  to: 64,  level: 16 }, { from: 64,  to: 65,  level: 36 },
  { from: 66,  to: 67,  level: 28 }, { from: 67,  to: 68,  level: 36 },
  { from: 69,  to: 70,  level: 21 }, { from: 70,  to: 71,  level: 36 },
  { from: 72,  to: 73,  level: 30 },
  { from: 74,  to: 75,  level: 25 }, { from: 75,  to: 76,  level: 36 },
  { from: 77,  to: 78,  level: 40 },
  { from: 79,  to: 80,  toOptions: [80, 199], level: 37 },
  { from: 81,  to: 82,  level: 30 },
  { from: 84,  to: 85,  level: 31 },
  { from: 86,  to: 87,  level: 34 },
  { from: 88,  to: 89,  level: 38 },
  { from: 90,  to: 91,  level: 36 },
  { from: 92,  to: 93,  level: 25 }, { from: 93,  to: 94,  level: 36 },
  { from: 96,  to: 97,  level: 26 },
  { from: 98,  to: 99,  level: 28 },
  { from: 100, to: 101, level: 30 },
  { from: 102, to: 103, level: 36 },
  { from: 104, to: 105, level: 28 },
  { from: 109, to: 110, level: 35 },
  { from: 111, to: 112, level: 42 },
  { from: 116, to: 117, level: 32 },
  { from: 118, to: 119, level: 33 },
  { from: 120, to: 121, level: 36 },
  { from: 129, to: 130, level: 20 }, // Magikarp → Gyarados
  // Eevee → sorteio aleatório entre as 8 eeveelutions ao atingir nível 30
  { from: 133, to: 134, toOptions: [134, 135, 136, 196, 197, 470, 471, 700], level: 30 },
  { from: 138, to: 139, level: 40 },
  { from: 140, to: 141, level: 40 },
  { from: 147, to: 148, level: 30 }, { from: 148, to: 149, level: 55 },
  // Gen 2 — starters
  { from: 152, to: 153, level: 16 }, { from: 153, to: 154, level: 32 },
  { from: 155, to: 156, level: 14 }, { from: 156, to: 157, level: 36 },
  { from: 158, to: 159, level: 18 }, { from: 159, to: 160, level: 30 },
  // Gen 2 — outros
  { from: 161, to: 162, level: 15 },
  { from: 163, to: 164, level: 20 },
  { from: 165, to: 166, level: 18 },
  { from: 167, to: 168, level: 22 },
  { from: 170, to: 171, level: 27 },
  { from: 172, to: 25,  level: 15 }, // Pichu → Pikachu
  { from: 173, to: 35,  level: 15 }, // Cleffa → Clefairy
  { from: 174, to: 39,  level: 15 }, // Igglybuff → Jigglypuff
  { from: 175, to: 176, level: 25 },
  { from: 183, to: 184, level: 18 },
  { from: 187, to: 188, level: 18 }, { from: 188, to: 189, level: 27 },
  { from: 191, to: 192, level: 36 },
  { from: 194, to: 195, level: 20 },
  { from: 204, to: 205, level: 31 },
  { from: 209, to: 210, level: 23 },
  { from: 216, to: 217, level: 30 },
  { from: 217, to: 901, level: 45 }, // Ursaring → Ursaluna (Peat Block)
  { from: 218, to: 219, level: 38 },
  { from: 220, to: 221, level: 33 },
  { from: 223, to: 224, level: 25 },
  { from: 228, to: 229, level: 24 },
  { from: 231, to: 232, level: 25 },
  { from: 238, to: 124, level: 30 }, // Smoochum → Jynx
  { from: 239, to: 125, level: 30 }, // Elekid → Electabuzz
  { from: 240, to: 126, level: 30 }, // Magby → Magmar
  { from: 246, to: 247, level: 30 }, { from: 247, to: 248, level: 55 },
  // Gen 3
  { from: 252, to: 253, level: 16 }, { from: 253, to: 254, level: 36 },
  { from: 255, to: 256, level: 16 }, { from: 256, to: 257, level: 36 },
  { from: 258, to: 259, level: 16 }, { from: 259, to: 260, level: 36 },
  { from: 261, to: 262, level: 18 },
  { from: 263, to: 264, level: 20 },
  { from: 265, to: 266, toOptions: [266, 268], level: 7  }, { from: 266, to: 267, level: 10 },
  { from: 268, to: 269, level: 10 },
  { from: 270, to: 271, level: 14 }, { from: 271, to: 272, level: 30 },
  { from: 273, to: 274, level: 14 }, { from: 274, to: 275, level: 30 },
  { from: 276, to: 277, level: 22 },
  { from: 278, to: 279, level: 25 },
  { from: 280, to: 281, level: 20 }, { from: 281, to: 282, toOptions: [282, 475], level: 30 },
  { from: 285, to: 286, level: 23 },
  { from: 287, to: 288, level: 18 }, { from: 288, to: 289, level: 36 },
  { from: 293, to: 294, level: 20 }, { from: 294, to: 295, level: 40 },
  { from: 296, to: 297, level: 24 },
  { from: 300, to: 301, level: 30 },
  { from: 304, to: 305, level: 32 }, { from: 305, to: 306, level: 42 },
  { from: 307, to: 308, level: 37 },
  { from: 309, to: 310, level: 26 },
  { from: 316, to: 317, level: 26 },
  { from: 318, to: 319, level: 30 },
  { from: 320, to: 321, level: 40 },
  { from: 322, to: 323, level: 33 },
  { from: 325, to: 326, level: 32 },
  { from: 328, to: 329, level: 35 }, { from: 329, to: 330, level: 45 },
  { from: 331, to: 332, level: 32 },
  { from: 333, to: 334, level: 35 },
  { from: 339, to: 340, level: 30 },
  { from: 341, to: 342, level: 30 },
  { from: 343, to: 344, level: 36 },
  { from: 345, to: 346, level: 40 },
  { from: 347, to: 348, level: 40 },
  { from: 349, to: 350, level: 30 }, // Feebas → Milotic (Prism Scale/beleza)
  { from: 353, to: 354, level: 37 },
  { from: 355, to: 356, level: 37 },
  { from: 361, to: 362, toOptions: [362, 478], level: 42 },
  { from: 363, to: 364, level: 32 }, { from: 364, to: 365, level: 44 },
  { from: 371, to: 372, level: 30 }, { from: 372, to: 373, level: 50 },
  { from: 374, to: 375, level: 20 }, { from: 375, to: 376, level: 45 },
  // Gen 4
  { from: 387, to: 388, level: 18 }, { from: 388, to: 389, level: 32 },
  { from: 390, to: 391, level: 14 }, { from: 391, to: 392, level: 36 },
  { from: 393, to: 394, level: 16 }, { from: 394, to: 395, level: 36 },
  { from: 396, to: 397, level: 14 }, { from: 397, to: 398, level: 34 },
  { from: 399, to: 400, level: 15 },
  { from: 403, to: 404, level: 15 }, { from: 404, to: 405, level: 30 },
  { from: 406, to: 315, level: 20 },
  { from: 315, to: 407, level: 30 }, // Roselia → Roserade (Shiny Stone)
  { from: 408, to: 409, level: 30 },
  { from: 410, to: 411, level: 30 },
  { from: 418, to: 419, level: 26 },
  { from: 420, to: 421, level: 25 },
  { from: 425, to: 426, level: 28 },
  { from: 427, to: 428, level: 32 },
  { from: 433, to: 358, level: 20 }, // Chingling -> Chimecho
  { from: 431, to: 432, level: 38 },
  { from: 434, to: 435, level: 34 },
  { from: 436, to: 437, level: 33 },
  { from: 438, to: 185, level: 20 }, // Bonsly -> Sudowoodo
  { from: 439, to: 122, level: 20 }, // Mime Jr. -> Mr. Mime
  { from: 440, to: 113, level: 20 }, // Happiny -> Chansey
  { from: 443, to: 444, level: 24 }, { from: 444, to: 445, level: 48 },
  { from: 446, to: 143, level: 25 }, // Munchlax -> Snorlax
  { from: 447, to: 448, level: 20 },
  { from: 449, to: 450, level: 34 },
  { from: 451, to: 452, level: 40 },
  { from: 453, to: 454, level: 37 },
  { from: 456, to: 457, level: 31 },
  { from: 458, to: 226, level: 20 }, // Mantyke -> Mantine
  { from: 459, to: 460, level: 40 },
  // Gen 5
  { from: 495, to: 496, level: 17 }, { from: 496, to: 497, level: 36 },
  { from: 498, to: 499, level: 17 }, { from: 499, to: 500, level: 36 },
  { from: 501, to: 502, level: 17 }, { from: 502, to: 503, level: 36 },
  { from: 504, to: 505, level: 20 },
  { from: 506, to: 507, level: 16 }, { from: 507, to: 508, level: 32 },
  { from: 509, to: 510, level: 20 },
  { from: 519, to: 520, level: 21 }, { from: 520, to: 521, level: 32 },
  { from: 522, to: 523, level: 27 },
  { from: 524, to: 525, level: 25 }, { from: 525, to: 526, level: 40 },
  { from: 529, to: 530, level: 31 },
  { from: 532, to: 533, level: 25 }, { from: 533, to: 534, level: 40 },
  { from: 535, to: 536, level: 25 }, { from: 536, to: 537, level: 36 },
  { from: 543, to: 544, level: 22 }, { from: 544, to: 545, level: 30 },
  { from: 551, to: 552, level: 29 }, { from: 552, to: 553, level: 40 },
  { from: 554, to: 555, level: 35 },
  { from: 559, to: 560, level: 39 },
  { from: 570, to: 571, level: 30 },
  { from: 574, to: 575, level: 32 }, { from: 575, to: 576, level: 41 },
  { from: 577, to: 578, level: 32 }, { from: 578, to: 579, level: 41 },
  { from: 590, to: 591, level: 39 },
  { from: 595, to: 596, level: 36 },
  { from: 599, to: 600, level: 38 }, { from: 600, to: 601, level: 49 },
  { from: 607, to: 608, level: 41 }, { from: 608, to: 609, level: 51 },
  { from: 610, to: 611, level: 38 }, { from: 611, to: 612, level: 48 },
  { from: 613, to: 614, level: 37 },
  { from: 619, to: 620, level: 50 },
  { from: 624, to: 625, level: 52 }, { from: 625, to: 983, level: 64 }, // Pawniard -> Bisharp -> Kingambit
  { from: 633, to: 634, level: 50 }, { from: 634, to: 635, level: 64 },
  { from: 636, to: 637, level: 59 },
  // Gen 6
  { from: 650, to: 651, level: 16 }, { from: 651, to: 652, level: 36 },
  { from: 653, to: 654, level: 16 }, { from: 654, to: 655, level: 36 },
  { from: 656, to: 657, level: 16 }, { from: 657, to: 658, level: 36 },
  { from: 661, to: 662, level: 17 }, { from: 662, to: 663, level: 35 },
  { from: 667, to: 668, level: 35 },
  { from: 672, to: 673, level: 32 },
  { from: 674, to: 675, level: 32 },
  { from: 677, to: 678, level: 25 },
  { from: 679, to: 680, level: 35 },
  { from: 682, to: 683, level: 39 },
  { from: 684, to: 685, level: 39 },
  { from: 686, to: 687, level: 30 },
  { from: 688, to: 689, level: 37 },
  { from: 690, to: 691, level: 48 },
  { from: 692, to: 693, level: 37 },
  { from: 694, to: 695, level: 39 },
  { from: 696, to: 697, level: 38 },
  { from: 698, to: 699, level: 39 },
  { from: 704, to: 705, level: 40 }, { from: 705, to: 706, level: 50 },
  { from: 708, to: 709, level: 37 },
  { from: 712, to: 713, level: 37 },
  // Gen 7
  { from: 722, to: 723, level: 17 }, { from: 723, to: 724, level: 34 },
  { from: 725, to: 726, level: 17 }, { from: 726, to: 727, level: 34 },
  { from: 728, to: 729, level: 17 }, { from: 729, to: 730, level: 34 },
  { from: 731, to: 732, level: 14 }, { from: 732, to: 733, level: 28 },
  { from: 734, to: 735, level: 20 },
  { from: 736, to: 737, level: 20 }, { from: 737, to: 738, level: 30 },
  { from: 742, to: 743, level: 25 },
  { from: 744, to: 745, toOptions: [745, 10152, 10155], level: 25 }, // Rockruff → Lycanroc Midday/Midnight/Dusk
  { from: 747, to: 748, level: 38 },
  { from: 749, to: 750, level: 30 },
  { from: 751, to: 752, level: 22 },
  { from: 753, to: 754, level: 34 },
  { from: 755, to: 756, level: 24 },
  { from: 757, to: 758, level: 33 },
  { from: 759, to: 760, level: 27 },
  { from: 761, to: 762, level: 18 }, { from: 762, to: 763, level: 29 },
  { from: 769, to: 770, level: 42 }, // Sandygast → Palossand
  { from: 782, to: 783, level: 35 }, { from: 783, to: 784, level: 45 },
  { from: 789, to: 790, level: 30 }, // Cosmog → Cosmoem
  { from: 790, to: 791, toOptions: [791, 792], level: 50 }, // Cosmoem → Solgaleo/Lunala (sorteio)
  { from: 891, to: 892, level: 40 }, // Kubfu → Urshifu
  // Gen 8
  { from: 810, to: 811, level: 16 }, { from: 811, to: 812, level: 35 },
  { from: 813, to: 814, level: 16 }, { from: 814, to: 815, level: 35 },
  { from: 816, to: 817, level: 16 }, { from: 817, to: 818, level: 35 },
  { from: 819, to: 820, level: 24 },
  { from: 821, to: 822, level: 18 }, { from: 822, to: 823, level: 38 },
  { from: 824, to: 825, level: 10 }, { from: 825, to: 826, level: 30 },
  { from: 827, to: 828, level: 18 },
  { from: 829, to: 830, level: 20 },
  { from: 833, to: 834, level: 22 },
  { from: 835, to: 836, level: 25 },
  { from: 837, to: 838, level: 18 }, { from: 838, to: 839, level: 34 },
  { from: 843, to: 844, level: 36 },
  { from: 846, to: 847, level: 26 },
  { from: 848, to: 849, toOptions: [849, 10184], level: 30 }, // Toxel → Toxtricity Amped/Low Key
  { from: 850, to: 851, level: 28 },
  { from: 852, to: 853, level: 35 },
  { from: 856, to: 857, level: 29 }, { from: 857, to: 858, level: 42 },
  { from: 859, to: 860, level: 32 }, { from: 860, to: 861, level: 42 },
  { from: 872, to: 873, level: 30 },
  { from: 878, to: 879, level: 34 },
  { from: 885, to: 886, level: 30 }, { from: 886, to: 887, level: 50 },
  // Evoluções por pedra/item/troca — simplificadas por nível para o sistema do jogo
  // Usadas para mostrar cadeia evolutiva E para filtrar pools de ovos (EVOLVED_IDS)
  { from: 82,  to: 462, level: 40 }, // Magneton → Magnezone (local especial)
  { from: 95,  to: 208, level: 36 }, // Onix → Steelix (Metal Coat)
  { from: 108, to: 463, level: 40 }, // Lickitung → Lickilicky (Rollout + level)
  { from: 112, to: 464, level: 45 }, // Rhydon → Rhyperior (Protector)
  { from: 114, to: 465, level: 34 }, // Tangela → Tangrowth (Ancient Power)
  { from: 117, to: 230, level: 38 }, // Seadra → Kingdra (Dragon Scale)
  { from: 123, to: 212, level: 38 }, // Scyther → Scizor (Metal Coat)
  { from: 125, to: 466, level: 45 }, // Electabuzz → Electivire (Electirizer)
  { from: 126, to: 467, level: 45 }, // Magmar → Magmortar (Magmarizer)
  { from: 137, to: 233, level: 28 }, // Porygon → Porygon2 (Up-Grade)
  { from: 176, to: 468, level: 30 }, // Togetic → Togekiss (Shiny Stone)
  { from: 190, to: 424, level: 32 }, // Aipom → Ambipom (Double Hit)
  { from: 193, to: 469, level: 33 }, // Yanma → Yanmega (Ancient Power)
  { from: 198, to: 430, level: 38 }, // Murkrow → Honchkrow (Dusk Stone)
  { from: 200, to: 429, level: 32 }, // Misdreavus → Mismagius (Dusk Stone)
  { from: 207, to: 472, level: 35 }, // Gligar → Gliscor (Razor Fang)
  { from: 215, to: 461, level: 35 }, // Sneasel → Weavile (Razor Claw)
  { from: 221, to: 473, level: 40 }, // Piloswine → Mamoswine (Ancient Power)
  { from: 233, to: 474, level: 40 }, // Porygon2 → Porygon-Z (Dubious Disc)
  { from: 299, to: 476, level: 30 }, // Nosepass → Probopass (local especial)
  { from: 356, to: 477, level: 45 }, // Dusclops → Dusknoir (Reaper Cloth)
  // Gen 5 — troca
  { from: 525, to: 526, level: 36 }, // Boldore → Gigalith (troca)
  { from: 533, to: 534, level: 40 }, // Gurdurr → Conkeldurr (troca)
  // Gen 6 — pedra/item
  { from: 680, to: 681, level: 40 }, // Doublade → Aegislash (Dawn Stone)
  { from: 714, to: 715, level: 48 }, // Noibat → Noivern (level)
  { from: 840, to: 841, toOptions: [841, 842, 1011], level: 30 }, // Applin → Flapple/Appletun/Dipplin
  // Gen 7 — item
  { from: 868, to: 869, level: 30 }, // Milcery → Alcremie (Sweet item)
  // Gen 9
  { from: 906, to: 907, level: 16 }, { from: 907, to: 908, level: 36 },
  { from: 909, to: 910, level: 16 }, { from: 910, to: 911, level: 36 },
  { from: 912, to: 913, level: 16 }, { from: 913, to: 914, level: 36 },
  { from: 915, to: 916, level: 18 },
  { from: 917, to: 918, level: 15 }, // Tarountula → Spidops
  { from: 919, to: 920, level: 30 },
  { from: 921, to: 922, level: 18 }, { from: 922, to: 923, level: 32 },
  { from: 924, to: 925, level: 25 },
  { from: 926, to: 927, level: 26 },
  { from: 928, to: 929, level: 25 }, { from: 929, to: 930, level: 35 },
  { from: 932, to: 933, level: 24 }, { from: 933, to: 934, level: 38 },
  { from: 935, to: 936, toOptions: [936, 937], level: 30 },
  { from: 938, to: 939, level: 30 },
  { from: 940, to: 941, level: 25 },
  { from: 942, to: 943, level: 30 },
  { from: 944, to: 945, level: 30 },
  { from: 946, to: 947, level: 30 },
  { from: 948, to: 949, level: 30 },
  { from: 951, to: 952, level: 26 },
  { from: 953, to: 954, level: 29 },
  { from: 955, to: 956, level: 30 },
  { from: 957, to: 958, level: 30 }, { from: 958, to: 959, level: 38 },
  { from: 960, to: 961, level: 30 },
  { from: 963, to: 964, level: 38 }, // Finizen → Palafin
  { from: 965, to: 966, level: 40 },
  { from: 969, to: 970, level: 35 },
  { from: 971, to: 972, level: 30 },
  { from: 974, to: 975, level: 30 },
  { from: 996, to: 997, level: 35 }, { from: 997, to: 998, level: 54 },
  { from: 999, to: 1000, level: 45 }, // Gimmighoul (Chest) → Gholdengo
  { from: 1011, to: 1019, level: 45 }, // Dipplin → Hydrapple
  { from: 1012, to: 1013, toOptions: [1013, 10013], level: 30 }, // Poltchageist → Sinistcha Unremarkable/Masterpiece
  // Linhas complementares auditadas contra a PokéAPI. Métodos especiais foram
  // simplificados para nível para manter consistência com o sistema de mascotes.
  { from: 42, to: 169, level: 35 }, // Golbat -> Crobat
  { from: 113, to: 242, level: 45 }, // Chansey -> Blissey
  { from: 123, to: 212, toOptions: [212, 900], level: 38 }, // Scyther -> Scizor/Kleavor
  { from: 177, to: 178, level: 25 }, // Natu -> Xatu
  { from: 179, to: 180, level: 15 }, { from: 180, to: 181, level: 30 }, // Mareep line
  { from: 236, to: 106, toOptions: [106, 107, 237], level: 30 }, // Tyrogue -> Hitmons
  { from: 298, to: 183, level: 18 }, // Azurill -> Marill
  { from: 360, to: 202, level: 18 }, // Wynaut -> Wobbuffet
  { from: 203, to: 981, level: 40 }, // Girafarig -> Farigiraf
  { from: 206, to: 982, level: 40 }, // Dunsparce -> Dudunsparce
  { from: 234, to: 899, level: 40 }, // Stantler -> Wyrdeer
  { from: 283, to: 284, level: 22 }, // Surskit -> Masquerain
  { from: 290, to: 291, toOptions: [291, 292], level: 20 }, // Nincada -> Ninjask/Shedinja
  { from: 366, to: 367, toOptions: [367, 368], level: 30 }, // Clamperl -> Huntail/Gorebyss
  { from: 401, to: 402, level: 20 }, // Kricketot -> Kricketune
  { from: 412, to: 413, toOptions: [413, 414], level: 20 }, // Burmy -> Wormadam/Mothim
  { from: 415, to: 416, level: 21 }, // Combee -> Vespiquen
  { from: 422, to: 423, level: 30 }, // Shellos -> Gastrodon
  { from: 511, to: 512, level: 30 }, // Pansage -> Simisage
  { from: 513, to: 514, level: 30 }, // Pansear -> Simisear
  { from: 515, to: 516, level: 30 }, // Panpour -> Simipour
  { from: 517, to: 518, level: 30 }, // Munna -> Musharna
  { from: 527, to: 528, level: 25 }, // Woobat -> Swoobat
  { from: 540, to: 541, level: 20 }, { from: 541, to: 542, level: 32 }, // Sewaddle line
  { from: 546, to: 547, level: 30 }, // Cottonee -> Whimsicott
  { from: 548, to: 549, level: 30 }, // Petilil -> Lilligant
  { from: 557, to: 558, level: 34 }, // Dwebble -> Crustle
  { from: 562, to: 563, level: 34 }, // Yamask -> Cofagrigus
  { from: 564, to: 565, level: 37 }, // Tirtouga -> Carracosta
  { from: 566, to: 567, level: 37 }, // Archen -> Archeops
  { from: 568, to: 569, level: 36 }, // Trubbish -> Garbodor
  { from: 572, to: 573, level: 30 }, // Minccino -> Cinccino
  { from: 580, to: 581, level: 35 }, // Ducklett -> Swanna
  { from: 582, to: 583, level: 35 }, { from: 583, to: 584, level: 47 }, // Vanillite line
  { from: 585, to: 586, level: 34 }, // Deerling -> Sawsbuck
  { from: 588, to: 589, level: 35 }, // Karrablast -> Escavalier
  { from: 592, to: 593, level: 40 }, // Frillish -> Jellicent
  { from: 597, to: 598, level: 40 }, // Ferroseed -> Ferrothorn
  { from: 602, to: 603, level: 39 }, { from: 603, to: 604, level: 50 }, // Tynamo line
  { from: 605, to: 606, level: 42 }, // Elgyem -> Beheeyem
  { from: 616, to: 617, level: 35 }, // Shelmet -> Accelgor
  { from: 622, to: 623, level: 43 }, // Golett -> Golurk
  { from: 627, to: 628, level: 45 }, // Rufflet -> Braviary
  { from: 629, to: 630, level: 45 }, // Vullaby -> Mandibuzz
  { from: 659, to: 660, level: 20 }, // Bunnelby -> Diggersby
  { from: 664, to: 665, level: 9 }, { from: 665, to: 666, level: 12 }, // Scatterbug line
  { from: 669, to: 670, level: 19 }, { from: 670, to: 671, level: 35 }, // Flabebe line
  { from: 710, to: 711, level: 32 }, // Pumpkaboo -> Gourgeist
  { from: 739, to: 740, level: 35 }, // Crabrawler -> Crabominable
  { from: 767, to: 768, level: 30 }, // Wimpod -> Golisopod
  { from: 803, to: 804, level: 40 }, // Poipole -> Naganadel
  { from: 772, to: 773, level: 40 }, // Type: Null -> Silvally
  { from: 831, to: 832, level: 24 }, // Wooloo -> Dubwool
  { from: 854, to: 855, level: 30 }, // Sinistea -> Polteageist
  { from: 884, to: 1018, level: 45 }, // Duraludon -> Archaludon
  // ── Formas Alolan ─────────────────────────────────────────────────────────────
  { from: 10091, to: 10092, level: 20 }, // Rattata-Alola → Raticate-Alola
  { from: 10101, to: 10102, level: 22 }, // Sandshrew-Alola → Sandslash-Alola (Ice Stone)
  { from: 10103, to: 10104, level: 36 }, // Vulpix-Alola → Ninetales-Alola (Ice Stone)
  { from: 10105, to: 10106, level: 26 }, // Diglett-Alola → Dugtrio-Alola
  { from: 10107, to: 10108, level: 28 }, // Meowth-Alola → Persian-Alola (amizade)
  { from: 10109, to: 10110, level: 25 }, // Geodude-Alola → Graveler-Alola
  { from: 10110, to: 10111, level: 36 }, // Graveler-Alola → Golem-Alola (troca)
  { from: 10112, to: 10113, level: 38 }, // Grimer-Alola → Muk-Alola
  // ── Formas Galar ─────────────────────────────────────────────────────────────
  { from: 10158, to: 863,   level: 28 }, // Meowth-Galar → Perrserker
  { from: 10159, to: 10160, level: 40 }, // Ponyta-Galar → Rapidash-Galar
  { from: 10161, to: 10162, level: 37 }, // Slowpoke-Galar → Slowbro-Galar
  { from: 10163, to: 865,   level: 30 }, // Farfetch'd-Galar → Sirfetch'd
  { from: 10165, to: 866,   level: 42 }, // Mr. Mime-Galar → Mr. Rime
  { from: 10170, to: 864,   level: 38 }, // Corsola-Galar → Cursola
  { from: 10171, to: 10172, level: 20 }, // Zigzagoon-Galar → Linoone-Galar
  { from: 10172, to: 862,   level: 35 }, // Linoone-Galar → Obstagoon
  { from: 10173, to: 10174, level: 38 }, // Darumaka-Galar → Darmanitan-Galar (Ice Stone)
  { from: 10175, to: 867,   level: 34 }, // Yamask-Galar → Runerigus
  // ── Formas Hisui ─────────────────────────────────────────────────────────────
  { from: 10229, to: 10230, level: 38 }, // Growlithe-Hisui → Arcanine-Hisui (Fire Stone)
  { from: 10231, to: 10232, level: 30 }, // Voltorb-Hisui → Electrode-Hisui (Leaf Stone)
  { from: 10234, to: 904,   level: 40 }, // Qwilfish-Hisui → Overqwil (Barb Barrage)
  { from: 10235, to: 903,   level: 40 }, // Sneasel-Hisui → Sneasler (Razor Claw)
  { from: 10238, to: 10239, level: 30 }, // Zorua-Hisui -> Zoroark-Hisui
  { from: 808, to: 809, level: 50 }, // Meltan -> Melmetal
];

// Mapa de acesso rápido: pokemonId → evolução
export const EVOLUTION_MAP = new Map<number, Evolution>(
  EVOLUTIONS.map(e => [e.from, e])
);

export const EVOLUTION_REVERSE_MAP = new Map<number, Evolution[]>();
for (const evolution of EVOLUTIONS) {
  const targets = evolution.toOptions?.length ? evolution.toOptions : [evolution.to];
  for (const target of targets) {
    const list = EVOLUTION_REVERSE_MAP.get(target) ?? [];
    list.push(evolution);
    EVOLUTION_REVERSE_MAP.set(target, list);
  }
}

// IDs de formas evoluídas via level-up (mapeadas em EVOLUTIONS)
export const EVOLVED_IDS = new Set(
  EVOLUTIONS.flatMap(e => e.toOptions?.length ? e.toOptions : [e.to])
);

// Formas evoluídas por pedra/troca/amizade/regional NÃO mapeadas em EVOLUTIONS
// Nunca devem aparecer em ovos, mas não têm level-up no sistema do jogo
const EXTRA_EVOLVED: ReadonlySet<number> = new Set<number>([
  // Eevee evoluções não mapeadas (pedra/amizade)
  135, 136, 196, 197, 470, 471, 700,
  // Tyrogue → Hitmons (depende de stats, não mapeável simples)
  106, 107, 237,
  // Gen 1-2 troca não mapeada
  186,  // Politoed (Poliwhirl + troca — Poliwrath já mapeado)
  199,  // Slowking (Slowpoke + troca — Slowbro já mapeado)
  242,  // Blissey (Chansey amizade — Chansey é form. evoluída de Happiny)
  // Gen 8 Galar — evoluções regionais/item sem base própria
  862,  // Obstagoon (Linoone-Galar + level)
  863,  // Perrserker (Meowth-Galar + level)
  864,  // Cursola (Corsola-Galar + level)
  865,  // Sirfetch'd (Farfetch'd-Galar + moveset)
  866,  // Mr. Rime (Mr. Mime-Galar + level)
  867,  // Runerigus (Yamask-Galar + local)
  // Evoluções regionais/especiais mantidas fora dos ovos sem forçar a linha base
  902,  // Basculegion (Basculin-White-Striped)
  980,  // Clodsire (Wooper-Paldea)
  // Phione não evolui para Manaphy nos jogos principais, apesar da cadeia da PokéAPI
  490,
  // Linhas lendarias/miticas com pre-evolucao propria; ovos devem usar a forma inicial.
  790,  // Cosmoem (Cosmog -> Cosmoem)
  791,  // Solgaleo (Cosmoem -> Solgaleo)
  // Ramificações não mapeadas via `to` (apenas em `toOptions`)
  792,  // Lunala (Cosmoem → toOptions, `to` é Solgaleo 791)
  804,  // Naganadel (Poipole -> Naganadel)
  892,  // Urshifu (Kubfu -> Urshifu)
  10152, // Lycanroc-Midnight (Rockruff → toOptions, `to` é Lycanroc-Midday 745)
  10155, // Lycanroc-Dusk (Rockruff → toOptions)
  // Gen 9 — evoluções não mapeadas
  10013, // Sinistcha Masterpiece (Poltchageist → toOptions)
  10184, // Toxtricity Low Key (Toxel → toOptions)
  // Formas Alolan — finais sem base própria ou pré-evolução externa
  10100, // Raichu-Alola (evolui de Pikachu, não de Raichu base)
  10114, // Exeggutor-Alola (evolui de Exeggcute com Leaf Stone)
  10115, // Marowak-Alola (evolui de Cubone, nível 28)
  // Formas Galar — finais sem cadeia interna no sistema
  10160, // Rapidash-Galar (evolui de Ponyta-Galar → já mapeado)
  10162, // Slowbro-Galar (evolui de Slowpoke-Galar → já mapeado)
  10169, // Slowking-Galar (evolui de Slowpoke-Galar, via item — sem mapeamento split)
  10174, // Darmanitan-Galar (evolui de Darumaka-Galar → já mapeado)
  // Formas Hisui — finais
  10230, // Arcanine-Hisui → já mapeado via 10229
  10232, // Electrode-Hisui → já mapeado via 10231
  10233, // Typhlosion-Hisui (evolui de Quilava, forma especial)
  10236, // Samurott-Hisui (evolui de Dewott, forma especial)
  10237, // Lilligant-Hisui (evolui de Petilil com Sun Stone)
  10239, // Zoroark-Hisui → já mapeado via 10238
  10240, // Braviary-Hisui (evolui de Rufflet, forma especial)
  10241, // Sliggoo-Hisui (evolui de Goomy)
  10242, // Goodra-Hisui (evolui de Sliggoo-Hisui)
  10243, // Avalugg-Hisui (evolui de Bergmite)
  10244, // Decidueye-Hisui (evolui de Dartrix, forma especial)
]);

// Conjunto unificado: tudo que não deve aparecer em ovos
export const ALL_EVOLVED_IDS = new Set<number>([...EVOLVED_IDS, ...EXTRA_EVOLVED]);

// ── Evoluções por pedra — simplificadas como nível ───────────────────────────
// No jogo original usam pedras (Fire Stone, Water Stone, etc.) mas aqui são
// mapeadas para um nível específico para simplificar o sistema.
// Exemplos notáveis:
//   Growlithe (58) → Arcanine (59): Fire Stone → tratado como Nv.36
//   Vulpix (37) → Ninetales (38): Fire Stone → tratado como Nv.36
//   Eevee (133) → Vaporeon (134): Water Stone → tratado como Nv.30
//     (as outras 7 evoluções do Eevee ainda não estão mapeadas)
//
// ── Eevee: evolução atual ────────────────────────────────────────────────────
// Neste sistema, Eevee evolui para Vaporeon no Nv.30 (simplificação).
// As outras evoluções (Jolteon 135, Flareon 136, Espeon 196, Umbreon 197,
// Leafeon 470, Glaceon 471, Sylveon 700) não estão mapeadas —
// por isso Espeon e Umbreon eram obtidos DIRETAMENTE dos pools (bug).
// Correção: foram removidos dos pools pelo filtro acima.
// Futuramente podem ser adicionados via sistema de pedras/itens.

// ── EXP necessária por nível ──────────────────────────────────────────────────
// Curva linear suave: jogável mesmo nos níveis altos.
// Nível 1→2: 120 EXP | Nível 50→51: 1.100 EXP | Nível 100→101: 2.100 EXP
export const PSEUDO_LEGENDARY_LINE_IDS = new Set([
  147, 148, 149,
  246, 247, 248,
  371, 372, 373,
  374, 375, 376,
  443, 444, 445,
  633, 634, 635,
  704, 705, 706,
  10241, 10242,
  782, 783, 784,
  885, 886, 887,
  996, 997, 998,
]);

// Paradox Pokémon de Gen 9 (Scarlet/Violet) — não são lendários, mas têm crescimento acelerado
export const PARADOX_IDS = new Set([
  // Paradoxos do passado (Ancient)
  984,  // Great Tusk
  985,  // Scream Tail
  986,  // Brute Bonnet
  987,  // Flutter Mane
  988,  // Slither Wing
  989,  // Sandy Shocks
  1005, // Roaring Moon
  // Paradoxos do futuro (Iron)
  990,  // Iron Treads
  991,  // Iron Bundle
  992,  // Iron Hands
  993,  // Iron Jugulis
  994,  // Iron Moth
  995,  // Iron Thorns
  1006, // Iron Valiant
  // DLC Indigo Disk — também são Paradoxos de Raid, não Lendários
  1009, // Walking Wake (Paradox Suicune)
  1010, // Iron Leaves (Paradox Virizion)
  1020, // Gouging Fire (Paradox Entei)
  1021, // Raging Bolt (Paradox Raikou)
  1022, // Iron Boulder (Paradox Terrakion)
  1023, // Iron Crown (Paradox Cobalion)
]);

export function getMascotStatusGrowthMultiplier(pokemonId?: number | null): number {
  if (!pokemonId) return 1;
  if (LEGENDARY_POOL.includes(pokemonId)) return 1.3;
  if (PSEUDO_LEGENDARY_LINE_IDS.has(pokemonId)) return 1.1;
  if (PARADOX_IDS.has(pokemonId)) return 1.1;
  return 1;
}

export type MascotProgressMilestoneRule = {
  key: string;
  label: string;
  level: number;
  points: number;
  kind: "EVOLUTION" | "MATURITY";
};

export const MASCOT_PROGRESS_MILESTONE_TABLE = [
  { line: "Sem evolucao", trigger: "Nv.16", bonus: "+3 atributos", notes: "Primeiro marco de maturidade." },
  { line: "Sem evolucao", trigger: "Nv.32", bonus: "+3 atributos", notes: "Segundo marco de maturidade." },
  { line: "Sem evolucao", trigger: "Nv.50", bonus: "+3 atributos", notes: "Maturidade plena." },
  { line: "Linha com 1 evolucao", trigger: "Ao evoluir", bonus: "+4 atributos", notes: "Momento de evolucao mais forte." },
  { line: "Linha com 1 evolucao", trigger: "Nv.50", bonus: "+3 atributos", notes: "Compensacao de maturidade final." },
  { line: "Linha com 2 evolucoes", trigger: "Cada evolucao", bonus: "+3 atributos", notes: "Dois momentos de evolucao." },
  { line: "Lendario/Mitico", trigger: "Sempre", bonus: "Crescimento x1.3", notes: "Nao acumula marcos de maturidade." },
] as const;

function getEvolutionDepth(pokemonId: number): number {
  let current = pokemonId;
  let depth = 0;
  const seen = new Set<number>();
  while (!seen.has(current)) {
    seen.add(current);
    const previous = EVOLUTION_REVERSE_MAP.get(current)?.[0];
    if (!previous) break;
    depth++;
    current = previous.from;
  }
  return depth;
}

function getEvolutionRemaining(pokemonId: number): number {
  let current = pokemonId;
  let remaining = 0;
  const seen = new Set<number>();
  while (!seen.has(current)) {
    seen.add(current);
    const next = EVOLUTION_MAP.get(current);
    if (!next) break;
    remaining++;
    current = next.toOptions?.[0] ?? next.to;
  }
  return remaining;
}

export function getEvolutionLineStageCount(pokemonId: number): number {
  return 1 + getEvolutionDepth(pokemonId) + getEvolutionRemaining(pokemonId);
}

export function getMascotProgressMilestones(
  pokemonId: number,
  level: number,
  evolvedThisGain = false,
): MascotProgressMilestoneRule[] {
  if (LEGENDARY_POOL.includes(pokemonId)) return [];

  const depth = getEvolutionDepth(pokemonId);
  const remaining = getEvolutionRemaining(pokemonId);
  const stageCount = 1 + depth + remaining;
  const rules: MascotProgressMilestoneRule[] = [];

  if (stageCount <= 1) {
    for (const milestoneLevel of [16, 32, 50]) {
      if (level >= milestoneLevel) {
        rules.push({
          key: `maturity:${milestoneLevel}`,
          label: `Maturidade Nv.${milestoneLevel}`,
          level: milestoneLevel,
          points: 3,
          kind: "MATURITY",
        });
      }
    }
    return rules;
  }

  if (depth > 0) {
    for (let stage = 1; stage <= depth; stage++) {
      rules.push({
        key: `evolution:${stage}`,
        label: stageCount === 2 ? "Evolucao marcante" : `Evolucao ${stage}`,
        level,
        points: stageCount === 2 ? 4 : 3,
        kind: "EVOLUTION",
      });
    }
  } else if (evolvedThisGain) {
    rules.push({
      key: "evolution:1",
      label: stageCount === 2 ? "Evolucao marcante" : "Evolucao 1",
      level,
      points: stageCount === 2 ? 4 : 3,
      kind: "EVOLUTION",
    });
  }

  if (stageCount === 2 && level >= 50) {
    rules.push({
      key: "maturity:50",
      label: "Maturidade Nv.50",
      level: 50,
      points: 3,
      kind: "MATURITY",
    });
  }

  return rules;
}

export function expForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 + (level - 1) * 20;
}

// EXP total acumulada até o nível N
export function totalExpForLevel(level: number): number {
  let total = 0;
  for (let l = 2; l <= level; l++) total += expForLevel(l);
  return total;
}

// EXP necessária para ir do nível atual para o próximo
export function expToNextLevel(currentLevel: number): number {
  return expForLevel(currentLevel + 1);
}

// ── Status derivados (calculados a partir dos dados, sem campo extra no BD) ───

export type HungerStatus = "STARVING" | "HUNGRY" | "NEUTRAL" | "SATISFIED" | "STUFFED";
export type HappinessStatus = "DEPRESSED" | "SAD" | "NEUTRAL" | "CONTENT" | "HAPPY";
export type ChallengeStatus = "ANGRY" | "CALM" | "EAGER" | "CHALLENGER";

export function getHungerStatus(lastFedAt: Date | null, isEquipped = true): HungerStatus {
  const hours = lastFedAt ? (Date.now() - new Date(lastFedAt).getTime()) / 3_600_000 : 999;
  // Mascotes no banco perdem fome 5x mais lentamente
  const m = isEquipped ? 1 : 5;
  if (hours < 2 * m)  return "STUFFED";
  if (hours < 6 * m)  return "SATISFIED";
  if (hours < 12 * m) return "NEUTRAL";
  if (hours < 24 * m) return "HUNGRY";
  return "STARVING";
}

export function getHappinessStatus(happiness: number): HappinessStatus {
  if (happiness >= 80) return "HAPPY";
  if (happiness >= 60) return "CONTENT";
  if (happiness >= 40) return "NEUTRAL";
  if (happiness >= 20) return "SAD";
  return "DEPRESSED";
}

export function getChallengeStatus(mood: string): ChallengeStatus {
  if (mood === "CONFIDENT" || mood === "COMPETITIVE") return "CHALLENGER";
  if (mood === "EXCITED" || mood === "PROUD")         return "EAGER";
  if (mood === "ANGRY")                               return "ANGRY";
  return "CALM";
}

export const HUNGER_LABEL: Record<HungerStatus,  string> = {
  STARVING:  "Faminto",  HUNGRY: "Com fome",   NEUTRAL: "Normal",
  SATISFIED: "Satisfeito", STUFFED: "Empanturrado",
};
export const HAPPINESS_LABEL: Record<HappinessStatus, string> = {
  DEPRESSED: "Depressivo", SAD: "Triste", NEUTRAL: "Neutro",
  CONTENT: "Contente", HAPPY: "Feliz",
};
export const CHALLENGE_LABEL: Record<ChallengeStatus, string> = {
  ANGRY: "Irritado", CALM: "Tranquilo", EAGER: "Animado", CHALLENGER: "Desafiante",
};
export const HUNGER_COLOR:    Record<HungerStatus,    string> = {
  STARVING: "text-red-400",    HUNGRY: "text-orange-400", NEUTRAL: "text-slate-400",
  SATISFIED: "text-green-400", STUFFED: "text-blue-400",
};
export const HAPPINESS_COLOR: Record<HappinessStatus, string> = {
  DEPRESSED: "text-red-400", SAD: "text-orange-400",    NEUTRAL: "text-slate-400",
  CONTENT:   "text-green-300", HAPPY: "text-[#FFCB05]",
};
export const CHALLENGE_COLOR: Record<ChallengeStatus, string> = {
  ANGRY: "text-red-400", CALM: "text-slate-400", EAGER: "text-blue-400", CHALLENGER: "text-[#FFCB05]",
};

// ── Personalidades ────────────────────────────────────────────────────────────

export const PERSONALITIES = [
  "LOYAL","PROUD","MISCHIEVOUS","LAZY","COMPETITIVE",
  "DRAMATIC","PLAYFUL","ELECTRIC","TIMID","CHAOTIC"
] as const;

export const PERSONALITY_LABEL: Record<string, string> = {
  LOYAL:        "Leal",
  PROUD:        "Orgulhoso",
  MISCHIEVOUS:  "Travesso",
  LAZY:         "Preguiçoso",
  COMPETITIVE:  "Competitivo",
  DRAMATIC:     "Dramático",
  PLAYFUL:      "Brincalhão",
  ELECTRIC:     "Elétrico",
  TIMID:        "Tímido",
  CHAOTIC:      "Caótico",
};

export const MOOD_LABEL: Record<string, string> = {
  HAPPY:        "Feliz",
  EXCITED:      "Animado",
  NEUTRAL:      "Neutro",
  TIRED:        "Cansado",
  NEEDY:        "Carente",
  COMPETITIVE:  "Competitivo",
  ANGRY:        "Bravo",
  PROUD:        "Orgulhoso",
  HUNGRY:       "Faminto",
  CONFIDENT:    "Confiante",
};

export const MOOD_EMOJI: Record<string, string> = {
  HAPPY:       "😊",
  EXCITED:     "🤩",
  NEUTRAL:     "😐",
  TIRED:       "😴",
  NEEDY:       "🥺",
  COMPETITIVE: "😤",
  ANGRY:       "😠",
  PROUD:       "😎",
  HUNGRY:      "😋",
  CONFIDENT:   "💪",
};

// ── Duração das expedições (em ms) ───────────────────────────────────────────

export const EXPEDITION_DURATION_MS = 60 * 60 * 1000; // 1 hora (padrão legado)

export const EXPEDITION_DURATIONS = {
  "30min": { ms: 30 * 60 * 1000,           label: "30 minutos", expMultiplier: 0.5,  rewardBonus: 0 },
  "1h":    { ms: 60 * 60 * 1000,           label: "1 hora",     expMultiplier: 1.2,  rewardBonus: 5 },
  "3h":    { ms: 3 * 60 * 60 * 1000,       label: "3 horas",    expMultiplier: 3.2,  rewardBonus: 15 },
  "6h":    { ms: 6 * 60 * 60 * 1000,       label: "6 horas",    expMultiplier: 7.0,  rewardBonus: 30 },
  "7d":    { ms: 7 * 24 * 60 * 60 * 1000,  label: "7 dias (Férias)", expMultiplier: 0, rewardBonus: 0 },
} as const;
export type ExpeditionDuration = keyof typeof EXPEDITION_DURATIONS;

// Expedição de treinamento (foco em EXP — sem itens/coins)
// Multiplicadores de EXP muito maiores que o padrão
export const TRAINING_EXP_MULT: Record<ExpeditionDuration, number> = {
  "30min": 4,   // 4× EXP base
  "1h":    8,   // 8×
  "3h":    20,  // 20×
  "6h":    40,  // 40×
  "7d":    0,   // férias: EXP calculado separadamente em claimVacation
};

export type ExpeditionMode = "STANDARD" | "TRAINING" | "ITEMS" | "VACATION";

// ── Incubadora (em ms) ────────────────────────────────────────────────────────

export const INCUBATION_DURATION_MS = 10 * 60 * 1000; // 10 minutos

// ── EXP ganho por atividade ───────────────────────────────────────────────────

export const EXP_REWARDS = {
  MATCH_PLAYED:    15,  // era 5
  MATCH_WIN:       35,  // era 10
  WIN_STREAK:      15,  // era 5 — bônus por vitória em sequência
  DECK_SUBMITTED:   5,  // era 3
  PLAY_WITH:       25,  // era 8
  PET:             10,  // era 3
  FEED_FOOD:       15,  // era 5
  FEED_SWEET:      35,  // era 12
  EXPEDITION:      50,  // era 20 — base para expedições padrão
};

// ── Sprite URL ────────────────────────────────────────────────────────────────

// IDs máximos com GIF animado no PokeAPI (Black/White animated — gen 1-5 apenas)
const MAX_ANIMATED_ID = 649;
const SPRITE_ID_OVERRIDES: Record<number, number> = {
  // Galar form IDs in this codebase differ from PokeAPI sprite IDs
  10158: 10161, // Meowth-Galar
  10159: 10162, // Ponyta-Galar
  10160: 10163, // Rapidash-Galar
  10161: 10164, // Slowpoke-Galar
  10162: 10165, // Slowbro-Galar
  10163: 10166, // Farfetch'd-Galar
  10164: 10167, // Weezing-Galar
  10165: 10168, // Mr. Mime-Galar
  10166: 10169, // Articuno-Galar
  10167: 10170, // Zapdos-Galar
  10168: 10171, // Moltres-Galar
  10169: 10172, // Slowking-Galar
  10170: 10173, // Corsola-Galar
  10171: 10174, // Zigzagoon-Galar
  10172: 10175, // Linoone-Galar
  10173: 10176, // Darumaka-Galar
  10174: 10177, // Darmanitan-Galar
  10175: 10179, // Yamask-Galar
  10176: 10180, // Stunfisk-Galar
  10013: 1013,  // Sinistcha Masterpiece → same sprite as Sinistcha
};

// Sprites auto-hospedados em public/sprites (CDN estático do Vercel) — o
// raw.githubusercontent.com sofria rate limit (HTTP 429) e quebrava imagens.
export function getSpriteUrl(pokemonId: number, animated = false): string {
  const spriteId = SPRITE_ID_OVERRIDES[pokemonId] ?? pokemonId;
  // GIFs animados só existem para gen 1-5 (IDs 1-649).
  // Para IDs > 649 (gen 6+), usar sempre o PNG estático para evitar imagens quebradas.
  if (animated && (spriteId <= MAX_ANIMATED_ID || MEGA_FORM_IDS.has(spriteId))) {
    return `/sprites/pokemon/versions/generation-v/black-white/animated/${spriteId}.gif`;
  }
  return `/sprites/pokemon/${spriteId}.png`;
}

// URL do sprite estático (sempre PNG, qualquer geração)
export function getStaticSpriteUrl(pokemonId: number): string {
  const spriteId = SPRITE_ID_OVERRIDES[pokemonId] ?? pokemonId;
  return `/sprites/pokemon/${spriteId}.png`;
}

// Sprites shiny (variante cromática). Os GIFs shiny-animados NÃO são
// auto-hospedados (raros — 1/500 — e pesados: ~57MB): buscamos direto do
// repositório do GitHub. Como shinies são raríssimos, o volume é ínfimo e o
// 429 é improvável; e o card usa o PNG shiny local como fallback no onError.
export function getShinySprite(pokemonId: number, animated = false): string {
  const spriteId = SPRITE_ID_OVERRIDES[pokemonId] ?? pokemonId;
  if (animated && spriteId <= MAX_ANIMATED_ID) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/shiny/${spriteId}.gif`;
  }
  return `/sprites/pokemon/shiny/${spriteId}.png`;
}

// ── Stat ranges por tipo de ovo ───────────────────────────────────────────────
// Ovos mais raros/altos dão stats base melhores
export const EGG_STAT_RANGES: Record<string, [number, number]> = {
  COMMON:       [8, 14],
  EVENT:        [12, 19],
  EGG_GEN1:     [9, 15],
  EGG_GEN2:     [9, 15],
  EGG_GEN3:     [10, 16],
  EGG_GEN4:     [10, 16],
  EGG_GEN5:     [10, 16],
  EGG_GEN6:     [11, 17],
  EGG_GEN7:     [11, 17],
  EGG_GEN8:     [11, 17],
  EGG_GEN9:     [11, 17],
  EGG_GEN6PLUS: [10, 16],
  RARE:         [11, 17],
  SPECIAL:      [13, 20],
  LAB:          [17, 26],  // +30% sobre SPECIAL
};

// Chance de nascer shiny (brilhante) por tipo de ovo
export const EGG_SHINY_CHANCE: Record<string, number> = {
  COMMON:       1 / 500,   // 0.2%
  EVENT:        1 / 300,   // 0.33%
  EGG_GEN1:     1 / 450,
  EGG_GEN2:     1 / 450,
  EGG_GEN3:     1 / 400,
  EGG_GEN4:     1 / 400,
  EGG_GEN5:     1 / 400,
  EGG_GEN6:     1 / 350,
  EGG_GEN7:     1 / 350,
  EGG_GEN8:     1 / 350,
  EGG_GEN9:     1 / 350,
  EGG_GEN6PLUS: 1 / 400,
  RARE:         1 / 300,   // 0.33%
  SPECIAL:      1 / 200,   // 0.5%
};

// Stats buffados = acima do range normal (para comparação no log)
export function isStatBuffed(eggType: string, stat: number): boolean {
  const range = EGG_STAT_RANGES[eggType] ?? EGG_STAT_RANGES.COMMON;
  return stat > range[1]; // acima do máximo normal
}

// ── Nomes PT-BR dos Pokémon Gen 1-2 (IDs 1-251) ──────────────────────────────

export const POKEMON_PT_NAMES: Record<number, string> = {
  // Gen 1
  1:"Bulbasaur",2:"Ivysaur",3:"Venusaur",4:"Charmander",5:"Charmeleon",6:"Charizard",
  7:"Squirtle",8:"Wartortle",9:"Blastoise",10:"Caterpie",11:"Metapod",12:"Butterfree",
  13:"Weedle",14:"Kakuna",15:"Beedrill",16:"Pidgey",17:"Pidgeotto",18:"Pidgeot",
  19:"Rattata",20:"Raticate",21:"Spearow",22:"Fearow",23:"Ekans",24:"Arbok",
  25:"Pikachu",26:"Raichu",27:"Sandshrew",28:"Sandslash",29:"Nidoran♀",30:"Nidorina",
  31:"Nidoqueen",32:"Nidoran♂",33:"Nidorino",34:"Nidoking",35:"Clefairy",36:"Clefable",
  37:"Vulpix",38:"Ninetales",39:"Jigglypuff",40:"Wigglytuff",41:"Zubat",42:"Golbat",
  43:"Oddish",44:"Gloom",45:"Vileplume",46:"Paras",47:"Parasect",48:"Venonat",
  49:"Venomoth",50:"Diglett",51:"Dugtrio",52:"Meowth",53:"Persian",54:"Psyduck",
  55:"Golduck",56:"Mankey",57:"Primeape",58:"Growlithe",59:"Arcanine",60:"Poliwag",
  61:"Poliwhirl",62:"Poliwrath",63:"Abra",64:"Kadabra",65:"Alakazam",66:"Machop",
  67:"Machoke",68:"Machamp",69:"Bellsprout",70:"Weepinbell",71:"Victreebel",
  72:"Tentacool",73:"Tentacruel",74:"Geodude",75:"Graveler",76:"Golem",
  77:"Ponyta",78:"Rapidash",79:"Slowpoke",80:"Slowbro",81:"Magnemite",82:"Magneton",
  83:"Farfetch'd",84:"Doduo",85:"Dodrio",86:"Seel",87:"Dewgong",88:"Grimer",89:"Muk",
  90:"Shellder",91:"Cloyster",92:"Gastly",93:"Haunter",94:"Gengar",95:"Onix",
  96:"Drowzee",97:"Hypno",98:"Krabby",99:"Kingler",100:"Voltorb",101:"Electrode",
  102:"Exeggcute",103:"Exeggutor",104:"Cubone",105:"Marowak",106:"Hitmonlee",
  107:"Hitmonchan",108:"Lickitung",109:"Koffing",110:"Weezing",111:"Rhyhorn",
  112:"Rhydon",113:"Chansey",114:"Tangela",115:"Kangaskhan",116:"Horsea",117:"Seadra",
  118:"Goldeen",119:"Seaking",120:"Staryu",121:"Starmie",122:"Mr. Mime",123:"Scyther",
  124:"Jynx",125:"Electabuzz",126:"Magmar",127:"Pinsir",128:"Tauros",129:"Magikarp",
  130:"Gyarados",131:"Lapras",132:"Ditto",133:"Eevee",134:"Vaporeon",135:"Jolteon",
  136:"Flareon",137:"Porygon",138:"Omanyte",139:"Omastar",140:"Kabuto",141:"Kabutops",
  142:"Aerodactyl",143:"Snorlax",144:"Articuno",145:"Zapdos",146:"Moltres",
  147:"Dratini",148:"Dragonair",149:"Dragonite",150:"Mewtwo",151:"Mew",
  // Gen 2
  152:"Chikorita",153:"Bayleef",154:"Meganium",155:"Cyndaquil",156:"Quilava",
  157:"Typhlosion",158:"Totodile",159:"Croconaw",160:"Feraligatr",161:"Sentret",
  162:"Furret",163:"Hoothoot",164:"Noctowl",165:"Ledyba",166:"Ledian",167:"Spinarak",
  168:"Ariados",169:"Crobat",170:"Chinchou",171:"Lanturn",172:"Pichu",173:"Cleffa",
  174:"Igglybuff",175:"Togepi",176:"Togetic",177:"Natu",178:"Xatu",179:"Mareep",
  180:"Flaaffy",181:"Ampharos",182:"Bellossom",183:"Marill",184:"Azumarill",
  185:"Sudowoodo",186:"Politoed",187:"Hoppip",188:"Skiploom",189:"Jumpluff",
  190:"Aipom",191:"Sunkern",192:"Sunflora",193:"Yanma",194:"Wooper",195:"Quagsire",
  196:"Espeon",197:"Umbreon",198:"Murkrow",199:"Slowking",200:"Misdreavus",
  201:"Unown",202:"Wobbuffet",203:"Girafarig",204:"Pineco",205:"Forretress",
  206:"Dunsparce",207:"Gligar",208:"Steelix",209:"Snubbull",210:"Granbull",
  211:"Qwilfish",212:"Scizor",213:"Shuckle",214:"Heracross",215:"Sneasel",
  216:"Teddiursa",217:"Ursaring",218:"Slugma",219:"Magcargo",220:"Swinub",
  221:"Piloswine",222:"Corsola",223:"Remoraid",224:"Octillery",225:"Delibird",
  226:"Mantine",227:"Skarmory",228:"Houndour",229:"Houndoom",230:"Kingdra",
  231:"Phanpy",232:"Donphan",233:"Porygon2",234:"Stantler",235:"Smeargle",
  236:"Tyrogue",237:"Hitmontop",238:"Smoochum",239:"Elekid",240:"Magby",
  241:"Miltank",242:"Blissey",243:"Raikou",244:"Entei",245:"Suicune",
  246:"Larvitar",247:"Pupitar",248:"Tyranitar",249:"Lugia",250:"Ho-Oh",251:"Celebi",
};

// Gen 3 (Hoenn)
const POKEMON_GEN3_NAMES: Record<number, string> = {
  252:"Treecko",253:"Grovyle",254:"Sceptile",
  255:"Torchic",256:"Combusken",257:"Blaziken",
  258:"Mudkip",259:"Marshtomp",260:"Swampert",
  261:"Poochyena",262:"Mightyena",
  263:"Zigzagoon",264:"Linoone",
  265:"Wurmple",266:"Silcoon",267:"Beautifly",268:"Cascoon",269:"Dustox",
  270:"Lotad",271:"Lombre",272:"Ludicolo",
  273:"Seedot",274:"Nuzleaf",275:"Shiftry",
  276:"Taillow",277:"Swellow",
  278:"Wingull",279:"Pelipper",
  280:"Ralts",281:"Kirlia",282:"Gardevoir",
  283:"Surskit",284:"Masquerain",
  285:"Shroomish",286:"Breloom",
  287:"Slakoth",288:"Vigoroth",289:"Slaking",
  290:"Nincada",291:"Ninjask",292:"Shedinja",
  293:"Whismur",294:"Loudred",295:"Exploud",
  296:"Makuhita",297:"Hariyama",
  298:"Azurill",299:"Nosepass",
  300:"Skitty",301:"Delcatty",
  302:"Sableye",303:"Mawile",
  304:"Aron",305:"Lairon",306:"Aggron",
  307:"Meditite",308:"Medicham",
  309:"Electrike",310:"Manectric",
  311:"Plusle",312:"Minun",
  313:"Volbeat",314:"Illumise",
  315:"Roselia",316:"Gulpin",317:"Swalot",
  318:"Carvanha",319:"Sharpedo",
  320:"Wailmer",321:"Wailord",
  322:"Numel",323:"Camerupt",324:"Torkoal",
  325:"Spoink",326:"Grumpig",
  327:"Spinda",
  328:"Trapinch",329:"Vibrava",330:"Flygon",
  331:"Cacnea",332:"Cacturne",
  333:"Swablu",334:"Altaria",
  335:"Zangoose",336:"Seviper",
  337:"Lunatone",338:"Solrock",
  339:"Barboach",340:"Whiscash",
  341:"Corphish",342:"Crawdaunt",
  343:"Baltoy",344:"Claydol",
  345:"Lileep",346:"Cradily",
  347:"Anorith",348:"Armaldo",
  349:"Feebas",350:"Milotic",
  351:"Castform",352:"Kecleon",
  353:"Shuppet",354:"Banette",
  355:"Duskull",356:"Dusclops",
  357:"Tropius",358:"Chimecho",359:"Absol",
  360:"Wynaut",361:"Snorunt",362:"Glalie",
  363:"Spheal",364:"Sealeo",365:"Walrein",
  366:"Clamperl",367:"Huntail",368:"Gorebyss",
  369:"Relicanth",370:"Luvdisc",
  371:"Bagon",372:"Shelgon",373:"Salamence",
  374:"Beldum",375:"Metang",376:"Metagross",
  377:"Regirock",378:"Regice",379:"Registeel",
  380:"Latias",381:"Latios",
  382:"Kyogre",383:"Groudon",384:"Rayquaza",
  385:"Jirachi",386:"Deoxys",
};

// Gen 4 (Sinnoh)
const POKEMON_GEN4_NAMES: Record<number, string> = {
  387:"Turtwig",388:"Grotle",389:"Torterra",
  390:"Chimchar",391:"Monferno",392:"Infernape",
  393:"Piplup",394:"Prinplup",395:"Empoleon",
  396:"Starly",397:"Staravia",398:"Staraptor",
  399:"Bidoof",400:"Bibarel",
  401:"Kricketot",402:"Kricketune",
  403:"Shinx",404:"Luxio",405:"Luxray",
  406:"Budew",407:"Roserade",
  408:"Cranidos",409:"Rampardos",
  410:"Shieldon",411:"Bastiodon",
  412:"Burmy",413:"Wormadam",414:"Mothim",
  415:"Combee",416:"Vespiquen",
  417:"Pachirisu",
  418:"Buizel",419:"Floatzel",
  420:"Cherubi",421:"Cherrim",
  422:"Shellos",423:"Gastrodon",
  424:"Ambipom",
  425:"Drifloon",426:"Drifblim",
  427:"Buneary",428:"Lopunny",
  429:"Mismagius",430:"Honchkrow",
  431:"Glameow",432:"Purugly",
  433:"Chingling",
  434:"Stunky",435:"Skuntank",
  436:"Bronzor",437:"Bronzong",
  438:"Bonsly",439:"Mime Jr.",440:"Happiny",
  441:"Chatot",442:"Spiritomb",
  443:"Gible",444:"Gabite",445:"Garchomp",
  446:"Munchlax",447:"Riolu",448:"Lucario",
  449:"Hippopotas",450:"Hippowdon",
  451:"Skorupi",452:"Drapion",
  453:"Croagunk",454:"Toxicroak",
  455:"Carnivine",
  456:"Finneon",457:"Lumineon",
  458:"Mantyke",459:"Snover",460:"Abomasnow",
  461:"Weavile",462:"Magnezone",463:"Lickilicky",
  464:"Rhyperior",465:"Tangrowth",466:"Electivire",
  467:"Magmortar",468:"Togekiss",469:"Yanmega",
  470:"Leafeon",471:"Glaceon",472:"Gliscor",
  473:"Mamoswine",474:"Porygon-Z",475:"Gallade",
  476:"Probopass",477:"Dusknoir",478:"Froslass",
  479:"Rotom",
  480:"Uxie",481:"Mesprit",482:"Azelf",
  483:"Dialga",484:"Palkia",485:"Heatran",
  486:"Regigigas",487:"Giratina",488:"Cresselia",
  489:"Phione",490:"Manaphy",491:"Darkrai",
  492:"Shaymin",493:"Arceus",
};

// Gen 5 (Unova)
const POKEMON_GEN5_NAMES: Record<number, string> = {
  494:"Victini",
  495:"Snivy",496:"Servine",497:"Serperior",
  498:"Tepig",499:"Pignite",500:"Emboar",
  501:"Oshawott",502:"Dewott",503:"Samurott",
  504:"Patrat",505:"Watchog",
  506:"Lillipup",507:"Herdier",508:"Stoutland",
  509:"Purrloin",510:"Liepard",
  511:"Pansage",512:"Simisage",
  513:"Pansear",514:"Simisear",
  515:"Panpour",516:"Simipour",
  517:"Munna",518:"Musharna",
  519:"Pidove",520:"Tranquill",521:"Unfezant",
  522:"Blitzle",523:"Zebstrika",
  524:"Roggenrola",525:"Boldore",526:"Gigalith",
  527:"Woobat",528:"Swoobat",
  529:"Drilbur",530:"Excadrill",
  531:"Audino",
  532:"Timburr",533:"Gurdurr",534:"Conkeldurr",
  535:"Tympole",536:"Palpitoad",537:"Seismitoad",
  538:"Throh",539:"Sawk",
  540:"Sewaddle",541:"Swadloon",542:"Leavanny",
  543:"Venipede",544:"Whirlipede",545:"Scolipede",
  546:"Cottonee",547:"Whimsicott",
  548:"Petilil",549:"Lilligant",
  550:"Basculin",
  551:"Sandile",552:"Krokorok",553:"Krookodile",
  554:"Darumaka",555:"Darmanitan",
  556:"Maractus",
  557:"Dwebble",558:"Crustle",
  559:"Scraggy",560:"Scrafty",
  561:"Sigilyph",
  562:"Yamask",563:"Cofagrigus",
  564:"Tirtouga",565:"Carracosta",
  566:"Archen",567:"Archeops",
  568:"Trubbish",569:"Garbodor",
  570:"Zorua",571:"Zoroark",
  572:"Minccino",573:"Cinccino",
  574:"Gothita",575:"Gothorita",576:"Gothitelle",
  577:"Solosis",578:"Duosion",579:"Reuniclus",
  580:"Ducklett",581:"Swanna",
  582:"Vanillite",583:"Vanillish",584:"Vanilluxe",
  585:"Deerling",586:"Sawsbuck",
  587:"Emolga",
  588:"Karrablast",589:"Escavalier",
  590:"Foongus",591:"Amoonguss",
  592:"Frillish",593:"Jellicent",
  594:"Alomomola",
  595:"Joltik",596:"Galvantula",
  597:"Ferroseed",598:"Ferrothorn",
  599:"Klink",600:"Klang",601:"Klinklang",
  602:"Tynamo",603:"Eelektrik",604:"Eelektross",
  605:"Elgyem",606:"Beheeyem",
  607:"Litwick",608:"Lampent",609:"Chandelure",
  610:"Axew",611:"Fraxure",612:"Haxorus",
  613:"Cubchoo",614:"Beartic",
  615:"Cryogonal",
  616:"Shelmet",617:"Accelgor",
  618:"Stunfisk",
  619:"Mienfoo",620:"Mienshao",
  621:"Druddigon",
  622:"Golett",623:"Golurk",
  624:"Pawniard",625:"Bisharp",
  626:"Bouffalant",
  627:"Rufflet",628:"Braviary",
  629:"Vullaby",630:"Mandibuzz",
  631:"Heatmor",632:"Durant",
  633:"Deino",634:"Zweilous",635:"Hydreigon",
  636:"Larvesta",637:"Volcarona",
  638:"Cobalion",639:"Terrakion",640:"Virizion",
  641:"Tornadus",642:"Thundurus",
  643:"Reshiram",644:"Zekrom",
  645:"Landorus",646:"Kyurem",
  647:"Keldeo",648:"Meloetta",649:"Genesect",
};

// Gen 6 (Kalos)
const POKEMON_GEN6_NAMES: Record<number, string> = {
  650:"Chespin",651:"Quilladin",652:"Chesnaught",
  653:"Fennekin",654:"Braixen",655:"Delphox",
  656:"Froakie",657:"Frogadier",658:"Greninja",
  659:"Bunnelby",660:"Diggersby",
  661:"Fletchling",662:"Fletchinder",663:"Talonflame",
  664:"Scatterbug",665:"Spewpa",666:"Vivillon",
  667:"Litleo",668:"Pyroar",
  669:"Flabébé",670:"Floette",671:"Florges",
  672:"Skiddo",673:"Gogoat",
  674:"Pancham",675:"Pangoro",
  676:"Furfrou",
  677:"Espurr",678:"Meowstic",
  679:"Honedge",680:"Doublade",681:"Aegislash",
  682:"Spritzee",683:"Aromatisse",
  684:"Swirlix",685:"Slurpuff",
  686:"Inkay",687:"Malamar",
  688:"Binacle",689:"Barbaracle",
  690:"Skrelp",691:"Dragalge",
  692:"Clauncher",693:"Clawitzer",
  694:"Helioptile",695:"Heliolisk",
  696:"Tyrunt",697:"Tyrantrum",
  698:"Amaura",699:"Aurorus",
  700:"Sylveon",701:"Hawlucha",
  702:"Dedenne",703:"Carbink",
  704:"Goomy",705:"Sliggoo",706:"Goodra",
  707:"Klefki",
  708:"Phantump",709:"Trevenant",
  710:"Pumpkaboo",711:"Gourgeist",
  712:"Bergmite",713:"Avalugg",
  714:"Noibat",715:"Noivern",
  716:"Xerneas",717:"Yveltal",718:"Zygarde",
  719:"Diancie",720:"Hoopa",721:"Volcanion",
};

// Gen 7 (Alola)
const POKEMON_GEN7_NAMES: Record<number, string> = {
  722:"Rowlet",723:"Dartrix",724:"Decidueye",
  725:"Litten",726:"Torracat",727:"Incineroar",
  728:"Popplio",729:"Brionne",730:"Primarina",
  731:"Pikipek",732:"Trumbeak",733:"Toucannon",
  734:"Yungoos",735:"Gumshoos",
  736:"Grubbin",737:"Charjabug",738:"Vikavolt",
  739:"Crabrawler",740:"Crabominable",
  741:"Oricorio",742:"Cutiefly",743:"Ribombee",
  744:"Rockruff",745:"Lycanroc",
  746:"Wishiwashi",
  747:"Mareanie",748:"Toxapex",
  749:"Mudbray",750:"Mudsdale",
  751:"Dewpider",752:"Araquanid",
  753:"Fomantis",754:"Lurantis",
  755:"Morelull",756:"Shiinotic",
  757:"Salandit",758:"Salazzle",
  759:"Stufful",760:"Bewear",
  761:"Bounsweet",762:"Steenee",763:"Tsareena",
  764:"Comfey",765:"Oranguru",766:"Passimian",
  767:"Wimpod",768:"Golisopod",
  769:"Sandygast",770:"Palossand",
  771:"Pyukumuku",772:"Type: Null",773:"Silvally",
  774:"Minior",775:"Komala",
  776:"Turtonator",777:"Togedemaru",
  778:"Mimikyu",779:"Bruxish",780:"Drampa",
  781:"Dhelmise",
  782:"Jangmo-o",783:"Hakamo-o",784:"Kommo-o",
  785:"Tapu Koko",786:"Tapu Lele",787:"Tapu Bulu",788:"Tapu Fini",
  789:"Cosmog",790:"Cosmoem",791:"Solgaleo",792:"Lunala",
  793:"Nihilego",794:"Buzzwole",795:"Pheromosa",796:"Xurkitree",
  797:"Celesteela",798:"Kartana",799:"Guzzlord",
  800:"Necrozma",801:"Magearna",802:"Marshadow",
  803:"Poipole",804:"Naganadel",805:"Stakataka",806:"Blacephalon",
  807:"Zeraora",808:"Meltan",809:"Melmetal",
};

// Gen 8 (Galar)
const POKEMON_GEN8_NAMES: Record<number, string> = {
  810:"Grookey",811:"Thwackey",812:"Rillaboom",
  813:"Scorbunny",814:"Raboot",815:"Cinderace",
  816:"Sobble",817:"Drizzile",818:"Inteleon",
  819:"Skwovet",820:"Greedent",
  821:"Rookidee",822:"Corvisquire",823:"Corviknight",
  824:"Blipbug",825:"Dottler",826:"Orbeetle",
  827:"Nickit",828:"Thievul",
  829:"Gossifleur",830:"Eldegoss",
  831:"Wooloo",832:"Dubwool",
  833:"Chewtle",834:"Drednaw",
  835:"Yamper",836:"Boltund",
  837:"Rolycoly",838:"Carkol",839:"Coalossal",
  840:"Applin",841:"Flapple",842:"Appletun",
  843:"Silicobra",844:"Sandaconda",
  845:"Cramorant",
  846:"Arrokuda",847:"Barraskewda",
  848:"Toxel",849:"Toxtricity",10184:"Toxtricity Low Key",
  850:"Sizzlipede",851:"Centiskorch",
  852:"Clobbopus",853:"Grapploct",
  854:"Sinistea",855:"Polteageist",
  856:"Hatenna",857:"Hattrem",858:"Hatterene",
  859:"Impidimp",860:"Morgrem",861:"Grimmsnarl",
  862:"Obstagoon",863:"Perrserker",864:"Cursola",
  865:"Sirfetch'd",866:"Mr. Rime",867:"Runerigus",
  868:"Milcery",869:"Alcremie",
  870:"Falinks",871:"Pincurchin",
  872:"Snom",873:"Frosmoth",
  874:"Stonjourner",875:"Eiscue",
  876:"Indeedee",877:"Morpeko",
  878:"Cufant",879:"Copperajah",
  880:"Dracozolt",881:"Arctozolt",882:"Dracovish",883:"Arctovish",
  884:"Duraludon",885:"Dreepy",886:"Drakloak",887:"Dragapult",
  888:"Zacian",889:"Zamazenta",890:"Eternatus",
  891:"Kubfu",892:"Urshifu",893:"Zarude",
  894:"Regieleki",895:"Regidrago",
  896:"Glastrier",897:"Spectrier",898:"Calyrex",
  899:"Wyrdeer",900:"Kleavor",901:"Ursaluna",
  902:"Basculegion",903:"Sneasler",904:"Overqwil",
  905:"Enamorus",
};

// Gen 9 (Paldea)
const POKEMON_GEN9_NAMES: Record<number, string> = {
  906:"Sprigatito",907:"Floragato",908:"Meowscarada",
  909:"Fuecoco",910:"Crocalor",911:"Skeledirge",
  912:"Quaxly",913:"Quaxwell",914:"Quaquaval",
  915:"Lechonk",916:"Oinkologne",
  917:"Tarountula",918:"Spidops",
  919:"Nymble",920:"Lokix",
  921:"Pawmi",922:"Pawmo",923:"Pawmot",
  924:"Tandemaus",925:"Maushold",
  926:"Fidough",927:"Dachsbun",
  928:"Smoliv",929:"Dolliv",930:"Arboliva",
  931:"Squawkabilly",
  932:"Nacli",933:"Naclstack",934:"Garganacl",
  935:"Charcadet",936:"Armarouge",937:"Ceruledge",
  938:"Tadbulb",939:"Bellibolt",
  940:"Wattrel",941:"Kilowattrel",
  942:"Maschiff",943:"Mabosstiff",
  944:"Shroodle",945:"Grafaiai",
  946:"Bramblin",947:"Brambleghast",
  948:"Toedscool",949:"Toedscruel",
  950:"Klawf",951:"Capsakid",952:"Scovillain",
  953:"Rellor",954:"Rabsca",
  955:"Flittle",956:"Espathra",
  957:"Tinkatink",958:"Tinkatuff",959:"Tinkaton",
  960:"Wiglett",961:"Wugtrio",
  962:"Bombirdier",963:"Finizen",964:"Palafin",
  965:"Varoom",966:"Revavroom",
  967:"Cyclizar",968:"Orthworm",
  969:"Glimmet",970:"Glimmora",
  971:"Greavard",972:"Houndstone",
  973:"Flamigo",
  974:"Cetoddle",975:"Cetitan",
  976:"Veluza",977:"Dondozo",
  978:"Tatsugiri",979:"Annihilape",
  980:"Clodsire",981:"Farigiraf",982:"Dudunsparce",
  983:"Kingambit",984:"Great Tusk",985:"Scream Tail",
  986:"Brute Bonnet",987:"Flutter Mane",988:"Slither Wing",
  989:"Sandy Shocks",990:"Iron Treads",991:"Iron Bundle",
  992:"Iron Hands",993:"Iron Jugulis",994:"Iron Moth",
  995:"Iron Thorns",996:"Frigibax",997:"Arctibax",998:"Baxcalibur",
  999:"Gimmighoul",1000:"Gholdengo",
  1001:"Wo-Chien",1002:"Chien-Pao",1003:"Ting-Lu",1004:"Chi-Yu",
  1005:"Roaring Moon",1006:"Iron Valiant",
  1007:"Koraidon",1008:"Miraidon",
  1009:"Walking Wake",1010:"Iron Leaves",
  1011:"Dipplin",1012:"Poltchageist",1013:"Sinistcha",10013:"Sinistcha Masterpiece",
  1014:"Okidogi",1015:"Munkidori",1016:"Fezandipiti",
  1017:"Ogerpon",1018:"Archaludon",1019:"Hydrapple",1020:"Gouging Fire",1021:"Raging Bolt",
  1022:"Iron Boulder",1023:"Iron Crown",
  1024:"Terapagos",1025:"Pecharunt",
  // Formas especiais (IDs PokeAPI de forma, não National Dex)
  10004:"Wormadam-Arenosa",10005:"Wormadam-Lata",
  10006:"Shaymin-Céu",10007:"Giratina-Origem",
  10008:"Rotom-Calor",10009:"Rotom-Lavagem",10010:"Rotom-Gelo",
  10011:"Rotom-Ventilador",10012:"Rotom-Corte",
  // ── Formas Alolan ─────────────────────────────────────────────────────────────
  // ── Formas de Lycanroc (Gen 7) ───────────────────────────────────────────────
  10152:"Lycanroc-Midnight",
  10155:"Lycanroc-Dusk",
  // ── Formas Alolan ────────────────────────────────────────────────────────────
  10091:"Rattata-Alola",10092:"Raticate-Alola",
  10100:"Raichu-Alola",
  10101:"Sandshrew-Alola",10102:"Sandslash-Alola",
  10103:"Vulpix-Alola",10104:"Ninetales-Alola",
  10105:"Diglett-Alola",10106:"Dugtrio-Alola",
  10107:"Meowth-Alola",10108:"Persian-Alola",
  10109:"Geodude-Alola",10110:"Graveler-Alola",10111:"Golem-Alola",
  10112:"Grimer-Alola",10113:"Muk-Alola",
  10114:"Exeggutor-Alola",10115:"Marowak-Alola",
  // ── Formas Galar ─────────────────────────────────────────────────────────────
  10158:"Meowth-Galar",
  10159:"Ponyta-Galar",10160:"Rapidash-Galar",
  10161:"Slowpoke-Galar",10162:"Slowbro-Galar",10169:"Slowking-Galar",
  10163:"Farfetch'd-Galar",
  10164:"Weezing-Galar",
  10165:"Mr. Mime-Galar",
  10166:"Articuno-Galar",10167:"Zapdos-Galar",10168:"Moltres-Galar",
  10170:"Corsola-Galar",
  10171:"Zigzagoon-Galar",10172:"Linoone-Galar",
  10173:"Darumaka-Galar",10174:"Darmanitan-Galar",
  10175:"Yamask-Galar",
  10176:"Stunfisk-Galar",
  // ── Formas Hisui ─────────────────────────────────────────────────────────────
  10229:"Growlithe-Hisui",10230:"Arcanine-Hisui",
  10231:"Voltorb-Hisui",10232:"Electrode-Hisui",
  10233:"Typhlosion-Hisui",
  10234:"Qwilfish-Hisui",
  10235:"Sneasel-Hisui",
  10236:"Samurott-Hisui",
  10237:"Lilligant-Hisui",
  10238:"Zorua-Hisui",10239:"Zoroark-Hisui",
  10240:"Braviary-Hisui",
  10241:"Sliggoo-Hisui",10242:"Goodra-Hisui",
  10243:"Avalugg-Hisui",
  10244:"Decidueye-Hisui",
};

export function getPokemonName(id: number): string {
  const megaStone = getMegaStoneForMegaPokemon(id);
  if (megaStone) return megaStone.megaPokemonName;
  return (
    POKEMON_PT_NAMES[id] ??
    POKEMON_GEN3_NAMES[id] ??
    POKEMON_GEN4_NAMES[id] ??
    POKEMON_GEN5_NAMES[id] ??
    POKEMON_GEN6_NAMES[id] ??
    POKEMON_GEN7_NAMES[id] ??
    POKEMON_GEN8_NAMES[id] ??
    POKEMON_GEN9_NAMES[id] ??
    `Pokémon #${id}`
  );
}

// ── Tipos elementais por Pokémon ID (formato "tipo1" ou "tipo1/tipo2") ────────
// getPokemonElement retorna apenas o tipo primário (divide em "/").
// getPokemonTypes retorna todos os tipos como array.
export const POKEMON_ELEMENT: Record<number, string> = {
  // ── Gen 1 ──────────────────────────────────────────────────────────────────
  1:"grass/poison",2:"grass/poison",3:"grass/poison",
  4:"fire",5:"fire",6:"fire/flying",
  7:"water",8:"water",9:"water",
  10:"bug",11:"bug",12:"bug/flying",
  13:"bug/poison",14:"bug/poison",15:"bug/poison",
  16:"normal/flying",17:"normal/flying",18:"normal/flying",
  19:"normal",20:"normal",21:"normal/flying",22:"normal/flying",
  23:"poison",24:"poison",
  25:"electric",26:"electric",
  27:"ground",28:"ground",
  29:"poison",30:"poison",31:"poison/ground",
  32:"poison",33:"poison",34:"poison/ground",
  35:"normal/fairy",36:"normal/fairy",
  37:"fire",38:"fire",
  39:"normal/fairy",40:"normal/fairy",
  41:"poison/flying",42:"poison/flying",
  43:"grass/poison",44:"grass/poison",45:"grass/poison",
  46:"bug/grass",47:"bug/grass",
  48:"bug/poison",49:"bug/poison",
  50:"ground",51:"ground",
  52:"normal",53:"normal",
  54:"water",55:"water",
  56:"fighting",57:"fighting",
  58:"fire",59:"fire",
  60:"water",61:"water",62:"water/fighting",
  63:"psychic",64:"psychic",65:"psychic",
  66:"fighting",67:"fighting",68:"fighting",
  69:"grass/poison",70:"grass/poison",71:"grass/poison",
  72:"water/poison",73:"water/poison",
  74:"rock/ground",75:"rock/ground",76:"rock/ground",
  77:"fire",78:"fire",
  79:"water/psychic",80:"water/psychic",
  81:"electric/steel",82:"electric/steel",
  83:"normal/flying",84:"normal/flying",85:"normal/flying",
  86:"water",87:"water/ice",
  88:"poison",89:"poison",
  90:"water",91:"water/ice",
  92:"ghost/poison",93:"ghost/poison",94:"ghost/poison",
  95:"rock/ground",96:"psychic",97:"psychic",
  98:"water",99:"water",100:"electric",101:"electric",
  102:"grass/psychic",103:"grass/psychic",
  104:"ground",105:"ground",
  106:"fighting",107:"fighting",108:"normal",
  109:"poison/ghost",110:"poison/ghost",
  111:"ground/rock",112:"ground/rock",
  113:"normal",114:"grass",115:"normal",
  116:"water",117:"water",118:"water",119:"water",
  120:"water",121:"water/psychic",122:"psychic/fairy",
  123:"bug/flying",124:"ice/psychic",125:"electric",126:"fire",127:"bug",
  128:"normal",129:"water",130:"water/flying",
  131:"water/ice",132:"normal",133:"normal",
  134:"water",135:"electric",136:"fire",137:"normal",
  138:"rock/water",139:"rock/water",140:"rock/water",141:"rock/water",142:"rock/flying",
  143:"normal",
  144:"ice/flying",145:"electric/flying",146:"fire/flying",
  147:"dragon",148:"dragon",149:"dragon/flying",
  150:"psychic",151:"psychic",
  // ── Gen 2 ──────────────────────────────────────────────────────────────────
  152:"grass",153:"grass",154:"grass",
  155:"fire",156:"fire",157:"fire",
  158:"water",159:"water",160:"water",
  161:"normal",162:"normal",163:"normal/flying",164:"normal/flying",
  165:"bug/electric",166:"bug/electric",
  167:"bug/poison",168:"bug/poison",169:"poison/flying",
  170:"water/electric",171:"water/electric",
  172:"electric",173:"normal/fairy",174:"normal/fairy",
  175:"normal/fairy",176:"normal/fairy",
  177:"psychic/flying",178:"psychic/flying",
  179:"electric",180:"electric",181:"electric",
  182:"grass",183:"water/fairy",184:"water/fairy",
  185:"rock",186:"water",
  187:"grass/flying",188:"grass/flying",189:"grass/flying",
  190:"normal",191:"grass",192:"grass",
  193:"bug/flying",194:"water/ground",195:"water/ground",
  196:"psychic",197:"dark",198:"dark/flying",
  199:"water/psychic",200:"ghost",201:"psychic",202:"psychic",
  203:"normal/psychic",204:"bug",205:"bug/steel",
  206:"normal",207:"ground/flying",208:"steel/ground",
  209:"normal/fairy",210:"normal/fairy",
  211:"water/poison",212:"bug/steel",213:"bug/rock",
  214:"bug/fighting",215:"dark/ice",
  216:"normal",217:"normal",218:"fire",219:"fire/rock",
  220:"ice/ground",221:"ice/ground",222:"water/rock",
  223:"water",224:"water",225:"ice/flying",
  226:"water/flying",227:"steel/flying",
  228:"dark/fire",229:"dark/fire",230:"water/dragon",
  231:"ground",232:"ground",233:"normal",234:"normal",235:"normal",
  236:"fighting",237:"fighting/psychic",238:"ice/psychic",
  239:"electric",240:"fire",241:"normal",242:"normal",
  243:"electric",244:"fire",245:"water",
  246:"rock/ground",247:"rock/ground",248:"rock/dark",
  249:"psychic/flying",250:"fire/flying",251:"psychic/grass",
  // ── Gen 3 ──────────────────────────────────────────────────────────────────
  252:"grass",253:"grass",254:"grass",
  255:"fire",256:"fire/fighting",257:"fire/fighting",
  258:"water",259:"water/ground",260:"water/ground",
  261:"dark",262:"dark",263:"normal",264:"normal",
  265:"bug",266:"bug",267:"bug/flying",268:"bug",269:"bug/poison",
  270:"water/grass",271:"water/grass",272:"water/grass",
  273:"grass",274:"grass/dark",275:"grass/dark",
  276:"normal/flying",277:"normal/flying",278:"water/flying",279:"water/flying",
  280:"psychic/fairy",281:"psychic/fairy",282:"psychic/fairy",
  283:"bug/water",284:"bug/flying",
  285:"grass",286:"grass/fighting",
  287:"normal",288:"normal",289:"normal",
  290:"bug/ground",291:"bug/flying",292:"bug/ghost",
  293:"normal",294:"normal",295:"normal",
  296:"fighting",297:"fighting",298:"normal/fairy",299:"rock",
  300:"normal",301:"normal",302:"dark/ghost",303:"steel/fairy",
  304:"steel/rock",305:"steel/rock",306:"steel/rock",
  307:"fighting/psychic",308:"fighting/psychic",
  309:"electric",310:"electric",311:"electric",312:"electric",
  313:"bug",314:"bug",315:"grass/poison",
  316:"poison",317:"poison",318:"water/dark",319:"water/dark",
  320:"water",321:"water",322:"fire/ground",323:"fire/ground",
  324:"fire",325:"psychic",326:"psychic",327:"normal",
  328:"ground",329:"ground/dragon",330:"ground/dragon",
  331:"grass",332:"grass/dark",333:"normal/flying",334:"dragon/flying",
  335:"normal",336:"poison",337:"rock/psychic",338:"rock/psychic",
  339:"water/ground",340:"water/ground",341:"water",342:"water/dark",
  343:"ground/psychic",344:"ground/psychic",
  345:"rock/grass",346:"rock/grass",347:"rock/bug",348:"rock/bug",
  349:"water",350:"water",351:"normal",352:"normal",
  353:"ghost",354:"ghost",355:"ghost",356:"ghost",
  357:"grass/flying",358:"psychic",359:"dark",360:"psychic",
  361:"ice",362:"ice",363:"ice/water",364:"ice/water",365:"ice/water",
  366:"water",367:"water",368:"water",369:"water/rock",370:"water",
  371:"dragon",372:"dragon",373:"dragon/flying",
  374:"steel/psychic",375:"steel/psychic",376:"steel/psychic",
  // Gen 3 legendaries
  377:"rock",378:"ice",379:"steel",
  380:"dragon/psychic",381:"dragon/psychic",
  382:"water",383:"fire/ground",384:"dragon/flying",
  385:"steel/psychic",386:"psychic",
  // ── Gen 4 ──────────────────────────────────────────────────────────────────
  387:"grass",388:"grass",389:"grass/ground",
  390:"fire",391:"fire/fighting",392:"fire/fighting",
  393:"water",394:"water",395:"water/steel",
  396:"normal/flying",397:"normal/flying",398:"normal/flying",
  399:"normal",400:"normal/water",401:"bug",402:"bug",
  403:"electric",404:"electric",405:"electric",
  406:"grass/poison",407:"grass/poison",408:"rock",409:"rock",
  410:"rock/steel",411:"rock/steel",
  412:"bug",413:"bug/grass",414:"bug/flying",415:"bug/flying",416:"bug/flying",
  417:"electric",418:"water",419:"water",420:"grass",421:"grass",
  422:"water",423:"water/ground",424:"normal",
  425:"ghost/flying",426:"ghost/flying",427:"normal",428:"normal",
  429:"ghost",430:"dark/flying",431:"normal",432:"normal",
  433:"psychic",434:"poison/dark",435:"poison/dark",
  436:"steel/psychic",437:"steel/psychic",
  438:"rock",439:"psychic/fairy",440:"normal",441:"normal/flying",
  442:"ghost/dark",
  443:"dragon/ground",444:"dragon/ground",445:"dragon/ground",
  446:"normal",447:"fighting",448:"fighting/steel",
  449:"ground",450:"ground",
  451:"poison/bug",452:"poison/dark",
  453:"poison/fighting",454:"poison/fighting",
  455:"grass",456:"water",457:"water",458:"water/flying",
  459:"grass/ice",460:"grass/ice",
  461:"dark/ice",462:"electric/steel",463:"normal",464:"ground/rock",
  465:"grass",466:"electric",467:"fire",
  468:"normal/flying",469:"bug/flying",470:"grass",471:"ice",
  472:"ground/flying",473:"ice/ground",474:"normal",
  475:"psychic/fighting",476:"rock/steel",477:"ghost",478:"ice/ghost",
  479:"electric/ghost",
  // Gen 4 legendaries
  480:"psychic",481:"psychic",482:"psychic",
  483:"steel/dragon",484:"water/dragon",485:"fire/steel",
  486:"psychic",487:"ghost/dragon",488:"psychic",
  489:"water",490:"water",491:"dark",492:"grass",493:"normal",
  494:"psychic/fire",
  // ── Gen 5 ──────────────────────────────────────────────────────────────────
  495:"grass",496:"grass",497:"grass",
  498:"fire",499:"fire/fighting",500:"fire/fighting",
  501:"water",502:"water",503:"water",
  504:"normal",505:"normal",506:"normal",507:"normal",508:"normal",
  509:"dark",510:"dark",
  511:"grass",512:"grass",513:"fire",514:"fire",515:"water",516:"water",
  517:"psychic",518:"psychic",
  519:"normal/flying",520:"normal/flying",521:"normal/flying",
  522:"electric",523:"electric",
  524:"rock",525:"rock",526:"rock",
  527:"psychic/flying",528:"psychic/flying",
  529:"ground",530:"ground/steel",531:"normal",
  532:"fighting",533:"fighting",534:"fighting",
  535:"water",536:"water/ground",537:"water/ground",
  538:"fighting",539:"fighting",
  540:"bug/grass",541:"bug/grass",542:"bug/grass",
  543:"bug/poison",544:"bug/poison",545:"bug/poison",
  546:"grass/fairy",547:"grass/fairy",548:"grass",549:"grass",
  550:"water",551:"ground/dark",552:"ground/dark",553:"ground/dark",
  554:"fire",555:"fire",556:"grass",
  557:"bug/rock",558:"bug/rock",559:"dark/fighting",560:"dark/fighting",
  561:"psychic/flying",562:"ghost",563:"ghost",
  564:"water/rock",565:"water/rock",566:"rock/flying",567:"rock/flying",
  568:"poison",569:"poison",570:"dark",571:"dark",
  572:"normal",573:"normal",
  574:"psychic",575:"psychic",576:"psychic",577:"psychic",578:"psychic",579:"psychic",
  580:"water/flying",581:"water/flying",
  582:"ice",583:"ice/flying",584:"ice/flying",
  585:"normal/grass",586:"normal/grass",587:"electric/flying",
  588:"bug",589:"bug/steel",
  590:"grass/poison",591:"grass/poison",
  592:"water/ghost",593:"water/ghost",594:"water",
  595:"bug/electric",596:"bug/electric",
  597:"grass/steel",598:"grass/steel",
  599:"steel",600:"steel",601:"steel",
  602:"electric",603:"electric",604:"electric",
  605:"psychic",606:"psychic",
  607:"ghost/fire",608:"ghost/fire",609:"ghost/fire",
  610:"dragon",611:"dragon",612:"dragon",
  613:"ice",614:"ice",615:"ice/ghost",
  616:"bug",617:"bug",618:"ground/electric",
  619:"fighting",620:"fighting",621:"dragon",
  622:"ground/ghost",623:"ground/ghost",
  624:"dark/steel",625:"dark/steel",626:"normal",
  627:"normal/flying",628:"normal/flying",629:"dark/flying",630:"dark/flying",
  631:"fire",632:"bug/steel",
  633:"dark/dragon",634:"dark/dragon",635:"dark/dragon",
  636:"bug/fire",637:"bug/fire",
  // Gen 5 legendaries
  638:"fighting/steel",639:"fighting/rock",640:"fighting/grass",
  641:"flying",642:"electric/flying",643:"dragon/fire",644:"dragon/electric",
  645:"ground/flying",646:"dragon/ice",647:"water/fighting",648:"normal/psychic",649:"bug/steel",
  // ── Gen 6 ──────────────────────────────────────────────────────────────────
  650:"grass",651:"grass",652:"grass/fighting",
  653:"fire",654:"fire",655:"fire/psychic",
  656:"water",657:"water",658:"water/dark",
  659:"normal",660:"normal/ground",
  661:"normal/flying",662:"fire/flying",663:"fire/flying",
  664:"bug",665:"bug",666:"bug/flying",
  667:"fire/normal",668:"fire/normal",
  669:"fairy",670:"fairy",671:"fairy",
  672:"grass",673:"grass/fighting",674:"fighting",675:"fighting/dark",676:"normal",
  677:"psychic",678:"psychic",
  679:"steel/ghost",680:"steel/ghost",681:"steel/ghost",
  682:"fairy",683:"fairy",684:"fairy",685:"fairy",
  686:"dark/psychic",687:"dark/psychic",
  688:"rock/water",689:"rock/water",
  690:"poison/water",691:"poison/dragon",
  692:"water",693:"water",694:"electric/normal",695:"electric/normal",
  696:"rock/dragon",697:"rock/dragon",698:"rock/ice",699:"rock/ice",
  700:"fairy",701:"fighting/flying",702:"electric/fairy",703:"rock/fairy",
  704:"dragon",705:"dragon",706:"dragon",707:"steel/fairy",
  708:"ghost/grass",709:"ghost/grass",710:"ghost/grass",711:"ghost/grass",
  712:"ice",713:"ice",714:"flying/dragon",715:"flying/dragon",
  // Gen 6 legendaries
  716:"fairy",717:"dark/flying",718:"dragon/ground",719:"rock/fairy",720:"psychic",721:"psychic/dark",
  // ── Gen 7 ──────────────────────────────────────────────────────────────────
  722:"grass/flying",723:"grass/flying",724:"grass/ghost",
  725:"fire",726:"fire",727:"fire/dark",
  728:"water",729:"water",730:"water/fairy",
  731:"normal/flying",732:"normal/flying",733:"normal/flying",
  734:"normal",735:"normal",
  736:"bug",737:"bug/electric",738:"bug/electric",
  739:"fighting/water",740:"fighting/ice",
  741:"fire/flying",742:"bug/fairy",743:"bug/fairy",
  744:"rock",745:"rock",746:"water",
  747:"poison/water",748:"poison/water",749:"ground",750:"ground",
  751:"water/bug",752:"water/bug",753:"grass",754:"grass",
  755:"grass/fairy",756:"grass/fairy",757:"poison/fire",758:"poison/fire",
  759:"normal/fighting",760:"normal/fighting",
  761:"grass",762:"grass",763:"grass",
  764:"fairy",765:"normal/psychic",766:"fighting",
  767:"bug/water",768:"bug/water",769:"ghost/ground",770:"ghost/ground",
  771:"water",772:"normal",773:"normal",774:"rock/flying",775:"normal",776:"fire/dragon",
  777:"electric/steel",778:"ghost/fairy",779:"water/psychic",780:"normal/dragon",
  781:"ghost/grass",782:"dragon",783:"dragon/fighting",784:"dragon/fighting",
  // Gen 7 legendaries / Ultra Beasts
  785:"electric/fairy",786:"psychic/fairy",787:"grass/fairy",788:"water/fairy",
  789:"psychic",790:"psychic",791:"psychic/steel",792:"psychic/ghost",
  793:"water/rock",794:"rock/steel",795:"electric/poison",796:"electric/flying",
  797:"bug/fighting",798:"electric/flying",799:"poison/steel",
  800:"psychic",801:"steel/fairy",802:"dark/fighting",
  803:"poison/dragon",804:"poison/dragon",805:"bug/fighting",806:"bug/fire",
  807:"electric",808:"steel",809:"steel",
  // ── Gen 8 ──────────────────────────────────────────────────────────────────
  810:"grass",811:"grass",812:"grass",
  813:"fire",814:"fire",815:"fire",
  816:"water",817:"water",818:"water",
  819:"normal",820:"normal",821:"flying",822:"flying",823:"steel/flying",
  824:"bug",825:"bug/psychic",826:"bug/psychic",
  827:"dark",828:"dark",829:"grass",830:"grass",
  831:"normal",832:"normal",833:"water",834:"water/rock",
  835:"electric",836:"electric",837:"rock",838:"rock/fire",839:"rock/fire",
  840:"grass/dragon",841:"grass/dragon",842:"grass/dragon",
  843:"ground",844:"ground",845:"flying/water",
  846:"water",847:"water",848:"electric/poison",849:"electric/poison",10184:"electric/poison",
  850:"fire/bug",851:"fire/bug",852:"fighting",853:"fighting",
  854:"ghost",855:"ghost",856:"psychic",857:"psychic",858:"psychic/fairy",
  859:"dark/fairy",860:"dark/fairy",861:"dark/fairy",
  862:"dark/normal",863:"steel",864:"ghost/water",
  865:"fighting",866:"ice/psychic",867:"ground/ghost",
  868:"fairy",869:"fairy",870:"fighting",871:"electric",
  872:"ice/bug",873:"ice/bug",874:"rock",875:"ice",876:"normal/psychic",
  877:"electric/dark",878:"steel",879:"steel",
  880:"electric/dragon",881:"electric/ice",882:"water/dragon",883:"water/ice",
  884:"steel/dragon",885:"dragon/ghost",886:"dragon/ghost",887:"dragon/ghost",
  // Gen 8 legendaries
  888:"fairy/steel",889:"dark/steel",890:"poison/dragon",
  891:"fighting",892:"fighting/dark",893:"grass/dark",  // 892 = Urshifu Single Strike
  894:"electric",895:"dragon",896:"ice",897:"ghost",898:"psychic/grass",
  899:"normal/psychic",900:"bug/rock",901:"ground/normal",
  902:"water/ghost",903:"fighting/poison",904:"dark/poison",905:"fairy/flying",
  // ── Gen 9 ──────────────────────────────────────────────────────────────────
  906:"grass",907:"grass",908:"grass/dark",
  909:"fire",910:"fire",911:"fire/ghost",
  912:"water",913:"water",914:"water/fighting",
  915:"normal",916:"normal",917:"bug",918:"bug",919:"bug",920:"bug/dark",
  921:"electric",922:"electric/fighting",923:"electric/fighting",
  924:"normal",925:"normal",926:"fairy",927:"fairy",
  928:"grass/normal",929:"grass/normal",930:"grass/normal",
  931:"normal/flying",932:"rock",933:"rock",934:"rock",
  935:"fire",936:"fire/psychic",937:"fire/ghost",
  938:"electric",939:"electric",940:"electric/flying",941:"electric/flying",
  942:"dark",943:"dark",944:"poison/normal",945:"poison/normal",
  946:"grass/ghost",947:"grass/ghost",948:"ground/grass",949:"ground/grass",
  950:"rock",951:"grass",952:"grass/fire",
  953:"bug",954:"bug/psychic",955:"psychic",956:"psychic",
  957:"fairy/steel",958:"fairy/steel",959:"fairy/steel",
  960:"water",961:"water",962:"flying/dark",963:"water",964:"water",
  965:"steel/poison",966:"steel/poison",967:"dragon/normal",968:"steel",
  969:"rock/poison",970:"rock/poison",971:"ghost",972:"ghost",
  973:"flying/fighting",974:"ice",975:"ice",976:"water",
  977:"water",978:"water/dragon",979:"fighting/ghost",980:"poison/ground",
  981:"normal/psychic",982:"normal",983:"dark/steel",
  984:"ground/fighting",985:"fairy/psychic",986:"grass/dark",987:"ghost/fairy",
  988:"bug/fighting",989:"electric/ground",990:"ground/steel",991:"ice/water",
  992:"fighting/electric",993:"dark/flying",994:"fire/poison",995:"rock/electric",
  996:"dragon/ice",997:"dragon/ice",998:"dragon/ice",
  999:"ghost",1000:"steel/ghost",
  1011:"grass/dragon",1012:"grass/ghost",1013:"grass/ghost",10013:"grass/ghost",
  // Gen 9 legendaries / DLC
  1001:"dark/grass",1002:"dark/ice",1003:"dark/rock",1004:"dark/fire",
  1005:"dragon/dark",1006:"fairy/fighting",
  1007:"dragon/fighting",1008:"dragon/electric",
  1009:"water/dragon",1010:"grass/psychic",
  1014:"poison/fighting",1015:"poison/psychic",1016:"poison/fairy",
  1017:"grass",1018:"steel/dragon",1019:"grass/dragon",
  1020:"fire/dragon",1021:"electric/dragon",1022:"rock/psychic",1023:"steel/psychic",
  1024:"normal",1025:"poison/ghost",
  // ── Formas especiais (IDs PokeAPI 10000+) ────────────────────────────────────
  10004:"bug/ground",  // Wormadam-Sandy
  10005:"bug/steel",   // Wormadam-Trash
  10006:"grass/flying",// Shaymin-Sky
  10007:"ghost/dragon",// Giratina-Origin
  10008:"electric/fire",  // Rotom-Calor
  10009:"electric/water", // Rotom-Lavagem
  10010:"electric/ice",   // Rotom-Gelo
  10011:"electric/flying",// Rotom-Ventilador
  10012:"electric/grass", // Rotom-Corte
  // ── Formas Alolan ──────────────────────────────────────────────────────────
  // Formas de Lycanroc (Gen 7)
  10152:"rock",  // Lycanroc-Midnight
  10155:"rock",  // Lycanroc-Dusk
  // Formas Alolan
  10091:"dark/normal", 10092:"dark/normal",   // Rattata/Raticate-Alola
  10100:"electric/psychic",                    // Raichu-Alola
  10101:"ice/steel",   10102:"ice/steel",      // Sandshrew/Sandslash-Alola
  10103:"ice",         10104:"ice/fairy",       // Vulpix/Ninetales-Alola
  10105:"ground/steel",10106:"ground/steel",   // Diglett/Dugtrio-Alola
  10107:"dark",        10108:"dark",            // Meowth/Persian-Alola
  10109:"rock/electric",10110:"rock/electric",10111:"rock/electric", // Geodude/Graveler/Golem-Alola
  10112:"poison/dark", 10113:"poison/dark",    // Grimer/Muk-Alola
  10114:"grass/dragon",                        // Exeggutor-Alola
  10115:"fire/ghost",                          // Marowak-Alola
  // ── Formas Galar ───────────────────────────────────────────────────────────
  10158:"steel",                               // Meowth-Galar
  10159:"psychic",     10160:"psychic/fairy",  // Ponyta/Rapidash-Galar
  10161:"psychic",     10162:"poison/psychic", 10169:"poison/psychic", // Slowpoke/Slowbro/Slowking-Galar
  10163:"fighting",                            // Farfetch'd-Galar
  10164:"poison/fairy",                        // Weezing-Galar
  10165:"ice/psychic",                         // Mr. Mime-Galar
  10166:"psychic/flying",                      // Articuno-Galar
  10167:"fighting/flying",                     // Zapdos-Galar
  10168:"dark/flying",                         // Moltres-Galar
  10170:"ghost",                               // Corsola-Galar
  10171:"dark/normal", 10172:"dark/normal",   // Zigzagoon/Linoone-Galar
  10173:"ice",         10174:"ice",            // Darumaka/Darmanitan-Galar
  10175:"ground/ghost",                        // Yamask-Galar
  10176:"ground/steel",                        // Stunfisk-Galar
  // ── Formas Hisui ───────────────────────────────────────────────────────────
  10229:"fire/rock",   10230:"fire/rock",      // Growlithe/Arcanine-Hisui
  10231:"electric/grass",10232:"electric/grass",// Voltorb/Electrode-Hisui
  10233:"fire/ghost",                          // Typhlosion-Hisui
  10234:"dark/poison",                         // Qwilfish-Hisui
  10235:"fighting/poison",                     // Sneasel-Hisui
  10236:"water/dark",                          // Samurott-Hisui
  10237:"grass/fighting",                      // Lilligant-Hisui
  10238:"normal/ghost",10239:"normal/ghost",   // Zorua/Zoroark-Hisui
  10240:"psychic/flying",                      // Braviary-Hisui
  10241:"steel/dragon",10242:"steel/dragon",   // Sliggoo/Goodra-Hisui
  10243:"ice/rock",                            // Avalugg-Hisui
  10244:"grass/fighting",                      // Decidueye-Hisui
};

export function getPokemonElement(pokemonId: number): string {
  const raw = POKEMON_ELEMENT[pokemonId] ?? "normal";
  return raw.split("/")[0];
}

export function getPokemonTypes(pokemonId: number): string[] {
  const raw = POKEMON_ELEMENT[pokemonId] ?? "normal";
  return raw.split("/");
}

// Vantagens de tipo (atacante → defensores fracos)
export const TYPE_ADVANTAGE: Record<string, string[]> = {
  fire:     ["grass","ice","bug","steel"],
  water:    ["fire","ground","rock"],
  grass:    ["water","ground","rock"],
  electric: ["water","flying"],
  psychic:  ["fighting","poison"],
  ghost:    ["psychic","ghost"],
  dragon:   ["dragon"],
  fighting: ["normal","rock","ice","dark","steel"],
  ground:   ["fire","electric","poison","rock","steel"],
  rock:     ["fire","flying","bug","ice"],
  ice:      ["grass","ground","flying","dragon"],
  poison:   ["grass","fairy"],
  bug:      ["grass","psychic","dark"],
  normal:   [],
};

export function getTypeAdvantageMultiplier(attackerTypes: string | string[], defenderTypes: string | string[]): number {
  const atk = Array.isArray(attackerTypes) ? attackerTypes : [attackerTypes];
  const def = Array.isArray(defenderTypes) ? defenderTypes : [defenderTypes];
  for (const a of atk) {
    const strong = TYPE_ADVANTAGE[a] ?? [];
    if (def.some((d) => strong.includes(d))) return 1.3;
  }
  return 1.0;
}

// ── Explicações das personalidades ────────────────────────────────────────────
export const PERSONALITY_DESCRIPTION: Record<string, string> = {
  LOYAL:       "Leal ao treinador. Ganha mais felicidade com carinho e tende a criar amizades fortes.",
  PROUD:       "Orgulhoso. Reage mais a vitórias, derrotas e rivalidades; fica melhor quando já está feliz.",
  MISCHIEVOUS: "Travesso. Puxa provocações, rivalidades leves e eventos de peças sem bloquear demais.",
  LAZY:        "Preguiçoso. Cansa mais ao brincar, mas mascotes com boa Vitalidade lidam melhor com isso.",
  COMPETITIVE: "Competitivo. Brilha contra rivais e combina muito com Força alta e vitórias do treinador.",
  DRAMATIC:    "Dramático. Emoções mais fortes; quando está feliz ou confiante, rende melhor nos eventos.",
  PLAYFUL:     "Brincalhão. Brincar dá mais felicidade e cerca de 10% mais EXP.",
  ELECTRIC:    "Elétrico. Tem energia para brincar e expedições curtas, com menor chance de cansar.",
  TIMID:       "Tímido. Começa devagar no carinho, mas aprende a confiar e cria laços fortes.",
  CHAOTIC:     "Caótico. Pode gerar eventos raros e imprevisíveis, especialmente com Instinto alto.",
};

// ── Balão de diálogo ──────────────────────────────────────────────────────────

export interface MascotSpeechParams {
  // Campos originais (mantidos para compatibilidade)
  mood: string;
  happiness: number;
  personality: string;
  lastFedAt: Date | null;
  lastInteractedAt: Date | null;
  battleWins?: number;
  battleLosses?: number;
  recentTrainerWins?: number;
  // Novos campos (opcionais — já existem no objeto mascot, sem custo de egress)
  id?: string;
  isEquipped?: boolean;
  arenaState?: string;
  restingUntil?: Date | null;
  lastPlayedAt?: Date | null;
  lastPettedAt?: Date | null;
  level?: number;
  exp?: number;
  isShiny?: boolean;
  statForce?: number;
  statAgility?: number;
  statVitality?: number;
  statCharisma?: number;
  statInstinct?: number;
  combatRole?: string | null;
  relations?: { type: string }[];
}

function _strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function generateMascotSpeech(params: MascotSpeechParams): string {
  // Seed determinístico: varia por mascote e muda quando estado muda (sem Date.now() → sem hydration mismatch)
  const seed = Math.abs(
    _strHash(params.id ?? params.personality) ^
    (params.happiness * 13) ^
    ((params.battleWins ?? 0) * 7) ^
    ((params.battleLosses ?? 0) * 11) ^
    ((params.level ?? 1) * 17)
  );
  function pick(lines: string[]): string { return lines[seed % lines.length]; }

  const hunger = getHungerStatus(params.lastFedAt, params.isEquipped ?? true);
  const hoursAlone = params.lastInteractedAt
    ? (Date.now() - new Date(params.lastInteractedAt).getTime()) / 3_600_000 : 999;
  const hoursWithoutPet = params.lastPettedAt
    ? (Date.now() - new Date(params.lastPettedAt).getTime()) / 3_600_000 : 999;
  const hoursWithoutPlay = params.lastPlayedAt
    ? (Date.now() - new Date(params.lastPlayedAt).getTime()) / 3_600_000 : 999;
  const restingActive = params.restingUntil && new Date(params.restingUntil) > new Date();

  // ── Prioridade 1: Ferido ──────────────────────────────────────────────────
  if (params.arenaState === "INJURED") return pick([
    "Ainda estou doendo… 🤕",
    "Preciso de cuidado antes de voltar. 🩹",
    "Não foi só arranhão, tá? 😣",
    "Vou melhorar, mas agora preciso descansar. 😔",
    "Essa batalha me deixou quebrado. 💢",
  ]);

  // ── Prioridade 1b: Descansando ────────────────────────────────────────────
  if (params.arenaState === "RESTING" || restingActive) return pick([
    "Mais um pouco e estou de volta. 😴",
    "Estou recuperando energia. 💤",
    "Descanso também é estratégia. 🌙",
    "Não me acorda ainda. 🛌",
    "Estou juntando forças. ✨",
  ]);

  // ── Prioridade 2: Fome crítica ────────────────────────────────────────────
  if (hunger === "STARVING") return pick([
    "Por favor! Estou desmaiando de fome! 🍖",
    "Minha barriga está fazendo barulho de novo… 😩",
    "Se tiver um petisco sobrando, eu aceito agora. 🥺",
    "Estou tentando ser forte, mas a fome está vencendo. 😮‍💨",
    "Uma comidinha resolveria 90% dos meus problemas. 🍗",
    "Se eu cair, diga que foi fome. 💀",
    "Acho que meu estômago acabou de usar Rugido. 🐾",
    "Não estou dramático. Estou faminto mesmo. 😤",
    "Meu humor está preso dentro da geladeira. 🥶",
    "Eu lutaria melhor se tivesse comido alguma coisa. ⚔️",
  ]);

  // ── Prioridade 3: Felicidade muito baixa ─────────────────────────────────
  if (params.happiness <= 25) return pick([
    "Você ainda lembra de mim, né? 🥺",
    "Estou meio apagado hoje… 😔",
    "Acho que preciso de atenção. 💙",
    "Um carinho resolveria bastante coisa. 🫂",
    "Fiquei esperando você aparecer. 😞",
    "Queria me sentir mais parte do time. 😶",
    "Hoje eu não estou no meu melhor dia. 😟",
    "Não estou bravo, só meio esquecido. 👻",
    "Talvez eu precise de uma pausa. 🌧️",
    "Eu estava com saudade. 💛",
  ]);

  // ── Prioridade 4: Humores negativos ──────────────────────────────────────
  if (params.mood === "ANGRY") return pick([
    "Hoje eu estou sem paciência. 😤",
    "Não cutuca, que eu estou irritado. 🔥",
    "Meu olhar já deveria explicar tudo. 😠",
    "Se tiver combate, talvez eu desconte. ⚔️",
    "Estou bravo, mas ainda aceito comida. 🍗",
    "Tô procurando briga! Me manda pra uma batalha! 💢",
  ]);
  if (params.mood === "TIRED") return pick([
    "Estou cansado até para reclamar. 😴",
    "Preciso descansar um pouco. 💤",
    "Hoje meu ritmo está mais lento. 🐢",
    "Se der para evitar confusão, eu agradeço. 🙏",
    "Acho que gastei energia demais. 😮‍💨",
    "Cansadinho... só mais uns minutinhos... 😴",
  ]);
  if (hunger === "HUNGRY") return pick([
    "Minha barriga está comandando minhas decisões. 🍽️",
    "Tudo me lembra comida agora. 🍗",
    "Estou faminto e ficando dramático. 😩",
    "Prometo melhorar depois de comer. 🤝",
    "A fome está afetando minha pose. 😓",
    "Meu estômago tá roncando... tem comida? 😋",
  ]);
  if (params.mood === "NEEDY" || hoursAlone > 48) return pick([
    "Você pode ficar mais um pouco? 🥺",
    "Eu queria um carinho agora. 💛",
    "Não me deixa esquecido no card. 👻",
    "Estou precisando de atenção. 💙",
    "Prometo fazer pose se você cuidar de mim. 🐾",
    "Oi! Você tá aí? Estava com saudade! 👋",
    "Você sumiu! Estava com tanta saudade! 🥺",
  ]);

  // ── Prioridade 5: Arena e Rastros ─────────────────────────────────────────
  if (params.arenaState === "ARENA") return pick([
    "Estou em batalha agora! ⚔️",
    "Não posso conversar, estou no meio da ação. 🔥",
    "Depois da luta eu reclamo da fome. 😤",
    "Estou focado no combate. 🎯",
    "Torça por mim daqui! 📣",
  ]);
  if (params.arenaState === "TRACE_HIDING") return pick([
    "Fica quieto… estou escondido. 🤫",
    "Meu rastro está bem desenhado. 🗺️",
    "Será que alguém consegue me achar? 👁️",
    "Estou ouvindo passos por perto… 👂",
    "Se me acharem, finjo que era parte do plano. 😏",
  ]);
  if (params.arenaState === "TRACE_HUNTING") return pick([
    "Estou seguindo um rastro agora. 🔍",
    "Acho que vi uma pegada suspeita. 👣",
    "Se esse caminho for falso, eu vou reclamar. 😤",
    "Estou quase encontrando alguém. 🏃",
    "Meu instinto diz que tem coisa por aqui. 🐾",
  ]);

  // ── Prioridade 5b: Falta de carinho / brincadeira ────────────────────────
  if (hoursWithoutPet > 24 && (params.lastPettedAt !== undefined)) return pick([
    "Faz tempo que não recebo carinho… 🥺",
    "Um carinho resolveria bastante coisa. 💛",
    "Minha pelagem precisa de atenção. 🐾",
    "Carinho também é treino, sabia? 💙",
  ]);
  if (hoursWithoutPlay > 48 && (params.lastPlayedAt !== undefined)) return pick([
    "Tô com vontade de brincar! 🎮",
    "Faz tempo que não a gente não brinca juntos. 🎯",
    "Brincaaa! Vamos jogar! 🎮",
    "Estou com energia sobrando aqui. ⚡",
  ]);

  // ── Prioridade 6: Quase subindo de nível ─────────────────────────────────
  const expNeeded = expToNextLevel(params.level ?? 1);
  if (expNeeded > 0 && (params.exp ?? 0) / expNeeded >= 0.85) return pick([
    "Estou quase ficando mais forte! 💪",
    "Falta pouco para eu subir de nível. ⭐",
    "Dá para sentir o próximo nível chegando. 🌟",
    "Treina comigo, estou quase lá. 🏋️",
    "Meu próximo nível está logo ali. 🚀",
  ]);

  // ── Prioridade 7: Vitórias e derrotas ────────────────────────────────────
  const wins = params.battleWins ?? 0;
  const losses = params.battleLosses ?? 0;
  if (losses >= 2 && losses > wins) return pick([
    "Preciso treinar mais… 💪",
    "A última derrota ainda está na cabeça. 😔",
    "Não gostei daquele resultado. 😤",
    "Na próxima eu vou melhor. 🔥",
    "Perder faz parte, mas eu não gostei. 😣",
    "Acho que preciso de um plano novo. 🧠",
    "Não estou numa fase boa. 📉",
    "Essa sequência está me incomodando. 😒",
  ]);
  if (wins > 3) return pick([
    `Já venci ${wins} batalhas! Respeita! ⚔️`,
    "Já venci algumas batalhas. Só dizendo. 😎",
    "Minha sequência está ficando bonita. 🏆",
    "Vitória combina comigo. 🥇",
    "Eu tenho histórico de respeito. ⚔️",
    "Se precisar de experiência, chama. 💪",
  ]);

  // ── Prioridade 8: Relações sociais ───────────────────────────────────────
  const hasRival  = params.relations?.some(r => r.type === "RIVAL");
  const hasFriend = params.relations?.some(r => r.type === "FRIEND");
  if (hasRival) return pick([
    "Meu rival vai me pagar. 😤",
    "Se meu rival aparecer, eu quero entrar. ⚔️",
    "Ainda não esqueci aquela disputa. 🔥",
    "Hoje eu queria uma revanche. 💢",
    "Rivalidade também é motivação. 💪",
  ]);
  if (hasFriend) return pick([
    "Sinto falta do meu amigo. 💛",
    "Com meu amigo por perto, eu jogo melhor. 🤝",
    "Será que meu parceiro aparece hoje? 👀",
    "Lutar junto de amigo é mais divertido. ⚔️",
    "A gente se entende até sem falar. 🫂",
  ]);

  // ── Prioridade 9: Postura de combate ─────────────────────────────────────
  const combatRolePhrases: Record<string, string[]> = {
    ATTACKER:    ["Me coloca para atacar e eu resolvo. 💥","Meu lugar é pressionando o adversário. 🔥","Se abrir espaço, eu avanço. ⚔️","Hoje eu quero causar dano. 💢","Atacar primeiro parece um bom plano. 🎯"],
    DEFENDER:    ["Pode deixar que eu seguro a linha. 🛡️","Se vier ataque, eu entro na frente. 💪","Proteger o time também ganha combate. 🤝","Eu aguento a pressão. 😤","Enquanto eu estiver de pé, o time respira. 🫂"],
    FLANK:       ["Eu prefiro pegar pelo lado. 🐾","Defesa demais só me dá vontade de contornar. 😏","Se piscarem, eu chego no alvo frágil. 🎯","Meu caminho nunca é o óbvio. 🌀","Eu gosto de aparecer onde não esperam. 👻"],
    ENCOURAGER:  ["Meu time luta melhor quando eu estou junto. 📣","Eu não bato mais forte, eu faço todos baterem melhor. ⭐","Hoje eu vou levantar o moral do time. 🔥","Um bom incentivo muda a luta. 💪","Se o time acreditar, já começa ganhando. 🏆"],
    OPPORTUNIST: ["Eu espero o erro certo. 👁️","Toda fraqueza deixa uma pista. 🔍","Se alguém vacilar, eu aproveito. 😏","Eu não preciso bater primeiro. Só preciso bater na hora certa. ⚔️","O adversário sempre entrega alguma coisa. 🎭"],
    GUARDIAN:    ["Eu já escolhi quem vou proteger. 🛡️","Se tentarem passar, vão ter que lidar comigo. 💢","Meu foco é manter alguém de pé. 🤝","Proteção bem feita muda combate. 💪","Eu seguro o perigo longe do alvo. 🔒"],
    DUELIST:     ["Um alvo por vez. Do meu jeito. 🎯","Se for duelo, eu não recuo. ⚔️","Eu gosto de resolver no mano a mano. 👊","Escolhi meu alvo e vou até o fim. 🔥","Duelar é questão de orgulho. 😤"],
    SABOTEUR:    ["Eu adoro atrapalhar plano bonito. 😈","Se o inimigo depender de buff, melhor ainda. 😏","Vou mexer onde mais incomoda. 🌀","Estratégia deles? Vamos desmontar. 💥","Nada como causar um pequeno caos. 🎭"],
    HEALER:      ["Eu fico de olho em quem precisa. 💙","Nem toda vitória vem de dano. 🌿","Se alguém cair demais, eu ajudo. 🩹","Cuidar do time também é estratégia. 🤝","Eu prefiro manter todo mundo lutando. 💪"],
    SCOUT:       ["Eu observo antes de agir. 👁️","Alvo errado é desperdício. 🎯","Vou achar o melhor caminho. 🗺️","Informação também vence batalha. 🧠","Eu vejo detalhe onde os outros veem confusão. 🔍"],
    PROVOKER:    ["Se eu irritar o adversário, já comecei bem. 😏","Às vezes, a melhor defesa é uma boa provocação. 🎭","Eu consigo chamar atenção sem levantar a voz. 👀","O alvo certo é aquele que perde a paciência. 😤","Confusão bem feita parece estratégia. 🌀"],
    SPECIALIST:  ["Meu melhor atributo vai resolver isso. 💥","Eu sei exatamente no que sou bom. 🎯","Não preciso fazer tudo. Só fazer bem feito. ✅","Especialista não improvisa. Executa. 🔥","Meu ponto forte é forte por um motivo. 💪"],
    SURVIVOR:    ["Enquanto eu respirar, ainda tem jogo. 💪","Eu sou difícil de finalizar. 🛡️","Vida baixa não significa fim. 🔥","Quanto pior fica, mais eu insisto. 😤","Eu já sobrevivi a coisa pior. ⭐"],
  };
  if (params.combatRole && combatRolePhrases[params.combatRole]) {
    return pick(combatRolePhrases[params.combatRole]);
  }

  // ── Prioridade 10: Stat mais alto ─────────────────────────────────────────
  const stats = {
    statForce:    params.statForce    ?? 0,
    statAgility:  params.statAgility  ?? 0,
    statVitality: params.statVitality ?? 0,
    statCharisma: params.statCharisma ?? 0,
    statInstinct: params.statInstinct ?? 0,
  };
  const maxStat = Math.max(...Object.values(stats));
  if (maxStat >= 14) {
    const highestKey = (Object.keys(stats) as (keyof typeof stats)[]).find(k => stats[k] === maxStat);
    const statPhrases: Partial<Record<keyof typeof stats, string[]>> = {
      statForce:    ["Minha Força está pedindo combate. 💪","Hoje eu estou batendo pesado. 🥊","Dá para resolver muita coisa com força. 💥","Minha pancada está calibrada. 🔥","Força alta, paciência baixa. 😤"],
      statAgility:  ["Pisca e eu já mudei de lugar. ⚡","Hoje ninguém acompanha meu ritmo. 🏃","Meu rastro deve ser difícil de seguir. 🐾","Desviar também é uma arte. 🌀","Eu não fujo. Eu reposiciono com estilo. 😏"],
      statVitality: ["Pode demorar. Eu aguento. 💪","Eu sou difícil de derrubar. 🛡️","Se a luta for longa, melhor para mim. ⚔️","Hoje estou firme como muralha. 🏔️","Meu plano é simples: continuar de pé. 😤"],
      statCharisma: ["Meu charme também conta como estratégia. 😎","Carisma alto, pose impecável. 🌟","Tem batalha que começa no olhar. 👁️","O time luta melhor quando eu estou por perto. 📣","Não é só poder. É presença. 💫"],
      statInstinct: ["Estou sentindo que tem algo acontecendo. 🔮","Meu Instinto diz que hoje vem surpresa. 👁️","Eu percebo detalhes que os outros ignoram. 🧠","Se tiver armadilha, eu vou desconfiar primeiro. 🐾","Eu não sei explicar, mas eu sei. ✨"],
    };
    if (highestKey && statPhrases[highestKey]) return pick(statPhrases[highestKey]!);
  }

  // ── Prioridade 11: Shiny e nível ──────────────────────────────────────────
  if (params.isShiny) return pick([
    "Eu brilho até quando estou parado. ✨",
    "Não é sujeira, é brilho especial. 💎",
    "Ser brilhante dá trabalho. 🌟",
    "Meu brilho merece atenção. 💫",
    "Hoje eu estou reluzente. ✨",
  ]);
  const lv = params.level ?? 1;
  if (lv >= 20) return pick([
    "Experiência não falta por aqui. 🏆",
    "Meu nível fala por mim. ⭐",
    "Eu não cheguei até aqui por sorte. 💪",
    "Se precisar de veterano, estou aqui. 🎖️",
    "Nível alto, responsabilidade alta. 😤",
  ]);
  if (lv <= 3) return pick([
    "Ainda sou pequeno, mas tenho potencial. 🌱",
    "Estou aprendendo do meu jeito. 📚",
    "Todo campeão começou de algum lugar. ⭐",
    "Me dá tempo que eu cresço. 🚀",
    "Ainda estou pegando o ritmo. 🐣",
  ]);

  // ── Prioridade 12: Fome leve, felicidade alta, humores positivos, personalidade ──

  if (hunger === "NEUTRAL") return pick([
    "Estou bem, mas um petisco cairia muito bem. 🍗",
    "Não estou faminto, só estrategicamente interessado em comida. 😏",
    "Comida agora seria um bônus de felicidade. 😊",
    "Será que petisco conta como preparação de batalha? 🤔",
    "Hoje eu aceitaria um lanchinho sem reclamar. 😌",
    "Estou normal, mas meu estômago discorda um pouco. 😅",
  ]);

  if (params.happiness >= 80) return pick([
    "Hoje eu estou me sentindo incrível! 🌟",
    "Fico feliz quando você lembra de mim. 💛",
    "Estou pronto para qualquer aventura! 🚀",
    "A felicidade está no máximo e a pose também. 😎",
    "Hoje eu ganho até no carisma. ✨",
    "Eu gosto quando fico por aqui com você. 🥰",
    "Estou feliz o suficiente para dividir petisco. Talvez. 🍗",
    "Hoje tudo parece dar certo. 🌈",
    "Estou muito feliz hoje! Obrigado por cuidar de mim! 💛",
    "Meu card está até mais bonito hoje. 💫",
  ]);

  const moodPhrases: Record<string, string[]> = {
    HAPPY:       ["Estou de ótimo humor hoje! 😄","Hoje até o treino parece divertido. 🏋️","Pode chamar, estou pronto. ⚡","Acho que hoje eu brilho mais. 🌟","Feliz, alimentado e perigoso. 😎"],
    EXCITED:     ["Vamos fazer alguma coisa agora! 🚀","Estou elétrico de animação! ⚡","Não consigo ficar parado. 🏃","Se tiver aventura, eu vou primeiro. 🎯","Hoje eu acordei em modo evento. 🎉","Que energia! Bora jogar! ⚡"],
    COMPETITIVE: ["Quero ver quem vai me parar. 😤","Hoje eu quero provar um ponto. 💪","Me coloca contra alguém forte. ⚔️","Não vim aqui para ficar bonito no card. 🔥","Desafio aceito antes mesmo de ser feito. 😎","Quando é a próxima batalha? 😤"],
    PROUD:       ["Eu sei que estou indo bem. 😎","Pode admitir, eu estou impressionante. 👑","Meu histórico fala por mim. 🏆","Estou orgulhoso do meu desempenho. 💪","Hoje eu caminho como campeão. 🥇","Sou o melhor mascote! 😎"],
    CONFIDENT:   ["Confia em mim. Eu confio em mim também. 💪","Hoje ninguém segura esse time. 🔥","Estou com postura de campeão. 👑","Meu olhar diz tudo: eu estou pronto. 😏","Se tiver combate, eu quero participar. ⚔️","Me sinto no topo do mundo! Ninguém me para! 💪"],
    NEUTRAL:     ["Estou observando tudo por aqui. 👁️","Nada suspeito acontecendo. Ainda. 😐","Se precisar, é só me chamar. 🤝","Hoje parece um dia normal. 😌","Estou quieto, mas atento. 🐾"],
    HUNGRY:      ["Minha barriga está comandando minhas decisões. 🍽️","Tudo me lembra comida agora. 🍗","Prometo melhorar depois de comer. 🤝","A fome está afetando minha pose. 😓"],
  };
  if (moodPhrases[params.mood]) return pick(moodPhrases[params.mood]);

  const personalityLines: Record<string, string[]> = {
    COMPETITIVE: ["Se tiver ranking, eu quero subir. 📊","Competir me deixa acordado. ⚡","Hoje eu quero resultado. 🏆"],
    LAZY:        ["Dá para vencer deitado? 😴","Eu ajudo… depois de um cochilo. 🛋️","A pressa é inimiga do descanso. 😌","...zzz... me deixa... 😴"],
    MISCHIEVOUS: ["Prometo não aprontar. Muito. 😈","Tenho uma ideia. Talvez péssima. 🤔","Se algo sumir, não fui eu. 🤫","Vamos aprontar alguma! 😈"],
    DRAMATIC:    ["Ninguém entende a profundidade da minha fome. 🎭","Se eu perder, será uma tragédia em três atos. 😩","Meu sofrimento merece trilha sonora. 🎵","Cada dia é uma história nova! ✨"],
    PLAYFUL:     ["Vamos brincar antes de lutar? 🎮","Se virar jogo, eu participo. 🎯","Tudo fica melhor com bagunça. 🌀","Brincaaa! Vamos jogar! 🎮"],
    ELECTRIC:    ["Estou ligado no 220. ⚡","Energia não falta. 🔋","Acho que soltei faísca. ⚡","Carregado de energia! ⚡"],
    TIMID:       ["Eu posso tentar… se você quiser. 🌸","Não gosto de muita atenção. 👀","Vou fazer meu melhor, baixinho. 🤫","*olha timidamente* ...oi... 👀"],
    CHAOTIC:     ["Tenho um plano. Ele muda a cada segundo. 🌀","A ordem é superestimada. 💥","Se der errado, pelo menos foi divertido. 😅","BOOOM! 💥"],
    LOYAL:       ["Eu fico do seu lado. 🤝","Se você chamar, eu venho. 💪","Time bom é time junto. 🫂","Sempre estarei do seu lado! 🤝"],
    PROUD:       ["Eu tenho uma reputação a manter. 👑","Minha pose não é por acaso. 😎","Orgulho também treina. 💪","Ninguém tem mais classe que eu! 👑"],
  };
  if (personalityLines[params.personality]) return pick(personalityLines[params.personality]);

  // ── Prioridade 13: Genérica ───────────────────────────────────────────────
  return pick([
    "Estou esperando sua próxima decisão. 🤔",
    "Será que hoje tem aventura? 🌟",
    "Me deixa no time certo e eu resolvo. 💪",
    "Nada suspeito acontecendo. Ainda. 😐",
    "Eu estava quieto, mas atento. 👁️",
    "Acho que alguém olhou para meu card. 👀",
    "Hoje parece um bom dia para fazer alguma coisa. ✨",
    "Se precisar, é só me chamar. 🤝",
    "Estou pronto para o que vier. 🎯",
    "Só não esquece de cuidar de mim depois. 💛",
  ]);
}


// ── Pool de lendários (todos os gens) — aparece com raridade muito baixa ──────
export const LEGENDARY_POOL: number[] = [
  // Gen 1
  144, 145, 146, 150, 151,           // Articuno, Zapdos, Moltres, Mewtwo, Mew
  // Gen 2
  243, 244, 245, 249, 250, 251,      // Raikou, Entei, Suicune, Lugia, Ho-Oh, Celebi
  // Gen 3
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  // Gen 4
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494,
  // Gen 5
  638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
  // Gen 6
  716, 717, 718, 719, 720, 721,
  // Gen 7
  785, 786, 787, 788, 789, 790, 791, 792, 800, 801, 802, 807, 808, 809,
  // Gen 8
  888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 905,
  // Gen 9
  1001, 1002, 1003, 1004, 1007, 1008,
  // Formas especiais lendárias (IDs PokeAPI)
  10006, 10007,  // Shaymin-Sky, Giratina-Origin
  10166, 10167, 10168, // Articuno/Zapdos/Moltres-Galar
];

export const LEGENDARY_HATCH_BASE_OVERRIDES: Record<number, number> = {
  809: 808, // Melmetal e evolucao do Meltan; ovos nunca chocam Melmetal direto.
};

export const ULTRA_BEAST_IDS = new Set([
  793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806,
]);

export const MYTHICAL_IDS = new Set([
  151, 251, 385, 386, 489, 490, 491, 492, 493, 494, 647, 648, 649,
  719, 720, 721, 801, 802, 807, 808, 809, 893,
  // 1001–1004 são Sub-Lendários (Treasures of Ruin), não Míticos — ficam só em LEGENDARY_POOL
  1025, // Pecharunt — Mítico de distribuição de evento
]);

export type MascotRarity = "LEGENDARY" | "MYTHICAL" | "ULTRA_BEAST" | "PSEUDO_LEGENDARY" | "PARADOX" | "COMMON";

export function getMascotRarity(pokemonId: number): MascotRarity {
  if (MYTHICAL_IDS.has(pokemonId)) return "MYTHICAL";
  if (ULTRA_BEAST_IDS.has(pokemonId)) return "ULTRA_BEAST";
  if (LEGENDARY_POOL.includes(pokemonId) && !MYTHICAL_IDS.has(pokemonId) && !ULTRA_BEAST_IDS.has(pokemonId)) return "LEGENDARY";
  if (PSEUDO_LEGENDARY_LINE_IDS.has(pokemonId)) return "PSEUDO_LEGENDARY";
  if (PARADOX_IDS.has(pokemonId)) return "PARADOX";
  return "COMMON";
}

export const RARITY_LABEL: Record<MascotRarity, string> = {
  LEGENDARY: "Lendário",
  MYTHICAL: "Mítico",
  ULTRA_BEAST: "Ultra Besta",
  PSEUDO_LEGENDARY: "Pseudo-Lendário",
  PARADOX: "Paradoxal",
  COMMON: "",
};

export const RARITY_COLOR: Record<MascotRarity, string> = {
  LEGENDARY: "border-yellow-400/50 bg-yellow-400/10 text-yellow-300",
  MYTHICAL: "border-pink-400/50 bg-pink-400/10 text-pink-300",
  ULTRA_BEAST: "border-purple-400/50 bg-purple-400/10 text-purple-300",
  PSEUDO_LEGENDARY: "border-cyan-400/50 bg-cyan-400/10 text-cyan-300",
  PARADOX: "border-violet-400/50 bg-violet-400/10 text-violet-300",
  COMMON: "",
};

const EXTRA_LEGENDARY_AND_MYTHICAL_IDS = [
  // Gen 7 Ultra Beasts / Poipole line (classificados como UB, mas recebem bônus de lendário)
  793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806,
  // Gen 9 DLC — verdadeiros Lendários e Míticos
  1014, 1015, 1016, // Okidogi, Munkidori, Fezandipiti (Loyal Three)
  1017,             // Ogerpon
  1024,             // Terapagos
  1025,             // Pecharunt (Mítico — também está em MYTHICAL_IDS)
  // 1009, 1010, 1020–1023 são Paradoxos de Raid — movidos para PARADOX_IDS
];

for (const pokemonId of EXTRA_LEGENDARY_AND_MYTHICAL_IDS) {
  if (!LEGENDARY_POOL.includes(pokemonId)) LEGENDARY_POOL.push(pokemonId);
}

const uniquePokemonIds = (ids: number[]) => Array.from(new Set(ids)).filter((id) => Number.isInteger(id) && id >= 1);

const ALL_STANDARD_POKEMON_IDS = uniquePokemonIds(
  Array.from({ length: 1025 }, (_, index) => index + 1)
).filter((pokemonId) => !LEGENDARY_POOL.includes(pokemonId));

const ALL_STARTER_IDS = [
  1, 4, 7, 152, 155, 158, 252, 255, 258, 387, 390, 393, 495, 498, 501,
  650, 653, 656, 722, 725, 728, 810, 813, 816, 906, 909, 912,
];

const RARE_FAN_FAVORITES = [
  25, 37, 58, 63, 66, 92, 95, 123, 124, 125, 126, 127, 128, 129, 131,
  132, 133, 147, 172, 175, 179, 196, 197, 200, 207, 215, 216, 227, 246,
  280, 302, 303, 304, 311, 312, 315, 333, 349, 359, 361, 371, 374, 403,
  408, 410, 425, 427, 433, 443, 446, 447, 448, 459, 479, 517, 529, 531,
  551, 570, 587, 595, 607, 610, 613, 624, 633, 636, 661, 667, 674, 677,
  679, 696, 698, 700, 701, 702, 704, 708, 714, 744, 747, 757, 759, 769,
  778, 782, 810, 813, 816, 821, 827, 835, 840, 848, 854, 856, 859, 868,
  872, 877, 878, 885, 921, 924, 926, 928, 935, 938, 942, 944, 957, 963,
  971, 974, 996, 999, 1011, 1012,
];

const SPECIAL_COVETED_IDS = [
  129, 131, 132, 133, 137, 138, 140, 143, 147, 215, 227, 233, 236, 241,
  246, 280, 302, 303, 349, 352, 359, 371, 374, 408, 410, 425, 442, 443,
  446, 447, 448, 479, 531, 570, 587, 610, 621, 624, 633, 636, 674, 679,
  696, 698, 700, 701, 704, 707, 714, 744, 746, 747, 757, 769, 778, 782,
  808, 840, 848, 854, 856, 859, 870, 871, 872, 874, 875, 877, 878, 885,
  // Paradox / especiais de Paldea que nao entram no pool comum.
  984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 1005, 1006,
  935, 942, 963, 967, 971, 974, 977, 996, 999, 1011, 1012,
];

// ── Filtros finais nos pools ──────────────────────────────────────────────────
// Predicado único: exclui lendários, evoluídos (level-up + pedra/troca/amizade)
const isBaseForm = (id: number) =>
  !LEGENDARY_POOL.includes(id) && !ALL_EVOLVED_IDS.has(id) && !MEGA_FORM_IDS.has(id);

const addMissingBaseFormsToGenerationPools = () => {
  const generationRanges: Record<string, [number, number]> = {
    EGG_GEN1: [1, 151],
    EGG_GEN2: [152, 251],
    EGG_GEN3: [252, 386],
    EGG_GEN4: [387, 493],
    EGG_GEN5: [494, 649],
    EGG_GEN6: [650, 721],
    EGG_GEN7: [722, 809],
    EGG_GEN8: [810, 905],
    EGG_GEN9: [906, 1025],
  };

  for (const [key, [start, end]] of Object.entries(generationRanges)) {
    const existing = EGG_POOLS[key] ?? [];
    const baseForms = Array.from({ length: end - start + 1 }, (_, index) => start + index)
      .filter(isBaseForm);
    EGG_POOLS[key] = uniquePokemonIds([...existing, ...baseForms]).filter(isBaseForm);
  }
};

// COMMON e RANDOM: apenas formas base das gerações curadas (não usa ALL_STANDARD 1-1025)
// A listagem manual nos pools EGG_GEN1-9 garante controle sobre o que entra
EGG_POOLS.RARE = uniquePokemonIds([...ALL_STARTER_IDS, ...RARE_FAN_FAVORITES])
  .filter(isBaseForm);
EGG_POOLS.SPECIAL = uniquePokemonIds([...SPECIAL_COVETED_IDS, ...RARE_FAN_FAVORITES])
  .filter(isBaseForm);

addMissingBaseFormsToGenerationPools();

// Reaplica filtro completo em TODOS os pools de geração
for (const key of Object.keys(EGG_POOLS)) {
  if (key !== "RANDOM") {
    EGG_POOLS[key] = EGG_POOLS[key].filter(isBaseForm);
  }
}

// RANDOM = união de todos os pools de geração após filtragem
EGG_POOLS.RANDOM = [
  ...EGG_POOLS.EGG_GEN1, ...EGG_POOLS.EGG_GEN2,
  ...EGG_POOLS.EGG_GEN3, ...EGG_POOLS.EGG_GEN4, ...EGG_POOLS.EGG_GEN5,
  ...EGG_POOLS.EGG_GEN6, ...EGG_POOLS.EGG_GEN7, ...EGG_POOLS.EGG_GEN8, ...EGG_POOLS.EGG_GEN9,
  ...EGG_POOLS.EGG_ALOLA, ...EGG_POOLS.EGG_GALAR, ...EGG_POOLS.EGG_HISUI,
];
EGG_POOLS.RANDOM = uniquePokemonIds(EGG_POOLS.RANDOM).filter(isBaseForm);

// Ovo comum sem geração específica deve representar o pool aleatório completo.
EGG_POOLS.COMMON = uniquePokemonIds(EGG_POOLS.RANDOM).filter(isBaseForm);

export const WISHLIST_POKEMON_IDS = Array.from({ length: 1025 }, (_, index) => index + 1);

export function getWishlistPokemonOptions() {
  return WISHLIST_POKEMON_IDS.map((id) => ({
    id,
    name: getPokemonName(id),
  }));
}
