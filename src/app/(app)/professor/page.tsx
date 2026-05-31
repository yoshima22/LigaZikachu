import { BarChart3, Zap } from "lucide-react";
import { ProfessorChat } from "./_components/professor-chat";
import { getMetaData } from "./actions";

export const metadata = { title: "Professor Enguiça | Liga Zikachu" };

export default async function ProfessorPage() {
  const meta = await getMetaData();
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          {process.env.NEXT_PUBLIC_PROFESSOR_IMAGE_URL ? (
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={process.env.NEXT_PUBLIC_PROFESSOR_IMAGE_URL}
                alt="Professor Enguiça"
                className="h-16 w-16 rounded-full object-cover border-2 border-[#FFCB05]/50 shadow-[0_0_24px_rgba(255,203,5,0.4)]"
              />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#7AC74C] text-[8px] font-bold text-white">⚡</span>
            </div>
          ) : (
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFCB05] to-[#FFD700] shadow-[0_0_24px_rgba(255,203,5,0.4)]">
              <Zap className="h-8 w-8 text-[#1A1A2E]" strokeWidth={2.5} />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#7AC74C] text-[8px] font-bold text-white">⚡</span>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
            <h1 className="font-pixel text-base text-[#FFCB05]">Professor Enguiça</h1>
            <p className="text-sm text-slate-400">
              O Treinador da Favela — analisa decks, sugere cartas e evolui seu game.
            </p>
          </div>
        </div>
      </div>

      {/* Meta snapshot do Limitless TCG */}
      {meta.available && meta.archetypes.length > 0 && (
        <div className="rounded-xl border border-border bg-slate-950/50 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            <BarChart3 size={14} className="text-[#FFCB05]" />
            Meta atual — Limitless TCG
            <span className="ml-auto text-slate-600 font-normal normal-case tracking-normal">dados de torneios recentes</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {meta.archetypes.slice(0, 8).map((a, i) => (
              <div key={a.name} className={`rounded-lg border px-3 py-1.5 text-xs ${
                i === 0 ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]" :
                i <= 2 ? "border-slate-600 bg-slate-900/60 text-slate-200" :
                "border-border bg-slate-950/40 text-slate-400"
              }`}>
                <span className="font-semibold">{i + 1}. {a.name}</span>
                <span className="ml-2 text-slate-500">{a.topFinishes} top 8</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!meta.available && process.env.NEXT_PUBLIC_SHOW_LIMITLESS_HINT === "true" && (
        <div className="rounded-xl border border-dashed border-border p-4 text-xs text-slate-500 text-center">
          Adicione <code className="bg-slate-800 px-1 rounded">LIMITLESS_API_KEY</code> na Vercel para ver dados reais do meta competitivo.{" "}
          <a href="https://docs.limitlesstcg.com/developer.html" target="_blank" rel="noreferrer" className="text-[#FFCB05] hover:underline">Documentação →</a>
        </div>
      )}

      {/* Chat */}
      <ProfessorChat />
    </div>
  );
}
