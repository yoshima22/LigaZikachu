"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportTournamentWeekReport } from "../export-actions";

export function WeekReportExportButton({ tournamentWeekId }: { tournamentWeekId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await exportTournamentWeekReport(tournamentWeekId);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      const blob = new Blob([res.content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao exportar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="w-full border border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700"
    >
      <Download size={14} className="mr-1" /> {loading ? "Gerando relatório..." : "Exportar relatório da semana (.md)"}
    </Button>
  );
}
