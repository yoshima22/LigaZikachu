"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Section {
  icon: string;
  title: string;
  content: React.ReactNode;
}

function GuideSection({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/60 bg-slate-900/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-800/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <span className="text-base">{section.icon}</span>
          {section.title}
        </span>
        {open ? <ChevronUp size={14} className="shrink-0 text-slate-500" /> : <ChevronDown size={14} className="shrink-0 text-slate-500" />}
      </button>
      {open && (
        <div className="border-t border-border/40 px-4 pb-4 pt-3 text-xs text-slate-400 leading-relaxed space-y-2">
          {section.content}
        </div>
      )}
    </div>
  );
}

const GUIDE_SECTIONS: Section[] = [
  {
    icon: "🏗️",
    title: "Criando e Gerenciando sua Equipe",
    content: (
      <div className="space-y-2">
        <p>Selecione de <strong className="text-slate-200">1 a 6 mascotes</strong> livres para montar uma equipe. Mascotes feridos, em repouso, expedição ou Bazar não podem entrar.</p>
        <div className="rounded-lg border border-border/40 bg-slate-900/60 p-3 space-y-1.5">
          <p className="font-semibold text-slate-300">Tipos de equipe:</p>
          <p>🤖 <strong className="text-green-300">PvE</strong> — Batalha apenas contra bots. <span className="text-green-400">Seguro</span>: não pode ser atacado por outros jogadores.</p>
          <p>⚔️ <strong className="text-red-300">PvP</strong> — Fica exposto a ataques. Não combate bots, mas gera <span className="text-[#FFCB05]">renda passiva</span> automática.</p>
          <p>🏆 <strong className="text-[#FFCB05]">PvE + PvP</strong> — Pode lutar contra bots E fica exposto. Melhor dos dois mundos, maior risco.</p>
        </div>
        <p className="text-slate-500">⏳ Ao sair da arena, cada mascote fica em <strong className="text-orange-300">cooldown de 15–30 min</strong> antes de poder entrar novamente. Isso evita rotações instantâneas.</p>
      </div>
    ),
  },
  {
    icon: "😓",
    title: "Debuff de Estamina (Fadiga)",
    content: (
      <div className="space-y-2">
        <p>Cada hora que um mascote fica na Arena, ele perde <strong className="text-orange-300">2% dos seus stats de combate</strong>. Esse debuff afeta <em>todos</em> os combates — PvE e PvP.</p>
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-1">
          <p className="font-semibold text-orange-200">Escala do debuff:</p>
          <div className="grid grid-cols-3 gap-1 text-center text-[10px] mt-1">
            {[
              ["1h", "-2%", "text-green-400"],
              ["6h", "-12%", "text-yellow-400"],
              ["12h", "-24%", "text-yellow-400"],
              ["18h", "-36%", "text-orange-400"],
              ["24h", "-48%", "text-orange-400"],
              ["36h+", "-72% (máx)", "text-red-400"],
            ].map(([t, v, c]) => (
              <div key={t} className="rounded bg-slate-800/60 py-1.5">
                <div className="text-slate-500">{t}</div>
                <div className={`font-bold ${c}`}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <p>Após <strong className="text-red-300">36 horas</strong>, o debuff trava em -72% — seus mascotes entram em combate com apenas 28% do potencial original. É um sinal claro para retirar a equipe!</p>
        <p className="text-slate-500">O debuff é calculado individualmente para cada time (atacante e defensor têm seus próprios debuffs). O <span className="text-[#FFCB05] font-semibold">badge 😓 -X%</span> aparece nos cards de equipe.</p>
      </div>
    ),
  },
  {
    icon: "💰",
    title: "Cofre e Renda Passiva",
    content: (
      <div className="space-y-2">
        <p>Todo loot de batalhas vai para o <strong className="text-[#FFCB05]">Cofre</strong> da equipe. Você só recebe o dinheiro ao <strong className="text-slate-200">retirar a equipe</strong>.</p>
        <div className="rounded-lg border border-border/40 bg-slate-900/60 p-3 space-y-1.5">
          <p className="font-semibold text-slate-300">Fontes de recurso:</p>
          <p>⚔️ <strong className="text-slate-200">Vitórias PvE</strong> — ZC, EXP e itens adicionados ao cofre após cada batalha.</p>
          <p>🤝 <strong className="text-slate-200">Renda Passiva (PvP/BOTH)</strong> — <span className="text-[#FFCB05]">+5 ZC e +10 EXP por mascote por hora</span>, acumulada automaticamente no cofre. Máximo de 24h de acúmulo.</p>
          <p>🏆 <strong className="text-slate-200">Vitória defensiva PvP</strong> — Além de guardar seu cofre, o defensor recebe bônus de ZC e pode dropar ovos.</p>
        </div>
        <p className="text-slate-500">O cofre fica visível para outros jogadores PvP — eles podem atacar para roubar uma parcela do que você acumulou.</p>
      </div>
    ),
  },
  {
    icon: "⏱️",
    title: "Multiplicador de Tempo",
    content: (
      <div className="space-y-2">
        <p>Quanto mais tempo a equipe fica na Arena, <strong className="text-[#FFCB05]">maior o multiplicador</strong> aplicado ao cofre quando você retirar.</p>
        <div className="rounded-lg border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3">
          <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
            {[
              ["1h", "×1.1", "text-slate-300"],
              ["6h", "×1.5", "text-slate-200"],
              ["12h", "×2.0", "text-yellow-300"],
              ["24h", "×3.0", "text-yellow-200"],
              ["30h", "×3.5", "text-[#FFCB05]"],
              ["36h+", "×4.0", "text-[#FFCB05] font-black"],
            ].map(([t, v, c]) => (
              <div key={t} className="rounded bg-slate-800/60 py-1.5">
                <div className="text-slate-500">{t}</div>
                <div className={c}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-2.5 space-y-1 text-[11px]">
          <p className="font-semibold text-slate-300">⚠️ Detalhes importantes:</p>
          <p>• O multiplicador se aplica <strong>apenas sobre a renda passiva PvP</strong> (para equipes PvE+PvP). Ganhos de batalha PvE não são multiplicados.</p>
          <p>• Retirar dentro de <strong className="text-red-300">2h após a última batalha PvP</strong> reduz o multiplicador pela metade (penalidade de saída rápida).</p>
          <p>• O <span className="text-[#FFCB05]">debuff de estamina</span> e o multiplicador de tempo são independentes — convém sair entre 12h–24h para equilibrar os dois.</p>
        </div>
        <p className="text-slate-500 text-[11px]">💡 Ponto ideal: em torno de <strong className="text-slate-300">18–24h</strong> o multiplicador já está em ×2.5–×3.0 com debuff de -36%–-48%. Ficar além de 30h aumenta o multiplicador mas o debuff começa a pesar muito nos combates.</p>
      </div>
    ),
  },
  {
    icon: "⚔️",
    title: "Fluxo do PvP — Passo a Passo",
    content: (
      <div className="space-y-2">
        <div className="space-y-2">
          {[
            {
              n: "1",
              title: "Você ataca",
              body: "Escolha uma equipe adversária visível na seção PvP. Cooldown de 10 min entre ataques. Você não pode atacar o mesmo time por 30 min.",
              color: "border-blue-500/30 bg-blue-500/5 text-blue-300",
            },
            {
              n: "2",
              title: "Combate automático",
              body: "Os mascotes dos dois times lutam automaticamente. O resultado depende dos stats, tipos e do debuff de estamina de cada time.",
              color: "border-slate-600/40 bg-slate-800/40 text-slate-300",
            },
            {
              n: "3a",
              title: "Atacante vence",
              body: "Rouba 30% do cofre adversário (com multiplicador de tempo do defensor). O defensor perde mascotes feridos e 40% do cofre vai para o chão.",
              color: "border-green-500/30 bg-green-500/5 text-green-300",
            },
            {
              n: "3b",
              title: "Defensor vence",
              body: "Guarda o cofre intacto + recebe bônus de ZC (40–125 ZC base + bônus de rival/defesa perfeita) + possibilidade de dropar um ovo.",
              color: "border-purple-500/30 bg-purple-500/5 text-purple-300",
            },
            {
              n: "4",
              title: "Defensor é notificado",
              body: "Um aviso aparece antes do próximo combate PvE do defensor. Ele pode ver o replay da batalha antes de continuar. O defensor deve visualizar o resultado antes de retirar a equipe.",
              color: "border-orange-500/30 bg-orange-500/5 text-orange-300",
            },
            {
              n: "5",
              title: "Ferimentos",
              body: "O time perdedor pode ter mascotes feridos. Use Atendimento SUS (10 ZC) para curar — o mascote entra em repouso de 3h antes de voltar ao banco.",
              color: "border-red-500/30 bg-red-500/5 text-red-300",
            },
          ].map(step => (
            <div key={step.n} className={`flex gap-2.5 rounded-lg border p-2.5 ${step.color}`}>
              <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[9px] font-black text-slate-200">{step.n}</span>
              <div>
                <p className="font-semibold text-[11px]">{step.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-2.5 text-[10px] text-[#FFCB05]">
          💡 <strong>Ataque Oportunista:</strong> se um rival seu está com um mascote ferido, você pode atacar esse mascote individualmente para roubar EXP extra e aumentar o tempo de recuperação dele — <em>mas só se houver uma relação de RIVAL entre vocês</em>.
        </div>
      </div>
    ),
  },
  {
    icon: "🤖",
    title: "Batalhas PvE (Bots)",
    content: (
      <div className="space-y-2">
        <p>Enfrente treinadores automáticos com dificuldades diferentes. Cooldown de <strong className="text-slate-200">3 min</strong> entre batalhas.</p>
        <div className="rounded-lg border border-border/40 bg-slate-900/60 p-3">
          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            {[
              { diff: "Fácil", mult: "×0.7", reward: "Menor risco, menos loot", color: "text-green-400" },
              { diff: "Normal", mult: "×1.0", reward: "Equilibrado", color: "text-blue-400" },
              { diff: "Difícil", mult: "×1.8", reward: "Risco alto, +80% loot", color: "text-red-400" },
            ].map(d => (
              <div key={d.diff} className="rounded bg-slate-800/60 p-2 space-y-1">
                <p className={`font-bold ${d.color}`}>{d.diff}</p>
                <p className="text-slate-300">{d.mult} loot</p>
                <p className="text-slate-600">{d.reward}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-slate-500">O bot é <strong className="text-slate-300">gerado deterministicamente</strong> — o nível do bot muda a cada 10 min, mas é igual para todos que batalham no mesmo período. Use o preview antes de confirmar.</p>
        <p className="text-slate-500">Recompensas PvE têm redução global de <strong className="text-slate-300">15%</strong> comparado ao base (para equilibrar com PvP passivo).</p>
      </div>
    ),
  },
  {
    icon: "🥚",
    title: "Drops de Ovos PvP",
    content: (
      <div className="space-y-2">
        <p>Vitórias e defesas bem-sucedidas em PvP podem dropar ovos — a probabilidade depende do contexto da batalha.</p>
        <div className="rounded-lg border border-border/40 bg-slate-900/60 p-3 overflow-x-auto">
          <table className="w-full text-[10px] text-center">
            <thead>
              <tr className="text-slate-500">
                <td className="text-left pr-2 font-semibold">Situação</td>
                <td>Comum</td>
                <td>Raro</td>
                <td>Especial</td>
                <td>Lab</td>
              </tr>
            </thead>
            <tbody className="space-y-1">
              {[
                ["Vitória fácil",     "5%",    "0.25%", "—",      "—"],
                ["Vitória equil.",    "9%",    "0.4%",  "0.25%",  "—"],
                ["Vitória difícil",   "14%",   "0.75%", "0.4%",   "0.25%"],
                ["Vitória vs rival",  "16%",   "0.9%",  "0.5%",   "0.25%"],
                ["Defesa comum",      "8%",    "0.35%", "0.25%",  "—"],
                ["Defesa perfeita",   "12.5%", "0.6%",  "0.35%",  "0.25%"],
              ].map(([s, ...vals]) => (
                <tr key={s} className="border-t border-border/20">
                  <td className="text-left py-1 pr-2 text-slate-400">{s}</td>
                  {vals.map((v, i) => (
                    <td key={i} className={v === "—" ? "text-slate-700" : "text-[#FFCB05] font-semibold"}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-500 text-[11px]">Defesa perfeita = defensor mais fraco vencendo o atacante. Rival = existe relação de RIVAL entre os times.</p>
      </div>
    ),
  },
  {
    icon: "🏆",
    title: "Recompensas de Defesa PvP",
    content: (
      <div className="space-y-2">
        <p>Quando você <strong className="text-slate-200">defende com sucesso</strong> um ataque PvP, recebe ZC diretamente no cofre além de manter seu loot intacto.</p>
        <div className="rounded-lg border border-border/40 bg-slate-900/60 p-3">
          <div className="space-y-1.5 text-[11px]">
            {[
              ["Defesa comum",       "40 – 90 ZC"],
              ["Defesa equilibrada", "75 – 125 ZC"],
              ["+ Rival",            "+25 ZC bônus"],
              ["+ Defesa perfeita",  "+40 ZC bônus"],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between">
                <span className="text-slate-400">{label}</span>
                <span className="font-semibold text-[#FFCB05]">{val}</span>
              </div>
            ))}
          </div>
        </div>
        <p>Mascotes defensores sobreviventes também recebem <strong className="text-slate-200">EXP de defesa</strong>: 30 EXP base, 50 EXP em defesa perfeita.</p>
      </div>
    ),
  },
];

export function ArenaGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-slate-950/60">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-900/40 transition-colors rounded-2xl"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <div>
            <p className="font-semibold text-slate-200 text-sm">Como funciona a Arena Z</p>
            <p className="text-[10px] text-slate-500 mt-0.5">PvP, debuffs, multiplicadores, renda passiva, drops de ovos e mais</p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">{open ? "Fechar" : "Ver guia"}</span>
          {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          <p className="text-[11px] text-slate-500 mb-3">
            Clique em cada seção para expandir. O Prof. Enguiça explica tudo! 🦎
          </p>
          {GUIDE_SECTIONS.map(s => (
            <GuideSection key={s.title} section={s} />
          ))}
        </div>
      )}
    </div>
  );
}
