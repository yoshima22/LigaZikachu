"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Gift, Sparkles, Swords, Zap } from "lucide-react";

// ── Recompensas fixas por posição ──────────────────────────────────────────────

const REWARDS = [
  {
    position: 1,
    medal: "🥇",
    label: "1º lugar",
    coins: 1200,
    egg: "Ovo de Evento",
    item: "Amuleto da Sorte",
    highlight: "border-[#FFCB05]/40 bg-[#FFCB05]/5",
    coinColor: "text-[#FFCB05]",
  },
  {
    position: 2,
    medal: "🥈",
    label: "2º lugar",
    coins: 800,
    egg: "Ovo Especial",
    item: "Vitamina Chocante",
    highlight: "border-slate-400/30 bg-slate-400/5",
    coinColor: "text-slate-300",
  },
  {
    position: 3,
    medal: "🥉",
    label: "3º lugar",
    coins: 500,
    egg: "Ovo Raro",
    item: "Bala de Mel",
    highlight: "border-amber-700/30 bg-amber-900/10",
    coinColor: "text-amber-400",
  },
  {
    position: 4,
    medal: "4️⃣",
    label: "4º lugar",
    coins: 300,
    egg: "Ovo Comum",
    item: "Água Fresca",
    highlight: "border-border bg-slate-950/40",
    coinColor: "text-slate-400",
  },
];

// ── Categorias de modificadores visíveis ──────────────────────────────────────

const MODIFIER_CATEGORIES = [
  {
    label: "Status",
    color: "text-purple-300",
    border: "border-purple-500/30",
    bg: "bg-purple-500/10",
    icon: "⚡",
    description: "Alteram os atributos dos mascotes antes do combate.",
  },
  {
    label: "Regra",
    color: "text-blue-300",
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    icon: "📋",
    description: "Mudam como a vitória é calculada naquela rodada.",
  },
  {
    label: "Recompensa",
    color: "text-green-300",
    border: "border-green-500/30",
    bg: "bg-green-500/10",
    icon: "🎁",
    description: "Adicionam itens e ZC extras para jogadores da partida.",
  },
  {
    label: "Caótico",
    color: "text-orange-300",
    border: "border-orange-500/30",
    bg: "bg-orange-500/10",
    icon: "🌀",
    description: "Efeitos imprevisíveis que podem inverter o resultado.",
  },
  {
    label: "Bloqueio",
    color: "text-red-300",
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    icon: "🔒",
    description: "Restringem quais mascotes podem ser usados.",
  },
];

interface PublicModifier {
  id: string;
  name: string;
  description: string;
}

interface Props {
  modifiers: PublicModifier[];
}

export function EventPreview({ modifiers }: Props) {
  const [openSection, setOpenSection] = useState<"rewards" | "modifiers" | null>("rewards");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const toggle = (section: "rewards" | "modifiers") =>
    setOpenSection((prev) => (prev === section ? null : section));

  return (
    <div className="space-y-3">
      {/* ── Recompensas ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => toggle("rewards")}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-950/60"
        >
          <div className="flex items-center gap-2">
            <Gift size={16} className="text-[#FFCB05]" />
            <span className="text-sm font-semibold text-slate-100">Recompensas por posição</span>
          </div>
          {openSection === "rewards" ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-500" />}
        </button>

        {openSection === "rewards" && (
          <div className="border-t border-border p-4 grid gap-3 sm:grid-cols-2">
            {REWARDS.map((r) => (
              <div key={r.position} className={`rounded-xl border p-3 ${r.highlight}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{r.medal}</span>
                  <span className="text-sm font-bold text-slate-200">{r.label}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <p className={`font-bold ${r.coinColor}`}>💰 {r.coins} ZC</p>
                  <p className="text-slate-300">🥚 {r.egg}</p>
                  <p className="text-slate-300">🎁 {r.item}</p>
                </div>
                <p className="mt-2 text-[10px] text-slate-500">por jogador da dupla</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modificadores ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden">
        <button
          onClick={() => toggle("modifiers")}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-950/60"
        >
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-purple-400" />
            <span className="text-sm font-semibold text-slate-100">Modificadores possíveis</span>
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300">
              {modifiers.length} na pool
            </span>
          </div>
          {openSection === "modifiers" ? <ChevronDown size={15} className="text-slate-500" /> : <ChevronRight size={15} className="text-slate-500" />}
        </button>

        {openSection === "modifiers" && (
          <div className="border-t border-border p-4 space-y-4">
            <p className="text-xs text-slate-400">
              Um modificador é sorteado por rodada <span className="font-semibold text-slate-200">depois</span> que os mascotes são escolhidos — você escolhe sem saber qual será. Conheça os possíveis abaixo:
            </p>

            {modifiers.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nenhum modificador ativo no momento. O admin pode popularizá-los no painel de administração.</p>
            ) : (
              <div className="space-y-3">
                {MODIFIER_CATEGORIES.map((cat) => (
                  <div key={cat.label} className={`rounded-xl border ${cat.border} overflow-hidden`}>
                    <button
                      onClick={() => setOpenCategory((prev) => (prev === cat.label ? null : cat.label))}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left ${cat.bg}`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{cat.icon}</span>
                        <span className={`text-xs font-bold uppercase tracking-wide ${cat.color}`}>{cat.label}</span>
                        <span className="text-[10px] text-slate-500 hidden sm:inline">— {cat.description}</span>
                      </div>
                      {openCategory === cat.label
                        ? <ChevronDown size={13} className="text-slate-500 shrink-0" />
                        : <ChevronRight size={13} className="text-slate-500 shrink-0" />}
                    </button>

                    {openCategory === cat.label && (
                      <div className="divide-y divide-border/40">
                        {modifiers
                          .filter((m) => getCategoryForModifier(m.name) === cat.label)
                          .map((m) => (
                            <div key={m.id} className="px-3 py-2 text-xs">
                              <p className="font-semibold text-slate-200">{m.name}</p>
                              <p className="text-slate-400 mt-0.5">{m.description}</p>
                            </div>
                          ))}
                        {modifiers.filter((m) => getCategoryForModifier(m.name) === cat.label).length === 0 && (
                          <p className="px-3 py-2 text-xs text-slate-600 italic">Nenhum ativo nesta categoria.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Regra de seleção ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-slate-950/40 px-4 py-3">
        <div className="flex items-start gap-2">
          <Swords size={14} className="text-slate-500 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-400 space-y-1">
            <p><span className="font-semibold text-slate-300">Regra do desconhecimento:</span> você escolhe 3 mascotes <em>antes</em> do modificador ser revelado. Estratégia e sorte andam juntas.</p>
            <p><span className="font-semibold text-slate-300">Uso único:</span> cada mascote só pode ser usado 1 vez por evento (exceto no desempate).</p>
            <p><span className="font-semibold text-slate-300">Desempate:</span> se duas duplas empatarem em 1º, jogam uma rodada extra podendo reutilizar qualquer um dos 9.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mapeamento nome → categoria ────────────────────────────────────────────────

const STATUS_MODIFIERS = new Set([
  "Pequenos Gigantes", "Força Demais Atrapalha", "Corrida dos Ligeiros",
  "Cansaço dos Fortes", "Instinto Selvagem", "Carisma de Palco",
  "Fraqueza Exposta", "Equilíbrio Forçado", "Virada dos Fracos", "Treino Relâmpago",
]);
const RULE_MODIFIERS = new Set([
  "Concurso de Carisma", "Queda de Braço", "Corrida de Agilidade",
  "União Perfeita", "Time Desajustado", "Duelo Limpo", "Virada Final",
]);
const REWARD_MODIFIERS = new Set([
  "Ovo no Campo", "Achado Raro", "Doce Vitória", "Água no Intervalo",
  "Energia Sincronizada", "Sorte Compartilhada", "Prêmio do Azarão",
  "Caçador de Ovos", "Especial do Dia", "Presente do Público",
]);
const CHAOTIC_MODIFIERS = new Set([
  "Troca de Papéis", "Instinto Confuso", "Tática Invertida", "Aula do Enguiça",
  "Pane na Arena", "Clima Esquisito", "Dupla Desafinada", "Harmonia Total", "Medo do Favorito",
]);

function getCategoryForModifier(name: string): string {
  if (STATUS_MODIFIERS.has(name)) return "Status";
  if (RULE_MODIFIERS.has(name)) return "Regra";
  if (REWARD_MODIFIERS.has(name)) return "Recompensa";
  if (CHAOTIC_MODIFIERS.has(name)) return "Caótico";
  return "Bloqueio";
}
