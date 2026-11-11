// Cartão de Natal montado só com frases prontas (sem texto livre: nada a moderar). Mensagem de até 5 frases: 1 início (greeting) + 1 a 3 do meio (lines) + 1 fim (closing).
export type CardData = { greeting: string; lines: string[]; closing: string; background: string; sticker: string; image?: string };

export const GREETINGS = [
  { key: "g1", text: "Feliz Natal!" },
  { key: "g2", text: "Boas festas, amigo!" },
  { key: "g3", text: "Ho ho ho! Chegou o seu presente." },
  { key: "g4", text: "Tirei você no amigo oculto!" },
  { key: "g5", text: "Que a noite seja iluminada!" },
  { key: "g6", text: "Atenção, atenção: um presente não identificado aterrissou!" },
  { key: "g7", text: "Querido(a) sorteado(a), senta aí que lá vem presente." },
  { key: "g8", text: "Ho ho ho! O Noel terceirizou e eu vim no lugar." },
  { key: "g9", text: "Boa noite, rival favorito!" },
  { key: "g10", text: "Alerta de Natal: este cartão contém carinho." },
  { key: "g11", text: "Hoje o seu ranking não importa, só o Natal." },
  { key: "g12", text: "Surpresa! Você me tirou no coração e eu te tirei no sorteio." },
  { key: "g13", text: "Respire fundo: é só um presente, não uma batalha." },
  { key: "g14", text: "Saudações, treinador(a) de coração mole!" },
  { key: "g15", text: "Plim plim! Mensagem do seu amigo oculto." },
  { key: "g16", text: "Fiz o cartão correndo, mas o presente foi com muito cuidado." },
  { key: "g17", text: "Ei, você aí que perde rodada e ganha presente!" },
  { key: "g18", text: "Informe especial da Liga: hoje é dia de ser legal." },
  { key: "g19", text: "Cuidado: este cartão pode conter sentimentos." },
  { key: "g20", text: "Que a Zika-sorte esteja com você neste Natal!" },
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
  { key: "f11", funny: true, text: "Meu mascote perdeu para o seu uma vez e ainda está em terapia." },
  { key: "f12", funny: true, text: "Eu ia comprar algo caro, mas a Liga me convenceu a ser criativo." },
  { key: "f13", funny: true, text: "Se o seu time cair em W.O. hoje, o presente continua valendo." },
  { key: "f14", funny: true, text: "Seu ranking pode estar baixo, mas seu astral está nas alturas." },
  { key: "f15", funny: true, text: "Tirei você: oficialmente o melhor azar do meu sorteio, no bom sentido." },
  { key: "f16", funny: true, text: "Prometo não contar a ninguém que você ainda guarda um mascote nível 1 de estimação." },
  { key: "f17", funny: true, text: "Não sei se você merece, mas o Natal não pede currículo." },
  { key: "f18", funny: true, text: "Se vier ovo comum, finja surpresa. Se vier raro, comemore alto." },
  { key: "f19", funny: true, text: "O presente passou por três revisões e uma crise existencial." },
  { key: "f20", funny: true, text: "Seus mascotes estão te chamando de lenda. Eu não ouvi, mas confio." },
  { key: "f21", funny: true, text: "Tentei adivinhar sua habilidade oculta: é ser gente boa." },
  { key: "f22", funny: true, text: "Obrigado por perder de forma tão elegante contra mim este ano." },
  { key: "f23", funny: true, text: "Dizem que nesta época do ano até o BYE vira amigo." },
  { key: "f24", funny: true, text: "A Pressão do Trono passa, mas a amizade da Liga fica." },
  { key: "f25", funny: true, text: "Se esfriar o Calor da Lareira, me chama que eu levo os doces." },
  { key: "f26", funny: true, text: "Não é suborno, é só um presente muito bem posicionado." },
  { key: "f27", funny: true, text: "Este cartão foi escrito por alguém que acordou cedo para dar check-in." },
  { key: "f28", funny: true, text: "Pesquisei seu perfil por 30 segundos e concluí: presente aprovado." },
  { key: "f29", funny: true, text: "Se o presente vier duplicado, é estratégia de investimento." },
  { key: "f30", funny: true, text: "Seu time é tão bom que o meu fica nervoso só de ver o sorteio." },
  { key: "f31", funny: true, text: "Tentei dar um presente imbatível, mas a vantagem de tipo me traiu." },
  { key: "f32", funny: true, text: "Como diria um Magikarp: splash! (traduzindo: feliz Natal)." },
  { key: "f33", funny: true, text: "A Caixa Enguiça mandou lembranças e um pouco de confusão." },
  { key: "f34", funny: true, text: "Prepare o coração: é um presente super efetivo." },
  { key: "f35", funny: true, text: "Você não é só um jogador, é patrimônio histórico da Liga." },
  { key: "f36", funny: true, text: "Se alguém perguntar, eu não escrevi isso chorando de rir." },
  { key: "f37", funny: true, text: "Que seus mascotes nunca durmam no meio do combate, tipo o Snorlax." },
  { key: "f38", funny: true, text: "Sempre soube que você era do bem. Tirei no sorteio, mas não por acaso." },
  { key: "f39", funny: true, text: "Aviso: abrir este presente pode aumentar sua popularidade em 8%." },
  { key: "f40", funny: true, text: "Se você perder a próxima rodada, finja que foi de propósito para testar o time." },
  { key: "f41", funny: true, text: "Eu escondi a minha identidade melhor que um shiny numa moita." },
  { key: "f42", funny: true, text: "Meu único plano para o ano que vem é te ganhar uma vez. Uma." },
  { key: "f43", funny: true, text: "Se o presente atrasar, culpe o Wi-Fi e o espírito natalino." },
  { key: "f44", funny: true, text: "Esta mensagem foi revisada por um Psyduck, por isso está um pouco confusa." },
  { key: "f45", funny: true, text: "Que o seu próximo ovo choque um bicho tão lindo quanto a sua tag." },
  { key: "f46", funny: true, text: "Prometo guardar segredo, desde que você prometa não me enfrentar com o time inteiro." },
  { key: "f47", funny: true, text: "Na dúvida entre presente e carinho, mandei os dois. A zoeira vem de brinde." },
  { key: "f48", funny: true, text: "Você é a prova de que rival bom é rival que a gente quer ver feliz." },
  { key: "f49", funny: true, text: "Segundo meus cálculos, 97% do presente é amor e 3% é doce." },
  { key: "f50", funny: true, text: "Ouvi dizer que quem lê isso até o fim ganha +1 de sorte." },
];
export const CLOSINGS = [
  { key: "c1", text: "Com carinho, seu amigo oculto." },
  { key: "c2", text: "Um abraço de alguém da Liga." },
  { key: "c3", text: "Até a próxima rodada!" },
  { key: "c4", text: "Feliz Natal e um ótimo ano novo!" },
  { key: "c5", text: "Assinado: alguém que você jura que não desconfia." },
  { key: "c6", text: "Beijos, abraços e nenhuma pista." },
  { key: "c7", text: "Do seu amigo oculto, escondido atrás da árvore." },
  { key: "c8", text: "Aproveite e depois me ajuda a esconder a identidade." },
  { key: "c9", text: "Fim da mensagem. Início da comilança." },
  { key: "c10", text: "Qualquer reclamação, fale com o Noel (ele nunca atende)." },
  { key: "c11", text: "Feliz Natal e que o próximo ano tenha menos W.O.!" },
  { key: "c12", text: "Um abraço apertado e um doce escondido no bolso." },
  { key: "c13", text: "Nos vemos nas rodadas, rival do coração!" },
  { key: "c14", text: "P.S.: se descobrir quem sou, não conta no grupo." },
  { key: "c15", text: "Com carinho e uma pitada de zoeira, seu amigo oculto." },
  { key: "c16", text: "Boas festas! A Liga é melhor com você." },
  { key: "c17", text: "Que o ano novo venha com ovo raro e adversário fácil." },
  { key: "c18", text: "Fim de transmissão. Volte para a sua ceia." },
  { key: "c19", text: "Tchau, tchau, e obrigado por existir na Liga!" },
  { key: "c20", text: "Até a próxima, treinador(a) lendário(a)!" },
];
// Ilustrações do cartão: artes dos personagens da Liga publicadas em assets/events/amigo-oculto/.
const IMG_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/assets/events/amigo-oculto`;
const img = (key: string, label: string) => ({ key, label, url: `${IMG_BASE}/${key}.webp` });
export const IMAGES: { key: string; label: string; url: string }[] = [
  img("noel-chamine", "Jotape preso na chaminé"),
  img("enguica-lista", "Enguiça e a lista do Noel"),
  img("cleide-arvore", "Cleide e a árvore explosiva"),
  img("miauvadao-arvore", "Miauvadão derruba a árvore"),
  img("miauvadao-noel", "Papai Noel Miauvadão"),
  img("amigos-suspeitos", "Amigos ocultos suspeitos"),
  img("laboratorio", "Laboratório natalino"),
  img("troca-presentes", "Troca de presentes"),
  img("ceia", "Ceia da Liga"),
  img("brinde", "Brinde de fim de ano"),
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
