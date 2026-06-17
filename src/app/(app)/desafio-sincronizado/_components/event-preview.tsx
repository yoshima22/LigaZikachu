"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Gift, Sparkles, Swords, Ticket, Zap } from "lucide-react";

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
  {
    position: 5,
    medal: "✨",
    label: "5º em diante",
    coins: 150,
    egg: "Ovo Comum",
    item: "Agua Fresca",
    highlight: "border-cyan-500/20 bg-cyan-500/5",
    coinColor: "text-cyan-300",
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
  const [openSection, setOpenSection] = useState<"rewards" | "modifiers" | "tickets" | null>("rewards");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const toggle = (section: "rewards" | "modifiers" | "tickets") =>
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
          <div className="border-t border-border p-4 space-y-3">
            <p className="text-xs leading-relaxed text-slate-400">
              Premios sao entregues por jogador da dupla. As quatro primeiras colocacoes recebem premios progressivos;
              todas as duplas abaixo do 4º lugar recebem a mesma recompensa de participacao.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
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

      {/* ── Como funcionam os tickets ─────────────────────────────────── */}
      <TicketExplainer openSection={openSection} toggle={toggle} />

      {/* ── Regra de seleção ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-slate-950/40 px-4 py-3">
        <div className="flex items-start gap-2">
          <Swords size={14} className="text-slate-500 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-400 space-y-1">
            <p><span className="font-semibold text-slate-300">Arena única:</span> todas as duplas prontas entram na mesma Arena Sincronizada. Não existe mais limite fixo de 4 duplas por sala.</p>
            <p><span className="font-semibold text-slate-300">Número ímpar:</span> se uma rodada ficar com uma dupla sem adversário, ela enfrenta o Bot Sincronizado em vez de receber folga.</p>
            <p><span className="font-semibold text-slate-300">Regra do desconhecimento:</span> você escolhe 3 mascotes <em>antes</em> do modificador ser revelado. Estratégia e sorte andam juntas.</p>
            <p><span className="font-semibold text-slate-300">Uso único:</span> cada mascote só pode ser usado 1 vez por evento, exceto em desempate.</p>
            <p><span className="font-semibold text-slate-300">Desempate:</span> se duplas empatarem em 1º, elas jogam uma rodada extra podendo reutilizar qualquer um dos 9 mascotes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ticket Explainer ──────────────────────────────────────────────────────────

function TicketExplainer({
  openSection,
  toggle,
}: {
  openSection: "rewards" | "modifiers" | "tickets" | null;
  toggle: (s: "rewards" | "modifiers" | "tickets") => void;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => toggle("tickets")}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-950/60"
      >
        <div className="flex items-center gap-2">
          <Ticket size={16} className="text-[#FFCB05]" />
          <span className="text-sm font-semibold text-slate-100">Como funcionam os tickets</span>
        </div>
        {openSection === "tickets"
          ? <ChevronDown size={15} className="text-slate-500" />
          : <ChevronRight size={15} className="text-slate-500" />}
      </button>

      {openSection === "tickets" && (
        <div className="border-t border-border p-4 space-y-4 text-xs text-slate-400">

          {/* Composição do ticket */}
          <div>
            <p className="font-semibold text-slate-200 mb-1">O que é um Ticket Completo?</p>
            <p>Para entrar no Desafio Sincronizado você precisa montar um <span className="font-semibold text-slate-200">Ticket Completo de Desafio</span>, formado por duas metades:</p>
            <div className="mt-2 flex gap-2">
              <div className="flex-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-center">
                <p className="text-[10px] font-bold text-blue-300 uppercase tracking-wide">Metade Esquerda</p>
              </div>
              <div className="flex items-center text-slate-600 font-bold">+</div>
              <div className="flex-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-center">
                <p className="text-[10px] font-bold text-purple-300 uppercase tracking-wide">Metade Direita</p>
              </div>
            </div>
            <p className="mt-2">Você pode ganhar metades jogando Arena, expedições, reciclagem de mascotes ou partidas validadas de Pokémon TCG Live.</p>
          </div>

          {/* Regra principal */}
          <div className="rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/5 px-3 py-2.5">
            <p className="font-bold text-[#FFCB05] mb-1">Regra mais importante</p>
            <p>Você <span className="font-semibold text-slate-200">não pode usar uma metade gerada por você mesmo</span>. Se você ganhou uma metade, ela precisa ser enviada para outro jogador.</p>
          </div>

          {/* Exemplo */}
          <div>
            <p className="font-semibold text-slate-200 mb-2">Exemplo prático</p>
            <div className="space-y-1.5">
              <div className="flex gap-2 items-start">
                <span className="shrink-0 w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 text-[9px] font-bold flex items-center justify-center">1</span>
                <p>Luiz ganha uma <span className="text-blue-300 font-semibold">metade esquerda</span> — mas não pode usá-la para si mesmo.</p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="shrink-0 w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 text-[9px] font-bold flex items-center justify-center">2</span>
                <p>Luiz envia a metade esquerda para <span className="font-semibold text-slate-200">Rodrigo</span>.</p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="shrink-0 w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 text-[9px] font-bold flex items-center justify-center">3</span>
                <p>Moisés ganha uma <span className="text-purple-300 font-semibold">metade direita</span> e também envia para Rodrigo.</p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="shrink-0 w-4 h-4 rounded-full bg-[#FFCB05]/20 text-[#FFCB05] text-[9px] font-bold flex items-center justify-center">✓</span>
                <p>Rodrigo tem as duas metades — nenhuma foi gerada por ele — e pode montar o <span className="font-semibold text-[#FFCB05]">Ticket Completo</span>.</p>
              </div>
            </div>
          </div>

          {/* Bloqueio */}
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
            <p className="font-bold text-red-300 mb-1">Bloqueio automático</p>
            <p>O ticket guarda o nome dos dois jogadores que geraram as metades. No exemplo, <span className="font-semibold text-slate-200">Luiz e Moisés</span> ficam bloqueados de entrar na sala criada com o ticket do Rodrigo — para evitar que alguém combine tudo sozinho ou use os próprios drops.</p>
          </div>

          {/* Resumo */}
          <div>
            <p className="font-semibold text-slate-200 mb-2">Resumo rápido</p>
            <ol className="space-y-1 list-none">
              {[
                "Você ganha uma metade (esquerda ou direita).",
                "Não pode usar uma metade gerada por você mesmo.",
                "Envie suas metades para outros jogadores.",
                "Para montar o ticket, junte uma esquerda + uma direita de jogadores diferentes.",
                "O ticket bloqueia os dois geradores de entrar na mesma sala.",
                "Com o ticket completo, você entra no Desafio e forma uma dupla.",
              ].map((step, i) => (
                <li key={i} className="flex gap-2 items-start">
                  <span className="shrink-0 font-mono text-[#FFCB05] text-[10px] mt-0.5">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-slate-500 italic">A ideia é fazer os tickets circularem entre jogadores e criar mais interação antes do evento começar.</p>
          </div>
        </div>
      )}
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
