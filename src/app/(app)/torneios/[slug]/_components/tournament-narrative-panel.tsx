"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateTournamentNarrative } from "../actions-narrative";
import type { TournamentNarrativeSections } from "@/lib/narrative";

interface Props {
  tournamentId: string;
  slug: string;
  existingNarrative: string | null;
  generatedAt: Date | null;
  isAdmin: boolean;
  isFinished: boolean;
}

type TabKey = keyof TournamentNarrativeSections;

const TABS: { key: TabKey; label: string; icon: string; onlyFinished?: boolean }[] = [
  { key: "overview", label: "Temporada", icon: "📋" },
  { key: "badges",   label: "Insígnias", icon: "🏅" },
  { key: "players",  label: "Jogadores", icon: "🧠" },
  { key: "title",    label: "Título",    icon: "🏁" },
  { key: "champion", label: "Campeão",   icon: "👑", onlyFinished: true },
];

const TOURNAMENT_KEYS: (keyof TournamentNarrativeSections)[] = ["overview","badges","players","title","champion"];

function safeStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try { return String(v); } catch { return ""; }
}

function parseSections(raw: string | null): TournamentNarrativeSections | null {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/^```[a-z]*\n?/gm, "").replace(/```$/gm, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === "object" && TOURNAMENT_KEYS.some(k => typeof parsed[k] === "string")) {
        return Object.fromEntries(TOURNAMENT_KEYS.map(k => [k, safeStr(parsed[k])])) as TournamentNarrativeSections;
      }
    }
  } catch { /* fallback */ }
  return { overview: raw, badges: "", players: "", title: "", champion: "" };
}

export function TournamentNarrativePanel({ tournamentId, slug, existingNarrative, generatedAt, isAdmin, isFinished }: Props) {
  const [pending, startTransition] = useTransition();
  const [sections, setSections]   = useState(() => parseSections(existingNarrative));
  const [genAt, setGenAt]         = useState(generatedAt);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const fmt = (d: Date) => d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const handleGenerate = () => {
    if (!confirm(sections ? "Regenerar análise geral do campeonato?" : "Gerar análise geral do campeonato?")) return;
    startTransition(async () => {
      try {
        const result = await generateTournamentNarrative(tournamentId, slug);
        if ("error" in result) { toast.error(result.error); return; }
        const parsed = parseSections(result.narrative);
        setSections(parsed);
        setGenAt(new Date());
        // Se tem campeão, vai para essa aba automaticamente
        if (parsed?.champion) setActiveTab("champion");
        toast.success("Análise do campeonato gerada!");
      } catch { toast.error("Erro ao gerar análise."); }
    });
  };

  const handleCopy = () => {
    if (!sections) return;
    const visibleTabs = TABS.filter(t => !t.onlyFinished || isFinished);
    const full = visibleTabs
      .map(t => sections[t.key] ? `${t.icon} ${t.label.toUpperCase()}\n${sections[t.key]}` : "")
      .filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(full).then(() => toast.success("Copiado!")).catch(() => toast.error("Erro ao copiar."));
  };

  const visibleTabs = TABS.filter(t => !t.onlyFinished || isFinished || (sections?.champion));
  const activeText = safeStr(sections?.[activeTab]);
  const isLegacyFormat = sections !== null && sections.overview.length > 100 && !sections.badges && !sections.players;

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      {/* Champion banner */}
      {isFinished && sections?.champion && (
        <div className="rounded-xl border border-[#FFCB05]/30 bg-gradient-to-r from-[#FFCB05]/10 via-[#FFCB05]/5 to-transparent p-4">
          <p className="text-[10px] uppercase tracking-widest text-[#FFCB05] mb-1 font-semibold">👑 Campeão da Temporada</p>
          <p className="whitespace-pre-line text-sm text-slate-200 leading-relaxed">{sections.champion}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#FFCB05]" />
          <div>
            <h2 className="font-semibold text-slate-200">Análise Geral do Campeonato</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Resumo completo da temporada recebido pelo Professor Enguiça.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sections && <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 h-8 text-xs"><Copy size={12} /> Copiar</Button>}
          {isAdmin && (
            <Button type="button" size="sm" disabled={pending} onClick={handleGenerate}
              className="gap-1.5 h-8 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] text-xs">
              {pending ? <><RefreshCw size={12} className="animate-spin" /> Gerando…</>
                : sections ? <><RefreshCw size={12} /> Regenerar</>
                : <><Sparkles size={12} /> Gerar Análise</>}
            </Button>
          )}
        </div>
      </div>

      {!pending && isLegacyFormat && isAdmin && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-400">
          ⚠ Narrativa no formato antigo — clique em "Regenerar" para criar com abas separadas.
        </div>
      )}

      {pending && (
        <div className="flex items-center gap-3 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-4 py-4">
          <RefreshCw size={15} className="animate-spin text-[#FFCB05] shrink-0" />
          <div>
            <p className="font-medium text-slate-200 text-xs">Professor Enguiça está compilando a temporada…</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Analisando todas as semanas, insígnias e corrida pelo título.</p>
          </div>
        </div>
      )}

      {!pending && sections ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {visibleTabs.map(t => (
              <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  activeTab === t.key
                    ? t.key === "champion"
                      ? "border-[#FFCB05]/60 bg-[#FFCB05]/15 text-[#FFCB05]"
                      : "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]"
                    : "border-border text-slate-500 hover:text-slate-300 hover:border-slate-600"
                }`}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-slate-900/50 px-4 py-3 min-h-[80px]">
            {activeText ? (
              <p className="whitespace-pre-line text-sm text-slate-300 leading-relaxed">{activeText}</p>
            ) : (
              <p className="text-xs text-slate-600 italic">Nenhuma informação nesta seção.</p>
            )}
          </div>

          {genAt && <p className="text-[10px] text-slate-600 text-right">Gerado em {fmt(genAt)}</p>}
        </div>
      ) : !pending && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4 text-xs text-slate-500">
          <BookOpen size={15} className="shrink-0 text-slate-600" />
          <div>
            <p className="text-slate-400">Nenhuma análise geral gerada ainda.</p>
            {isAdmin && <p className="mt-0.5">Clique em "Gerar Análise" para criar o recap completo.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
