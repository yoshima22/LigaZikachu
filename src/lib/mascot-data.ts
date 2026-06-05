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
    369, 370, 371, 374, 387, // Bagon, Beldum
  ],

  // Gen 4 (Sinnoh) — formas iniciais selecionadas
  EGG_GEN4: [
    387, 390, 393,       // Starters: Turtwig, Chimchar, Piplup
    396, 399, 401, 403, 406, 408, 410, 412, 415, 417, 418, 420, 422,
    424, 425, 427, 429, 430, 431, 433, 434, 436, 438, 439, 440, 441,
    442, 443, 446, 447, 449, 451, 453, 455, 456, 458, 459, 461, 479,
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

  // Gen 7 (Alola)
  EGG_GEN7: [
    722, 725, 728,  // Starters Alola
    731, 734, 736, 739, 742, 744, 746, 747, 749, 751, 753, 755, 757,
    759, 761, 767, 769, 777, 781, 782,
  ],

  // Gen 8 (Galar)
  EGG_GEN8: [
    810, 813, 816,  // Starters Galar
    819, 821, 824, 827, 829, 831, 833, 835, 837, 840, 843, 845, 846,
    848, 850, 852, 854, 856, 861, 868, 870, 871, 872, 874, 875, 877,
    878, 885,
  ],

  // Gen 9 (Paldea)
  EGG_GEN9: [
    906, 909, 912,  // Starters Paldea
    915, 917, 919, 921, 924, 926, 928, 931, 932, 935, 938, 940,
    942, 944, 946, 948, 950, 952, 954, 956, 958, 961, 963, 965,
    967, 968, 969, 971, 973, 977, 978, 996,
  ],

  // Pool aleatório — inclui todos os gens, garante diversidade
  RANDOM: [] as number[], // preenchido abaixo após todas as definições

  // Gen 6+ legacy alias (mantido para compatibilidade)
  EGG_GEN6PLUS: [
    650, 653, 656,       // Starters Kalos
    661, 664, 667, 669, 672, 674, 676, 677, 679, 681, 682, 684, 686,
    688, 690, 692, 694, 696, 698, 700, 701, 703, 704, 707, 708, 710,
    712, 714, 716, 720,
    // Alola
    722, 725, 728, 731, 734, 736, 739, 742, 744, 746, 747, 749, 751,
    753, 755, 757, 759, 761, 764, 765, 766, 767, 769, 771, 774, 775,
    778, 781, 782, 785, 786, 787, 788,
    // Galar
    810, 813, 816, 819, 821, 824, 827, 829, 831, 833, 835, 837, 840,
    842, 843, 845, 846, 848, 850, 852, 854, 856, 858, 860, 861, 862,
    863, 864, 865, 866, 867, 868, 869, 870, 871, 872, 874, 875, 876,
    877, 878, 880, 881, 882, 883, 884, 885, 886, 887,
  ],
};

// Preenche pool aleatório com todos os gens (sem lendários)
EGG_POOLS.RANDOM = [
  ...EGG_POOLS.EGG_GEN1, ...EGG_POOLS.EGG_GEN2,
  ...EGG_POOLS.EGG_GEN3, ...EGG_POOLS.EGG_GEN4, ...EGG_POOLS.EGG_GEN5,
  ...EGG_POOLS.EGG_GEN6, ...EGG_POOLS.EGG_GEN7, ...EGG_POOLS.EGG_GEN8, ...EGG_POOLS.EGG_GEN9,
];

// ── Evoluções por nível ───────────────────────────────────────────────────────
// Formato: { de: pokemonId, para: pokemonId, nivel: number }

export interface Evolution {
  from: number;
  to: number;
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
  { from: 43,  to: 44,  level: 21 }, { from: 44,  to: 45,  level: 36 },
  { from: 46,  to: 47,  level: 24 },
  { from: 48,  to: 49,  level: 31 },
  { from: 50,  to: 51,  level: 26 },
  { from: 52,  to: 53,  level: 28 },
  { from: 54,  to: 55,  level: 33 },
  { from: 56,  to: 57,  level: 28 },
  { from: 58,  to: 59,  level: 36 },
  { from: 60,  to: 61,  level: 25 }, { from: 61,  to: 62,  level: 36 },
  { from: 63,  to: 64,  level: 16 }, { from: 64,  to: 65,  level: 36 },
  { from: 66,  to: 67,  level: 28 }, { from: 67,  to: 68,  level: 36 },
  { from: 69,  to: 70,  level: 21 }, { from: 70,  to: 71,  level: 36 },
  { from: 72,  to: 73,  level: 30 },
  { from: 74,  to: 75,  level: 25 }, { from: 75,  to: 76,  level: 36 },
  { from: 77,  to: 78,  level: 40 },
  { from: 79,  to: 80,  level: 37 },
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
  { from: 133, to: 134, level: 30 }, // Eevee → Vaporeon (simplificado por nível)
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
  { from: 265, to: 266, level: 7  }, { from: 266, to: 267, level: 10 },
  { from: 270, to: 271, level: 14 }, { from: 271, to: 272, level: 30 },
  { from: 273, to: 274, level: 14 }, { from: 274, to: 275, level: 30 },
  { from: 276, to: 277, level: 22 },
  { from: 278, to: 279, level: 25 },
  { from: 280, to: 281, level: 20 }, { from: 281, to: 282, level: 30 },
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
  { from: 353, to: 354, level: 37 },
  { from: 355, to: 356, level: 37 },
  { from: 361, to: 362, level: 42 },
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
  { from: 408, to: 409, level: 30 },
  { from: 410, to: 411, level: 30 },
  { from: 418, to: 419, level: 26 },
  { from: 420, to: 421, level: 25 },
  { from: 425, to: 426, level: 28 },
  { from: 427, to: 428, level: 32 },
  { from: 431, to: 432, level: 38 },
  { from: 434, to: 435, level: 34 },
  { from: 436, to: 437, level: 33 },
  { from: 443, to: 444, level: 24 }, { from: 444, to: 445, level: 48 },
  { from: 447, to: 448, level: 20 },
  { from: 449, to: 450, level: 34 },
  { from: 451, to: 452, level: 40 },
  { from: 453, to: 454, level: 37 },
  { from: 456, to: 457, level: 31 },
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
  { from: 624, to: 625, level: 52 },
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
  { from: 744, to: 745, level: 25 },
  { from: 747, to: 748, level: 38 },
  { from: 749, to: 750, level: 30 },
  { from: 751, to: 752, level: 22 },
  { from: 753, to: 754, level: 34 },
  { from: 755, to: 756, level: 24 },
  { from: 757, to: 758, level: 33 },
  { from: 759, to: 760, level: 27 },
  { from: 761, to: 762, level: 18 }, { from: 762, to: 763, level: 29 },
  { from: 782, to: 783, level: 35 }, { from: 783, to: 784, level: 45 },
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
  { from: 850, to: 851, level: 28 },
  { from: 852, to: 853, level: 35 },
  { from: 856, to: 857, level: 29 }, { from: 857, to: 858, level: 42 },
  { from: 859, to: 860, level: 32 }, { from: 860, to: 861, level: 42 },
  { from: 872, to: 873, level: 30 },
  { from: 878, to: 879, level: 34 },
  { from: 885, to: 886, level: 30 }, { from: 886, to: 887, level: 50 },
  // Gen 9
  { from: 906, to: 907, level: 16 }, { from: 907, to: 908, level: 36 },
  { from: 909, to: 910, level: 16 }, { from: 910, to: 911, level: 36 },
  { from: 912, to: 913, level: 16 }, { from: 913, to: 914, level: 36 },
  { from: 915, to: 916, level: 18 },
  { from: 919, to: 920, level: 30 },
  { from: 921, to: 922, level: 18 }, { from: 922, to: 923, level: 32 },
  { from: 924, to: 925, level: 25 },
  { from: 926, to: 927, level: 26 },
  { from: 928, to: 929, level: 25 }, { from: 929, to: 930, level: 35 },
  { from: 932, to: 933, level: 24 }, { from: 933, to: 934, level: 38 },
  { from: 935, to: 936, level: 30 },
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
  { from: 965, to: 966, level: 40 },
  { from: 969, to: 970, level: 35 },
  { from: 971, to: 972, level: 30 },
  { from: 974, to: 975, level: 30 },
  { from: 996, to: 997, level: 35 }, { from: 997, to: 998, level: 54 },
];

// Mapa de acesso rápido: pokemonId → evolução
export const EVOLUTION_MAP = new Map<number, Evolution>(
  EVOLUTIONS.map(e => [e.from, e])
);

// ── EXP necessária por nível ──────────────────────────────────────────────────
// Curva linear suave: jogável mesmo nos níveis altos.
// Nível 1→2: 120 EXP | Nível 50→51: 1.100 EXP | Nível 100→101: 2.100 EXP
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

export function getHungerStatus(lastFedAt: Date | null): HungerStatus {
  const hours = lastFedAt ? (Date.now() - new Date(lastFedAt).getTime()) / 3_600_000 : 999;
  if (hours < 2)  return "STUFFED";
  if (hours < 6)  return "SATISFIED";
  if (hours < 12) return "NEUTRAL";
  if (hours < 24) return "HUNGRY";
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
  "30min": { ms: 30 * 60 * 1000,      label: "30 minutos", expMultiplier: 0.5,  rewardBonus: 0 },
  "1h":    { ms: 60 * 60 * 1000,      label: "1 hora",     expMultiplier: 1.0,  rewardBonus: 5 },
  "3h":    { ms: 3 * 60 * 60 * 1000,  label: "3 horas",    expMultiplier: 2.5,  rewardBonus: 15 },
  "6h":    { ms: 6 * 60 * 60 * 1000,  label: "6 horas",    expMultiplier: 5.0,  rewardBonus: 30 },
} as const;
export type ExpeditionDuration = keyof typeof EXPEDITION_DURATIONS;

// Expedição de treinamento (foco em EXP — sem itens/coins)
// Multiplicadores de EXP muito maiores que o padrão
export const TRAINING_EXP_MULT: Record<ExpeditionDuration, number> = {
  "30min": 4,   // 4× EXP base
  "1h":    8,   // 8×
  "3h":    20,  // 20×
  "6h":    40,  // 40×
};

export type ExpeditionMode = "STANDARD" | "TRAINING";

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

export function getSpriteUrl(pokemonId: number, animated = false): string {
  if (animated) {
    // GIF animado — existe para gen 1-5 (IDs 1-649)
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pokemonId}.gif`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

// URL do sprite estático (fallback quando GIF não existe)
export function getStaticSpriteUrl(pokemonId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
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
  848:"Toxel",849:"Toxtricity",
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
  1011:"Dipplin",1012:"Poltchageist",1013:"Sinistcha",
  1017:"Ogerpon",1020:"Gouging Fire",1021:"Raging Bolt",
  1022:"Iron Boulder",1023:"Iron Crown",
  1024:"Terapagos",1025:"Pecharunt",
};

export function getPokemonName(id: number): string {
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

// ── Tipos elementais por Pokémon ID ──────────────────────────────────────────
export const POKEMON_ELEMENT: Record<number, string> = {
  // Fire
  4:"fire",5:"fire",6:"fire",37:"fire",38:"fire",58:"fire",59:"fire",77:"fire",78:"fire",
  126:"fire",136:"fire",155:"fire",156:"fire",157:"fire",228:"fire",229:"fire",240:"fire",
  // Water
  7:"water",8:"water",9:"water",54:"water",55:"water",60:"water",61:"water",62:"water",
  72:"water",73:"water",86:"water",
  98:"water",99:"water",116:"water",117:"water",118:"water",119:"water",120:"water",
  121:"water",129:"water",130:"water",134:"water",158:"water",159:"water",
  160:"water",170:"water",171:"water",183:"water",184:"water",194:"water",195:"water",
  222:"water",223:"water",224:"water",
  // Grass
  1:"grass",2:"grass",3:"grass",43:"grass",44:"grass",45:"grass",69:"grass",70:"grass",
  71:"grass",102:"grass",103:"grass",114:"grass",152:"grass",153:"grass",154:"grass",
  187:"grass",188:"grass",189:"grass",191:"grass",192:"grass",
  // Electric
  25:"electric",26:"electric",82:"electric",100:"electric",101:"electric",
  125:"electric",135:"electric",172:"electric",239:"electric",
  // Psychic (79=Slowpoke, 80=Slowbro, 81=Magnemite→electric, 124=Jynx)
  63:"psychic",64:"psychic",65:"psychic",79:"psychic",80:"psychic",81:"electric",
  96:"psychic",97:"psychic",124:"psychic",
  137:"psychic",150:"psychic",196:"psychic",203:"psychic",175:"psychic",176:"psychic",
  // Ghost
  92:"ghost",93:"ghost",94:"ghost",200:"ghost",
  // Dragon
  147:"dragon",148:"dragon",149:"dragon",
  // Fighting
  56:"fighting",57:"fighting",66:"fighting",67:"fighting",68:"fighting",
  106:"fighting",107:"fighting",214:"fighting",236:"fighting",237:"fighting",
  // Ice (87=Dewgong, 91=Cloyster, 131=Lapras, 220=Swinub, 221=Piloswine, 238=Smoochum)
  87:"ice",91:"ice",131:"ice",220:"ice",221:"ice",238:"ice",
  // Poison
  23:"poison",24:"poison",29:"poison",30:"poison",31:"poison",32:"poison",33:"poison",
  34:"poison",41:"poison",42:"poison",88:"poison",89:"poison",109:"poison",110:"poison",
  // Ground (74=Geodude→rock primary)
  27:"ground",28:"ground",50:"ground",51:"ground",75:"ground",76:"ground",
  104:"ground",105:"ground",111:"ground",112:"ground",
  // Rock (74=Geodude, 138-142)
  74:"rock",138:"rock",139:"rock",140:"rock",141:"rock",142:"rock",
  // Bug
  10:"bug",11:"bug",12:"bug",13:"bug",14:"bug",15:"bug",46:"bug",47:"bug",
  48:"bug",49:"bug",165:"bug",166:"bug",167:"bug",168:"bug",204:"bug",205:"bug",
  // Normal (default)
};

export function getPokemonElement(pokemonId: number): string {
  return POKEMON_ELEMENT[pokemonId] ?? "normal";
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

export function getTypeAdvantageMultiplier(attackerType: string, defenderType: string): number {
  const strong = TYPE_ADVANTAGE[attackerType] ?? [];
  return strong.includes(defenderType) ? 1.3 : 1.0;
}

// ── Explicações das personalidades ────────────────────────────────────────────
export const PERSONALITY_DESCRIPTION: Record<string, string> = {
  LOYAL:       "Fiel ao treinador. Cresce mais em Carisma. Manda mais presentes para amigos e defende bem em batalhas.",
  PROUD:       "Orgulhoso e vaidoso. Entra em modo Confiante com mais facilidade. Pode recusar carinho se não estiver feliz.",
  MISCHIEVOUS: "Travesso e irreverente. Tem mais chance de criar rivalidades e pode 'roubar' itens de rivais.",
  LAZY:        "Preguiçoso. Rende menos quando felicidade está baixa. Fica cansado mais rápido em interações.",
  COMPETITIVE: "Competitivo nato. Cresce mais em Força. Fica mais forte quando o treinador vence partidas.",
  DRAMATIC:    "Dramático. Reage mais intensamente a vitórias e derrotas do treinador.",
  PLAYFUL:     "Brincalhão. Brincar dá mais EXP e felicidade. Se entedia rápido sem interação.",
  ELECTRIC:    "Cheio de energia. Tem bônus em expedições. Fica animado com mais facilidade.",
  TIMID:       "Tímido. Pode recusar carinho e evitar interações. Mas quando cria amizade, é muito leal.",
  CHAOTIC:     "Caótico e imprevisível. Reações podem surpreender — positivas ou negativas.",
};

// ── Balão de diálogo ──────────────────────────────────────────────────────────
export function generateMascotSpeech(params: {
  mood: string;
  happiness: number;
  personality: string;
  lastFedAt: Date | null;
  lastInteractedAt: Date | null;
  battleWins?: number;
  battleLosses?: number;
  recentTrainerWins?: number;
}): string {
  const hunger = getHungerStatus(params.lastFedAt);
  const h = getHappinessStatus(params.happiness);
  const hoursAlone = params.lastInteractedAt
    ? (Date.now() - new Date(params.lastInteractedAt).getTime()) / 3_600_000
    : 999;

  if (hunger === "STARVING") return "Por favor! Estou desmaiando de fome! 🍖";
  if (params.mood === "ANGRY") return "Tô procurando briga! Me manda pra uma batalha! 😤";
  if (hunger === "HUNGRY") return "Meu estômago tá roncando... tem comida? 😋";
  if (params.mood === "CONFIDENT") {
    if ((params.recentTrainerWins ?? 0) > 0)
      return `${params.recentTrainerWins} vitórias seguidas! Meu treinador é imbatível! 🏆`;
    return "Me sinto no topo do mundo! Ninguém me para! 💪";
  }
  if (params.mood === "EXCITED") return "Que energia! Bora jogar! ⚡";
  if (hoursAlone > 48) return "Você sumiu! Estava com tanta saudade! 🥺";
  if (h === "HAPPY") return "Estou muito feliz hoje! Obrigado por cuidar de mim! 💛";
  if (params.mood === "TIRED") return "Cansadinho... só mais uns minutinhos... 😴";
  if (h === "DEPRESSED") return "Estou me sentindo muito para baixo... 😢";
  if (h === "SAD") return "Preciso de atenção... 🥺";
  if (params.mood === "NEEDY") return "Oi! Você tá aí? Estava com saudade! 👋";
  if (hunger === "STUFFED") return "Não consigo mais! Tô empanturrado! 😌";
  if ((params.battleWins ?? 0) > 3) return `Já venci ${params.battleWins} batalhas! Respeita! ⚔️`;

  const personalityLines: Record<string, string[]> = {
    COMPETITIVE: ["Quando é a próxima batalha? 😤","Tô pronto pra qualquer desafio! ⚔️"],
    LAZY:        ["...zzz... me deixa... 😴","Hoje não tô com vontade... 🛋️"],
    MISCHIEVOUS: ["Vamos aprontar alguma! 😈","Psiu! Tô tramando algo... 🤫"],
    DRAMATIC:    ["A vida de mascote é uma aventura! 🎭","Cada dia é uma história nova! ✨"],
    TIMID:       ["*olha timidamente* ...oi... 👀","É... estou aqui... 🌸"],
    PLAYFUL:     ["Brincaaa! Vamos jogar! 🎮","Faz alguma coisa! Estou entediado! 😅"],
    LOYAL:       ["Sempre estarei do seu lado! 🤝","Conte comigo, treinador! 💪"],
    ELECTRIC:    ["Carregado de energia! ⚡","Pronto pra qualquer coisa! 🔋"],
    PROUD:       ["Sou o melhor mascote! 😎","Ninguém tem mais classe que eu! 👑"],
    CHAOTIC:     ["...","BOOOM! 💥","Tudo bem? Nada. 🌀"],
  };
  const lines = personalityLines[params.personality] ?? ["Tudo tranquilo! 😐"];
  // Usa hash determinístico do mood+personality para evitar hydration mismatch
  const idx = (params.mood.length + params.personality.length + params.happiness) % lines.length;
  return lines[idx];
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
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
  // Gen 5
  638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
  // Gen 6
  716, 717, 718, 719, 720, 721,
  // Gen 7
  785, 786, 787, 788, 789, 790, 791, 792, 800, 801, 802, 807, 808, 809,
  // Gen 8
  888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898,
  // Gen 9
  1001, 1002, 1003, 1004, 1007, 1008,
];

const EXTRA_LEGENDARY_AND_MYTHICAL_IDS = [
  // Gen 7 Ultra Beasts / Poipole line
  793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806,
  // Gen 9 DLC legendary/mythical/paradox legends
  1009, 1010, 1014, 1015, 1016, 1017, 1020, 1021, 1022, 1023, 1024, 1025,
];

for (const pokemonId of EXTRA_LEGENDARY_AND_MYTHICAL_IDS) {
  if (!LEGENDARY_POOL.includes(pokemonId)) LEGENDARY_POOL.push(pokemonId);
}

const uniquePokemonIds = (ids: number[]) => Array.from(new Set(ids)).filter((id) => id >= 1 && id <= 1025);

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

EGG_POOLS.COMMON = ALL_STANDARD_POKEMON_IDS;
EGG_POOLS.RANDOM = ALL_STANDARD_POKEMON_IDS;
EGG_POOLS.RARE = uniquePokemonIds([...ALL_STARTER_IDS, ...RARE_FAN_FAVORITES])
  .filter((pokemonId) => !LEGENDARY_POOL.includes(pokemonId));
EGG_POOLS.SPECIAL = uniquePokemonIds([...SPECIAL_COVETED_IDS, ...RARE_FAN_FAVORITES])
  .filter((pokemonId) => !LEGENDARY_POOL.includes(pokemonId));
