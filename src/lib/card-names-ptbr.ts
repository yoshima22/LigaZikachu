/**
 * Mapeamento de nomes de cartas em PT-BR → nome em inglês (TCG API)
 *
 * IMPORTANTE: Muitos nomes NÃO são traduções literais.
 * São nomes de personagens localizados de formas completamente diferentes.
 * Exemplos: "Kissera" ≠ tradução de "Iono" — é o nome da personagem em PT-BR.
 *
 * Contribua: ao encontrar um nome PT-BR não mapeado, adicione aqui.
 */

export const PT_TO_EN: Record<string, string> = {
  // ── Supporters — Personagens (nomes NÃO literais) ──────────────────────────
  "kissera":               "Iono",
  "lili":                  "Lillie",
  "dra. lili":             "Lillie",
  "dra lili":              "Lillie",
  "professor carvalho":    "Professor Kukui",
  "carvalho":              "Professor Kukui",
  "professora magnólia":   "Professor Magnolia",
  "magnólia":              "Professor Magnolia",
  "miriam":                "Miriam",
  "lança":                 "Raihan",
  "hau":                   "Hau",
  "plumeria":              "Plumeria",
  "tabita":                "Tabitha",
  "maxie":                 "Maxie",
  "aqua":                  "Aqua Admin",
  "arqueiro":              "Archie",
  "maximo":                "Maxie",
  "faba":                  "Faba",
  "wally":                 "Wally",
  "siebold":               "Siebold",
  "diantha":               "Diantha",
  "volkner":               "Volkner",
  "flint":                 "Flint",
  "bela":                  "Elesa",
  "lenora":                "Lenora",
  "brock":                 "Brock",
  "misty":                 "Misty",
  "lt. surge":             "Lt. Surge",
  "erika":                 "Erika",
  "koga":                  "Koga",
  "sabrina":               "Sabrina",
  "blaine":                "Blaine",
  "giovanni":              "Giovanni",
  "lorelei":               "Lorelei",
  "agatha":                "Agatha",
  "lance":                 "Lance",
  "whitney":               "Whitney",
  "morty":                 "Morty",
  "chuck":                 "Chuck",
  "jasmine":               "Jasmine",
  "pryce":                 "Pryce",
  "claire":                "Clair",
  "brandon":               "Brandon",
  "mayla":                 "Maylene",
  "candice":               "Candice",
  "fantina":               "Fantina",
  "byron":                 "Byron",
  "cheryl":                "Cheryl",
  "dawn":                  "Dawn",
  "lucas":                 "Lucas",
  "holly":                 "Hapu",
  "mallow":                "Mallow",
  "lana":                  "Lana",
  "kiawe":                 "Kiawe",
  "acerola":               "Acerola",
  "olivia":                "Olivia",
  "nanu":                  "Nanu",
  "guzma":                 "Guzma",
  "lusamine":              "Lusamine",
  "wicke":                 "Wicke",
  "gladion":               "Gladion",
  "lillie (símbolo do sol)": "Lillie",

  // ── Supporters — Nomes iguais ou similares ────────────────────────────────
  "n":                     "N",
  "cynthia":               "Cynthia",
  "bianca":                "Bianca",
  "cheren":                "Cheren",
  "skyla":                 "Skyla",
  "marnie":                "Marnie",
  "hop":                   "Hop",
  "sonia":                 "Sonia",
  "sónia":                 "Sonia",
  "bede":                  "Bede",
  "piers":                 "Piers",
  "raihan":                "Raihan",
  "nessa":                 "Nessa",
  "milo":                  "Milo",
  "kabu":                  "Kabu",
  "allister":              "Allister",
  "gordie":                "Gordie",
  "melony":                "Melony",
  "piers (sordward)":      "Piers",
  "klara":                 "Klara",
  "avery":                 "Avery",
  "mustard":               "Mustard",
  "honey":                 "Honey",
  "arven":                 "Arven",
  "nemona":                "Nemona",
  "penny":                 "Penny",
  "tulip":                 "Tulip",
  "larry":                 "Larry",
  "rika":                  "Rika",
  "hassel":                "Hassel",

  // ── Trainers / Items comuns ───────────────────────────────────────────────
  "bola ultra":            "Ultra Ball",
  "bola nininho":          "Nest Ball",
  "bola nível":            "Level Ball",
  "bola veloz":            "Quick Ball",
  "bola mergulho":         "Dive Ball",
  "bola grande":           "Great Ball",
  "pesquisa do professor": "Professor's Research",
  "pesquisa da prof.":     "Professor's Research",
  "pesquisa do prof.":     "Professor's Research",
  "ordens do chefe":       "Boss's Orders",
  "poção":                 "Potion",
  "poção máxima":          "Max Potion",
  "ether":                 "Ether",
  "tablet de memória":     "Memory Capsule",
  "trocador de ferramentas": "Tool Scrapper",
  "comunicador pokémon":   "Pokémon Communication",
  "rede de captura":       "Capture Network",
  "passe vip de batalha":  "Battle VIP Pass",
  "incenso de evolução":   "Evolution Incense",
  "tesouro misterioso":    "Mysterious Treasure",
  "varinha de estrelas":   "Star Rod",
  "colete bravura":        "Bravery Charm",

  // ── Estádios ───────────────────────────────────────────────────────────────
  "cidade perdida":        "Lost City",
  "caminho para o cume":   "Path to the Peak",
  "academia de batalha":   "Battle Academy",
  "cidade lenticular":     "Lenticular City",

  // ── Energias ──────────────────────────────────────────────────────────────
  "energia fogo":          "Fire Energy",
  "energia água":          "Water Energy",
  "energia grama":         "Grass Energy",
  "energia elétrica":      "Lightning Energy",
  "energia psíquica":      "Psychic Energy",
  "energia lutador":       "Fighting Energy",
  "energia noturno":       "Darkness Energy",
  "energia metálico":      "Metal Energy",
  "energia incolor":       "Colorless Energy",
  "energia dragão":        "Dragon Energy",
  "energia fada":          "Fairy Energy",
  "energia dupla":         "Double Colorless Energy",
  "energia turbo":         "Turbo Energy",
};

/** Tenta encontrar o nome em inglês para um nome em PT-BR */
export function resolveCardName(name: string): string {
  const lower = name.toLowerCase().trim();
  return PT_TO_EN[lower] ?? name; // Retorna o original se não encontrar
}

/** Resolve uma lista de nomes, mantendo os que já estão em inglês */
export function resolveCardNames(names: string[]): string[] {
  return names.map(resolveCardName);
}
