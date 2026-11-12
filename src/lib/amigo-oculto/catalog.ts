// Kits de presente por categoria (1..4), montados só com os itens que cada categoria permite.
// Itens reais da loja são resolvidos por nome no banco (com a imagem original). O presenteador escolhe até 3 kits;
// o recebedor ganha 1 deles por sorteio. Cada linha de item conta como 1 item do kit (comida/doce também).
export type EggKind = "COMMON" | "RARE" | "SPECIAL" | "LAB" | "EVENT";
// fx: itens que não são da loja — comida/doce/doce raro de mascote e pedra de mega aleatória.
export type Fx = "FOOD" | "SWEET" | "RARE_SWEET" | "MEGA";
export type PackageItem = { name: string; qty: number; egg?: EggKind; fx?: Fx };
export type GiftPackage = { key: string; tier: 1 | 2 | 3 | 4; name: string; emoji: string; items: PackageItem[] };

export const FX_LABEL: Record<Fx, string> = { FOOD: "Comida", SWEET: "Doce", RARE_SWEET: "Doce Raro", MEGA: "Pedra de Mega Evolução (aleatória)" };
export const FX_EMOJI: Record<Fx, string> = { FOOD: "🍖", SWEET: "🍬", RARE_SWEET: "🍭", MEGA: "💎" };
export const EGG_LABEL: Record<EggKind, string> = { COMMON: "Ovo Comum", RARE: "Ovo Raro", SPECIAL: "Ovo Especial", LAB: "Ovo de Laboratório", EVENT: "Ovo de Evento" };

// Categorias: bengalas de açúcar (check-ins da comunidade) necessárias para liberar cada uma.
export const TIERS = [
  { tier: 1, name: "Nem ligo pro Natal", emoji: "🙄", from: 1, to: 30, blurb: "Agrados simples: comida, doces, antídoto e um ovo ou pena." },
  { tier: 2, name: "Natal é Legal", emoji: "🎄", from: 31, to: 150, blurb: "Ovos raros e de evento, penas de evento, amuletos e tickets." },
  { tier: 3, name: "Eu Amo o Natal", emoji: "🎅", from: 151, to: 299, blurb: "Ovos de evento e especiais, penas especiais e de laboratório." },
  { tier: 4, name: "Papa Coração", emoji: "💝", from: 300, to: null, blurb: "O melhor da Liga: ovos de laboratório, penas potentes e pedra de mega." },
] as const;
// Pontos de corte (bengalas) que liberam os níveis 1..4.
export const DEFAULT_LEVELS: [number, number, number, number] = [1, 31, 151, 300];

type Q = (qty?: number) => PackageItem;
const it = (name: string): Q => (qty = 1) => ({ name, qty });
const egg = (kind: EggKind): Q => (qty = 1) => ({ name: EGG_LABEL[kind], qty, egg: kind });
const fx = (kind: Fx): Q => (qty = 1) => ({ name: FX_LABEL[kind], qty, fx: kind });

const comida = fx("FOOD"), doce = fx("SWEET"), doceRaro = fx("RARE_SWEET"), pedraMega = fx("MEGA");
const bala = it("Bala de Mel"), antidoto = it("Antídoto"), vitamina = it("Vitamina Chocante"), amuleto = it("Amuleto da Sorte"), agua = it("Água Fresca");
const ovoSorte = it("Ovo da Sorte"), politica = it("Política de Fraqueza"), ferias = it("Ticket de Férias do Prof. Carvalho"), cesta = it("Cesta de Piquenique Chocante");
const socorros = it("Kit de Primeiros Socorros"), reversor = it("Reversor De Mega"), proteina = it("Proteína Zika");
const penaComum = it("Pena Arco-Íris Comum"), penaRara = it("Pena Arco-Íris Rara"), penaRaraP = it("Pena Arco-Íris Rara Potente");
const penaEvento = it("Pena Arco-Íris de Evento"), penaEventoP = it("Pena Arco-Íris de Evento Potente");
const penaEspecial = it("Pena Arco-Íris Especial"), penaEspecialP = it("Pena Arco-Íris Especial Potente");
const penaLab = it("Pena Arco-Íris de Laboratório"), penaLabP = it("Pena Arco-Íris de Laboratório Potente");
const ovoComum = egg("COMMON"), ovoRaro = egg("RARE"), ovoEspecial = egg("SPECIAL"), ovoLab = egg("LAB"), ovoEvento = egg("EVENT");

const P = (key: string, tier: GiftPackage["tier"], emoji: string, name: string, items: PackageItem[]): GiftPackage => ({ key, tier, name, emoji, items });

export const PACKAGES: GiftPackage[] = [
  // Nem ligo pro Natal — 5 kits × 3 itens
  P("n1-lanchinho", 1, "🥪", "Kit Lanchinho", [comida(20), doce(10), bala(2)]),
  P("n1-ninho", 1, "🐣", "Kit Ninho Comum", [ovoComum(), penaComum(), antidoto()]),
  P("n1-penas", 1, "🪶", "Kit Penas e Petiscos", [penaRara(), comida(10), doce(5)]),
  P("n1-docinho", 1, "🍭", "Kit Docinho Raro", [doceRaro(), comida(10), antidoto(2)]),
  P("n1-ovo", 1, "🥚", "Kit Ovo Raro", [ovoRaro(), doce(5), bala()]),
  // Natal é Legal — 10 kits × 3 itens
  P("n2-ninho-raro", 2, "🪺", "Kit Ninho Raro", [ovoRaro(), bala(2), antidoto(2)]),
  P("n2-evento", 2, "🎉", "Kit Ovo de Evento", [ovoEvento(), doceRaro(), bala()]),
  P("n2-plumagem", 2, "🦚", "Kit Plumagem de Natal", [penaEvento(), vitamina(2), antidoto()]),
  P("n2-pena-especial", 2, "🌟", "Kit Pena Especial", [penaEspecial(), amuleto(), bala(2)]),
  P("n2-estrategia", 2, "🧠", "Kit Estratégia e Descanso", [politica(), ferias(), antidoto(2)]),
  P("n2-sorte-mestre", 2, "🍀", "Kit Sorte de Mestre", [ovoRaro(), vitamina(), amuleto()]),
  P("n2-banquete", 2, "🍰", "Kit Banquete Doce", [doceRaro(2), vitamina(2), bala(2)]),
  P("n2-ferias", 2, "🏖️", "Kit Férias de Natal", [ferias(2), amuleto(), doceRaro()]),
  P("n2-surpresa", 2, "🎁", "Kit Surpresa de Evento", [ovoEvento(), politica(), antidoto()]),
  P("n2-duas-penas", 2, "🪽", "Kit Duas Penas", [penaEvento(), penaEspecial(), doceRaro()]),
  // Eu Amo o Natal — 10 kits × 4 itens
  P("n3-piquenique", 3, "🧺", "Kit Piquenique de Evento", [ovoEvento(), cesta(), vitamina(), agua(2)]),
  P("n3-especial", 3, "✨", "Kit Especial de Natal", [ovoEspecial(), doceRaro(2), amuleto(), socorros()]),
  P("n3-gala", 3, "👑", "Kit Penas de Gala", [penaEspecial(), penaRaraP(), vitamina(2), agua()]),
  P("n3-laboratorio", 3, "🧪", "Kit Laboratório de Natal", [penaLab(), penaEventoP(), amuleto(), doceRaro()]),
  P("n3-dia-sorte", 3, "🎰", "Kit Dia de Sorte", [ovoSorte(), amuleto(2), ferias(), cesta()]),
  P("n3-ovo-pluma", 3, "🦢", "Kit Ovo e Pluma", [ovoEvento(), penaRaraP(), doceRaro(), socorros()]),
  P("n3-banquete", 3, "🍽️", "Kit Banquete Chocante", [cesta(2), vitamina(2), agua(2), doceRaro(2)]),
  P("n3-spa", 3, "🛁", "Kit Spa Natalino", [ferias(2), socorros(2), agua(2), amuleto()]),
  P("n3-sorte-especial", 3, "🎲", "Kit Sorte Especial", [ovoEspecial(), ovoSorte(), vitamina(), penaEspecial()]),
  P("n3-cientista", 3, "🔬", "Kit Caixa do Cientista", [ovoSorte(), penaLab(), cesta(), socorros()]),
  // Papa Coração — 15 kits × 4 itens
  P("n4-mega-presente", 4, "💎", "Kit Mega Presente", [pedraMega(), bala(2), doceRaro(), vitamina()]),
  P("n4-mega-reverso", 4, "🔄", "Kit Mega e Reverso", [pedraMega(), reversor(), amuleto(), ferias()]),
  P("n4-mega-surpresa", 4, "🎆", "Kit Mega Surpresa", [pedraMega(), cesta(), politica(), proteina()]),
  P("n4-pedra-poder", 4, "💪", "Kit Pedra & Poder", [pedraMega(), proteina(), amuleto(), bala(2)]),
  P("n4-especial-potente", 4, "⚡", "Kit Especial Potente", [ovoEspecial(), penaEspecialP(), proteina(), doceRaro(2)]),
  P("n4-ciencia", 4, "🧬", "Kit Ciência de Natal", [ovoLab(), penaLabP(), vitamina(2), bala(2)]),
  P("n4-estrategista", 4, "♟️", "Kit Estrategista", [ovoEspecial(), reversor(), politica(), amuleto()]),
  P("n4-dupla-pena", 4, "🪶", "Kit Dupla Pena", [penaEspecialP(), penaLab(), proteina(2), cesta()]),
  P("n4-penas-douradas", 4, "🥇", "Kit Penas Douradas", [penaLabP(), penaEspecial(), doceRaro(2), amuleto()]),
  P("n4-ferias-lab", 4, "🏝️", "Kit Férias no Lab", [ovoLab(), ferias(2), cesta(), vitamina(2)]),
  P("n4-fabrica", 4, "🏭", "Kit Fábrica de Poder", [proteina(3), vitamina(3), bala(3), doceRaro(3)]),
  P("n4-defesa", 4, "🛡️", "Kit Defesa Total", [politica(2), reversor(), amuleto(2), ferias()]),
  P("n4-ninhada", 4, "🐉", "Kit Ninhada Premium", [ovoEspecial(), ovoLab(), doceRaro(2), bala(2)]),
  P("n4-lendario", 4, "🌈", "Kit Penas Lendárias", [penaEspecialP(), penaLabP(), cesta(2), vitamina(2)]),
  P("n4-papai", 4, "🎅", "Kit Caixa do Papai", [ovoLab(), penaEspecial(), reversor(), proteina()]),
];

// Mimo de constância: um agrado pequeno junto ao presente principal.
export const MIMO = { food: 5, sweet: 3 };

export const OPTIONS_PER_GIFT = 3;
export const packageByKey = (key: string | null | undefined) => PACKAGES.find((g) => g.key === key);
export const packagesForLevel = (level: number) => PACKAGES.filter((g) => g.tier <= level);

// Valida as opções: de 1 a 3 chaves distintas, existentes e já liberadas pelo nível.
export function validateOptions(keys: unknown, level: number): { ok: true; keys: string[] } | { ok: false; error: string } {
  if (!Array.isArray(keys) || keys.length < 1 || keys.length > OPTIONS_PER_GIFT) return { ok: false, error: `Escolha de 1 a ${OPTIONS_PER_GIFT} kits.` };
  if (new Set(keys).size !== keys.length) return { ok: false, error: "Escolha kits diferentes." };
  for (const k of keys) {
    const p = packageByKey(k as string);
    if (!p) return { ok: false, error: "Kit inválido." };
    if (p.tier > level) return { ok: false, error: "Um dos kits ainda não foi liberado pelas bengalas de açúcar da comunidade." };
  }
  return { ok: true, keys: keys as string[] };
}

// Quem não escolheu: 3 kits do nível mais alto liberado (ordem estável).
export function defaultOptions(level: number): string[] {
  const lv = Math.max(1, level);
  return [...packagesForLevel(lv)].sort((a, b) => b.tier - a.tier || a.key.localeCompare(b.key)).slice(0, OPTIONS_PER_GIFT).map((p) => p.key);
}
