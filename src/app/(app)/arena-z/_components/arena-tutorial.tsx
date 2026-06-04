"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight } from "lucide-react";

const STEPS = [
  {
    icon: "⚔️",
    title: "Bem-vindo à Arena Z!",
    body: "A Arena Z é o modo de combate automático entre mascotes. Monte equipes, enfrente bots ou outros jogadores, acumule loot e gerencie seus mascotes estrategicamente.",
  },
  {
    icon: "🐾",
    title: "Montando sua Equipe",
    body: "Selecione de 1 a 6 mascotes livres (não feridos, em repouso, expedição ou Bazar) e crie uma equipe. Mascotes na Arena ficam bloqueados para outras atividades.",
  },
  {
    icon: "🤖",
    title: "Arena Bots (PvE)",
    body: "Escolha a dificuldade (Fácil / Normal / Difícil) e enfrente bots gerados automaticamente. Vencer acumula ZC, EXP e itens no cofre da equipe. Cooldown de 3 min entre batalhas.",
  },
  {
    icon: "⚔️",
    title: "Arena PvP",
    body: "Ataque equipes ativas de outros jogadores! Vencer rouba 30% do cofre adversário. Perder = mascotes feridos + 40% do cofre perdido. Cooldown de 10 min entre ataques.",
  },
  {
    icon: "💰",
    title: "O Cofre da Arena",
    body: "Cada vitória acumula loot no cofre. Quanto mais tempo na Arena, mais acumula — mas maior o risco de ser atacado. Use 'Retirar e coletar' quando quiser garantir os ganhos.",
  },
  {
    icon: "🤕",
    title: "Ferimentos e Recuperação",
    body: "Mascotes derrotados ficam feridos. Pague ZC no Atendimento SUS para curar. Após cura, eles ficam em repouso mínimo de 3h antes de voltar à ação.",
  },
];

export function ArenaTutorial() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem("arena-z-tutorial-v1");
    if (!seen) setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem("arena-z-tutorial-v1", "1");
    setShow(false);
  };

  if (!show) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#FFCB05]/30 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-[#FFCB05] transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6 space-y-4">
          {/* Step counter */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">
              {step + 1} de {STEPS.length}
            </span>
            <button onClick={dismiss} className="rounded-lg border border-border p-1.5 text-slate-500 hover:text-slate-200">
              <X size={12} />
            </button>
          </div>

          {/* Content */}
          <div className="text-center space-y-3">
            <div className="text-5xl">{current.icon}</div>
            <h3 className="text-lg font-bold text-white">{current.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{current.body}</p>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex-1 rounded-xl border border-border py-2.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Anterior
              </button>
            )}
            <button
              onClick={() => isLast ? dismiss() : setStep(s => s + 1)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#FFCB05] py-2.5 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700]"
            >
              {isLast ? "Começar!" : (
                <>Próximo <ChevronRight size={13} /></>
              )}
            </button>
          </div>

          {/* Skip */}
          {!isLast && (
            <button onClick={dismiss} className="w-full text-center text-[10px] text-slate-600 hover:text-slate-400">
              Pular tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
