// Camada visual dos replays: transforma as notas de efeito (texto já gravado no
// log do combate) em chips com ícone e cor, com o texto completo no tooltip.
// Verde: buff · Vermelho: debuff · Azul: proteção · Roxo: personalidade · Amarelo: item.
// Combates antigos sem notas simplesmente não geram chips.

type EffectKind = "buff" | "debuff" | "protection" | "personality" | "item" | "neutral";

const KIND_STYLE: Record<EffectKind, { emoji: string; cls: string }> = {
  buff:        { emoji: "🟢", cls: "border-green-500/30 bg-green-500/10 text-green-300" },
  debuff:      { emoji: "🔴", cls: "border-red-500/30 bg-red-500/10 text-red-300" },
  protection:  { emoji: "🔵", cls: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
  personality: { emoji: "🟣", cls: "border-purple-500/30 bg-purple-500/10 text-purple-300" },
  item:        { emoji: "🟡", cls: "border-yellow-400/30 bg-yellow-400/10 text-yellow-200" },
  neutral:     { emoji: "⚪", cls: "border-slate-600/40 bg-slate-700/20 text-slate-300" },
};

// Ordem importa: a primeira regra que casar define a categoria da frase.
const RULES: Array<{ kind: EffectKind; re: RegExp }> = [
  { kind: "personality", re: /personalidade|instinto confuso|último ato|dramático .*(sobreviv|hp)|volatilidade|leal .*(protege|defende)/i },
  { kind: "debuff",      re: /travessura|reduziu|resistência aplicada|sabotador|bloqueou|debuff|menos \d/i },
  { kind: "protection",  re: /guardião|absorveu|protegeu|sobrevivente|desviou|preparou defesa|interceptou|resistiu ao golpe/i },
  { kind: "buff",        re: /encorajador|batedor|curou|cuidador|impulso|precisão|ação extra|agilidade: ação|\+\d+%/i },
  { kind: "item",        re: /vitamina|ovo|pena|ticket|amuleto|item|pedra/i },
];

function classify(sentence: string): EffectKind {
  for (const r of RULES) if (r.re.test(sentence)) return r.kind;
  return "neutral";
}

function splitEffect(effect: string): string[] {
  return effect
    .split(/(?<=[.!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function EffectChips({ effect, className }: { effect?: string | null; className?: string }) {
  if (!effect) return null;
  const parts = splitEffect(effect);
  if (parts.length === 0) return null;
  return (
    <div className={`flex flex-wrap justify-center gap-1 ${className ?? ""}`}>
      {parts.map((p, i) => {
        const style = KIND_STYLE[classify(p)];
        return (
          <span key={i} title={p} className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] leading-tight ${style.cls}`}>
            <span className="shrink-0">{style.emoji}</span>
            <span className="truncate">{p}</span>
          </span>
        );
      })}
    </div>
  );
}
