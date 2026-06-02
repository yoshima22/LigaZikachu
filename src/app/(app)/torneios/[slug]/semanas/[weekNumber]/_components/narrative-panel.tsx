"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateWeekNarrative } from "../actions-narrative";
import type { WeekNarrativeSections } from "@/lib/narrative";

interface Props {
  weekId: string;
  weekLabel: string;
  existingNarrative: string | null;
  generatedAt: Date | null;
  isAdmin: boolean;
}

const TABS: { key: keyof WeekNarrativeSections; label: string; icon: string }[] = [
  { key: "intro",      label: "Abertura",   icon: "📢" },
  { key: "highlights", label: "Destaques",  icon: "⭐" },
  { key: "challenges", label: "Desafios",   icon: "🎯" },
  { key: "rankings",   label: "Tabela",     icon: "📊" },
  { key: "players",    label: "Jogadores",  icon: "🧠" },
  { key: "title",      label: "Título",     icon: "🏁" },
  { key: "closing",    label: "Próxima",    icon: "🔮" },
];

const WEEK_KEYS: (keyof WeekNarrativeSections)[] = ["intro","highlights","challenges","rankings","players","title","closing"];

function safeStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  try { return String(v); } catch { return ""; }
}

function parseSections(raw: string | null): WeekNarrativeSections | null {
  if (!raw) return null;
  try {
    // Remove possíveis blocos markdown ```json ... ```
    const cleaned = raw.replace(/^```[a-z]*\n?/gm, "").replace(/```$/gm, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === "object" && WEEK_KEYS.some(k => typeof parsed[k] === "string")) {
        return Object.fromEntries(WEEK_KEYS.map(k => [k, safeStr(parsed[k])])) as unknown as WeekNarrativeSections;
      }
    }
  } catch { /* fallback */ }
  // Texto legado (não JSON): mostra na intro, avisa admin para regenerar
  return { intro: raw, highlights: "", challenges: "", rankings: "", players: "", title: "", closing: "" };
}

export function NarrativePanel({ weekId, weekLabel, existingNarrative, generatedAt, isAdmin }: Props) {
  const [pending, startTransition] = useTransition();
  const [sections, setSections]   = useState(() => parseSections(existingNarrative));
  const [genAt, setGenAt]         = useState(generatedAt);
  const [activeTab, setActiveTab] = useState<keyof WeekNarrativeSections>("intro");

  const fmt = (d: Date) => d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const handleGenerate = () => {
    const label = sections ? "Regenerar o recap narrativo desta semana?" : "Gerar o recap narrativo desta semana via Professor Enguiça?";
    if (!confirm(label)) return;
    startTransition(async () => {
      try {
        const result = await generateWeekNarrative(weekId);
        if ("error" in result) { toast.error(result.error); return; }
        setSections(parseSections(result.narrative));
        setGenAt(new Date());
        toast.success("Narrativa gerada!");
      } catch { toast.error("Erro ao gerar narrativa."); }
    });
  };

  const handleCopy = () => {
    if (!sections) return;
    const full = TABS.map(t => `${t.icon} ${t.label.toUpperCase()}\n${sections[t.key]}`).filter(s => !s.endsWith("\n")).join("\n\n");
    navigator.clipboard.writeText(full).then(() => toast.success("Copiado!")).catch(() => toast.error("Erro ao copiar."));
  };

  const activeText = safeStr(sections?.[activeTab]);
  // Detecta narrativa no formato antigo (tudo na intro, restante vazio)
  const isLegacyFormat = sections !== null &&
    sections.intro.length > 100 &&
    !sections.highlights && !sections.players;

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#FFCB05]" />
          <div>
            <h2 className="font-semibold text-slate-200">Recap do Professor Enguiça</h2>
            <p className="mt-0.5 text-xs text-slate-500">Resumo de informações recebidas pelo Professor Enguiça.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sections && <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 h-8 text-xs"><Copy size={12} /> Copiar tudo</Button>}
          {isAdmin && (
            <Button type="button" size="sm" disabled={pending} onClick={handleGenerate}
              className="gap-1.5 h-8 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] text-xs">
              {pending ? <><RefreshCw size={12} className="animate-spin" /> Gerando…</>
                : sections ? <><RefreshCw size={12} /> Regenerar</>
                : <><Sparkles size={12} /> Gerar Narrativa</>}
            </Button>
          )}
        </div>
      </div>

      {/* Aviso de formato antigo */}
      {!pending && isLegacyFormat && isAdmin && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-400">
          ⚠ Narrativa no formato antigo — clique em "Regenerar" para criar com abas separadas.
        </div>
      )}

      {pending && (
        <div className="flex items-center gap-3 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-4 py-4 text-sm">
          <RefreshCw size={15} className="animate-spin text-[#FFCB05] shrink-0" />
          <div>
            <p className="font-medium text-slate-200 text-xs">Professor Enguiça está analisando a semana…</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Isso pode levar alguns segundos.</p>
          </div>
        </div>
      )}

      {!pending && sections ? (
        <div className="space-y-3">
          {/* Abas */}
          <div className="flex flex-wrap gap-1">
            {TABS.map(t => (
              <button key={t.key} type="button"
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  activeTab === t.key
                    ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]"
                    : "border-border text-slate-500 hover:text-slate-300 hover:border-slate-600"
                }`}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Conteúdo da aba */}
          <div className="rounded-xl border border-border bg-slate-900/50 px-4 py-3 min-h-[80px]">
            {activeText ? (
              <p className="whitespace-pre-line text-sm text-slate-300 leading-relaxed">{activeText}</p>
            ) : (
              <p className="text-xs text-slate-600 italic">Nenhuma informação nesta seção.</p>
            )}
          </div>

          {genAt && (
            <p className="text-[10px] text-slate-600 text-right">Gerado em {fmt(genAt)} · {weekLabel}</p>
          )}
        </div>
      ) : !pending && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4 text-xs text-slate-500">
          <BookOpen size={15} className="shrink-0 text-slate-600" />
          <div>
            <p className="text-slate-400">Nenhum recap gerado ainda.</p>
            {isAdmin && <p className="mt-0.5">Clique em "Gerar Narrativa" para criar o texto automático.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
