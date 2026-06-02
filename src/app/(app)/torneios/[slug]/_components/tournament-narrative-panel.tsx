"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Sparkles, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateTournamentNarrative } from "../actions-narrative";

interface Props {
  tournamentId: string;
  slug: string;
  existingNarrative: string | null;
  generatedAt: Date | null;
  isAdmin: boolean;
}

export function TournamentNarrativePanel({ tournamentId, slug, existingNarrative, generatedAt, isAdmin }: Props) {
  const [pending, startTransition] = useTransition();
  const [text, setText]   = useState(existingNarrative);
  const [genAt, setGenAt] = useState(generatedAt);

  const fmt = (d: Date) => d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const handleGenerate = () => {
    const label = text
      ? "Regenerar a análise geral do campeonato? O texto atual será substituído."
      : "Gerar análise geral do campeonato via Professor Enguiça?";
    if (!confirm(label)) return;

    startTransition(async () => {
      try {
        const result = await generateTournamentNarrative(tournamentId, slug);
        if ("error" in result) { toast.error(result.error); return; }
        setText(result.narrative);
        setGenAt(new Date());
        toast.success("Análise do campeonato gerada!");
      } catch { toast.error("Erro ao gerar análise."); }
    });
  };

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => toast.success("Copiado!"))
      .catch(() => toast.error("Erro ao copiar."));
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#FFCB05]" />
          <div>
            <h2 className="font-semibold text-slate-200">Análise Geral do Campeonato</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Resumo completo da temporada recebido pelo Professor Enguiça — todas as semanas, insígnias, corrida pelo título.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {text && (
            <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 h-8 text-xs">
              <Copy size={12} /> Copiar
            </Button>
          )}
          {isAdmin && (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={handleGenerate}
              className="gap-1.5 h-8 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] text-xs"
            >
              {pending
                ? <><RefreshCw size={12} className="animate-spin" /> Gerando…</>
                : text
                ? <><RefreshCw size={12} /> Regenerar</>
                : <><Sparkles size={12} /> Gerar Análise</>
              }
            </Button>
          )}
        </div>
      </div>

      {pending && (
        <div className="flex items-center gap-3 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-4 py-5 text-sm text-slate-400">
          <RefreshCw size={16} className="animate-spin text-[#FFCB05] shrink-0" />
          <div>
            <p className="font-medium text-slate-200">Professor Enguiça está compilando a temporada…</p>
            <p className="text-xs text-slate-500 mt-0.5">Analisando todas as semanas, insígnias e corrida pelo título.</p>
          </div>
        </div>
      )}

      {!pending && text ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-slate-900/50 px-5 py-4">
            <p className="whitespace-pre-line text-sm text-slate-300 leading-relaxed">
              {text}
            </p>
          </div>
          {genAt && (
            <p className="text-[10px] text-slate-600 text-right">
              Gerado em {fmt(genAt)}
            </p>
          )}
        </div>
      ) : !pending && !text ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-5 text-xs text-slate-500">
          <BookOpen size={16} className="shrink-0 text-slate-600" />
          <div>
            <p className="text-slate-400">Nenhuma análise geral gerada ainda.</p>
            {isAdmin && <p className="mt-0.5">Clique em "Gerar Análise" para criar o recap completo da temporada.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
