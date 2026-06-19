import { TraceTarget } from "@prisma/client";

export type TraceEvent = {
  code: string;
  label: string;
  description: string;
  target: TraceTarget;
  positiveForHider: boolean;
  effectType:
    | "FOCUS_GAIN_HIDER"
    | "FOCUS_LOSS_HIDER"
    | "SKIP_NEXT_MOVE"
    | "REVEAL_HINT"
    | "FLAVOR_ONLY";
};

export const TRACE_EVENTS: TraceEvent[] = [
  // Positivos para o HIDER (caçador em desvantagem)
  { code: "NEBLINA_DENSA", label: "Neblina Densa", description: "Uma neblina espessa cobre a rota — o esconderijo ganha +1 Foco.", target: "HIDER", positiveForHider: true, effectType: "FOCUS_GAIN_HIDER" },
  { code: "CHUVA_REPENTINA", label: "Chuva Repentina", description: "Uma chuva apaga os rastros — o caçador pula o próximo movimento.", target: "HUNTER", positiveForHider: true, effectType: "SKIP_NEXT_MOVE" },
  { code: "TRILHA_CAMUFLADA", label: "Trilha Camuflada", description: "O esconderijo se camufla perfeitamente — +1 Foco para o escondido.", target: "HIDER", positiveForHider: true, effectType: "FOCUS_GAIN_HIDER" },
  { code: "VENTO_FORTE", label: "Vento Forte", description: "O vento apaga os cheiros — o caçador perde a trilha por um momento.", target: "HUNTER", positiveForHider: true, effectType: "SKIP_NEXT_MOVE" },
  { code: "SOMBRA_NOTURNA", label: "Sombra Noturna", description: "A escuridão favorece o escondido — +1 Foco.", target: "HIDER", positiveForHider: true, effectType: "FOCUS_GAIN_HIDER" },
  { code: "POÇA_DE_LAMA", label: "Poça de Lama", description: "O caçador cai em uma poça de lama — próximo movimento é pulado.", target: "HUNTER", positiveForHider: true, effectType: "SKIP_NEXT_MOVE" },
  { code: "NINHO_DE_VESPAS", label: "Ninho de Vespas", description: "O caçador tromba com um ninho — disturbado, pula o próximo passo.", target: "HUNTER", positiveForHider: true, effectType: "SKIP_NEXT_MOVE" },
  { code: "RASTRO_FALSO", label: "Rastro Falso", description: "Um rastro falso confunde o caçador — o escondido ganha +1 Foco.", target: "HIDER", positiveForHider: true, effectType: "FOCUS_GAIN_HIDER" },
  { code: "BRISA_REFRESCANTE", label: "Brisa Refrescante", description: "Uma brisa suave revigora o escondido — +1 Foco.", target: "HIDER", positiveForHider: true, effectType: "FOCUS_GAIN_HIDER" },
  { code: "CAMUFLAGEM_NATURAL", label: "Camuflagem Natural", description: "O mascote se mescla ao ambiente — +1 Foco extra.", target: "HIDER", positiveForHider: true, effectType: "FOCUS_GAIN_HIDER" },
  // Negativos para o HIDER (caçador em vantagem)
  { code: "PATA_BARULHENTA", label: "Pata Barulhenta", description: "O mascote escondido faz barulho — o caçador recebe uma dica de direção.", target: "HUNTER", positiveForHider: false, effectType: "REVEAL_HINT" },
  { code: "FOLHA_QUEBRADA", label: "Folha Quebrada", description: "Uma folha quebra sob o mascote — a direção correta é revelada ao caçador.", target: "HUNTER", positiveForHider: false, effectType: "REVEAL_HINT" },
  { code: "CANSAÇO_EXTREMO", label: "Cansaço Extremo", description: "O escondido está exausto — perde -1 Foco.", target: "HIDER", positiveForHider: false, effectType: "FOCUS_LOSS_HIDER" },
  { code: "RASTRO_VISÍVEL", label: "Rastro Visível", description: "O escondido deixa marcas claras — o caçador ganha uma dica.", target: "HUNTER", positiveForHider: false, effectType: "REVEAL_HINT" },
  { code: "ESPIRRO_INOPORTUNO", label: "Espirro Inoportuno", description: "Um espirro delata o escondido — direção atual revelada ao caçador.", target: "HUNTER", positiveForHider: false, effectType: "REVEAL_HINT" },
  { code: "PÂNICO", label: "Pânico!", description: "O mascote entra em pânico — -1 Foco.", target: "HIDER", positiveForHider: false, effectType: "FOCUS_LOSS_HIDER" },
  { code: "TRILHA_ABERTA", label: "Trilha Aberta", description: "A trilha fica exposta — o caçador detecta a direção correta.", target: "HUNTER", positiveForHider: false, effectType: "REVEAL_HINT" },
  { code: "GRAVETO_NO_CAMINHO", label: "Graveto no Caminho", description: "Um graveto estalou — -1 Foco para o escondido.", target: "HIDER", positiveForHider: false, effectType: "FOCUS_LOSS_HIDER" },
  { code: "CHEIRO_FORTE", label: "Cheiro Forte", description: "O aroma do mascote é inconfundível — caçador recebe dica de direção.", target: "HUNTER", positiveForHider: false, effectType: "REVEAL_HINT" },
  { code: "TERRENO_ABERTO", label: "Terreno Aberto", description: "O escondido cruzou um campo sem cobertura — perde -1 Foco.", target: "HIDER", positiveForHider: false, effectType: "FOCUS_LOSS_HIDER" },
];

export type GoldenPawShopEntry = {
  type: string;
  name: string;
  cost: number;
  description: string;
};

export const GOLDEN_PAW_SHOP: GoldenPawShopEntry[] = [
  { type: "TRACE_SIGNAL_FLARE",   name: "Sinalizador de Rastro", cost: 20,  description: "Adiciona +1 seta de dica ao caçador nesta sala." },
  { type: "TRACE_DECOY",          name: "Isca Falsa",            cost: 15,  description: "O caçador recebe uma direção falsa." },
  { type: "TRACE_SILENCE_POTION", name: "Poção do Silêncio",     cost: 25,  description: "Cancela o próximo evento aleatório." },
  { type: "TRACE_ARMOR_VEST",     name: "Colete de Armadura",    cost: 30,  description: "Absorve 1 evento negativo para o caçador." },
  { type: "TRACE_MIST_SHIELD",    name: "Escudo de Neblina",     cost: 20,  description: "Protege o Foco do escondido por 1 passo errado." },
  { type: "TRACE_INSTINCT_BOOST", name: "Impulso de Instinto",   cost: 35,  description: "Revela a direção correta do passo atual." },
  { type: "TRACE_GOLDEN_TICKET",  name: "Ticket Dourado",        cost: 100, description: "1 entrada gratuita em qualquer caçada." },
  { type: "TRACE_SPECIAL_MAP",    name: "Mapa Especial",         cost: 80,  description: "Abre uma rota Longa sem o Mapa físico." },
];
