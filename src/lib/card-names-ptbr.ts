/**
 * Mapeamento de nomes PT-BR → inglês (TCG API)
 * ATENÇÃO: Nomes NÃO são traduções literais — são localizações completamente diferentes.
 * Exemplo: "Kissera" ≠ tradução de "Iono"
 */

export const PT_TO_EN: Record<string, string> = {
  // ── Apoiadores — Prioridade Altíssima ─────────────────────────────────────
  "kissera":                          "Iono",
  "pesquisa de professores":          "Professor's Research",
  "pesquisa do professor":            "Professor's Research",
  "pesquisa da professora":           "Professor's Research",
  "pesquisa de prof.":                "Professor's Research",
  "pesquisa do prof.":                "Professor's Research",
  "pesquisa de professores: prof. carvalho": "Professor's Research: Professor Oak",
  "prof. carvalho":                   "Professor Oak",
  "ordem da chefia":                  "Boss's Orders",
  "ordens da chefia":                 "Boss's Orders",
  "ordens do chefe":                  "Boss's Orders",
  "juiz":                             "Judge",

  // ── Apoiadores — Prioridade Alta ─────────────────────────────────────────
  "lílian":                           "Lillie",
  "lilian":                           "Lillie",
  "determinação da lílian":           "Lillie's Determination",
  "determinação da lilian":           "Lillie's Determination",
  "encorajamento da rosa":            "Rosa's Encouragement",
  "rosa":                             "Rosa",
  "hau":                              "Hau",
  "sonia":                            "Sonia",
  "sónia":                            "Sonia",
  "marnie":                           "Marnie",
  "hop":                              "Hop",
  "bede":                             "Bede",
  "arven":                            "Arven",
  "nemona":                           "Nemona",
  "penny":                            "Penny",
  "raihan":                           "Raihan",
  "lança":                            "Raihan",
  "nessa":                            "Nessa",
  "miriam":                           "Miriam",
  "cyrus":                            "Cyrus",
  "cynthia":                          "Cynthia",
  "n":                                "N",
  "bianca":                           "Bianca",
  "cheren":                           "Cheren",
  "skyla":                            "Skyla",

  // ── Itens — Prioridade Altíssima ─────────────────────────────────────────
  "bola ninho":                       "Nest Ball",
  "bola-ninho":                       "Nest Ball",
  "ultra bola":                       "Ultra Ball",
  "ultrabola":                        "Ultra Ball",
  "doce raro":                        "Rare Candy",
  "poffin de colega":                 "Buddy-Buddy Poffin",
  "pegador superior":                 "Prime Catcher",

  // ── Itens — Prioridade Alta ───────────────────────────────────────────────
  "substituição":                     "Switch",
  "carrinho de troca":                "Switch Cart",
  "substituição de energia":          "Energy Switch",
  "recuperação de energia":           "Energy Retrieval",
  "recuperação de energia superior":  "Superior Energy Retrieval",
  "pegador de contra-ataque":         "Counter Catcher",
  "aspirador perdido":                "Lost Vacuum",
  "maca noturna":                     "Night Stretcher",
  "recipiente terrestre":             "Earthen Vessel",
  "super vara":                       "Super Rod",
  "máquina técnica: evolução":        "Technical Machine: Evolution",
  "tm evolução":                      "Technical Machine: Evolution",
  "tm: evolução":                     "Technical Machine: Evolution",
  "máquina técnica: involução":       "Technical Machine: Devolution",
  "tm: involução":                    "Technical Machine: Devolution",

  // ── Ferramentas Pokémon ───────────────────────────────────────────────────
  "amuleto da bravura":               "Bravery Charm",
  "faixa de vitalidade":              "Vitality Band",
  "skate de resgate":                 "Rescue Board",

  // ── Outros Itens ──────────────────────────────────────────────────────────
  "bola de evolução":                 "Evolution Incense",
  "bola nível":                       "Level Ball",
  "bola mergulho":                    "Dive Ball",
  "bola veloz":                       "Quick Ball",
  "bola grande":                      "Great Ball",
  "comunicador pokémon":              "Pokémon Communication",
  "comunicador pokemon":              "Pokémon Communication",
  "passe vip de batalha":             "Battle VIP Pass",
  "tesouro misterioso":               "Mysterious Treasure",
  "fragmento de zircônia":            "Zirconia Fragment",

  // ── Estádios ───────────────────────────────────────────────────────────────
  "cidade perdida":                   "Lost City",
  "caminho para o cume":              "Path to the Peak",
  "praia das batalhas":               "Beach Court",
  "academia de batalha":              "Battle Academy",
  "antiga lenda":                     "Ancient Booster Capsule",

  // ── Energias ──────────────────────────────────────────────────────────────
  "energia fogo":                     "Fire Energy",
  "energia água":                     "Water Energy",
  "energia grama":                    "Grass Energy",
  "energia elétrica":                 "Lightning Energy",
  "energia psíquica":                 "Psychic Energy",
  "energia lutador":                  "Fighting Energy",
  "energia noturno":                  "Darkness Energy",
  "energia metálico":                 "Metal Energy",
  "energia dragão":                   "Dragon Energy",
  "energia incolor":                  "Colorless Energy",
  "energia turbo":                    "Turbo Energy",
  "energia dupla":                    "Double Turbo Energy",
  "energia dupla incolor":            "Double Colorless Energy",
};

/** Converte nome PT-BR para inglês se existir no mapeamento */
export function resolveCardName(name: string): string {
  return PT_TO_EN[name.toLowerCase().trim()] ?? name;
}

/** Resolve lista de nomes */
export function resolveCardNames(names: string[]): string[] {
  return names.map(resolveCardName);
}
