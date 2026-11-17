// Glossário do combate: fonte única das palavras-chave das descrições de habilidades (tooltips) e do manual.
// Os números vêm das mesmas constantes do motor, então a explicação nunca fica desatualizada.
import { ABILITY_CATEGORY_LIMIT, ABILITY_REDUCED_FACTOR } from "@/lib/abilities";
import { DOOM_INFO, STATUS_INFO, STATUS_RULES } from "@/lib/abilities/status";
import { CRIT_DAMAGE_BONUS, CRIT_NATURAL_CAP, CRIT_TOTAL_CAP } from "@/lib/critical";

export type GlossaryEntry = {
  /** Título do verbete. */
  term: string;
  /** Grupo no manual. */
  group: "Estados alterados" | "Atributos" | "Combate" | "Habilidades";
  /** Formas que aparecem nas descrições (sem diferenciar maiúsculas/acentos). */
  aliases: string[];
  /** Explicação detalhada (com números e cálculos). */
  body: string;
};

const p = (v: number) => `${Math.round(v * 1000) / 10}%`;
const rounds = (d: [number, number]) => (d[0] === d[1] ? `${d[0]} rodada${d[0] > 1 ? "s" : ""}` : `${d[0]} a ${d[1]} rodadas`);
const S = STATUS_INFO;
const R = STATUS_RULES;

export const GLOSSARY: GlossaryEntry[] = [
  // ── Estados alterados ──
  { term: "Envenenado", group: "Estados alterados", aliases: ["envenenado", "envenenar", "veneno"],
    body: `${S.POISON.emoji} Perde ${p(R.poisonPct)} do HP máximo no fim do turno, por ${rounds(S.POISON.duration)}. Imunes: Veneno e Metal. Só um estado alterado por vez.` },
  { term: "Queimado", group: "Estados alterados", aliases: ["queimado", "queimar", "queimadura", "queimaduras"],
    body: `${S.BURN.emoji} Perde ${p(R.burnPct)} do HP máximo no início do turno, por ${rounds(S.BURN.duration)}. Imunes: Fogo. Só um estado alterado por vez.` },
  { term: "Paralisado", group: "Estados alterados", aliases: ["paralisado", "paralisar", "paralisia"],
    body: `${S.PARALYSIS.emoji} A cada ação, ${p(R.paralysisSkip)} de chance de perder a ação, por ${rounds(S.PARALYSIS.duration)}. Imunes: Elétrico. Cada autor só mantém um rival paralisado por vez.` },
  { term: "Dormindo", group: "Estados alterados", aliases: ["dormindo", "dormir", "sono"],
    body: `${S.SLEEP.emoji} A cada ação, ${p(R.sleepWake)} de chance de acordar; se não acordar, perde a ação. Dura ${rounds(S.SLEEP.duration)}. Habilidades como Mente aberta podem ignorar o sono.` },
  { term: "Confuso", group: "Estados alterados", aliases: ["confuso", "confusão", "confusao"],
    body: `${S.CONFUSION.emoji} A cada ação, ${p(R.confusionSelfHit)} de chance de se ferir (${p(R.confusionSelfPct)} do HP máximo) em vez de atacar; a cada ação há ${p(R.confusionCure)} de chance de a confusão passar. Dura ${rounds(S.CONFUSION.duration)}. Imunes: Psíquico.` },
  { term: "Congelado", group: "Estados alterados", aliases: ["congelado", "congelar", "congelamento", "acúmulo de congelado", "acumulo de congelado"],
    body: `${S.FREEZE.emoji} Acumula até ${R.freezeMaxStacks} vezes. Cada acúmulo reduz a Agilidade em ${p(R.freezeAgilityPerStack)} e a Força em ${p(R.freezeForcePerStack)} por ${R.freezeStackRounds} rodadas (cada um com o seu tempo). No ${R.freezeMaxStacks}º acúmulo o mascote fica totalmente congelado e não age na rodada seguinte; depois o congelamento some levando todos os acúmulos. Imunes: Gelo.` },
  { term: "Maldito", group: "Estados alterados", aliases: ["maldito", "maldição", "maldicao", "amaldiçoado"],
    body: `👻 Quem ataca o mascote maldito perde 5% do HP máximo, até quem o amaldiçoou cair. Acumula com os outros estados. Imunes: Fantasma e Sombrio.` },
  { term: "Amendrontado", group: "Estados alterados", aliases: ["amendrontado", "amedrontado"],
    body: `${S.FLINCH.emoji} O mascote perde a ação desta rodada, mas só se ainda não tinha agido nela (por isso a Agilidade importa). Dura só a rodada em que é aplicado e não ocupa o limite de "um estado por vez".` },
  { term: "Apaixonado", group: "Estados alterados", aliases: ["apaixonado", "paixão", "paixao"],
    body: `${S.CHARM.emoji} Dura ${rounds(S.CHARM.duration)}. Quando vai atacar quem o encantou, tem ${p(R.charmSkip)} de chance de perder a ação; contra os outros mascotes age normalmente.` },
  { term: "Condenado", group: "Estados alterados", aliases: ["condenado", "condenar", "condenação", "condenacao"],
    body: `${DOOM_INFO.emoji} O primeiro que ataca o portador da habilidade fica condenado: quando o portador cair, o condenado cai ${DOOM_INFO.delayRounds} rodada depois (o HP vai a zero). Pode ser curado por habilidades de cura de estado. Imunes: Fantasma e Sombrio.` },
  { term: "Estado alterado", group: "Estados alterados", aliases: ["estado alterado", "estados alterados"],
    body: `Condições aplicadas por habilidades: Envenenado, Queimado, Paralisado, Dormindo, Confuso, Congelado, Maldito, Amendrontado, Apaixonado e Condenado. Cada mascote tem no máximo um estado comum por vez (Congelado, Maldito, Amendrontado e Condenado têm regras próprias). Passe o mouse em cada nome para ver o efeito.` },
  // ── Atributos ──
  { term: "Força", group: "Atributos", aliases: ["força", "forca"], body: "Ataque físico. Aumenta o dano dos golpes e é o atributo de escala de muitas habilidades de Dano. Equivale ao Ataque da Pokédex." },
  { term: "Agilidade", group: "Atributos", aliases: ["agilidade"], body: "Velocidade. Define quem age primeiro na rodada e quantas ações o mascote faz. Equivale à Velocidade da Pokédex." },
  { term: "Instinto", group: "Atributos", aliases: ["instinto"], body: "Ataque especial e precisão. Soma ao dano e, com o Carisma, define a chance de acerto crítico. Equivale ao Ataque Especial da Pokédex." },
  { term: "Vitalidade", group: "Atributos", aliases: ["vitalidade"], body: "Defesa. Reduz o dano recebido (mitigação) e aumenta o HP. Equivale à Defesa da Pokédex." },
  { term: "Carisma", group: "Atributos", aliases: ["carisma"], body: "Liderança e defesa especial. Fortalece habilidades de aliados e auras, e soma ao Instinto na chance de crítico. Equivale à Defesa Especial da Pokédex." },
  // ── Combate ──
  { term: "Acerto crítico", group: "Combate", aliases: ["acerto crítico", "acerto critico", "crítico", "critico", "críticos", "criticos"],
    body: `💥 Um golpe crítico causa +${p(CRIT_DAMAGE_BONUS)} de dano (menos que um passo de vantagem de tipo, ±20%). Chance por golpe: (Instinto + Carisma) ÷ 40 em %, +30%, com teto natural de ${p(CRIT_NATURAL_CAP)}. Habilidades somam pontos percentuais, com teto total de ${p(CRIT_TOTAL_CAP)}.` },
  { term: "Rodada", group: "Combate", aliases: ["rodada", "rodadas"], body: "Cada mascote em campo age uma vez por rodada, em ordem de Agilidade; mascotes muito ágeis ganham ações extras. Efeitos de duração contam em rodadas." },
  { term: "Ação", group: "Combate", aliases: ["ação", "ações", "acao", "acoes"], body: "O que o mascote faz na sua vez: atacar, defender ou usar uma habilidade. Estados como Paralisado, Dormindo e Amendrontado fazem o mascote perder a ação." },
  { term: "Em campo", group: "Combate", aliases: ["em campo"], body: "Os mascotes que estão lutando agora (não os reservas). Só eles contam nos limites de habilidade por categoria." },
  { term: "Aliados", group: "Combate", aliases: ["aliados", "aliado"], body: "Os outros mascotes do seu time em campo. Estados \"de aliados\" são os aplicados pelas habilidades do seu time nos rivais." },
  { term: "Rivais", group: "Combate", aliases: ["rivais", "rival", "oponente", "oponentes", "adversário", "adversario"], body: "Os mascotes do time adversário em campo." },
  { term: "Debuff", group: "Combate", aliases: ["debuff", "debuffs"], body: "Redução de um atributo (Força, Agilidade, Instinto ou Vitalidade) que dura a luta inteira. Debuffs não se somam: vale o maior valor em cada atributo." },
  { term: "Buff", group: "Combate", aliases: ["buff", "buffs"], body: "Bônus temporário vindo de posturas (Encorajador, Batedor) ou habilidades." },
  { term: "Vantagem de tipo", group: "Combate", aliases: ["vantagem de tipo", "super efetivo", "super efetivos", "resistência de tipo", "resistencia de tipo"], body: "Cada passo de vantagem de tipo muda o dano em ±20% (teto ±40%). Ex.: Água contra Fogo." },
  { term: "Provocador", group: "Combate", aliases: ["provocador", "provocadores"], body: "Postura que atrai os ataques dos rivais para si." },
  { term: "Guardião", group: "Combate", aliases: ["guardião", "guardiao"], body: "Postura que protege um aliado, absorvendo parte do dano." },
  { term: "Defensor", group: "Combate", aliases: ["defensor"], body: "Postura que prepara defesas e reduz o dano recebido." },
  // ── Habilidades ──
  { term: "Ativação", group: "Habilidades", aliases: ["ativação", "ativações", "ativacao", "ativacoes"], body: "Quantas vezes a habilidade pode disparar por luta. O contador aparece no card e no log (ex.: 1/2). Habilidades passivas (0) não gastam ativações." },
  { term: "Prioridade", group: "Habilidades", aliases: ["prioridade", "prioridade das habilidades"],
    body: `A ordem em que você monta as habilidades do time. Dentro de cada categoria, a 1ª usa 100% do efeito, a 2ª usa ${p(ABILITY_REDUCED_FACTOR)} e as seguintes ficam desligadas (limite por categoria: ${Object.entries(ABILITY_CATEGORY_LIMIT).map(([c, n]) => `${c} ${n}`).join(", ")}). Independe da posição do mascote no time.` },
  { term: "Fruta", group: "Habilidades", aliases: ["fruta", "frutas"], body: "Itens de cura e bônus usados por habilidades como Cheek Pouch e Harvest. Habilidades como Unnerve impedem os rivais de aproveitar frutas." },
  { term: "Ambiente", group: "Habilidades", aliases: ["ambiente", "clima", "terreno"], body: "Clima ou terreno criado por uma habilidade (sol, chuva, areia, granizo, terrenos). Dura as 3 primeiras rodadas e dá bônus aos aliados do tipo citado." },
  { term: "Aura", group: "Habilidades", aliases: ["aura"], body: "Bônus de dano para os golpes de um tipo enquanto o portador estiver em campo (2 vezes por luta)." },
];

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const byAlias = new Map<string, GlossaryEntry>();
for (const e of GLOSSARY) for (const a of e.aliases) if (!byAlias.has(strip(a))) byAlias.set(strip(a), e);

/** Aliases ordenados do maior para o menor (a frase mais longa casa primeiro). */
export const GLOSSARY_ALIASES = [...byAlias.keys()].sort((a, b) => b.length - a.length);

export function glossaryEntryFor(matched: string): GlossaryEntry | null {
  return byAlias.get(strip(matched)) ?? null;
}

/**
 * Divide o texto em pedaços (texto simples ou palavra-chave). A busca ignora maiúsculas/acentos e só casa palavras inteiras.
 */
export function splitKeywords(text: string): Array<{ text: string; entry: GlossaryEntry | null }> {
  // Normaliza unidade a unidade (UTF-16) para manter os índices alinhados com o texto original.
  const flat = text.split("").map((ch) => ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()[0] ?? ch).join("");
  const parts: Array<{ text: string; entry: GlossaryEntry | null }> = [];
  const isWord = (c: string | undefined) => !!c && /[a-z0-9]/.test(c);
  let i = 0, last = 0;
  while (i < flat.length) {
    let hit: string | null = null;
    if (!isWord(flat[i - 1])) {
      for (const alias of GLOSSARY_ALIASES) {
        if (flat.startsWith(alias, i) && !isWord(flat[i + alias.length])) { hit = alias; break; }
      }
    }
    if (hit) {
      if (i > last) parts.push({ text: text.slice(last, i), entry: null });
      parts.push({ text: text.slice(i, i + hit.length), entry: byAlias.get(hit)! });
      i += hit.length; last = i;
    } else i++;
  }
  if (last < text.length) parts.push({ text: text.slice(last), entry: null });
  return parts;
}
