"use client";

import { useState, useEffect, useTransition } from "react";
import { ChevronRight, X, Gift } from "lucide-react";
import { claimArenaTutorialBonusAction } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const TUTORIAL_KEY = "arena-z-tutorial-v2"; // v2 = força reset para todos

const STEPS = [
  {
    icon: "⚔️",
    title: "Bem-vindo à Arena Z!",
    body: "A Arena Z é o modo de combate automático entre mascotes. Monte equipes, enfrente bots ou outros jogadores, acumule loot e gerencie seus mascotes estrategicamente.",
    tip: null,
  },
  {
    icon: "🐾",
    title: "Montando sua Equipe",
    body: "Selecione de 1 a 6 mascotes livres e escolha o tipo: PvE (contra bots), PvP (contra jogadores) ou ambos. Mascotes na Arena ficam bloqueados para outras atividades.",
    tip: "Prof. Enguiça: Comece com mascotes de níveis parecidos — sinergia de equipe faz diferença!",
  },
  {
    icon: "🤖",
    title: "Arena Bots (PvE)",
    body: "Escolha dificuldade Fácil, Normal ou Difícil e enfrente bots automáticos. Vencer acumula ZC, EXP e itens no cofre. Cooldown de 3 min entre batalhas.",
    tip: "Prof. Enguiça: Dificuldade Difícil dá 1.8× mais loot — vale o risco se a equipe for forte!",
  },
  {
    icon: "⚔️",
    title: "Arena PvP",
    body: "Ataque equipes ativas de outros jogadores! Vencer rouba 30% do cofre adversário. Perder = mascotes feridos + 40% do cofre perdido. Cooldown de 10 min entre ataques.",
    tip: "Prof. Enguiça: Atacar e retirar o próprio time logo depois reduz 30% do bônus de tempo. Mantenha-o na Arena!",
  },
  {
    icon: "⏱️",
    title: "Multiplicador de Tempo",
    body: "Quanto mais tempo a equipe fica na Arena, maior o bônus ao sair. Começa em ×1 e cresce até ×4 após 36 horas. Retirar cedo significa desperdiçar recompensas!",
    tip: "Prof. Enguiça: Uma equipe que fica 36h sai com 4× mais recompensas. Planejar a retirada é parte da estratégia!",
  },
  {
    icon: "🤕",
    title: "Ferimentos e Recuperação",
    body: "Mascotes derrotados ficam Feridos. Use o Atendimento SUS (10 ZC) para curar. Após a cura, eles descansam 3h antes de voltar à ação.",
    tip: "Prof. Enguiça: Sempre tenha ZC disponíveis para o SUS — um mascote ferido parado é prejuízo puro!",
  },
];

export function ArenaTutorial({ tutorialClaimed }: { tutorialClaimed: boolean }) {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [showBonus, setShowBonus] = useState(false);
  const [bonusClaimed, setBonusClaimed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Já resgatou no banco → nunca mostra
    if (tutorialClaimed) return;
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (!seen) {
      // Primeira visita: mostra o tutorial completo
      setShow(true);
    } else {
      // Já viu o tutorial mas fechou sem resgatar o bônus → pula direto para o bônus
      setShow(true);
      setShowBonus(true);
    }
  }, [tutorialClaimed]);

  const handleComplete = () => {
    // NÃO grava localStorage aqui — só grava depois que o bônus for resgatado no banco
    setShowBonus(true);
  };

  const handleClaimBonus = () => {
    startTransition(async () => {
      const r = await claimArenaTutorialBonusAction();
      if (r.error) {
        toast.error(r.error);
      } else {
        // Só grava o localStorage após confirmação do servidor
        localStorage.setItem(TUTORIAL_KEY, "1");
        setBonusClaimed(true);
        toast.success("Bônus resgatado! Boa sorte na Arena Z! 🎉");
        setTimeout(() => { setShowBonus(false); setShow(false); router.refresh(); }, 1500);
      }
    });
  };

  if (!show) return null;

  // ── Tela de bônus ──────────────────────────────────────────────────────────
  if (showBonus) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-[#FFCB05]/30 bg-slate-950 shadow-2xl overflow-hidden">
          <div className="p-6 space-y-5 text-center">
            <div className="text-5xl">🎁</div>
            <div>
              <h3 className="text-lg font-bold text-[#FFCB05]">Boa sorte na Arena Z!</h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                O Prof. Enguiça preparou um presente especial para o início da sua jornada:
              </p>
            </div>
            <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 text-left space-y-1.5">
              {["🍖 3× Comida de Mascote","💊 1× Proteína Zika","💧 1× Água Sagrada","💰 200 ZikaCoins","🥚 1× Ovo Comum","🥚 1× Ovo Raro","🥚 1× Ovo Especial"].map(item => (
                <p key={item} className="text-xs text-slate-300">{item}</p>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 italic">
              &quot;Combine seus mascotes com sabedoria e o sucesso virá!&quot; — Prof. Enguiça
            </p>
            <button
              disabled={pending || bonusClaimed}
              onClick={handleClaimBonus}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#FFCB05] py-3 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
            >
              <Gift size={16} /> {bonusClaimed ? "Resgatado! 🎉" : pending ? "Resgatando…" : "Resgatar presente"}
            </button>
            <button onClick={() => { setShowBonus(false); setShow(false); }} className="text-[10px] text-slate-600 hover:text-slate-400">
              Fechar por agora (lembraremos ao voltar)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Tutorial ───────────────────────────────────────────────────────────────
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#FFCB05]/30 bg-slate-950 shadow-2xl overflow-hidden">
        <div className="h-1 bg-slate-800">
          <div className="h-full bg-[#FFCB05] transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase tracking-wide">{step + 1} de {STEPS.length}</span>
            <button onClick={handleComplete} className="rounded-lg border border-border p-1.5 text-slate-500 hover:text-slate-200">
              <X size={12} />
            </button>
          </div>
          <div className="text-center space-y-3">
            <div className="text-5xl">{current.icon}</div>
            <h3 className="text-lg font-bold text-white">{current.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{current.body}</p>
          </div>
          {current.tip && (
            <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-3 py-2">
              <p className="text-[11px] text-[#FFCB05] leading-snug">📚 {current.tip}</p>
            </div>
          )}
          <div className="flex gap-3">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="flex-1 rounded-xl border border-border py-2.5 text-xs text-slate-400 hover:text-slate-200">
                Anterior
              </button>
            )}
            <button
              onClick={() => isLast ? handleComplete() : setStep(s => s + 1)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#FFCB05] py-2.5 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700]"
            >
              {isLast ? <><Gift size={13}/> Ver presente!</> : <>Próximo <ChevronRight size={13}/></>}
            </button>
          </div>
          {!isLast && (
            <button onClick={handleComplete} className="w-full text-center text-[10px] text-slate-600 hover:text-slate-400">
              Pular e ver presente
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
