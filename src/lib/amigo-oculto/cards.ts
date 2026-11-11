// Cartão de Natal montado só com frases prontas (sem texto livre: nada a moderar).
export type CardData = { greeting: string; lines: string[]; closing: string; background: string; sticker: string; image?: string };

export const GREETINGS = [
  { key: "g1", text: "Feliz Natal!" },
  { key: "g2", text: "Boas festas, amigo!" },
  { key: "g3", text: "Ho ho ho! Chegou o seu presente." },
  { key: "g4", text: "Tirei você no amigo oculto!" },
  { key: "g5", text: "Que a noite seja iluminada!" },
];
export const LINES: { key: string; text: string; funny?: boolean }[] = [
  { key: "l1", text: "Seus mascotes merecem o melhor do inverno." },
  { key: "l2", text: "Você faz a Liga ser mais divertida." },
  { key: "l3", text: "Que suas rodadas sejam sempre de vitória." },
  { key: "l4", text: "Obrigado pelas partidas, pelas risadas e pelas derrotas honrosas." },
  { key: "l5", text: "Que seus ovos nasçam raros e brilhantes." },
  { key: "l6", text: "Um brinde ao melhor time da temporada." },
  { key: "l7", text: "Espero que este presente chegue na hora certa." },
  { key: "l8", text: "Prepare o time: o ano que vem promete." },
  { key: "l9", text: "Você é daqueles rivais que a gente respeita." },
  { key: "l10", text: "Que a sorte esteja sempre a seu favor." },
  { key: "f1", funny: true, text: "Tirei você e quase troquei de nome para não ser descoberto." },
  { key: "f2", funny: true, text: "Seu presente veio embrulhado com a última fita adesiva da Liga." },
  { key: "f3", funny: true, text: "Prometo que não é um ovo de Magikarp... talvez seja." },
  { key: "f4", funny: true, text: "Se o presente for ruim, a culpa é do sorteio." },
  { key: "f5", funny: true, text: "Esse cartão se autodestrói se você perder a próxima rodada." },
  { key: "f6", funny: true, text: "Pensei muito em você. Uns 4 minutos, mas com carinho." },
  { key: "f7", funny: true, text: "Seu mascote me pediu para avisar: ele quer mais doces." },
  { key: "f8", funny: true, text: "Comi o panetone, mas guardei o presente." },
  { key: "f9", funny: true, text: "Este presente foi inspecionado por um Snorlax. Aprovado depois da soneca." },
  { key: "f10", funny: true, text: "Se você descobriu quem sou, finja que não." },
];
export const CLOSINGS = [
  { key: "c1", text: "Com carinho, seu amigo oculto." },
  { key: "c2", text: "Um abraço de alguém da Liga." },
  { key: "c3", text: "Até a próxima rodada!" },
  { key: "c4", text: "Feliz Natal e um ótimo ano novo!" },
];
// Ilustrações do cartão (composições de emoji por enquanto; `url` troca por arte pintada depois).
export const IMAGES: { key: string; label: string; scene: string; url?: string }[] = [
  { key: "noel-chamine", label: "Noel preso na chaminé", scene: "🧱🎅" },
  { key: "rena-perdida", label: "Rena perdida", scene: "🦌❓" },
  { key: "boneco-derretendo", label: "Boneco de neve derretendo", scene: "☃️💦" },
  { key: "pisca", label: "Pinheiro enrolado no pisca-pisca", scene: "🎄💡" },
  { key: "ovo-natal", label: "Ovo de Natal chocando", scene: "🥚🎁" },
  { key: "mascote-gorro", label: "Mascote de gorro", scene: "🐣🎅" },
  { key: "panetone-vs-pave", label: "Panetone vs. pavê", scene: "🍞⚔️🍰" },
  { key: "meia-furada", label: "Meia furada com presente", scene: "🧦🎁" },
  { key: "soneca", label: "Snorlax de soneca", scene: "😴🎁" },
];

export const STICKERS = ["🎄", "⭐", "🎁", "❄️", "🔔", "🕯️", "🦌", "☃️"];
// Fundos desenhados em CSS (sem dependência de imagem). As artes pintadas podem entrar depois pelo mesmo `key`.
export const BACKGROUNDS = [
  { key: "noite", label: "Noite de neve", css: "linear-gradient(160deg,#0b1d3a 0%,#1b2f5e 55%,#3a2a66 100%)", ink: "#f4f9ff", accent: "#f3b91f" },
  { key: "lareira", label: "Lareira", css: "linear-gradient(160deg,#3a0f0f 0%,#7a1f1f 55%,#d9772b 100%)", ink: "#fff4e6", accent: "#ffd479" },
  { key: "pinheiro", label: "Pinheiral", css: "linear-gradient(160deg,#062b1d 0%,#14663a 60%,#2f8f5a 100%)", ink: "#f1fff6", accent: "#f3b91f" },
  { key: "gelo", label: "Gelo", css: "linear-gradient(160deg,#d7ecff 0%,#a9d3f5 60%,#7fb4e6 100%)", ink: "#0b1d3a", accent: "#d62839" },
  { key: "ouro", label: "Ouro", css: "linear-gradient(160deg,#4a3206 0%,#a47a12 55%,#f3d36b 100%)", ink: "#2a1a02", accent: "#7a1f1f" },
  { key: "aurora", label: "Aurora", css: "linear-gradient(160deg,#071a2b 0%,#0f6b6b 50%,#5a2e91 100%)", ink: "#eafffb", accent: "#9bffe0" },
];

const has = (list: { key: string }[], k: string) => list.some((x) => x.key === k);
export const textOf = (list: { key: string; text: string }[], k: string) => list.find((x) => x.key === k)?.text ?? "";

// Valida o cartão vindo do cliente: só chaves conhecidas, 1 a 3 frases.
export function validateCard(input: unknown): { ok: true; card: CardData } | { ok: false; error: string } {
  const c = (input ?? {}) as Partial<CardData>;
  if (!c.greeting || !has(GREETINGS, c.greeting)) return { ok: false, error: "Escolha uma saudação." };
  if (!Array.isArray(c.lines) || c.lines.length < 1 || c.lines.length > 3) return { ok: false, error: "Escolha de 1 a 3 frases." };
  if (new Set(c.lines).size !== c.lines.length || !c.lines.every((k) => typeof k === "string" && has(LINES, k))) return { ok: false, error: "Frase inválida." };
  if (!c.closing || !has(CLOSINGS, c.closing)) return { ok: false, error: "Escolha um fecho." };
  if (!c.background || !BACKGROUNDS.some((b) => b.key === c.background)) return { ok: false, error: "Escolha um fundo." };
  if (!c.sticker || !STICKERS.includes(c.sticker)) return { ok: false, error: "Escolha um adorno." };
  if (c.image && !IMAGES.some((i) => i.key === c.image)) return { ok: false, error: "Ilustração inválida." };
  return { ok: true, card: { greeting: c.greeting, lines: c.lines, closing: c.closing, background: c.background, sticker: c.sticker, ...(c.image ? { image: c.image } : {}) } };
}
