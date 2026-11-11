// Pacotes de presente por nível (1..4), montados com itens REAIS da loja (resolvidos por nome no banco,
// com a imagem original). O presenteador escolhe 3 pacotes; o recebedor ganha 1 deles por sorteio.
// `egg` = o item vira um ovo de verdade (MascotEgg) em vez de item de inventário; `food`/`sweet` = comida/doce de mascote.
export type PackageItem = { name: string; qty: number; egg?: "COMMON" | "RARE" | "SPECIAL" };
export type GiftPackage = { key: string; tier: 1 | 2 | 3 | 4; name: string; emoji: string; items: PackageItem[]; food?: number; sweet?: number };

const P = (key: string, tier: GiftPackage["tier"], emoji: string, name: string, items: PackageItem[], extra: { food?: number; sweet?: number } = {}): GiftPackage => ({ key, tier, name, emoji, items, ...extra });

export const PACKAGES: GiftPackage[] = [
  // Nível 1 — agrados e cosméticos
  P("guloseimas", 1, "🧺", "Pacote Guloseimas", [{ name: "Bala de Mel", qty: 2 }], { food: 15, sweet: 8 }),
  P("torcedor", 1, "📣", "Pacote Torcedor", [{ name: "Bandeira da Torcida", qty: 1 }, { name: "Apito de Formação", qty: 1 }, { name: "Escudo de Banco", qty: 1 }]),
  P("visual", 1, "🎨", "Pacote Visual", [{ name: "Liga Zikachu - Laranja", qty: 1 }, { name: "Liga Zikachu - Moldura Amarela", qty: 1 }]),
  P("loot", 1, "🎟️", "Pacote Zika Loot", [{ name: "Ticket Zika Loot", qty: 2 }, { name: "Ovo Comum", qty: 1, egg: "COMMON" }]),
  P("zoeira", 1, "😈", "Pacote Zoeira", [{ name: "Spray de Confusão", qty: 1 }, { name: "Areia no Campo", qty: 1 }, { name: "Fita Embaraçosa", qty: 1 }]),
  // Nível 2 — consumíveis de mascote e estratégia
  P("vitamina", 2, "💪", "Pacote Vitamina", [{ name: "Vitamina Chocante", qty: 2 }, { name: "Amuleto da Sorte", qty: 1 }]),
  P("penas", 2, "🪶", "Pacote Penas", [{ name: "Pena Arco-Íris Comum", qty: 2 }, { name: "Pena Arco-Íris Comum Potente", qty: 1 }]),
  P("sorte", 2, "🍀", "Pacote da Sorte", [{ name: "Ovo da Sorte", qty: 1 }, { name: "Amuleto da Sorte", qty: 1 }, { name: "Ticket Zika Loot", qty: 2 }]),
  P("estrategia", 2, "🧠", "Pacote Estratégia", [{ name: "Estratégia do Enguiça", qty: 1 }, { name: "Lanterna de Análise", qty: 1 }, { name: "Botas de Rodada", qty: 1 }]),
  P("visual-premium", 2, "🖼️", "Pacote Visual Premium", [{ name: "Faixa do Gengar", qty: 1 }, { name: "Chapéu de Palha", qty: 1 }]),
  // Nível 3 — raros
  P("raro", 3, "🥚", "Pacote Ovo Raro", [{ name: "Ovo Raro", qty: 1, egg: "RARE" }], { sweet: 5 }),
  P("penas-raras", 3, "🌈", "Pacote Penas Raras", [{ name: "Pena Arco-Íris Rara", qty: 2 }, { name: "Pena Arco-Íris de Evento", qty: 1 }]),
  P("cuidados", 3, "🩹", "Pacote Cuidados", [{ name: "Kit de Primeiros Socorros", qty: 1 }, { name: "Cesta de Piquenique Chocante", qty: 1 }]),
  P("descanso", 3, "🏖️", "Pacote Descanso", [{ name: "Ticket de Férias do Prof. Carvalho", qty: 1 }, { name: "Água Fresca", qty: 2 }, { name: "Antídoto", qty: 2 }]),
  // Nível 4 — especiais
  P("especial", 4, "✨", "Pacote Ovo Especial", [{ name: "Ovo Especial", qty: 1, egg: "SPECIAL" }, { name: "Ovo Raro", qty: 1, egg: "RARE" }]),
  P("tm-poder", 4, "💥", "Pacote TM Huge Power", [{ name: "TM Huge Power", qty: 1 }, { name: "Pena Arco-Íris Rara", qty: 1 }]),
  P("tm-regen", 4, "💚", "Pacote TM Regenerator", [{ name: "TM Regenerator", qty: 1 }, { name: "Pena Arco-Íris Rara", qty: 1 }]),
  P("tm-protean", 4, "🔮", "Pacote TM Protean", [{ name: "TM Protean", qty: 1 }, { name: "Pena Arco-Íris Rara", qty: 1 }]),
  P("laboratorio", 4, "🧪", "Pacote Laboratório", [{ name: "Pena Arco-Íris de Laboratório", qty: 1 }, { name: "Pena Arco-Íris Especial Potente", qty: 1 }, { name: "Proteína Zika", qty: 1 }]),
];

// Mimo de constância: um agrado pequeno junto ao presente principal.
export const MIMO = { food: 5, sweet: 3 };

export const OPTIONS_PER_GIFT = 3;
export const packageByKey = (key: string | null | undefined) => PACKAGES.find((g) => g.key === key);
export const packagesForLevel = (level: number) => PACKAGES.filter((g) => g.tier <= level);

// Valida as 3 opções: chaves distintas, existentes e já liberadas pelo nível.
export function validateOptions(keys: unknown, level: number): { ok: true; keys: string[] } | { ok: false; error: string } {
  if (!Array.isArray(keys) || keys.length !== OPTIONS_PER_GIFT) return { ok: false, error: `Escolha exatamente ${OPTIONS_PER_GIFT} pacotes.` };
  if (new Set(keys).size !== keys.length) return { ok: false, error: "Escolha pacotes diferentes." };
  for (const k of keys) {
    const p = packageByKey(k as string);
    if (!p) return { ok: false, error: "Pacote inválido." };
    if (p.tier > level) return { ok: false, error: "Um dos pacotes ainda não foi liberado pelos laços da comunidade." };
  }
  return { ok: true, keys: keys as string[] };
}

// Quem não escolheu: 3 pacotes do nível mais alto liberado (ordem estável).
export function defaultOptions(level: number): string[] {
  const lv = Math.max(1, level);
  return [...packagesForLevel(lv)].sort((a, b) => b.tier - a.tier || a.key.localeCompare(b.key)).slice(0, OPTIONS_PER_GIFT).map((p) => p.key);
}
