// Caixas de recompensa do Rei do Rio (puro, sem banco). Cada caixa custa PONTOS DO RANKING, pode ser resgatada 1 vez
// por jogador e deixa escolher 1 entre 3 opções. Do topo à base o valor cai gradualmente.
//
// Custos ajustados pelo admin em 18/11: -300 e depois +150 em cada caixa (líquido -150 sobre a tabela original).
// Calibragem (simulação de 12 jogadores, 5 combates ≈ 208 pts em média; faixa 110–386): uma SEMANA (20 combates) rende
// em média ≈ 830 pts (fracos ≈ 440, fortes ≈ 1.550). Em 4 semanas de dezembro: médio ≈ 3.300, fraco ≈ 1.750, forte ≈ 6.200.
// Assim todo mundo resgata as caixas de baixo logo na 1ª semana e só quem joga bem (ou todas as semanas) chega ao topo.
import { EGG_LABEL, FX_LABEL, type PackageItem } from "@/lib/amigo-oculto/catalog";

type Q = (qty?: number) => PackageItem;
const it = (name: string): Q => (qty = 1) => ({ name, qty });
const egg = (kind: keyof typeof EGG_LABEL): Q => (qty = 1) => ({ name: EGG_LABEL[kind], qty, egg: kind });
const fx = (kind: keyof typeof FX_LABEL): Q => (qty = 1) => ({ name: FX_LABEL[kind], qty, fx: kind });

const comida = fx("FOOD"), doce = fx("SWEET"), doceRaro = fx("RARE_SWEET"), pedraMega = fx("MEGA");
const ovoComum = egg("COMMON"), ovoRaro = egg("RARE"), ovoEspecial = egg("SPECIAL"), ovoLab = egg("LAB"), ovoEvento = egg("EVENT");
const penaComum = it("Pena Arco-Íris Comum"), penaRara = it("Pena Arco-Íris Rara"), penaRaraP = it("Pena Arco-Íris Rara Potente");
const penaEvento = it("Pena Arco-Íris de Evento"), penaEventoP = it("Pena Arco-Íris de Evento Potente");
const penaEspecialP = it("Pena Arco-Íris Especial Potente"), penaLab = it("Pena Arco-Íris de Laboratório"), penaLabP = it("Pena Arco-Íris de Laboratório Potente");
const proteina = it("Proteína Zika"), vitamina = it("Vitamina Chocante"), amuleto = it("Amuleto da Sorte"), cesta = it("Cesta de Piquenique Chocante");
const agua = it("Água Fresca"), antidoto = it("Antídoto"), socorros = it("Kit de Primeiros Socorros"), bala = it("Bala de Mel"), reversor = it("Reversor De Mega");
const ticket = it("Ticket Zika Loot");
const tmPoder = it("TM Huge Power"), tmRegen = it("TM Regenerator"), tmProtean = it("TM Protean");

export type RewardOption = { key: string; label: string; items: PackageItem[] };
export type RewardBox = { key: string; name: string; emoji: string; tier: number; cost: number; blurb: string; options: RewardOption[] };

const O = (key: string, label: string, items: PackageItem[]): RewardOption => ({ key, label, items });

// `cost` em PONTOS (a carteira guarda centésimos: ver PT em config.ts).
export const REWARD_BOXES: RewardBox[] = [
  { key: "trono", name: "Trono de Gelo", emoji: "👑", tier: 8, cost: 5350, blurb: "O prêmio máximo da temporada.", options: [
    O("mega", "Mega & Laboratório", [pedraMega(3), ovoLab(2), penaLabP(2), proteina(3)]),
    O("tms", "Trio de TMs", [tmPoder(), tmRegen(), tmProtean(), ovoEspecial(2), reversor(2)]),
    O("ninhada", "Ninhada Suprema", [ovoLab(5), penaLabP(3), doceRaro(60)]),
  ] },
  { key: "coroa", name: "Coroa Real", emoji: "💎", tier: 7, cost: 4050, blurb: "Quase no topo: ainda com Mega e Laboratório.", options: [
    O("mega", "Mega & Poder", [pedraMega(2), ovoLab(), penaLabP(), proteina(2)]),
    O("tms", "Dupla de TMs", [tmPoder(), tmRegen(), ovoEspecial(2)]),
    O("ninhada", "Ninhada Real", [ovoLab(3), penaEspecialP(2), doceRaro(40)]),
  ] },
  { key: "noel", name: "Presente do Noel", emoji: "🎅", tier: 6, cost: 3050, blurb: "Ovo de Laboratório e uma Pedra de Mega.", options: [
    O("mega", "Pedra do Noel", [pedraMega(), ovoLab(), proteina(2), vitamina(3)]),
    O("tm", "TM + Especial", [tmProtean(), ovoEspecial(2), penaEspecialP()]),
    O("lab", "Laboratório do Noel", [ovoLab(2), penaLab(2), doceRaro(30)]),
  ] },
  { key: "treno", name: "Trenó das Renas", emoji: "🦌", tier: 5, cost: 2250, blurb: "Ovos especiais e de evento, penas potentes.", options: [
    O("especial", "Especial Potente", [ovoEspecial(2), penaEspecialP(), proteina(), doceRaro(20)]),
    O("mega", "Pedra & Vigor", [pedraMega(), vitamina(2), amuleto(2)]),
    O("evento", "Trio de Evento", [ovoEvento(3), penaEventoP(2), doceRaro(20)]),
  ] },
  { key: "lareira", name: "Lareira Acesa", emoji: "🔥", tier: 4, cost: 1550, blurb: "Ovos especiais/de evento e bons consumíveis.", options: [
    O("ovos", "Ninho Aquecido", [ovoEspecial(), ovoRaro(2), penaRaraP(), doceRaro(15)]),
    O("loot", "Sorte e Vitaminas", [ticket(5), vitamina(3), amuleto(2), cesta(2)]),
    O("evento", "Evento Brilhante", [ovoEvento(2), penaEvento(2), doceRaro(15)]),
  ] },
  { key: "ceia", name: "Ceia da Liga", emoji: "🍽️", tier: 3, cost: 950, blurb: "Ovos raros, penas e consumíveis.", options: [
    O("ovos", "Ninho da Ceia", [ovoRaro(2), penaRara(2), doceRaro(10)]),
    O("vigor", "Banquete de Vigor", [vitamina(3), proteina(), amuleto(), cesta()]),
    O("evento", "Sobremesa de Evento", [ovoEvento(), penaEvento(), ticket(3)]),
  ] },
  { key: "meia", name: "Meia de Natal", emoji: "🧦", tier: 2, cost: 550, blurb: "Um ovo raro e mimos para o dia a dia.", options: [
    O("ovo", "Ovo na Meia", [ovoRaro(), penaComum(2), doceRaro(5)]),
    O("cuidados", "Kit Cuidados", [vitamina(2), agua(3), antidoto(2), socorros()]),
    O("sorte", "Sorte na Meia", [ticket(3), comida(30), doce(15)]),
  ] },
  { key: "bengala", name: "Bengala Doce", emoji: "🍬", tier: 1, cost: 250, blurb: "Para começar: ao alcance de quem jogou uma semana.", options: [
    O("ovo", "Ovinho Doce", [ovoComum(2), doceRaro(3), comida(20)]),
    O("mel", "Mel e Vigor", [bala(3), vitamina(), doce(15)]),
    O("sorte", "Primeira Sorte", [ticket(2), penaComum(), comida(15)]),
  ] },
];

export const boxByKey = (k: string) => REWARD_BOXES.find((b) => b.key === k);
export const optionOf = (box: RewardBox, k: string) => box.options.find((o) => o.key === k);

/** Temporada de dezembro/2026: edições começam nas segundas-feiras de dezembro (a 1ª segunda é 07/12). Janeiro só termina a última iniciada. */
export const SEASON_MONDAYS = ["2026-12-07", "2026-12-14", "2026-12-21", "2026-12-28"] as const;
