import { Zap } from "lucide-react";
import { ProfessorChat } from "./_components/professor-chat";

export const metadata = { title: "Professor Enguiça | Liga Zikachu" };

export default function ProfessorPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFCB05] to-[#FFD700] shadow-[0_0_24px_rgba(255,203,5,0.4)]">
            <Zap className="h-8 w-8 text-[#1A1A2E]" strokeWidth={2.5} />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#7AC74C] text-[8px] font-bold text-white">
              ⚡
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
            <h1 className="font-pixel text-base text-[#FFCB05]">Professor Enguiça</h1>
            <p className="text-sm text-slate-400">
              O Treinador da Favela — analisa decks, sugere cartas e evolui seu game.
            </p>
          </div>
        </div>
      </div>

      {/* Chat */}
      <ProfessorChat />
    </div>
  );
}
