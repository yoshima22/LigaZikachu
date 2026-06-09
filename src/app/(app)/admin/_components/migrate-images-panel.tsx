"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HardDriveUpload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type MigrateResult = {
  table: string; id: string; name: string; size: string; url?: string; error?: string;
};

export function MigrateImagesPanel() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MigrateResult[] | null>(null);
  const [summary, setSummary] = useState<{ ok: number; errors: number; dry: boolean } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const run = async (dry: boolean) => {
    if (!dry && !confirm(
      `⚠️ Isso vai fazer upload de todas as imagens base64 para o Supabase Storage e atualizar o banco.\n\nCertifique-se de que o bucket "assets" (público) foi criado.\n\nContinuar?`
    )) return;

    setLoading(true);
    setResults(null);
    setSummary(null);
    setApiError(null);

    try {
      const res = await fetch(`/api/admin/migrate-images${dry ? "?dry=1" : ""}`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.error ?? `Erro HTTP ${res.status}`;
        toast.error(msg);
        setApiError(msg);
        return;
      }

      setResults(data.results);
      setSummary({ ok: data.ok, errors: data.errors, dry: data.dry });

      if (dry) {
        toast.success(`Dry run: ${data.ok} itens seriam migrados`);
      } else {
        toast.success(`Migração concluída: ${data.ok} migrados, ${data.errors} erros`);
      }
    } catch (err) {
      const msg = "Erro de rede: " + String(err);
      toast.error(msg);
      setApiError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <HardDriveUpload size={16} className="text-purple-400" />
        <h3 className="font-semibold text-slate-200">Migrar Imagens → Storage</h3>
        <span className="text-xs text-slate-500">— move base64 do banco para Supabase CDN</span>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-300 space-y-1">
        <p className="font-semibold">Pré-requisito antes de rodar:</p>
        <p>1. Supabase → Storage → <strong>New bucket</strong> → nome: <code>assets</code> → marque <strong>Public</strong> → Create</p>
        <p>2. Vercel → Settings → Environment Variables → adicionar <code>SUPABASE_SERVICE_ROLE_KEY</code> → Redeploy</p>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          disabled={loading}
          onClick={() => run(true)}
          className="gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Dry Run (só listar)
        </Button>
        <Button
          type="button"
          disabled={loading}
          onClick={() => run(false)}
          className="gap-2 bg-purple-600 hover:bg-purple-500 text-white"
        >
          <HardDriveUpload size={13} />
          Migrar de verdade
        </Button>
      </div>

      {apiError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300 space-y-1">
          <p className="font-semibold">❌ Erro ao chamar a API:</p>
          <p className="font-mono break-all">{apiError}</p>
          <p className="text-red-400/70 mt-1">Verifique se o <code>SUPABASE_SERVICE_ROLE_KEY</code> está configurado no Vercel e se você está logado como admin.</p>
        </div>
      )}

      {summary && (
        <div className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${summary.errors > 0 ? "border-red-500/20 bg-red-500/5 text-red-300" : "border-green-500/20 bg-green-500/5 text-green-300"}`}>
          {summary.dry ? "🔍 Dry run — " : "✅ Migração — "}
          {summary.ok} {summary.dry ? "seriam migrados" : "migrados"}
          {summary.errors > 0 && `, ${summary.errors} erros`}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="max-h-96 overflow-y-auto space-y-1 rounded-xl border border-border/40 bg-slate-900/40 p-3">
          {results.map((r) => (
            <div key={r.id} className={`flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 text-xs ${r.error ? "bg-red-500/10 text-red-300" : "text-slate-300"}`}>
              <span className="min-w-0">
                <span className="font-semibold">{r.name}</span>
                <span className="ml-2 text-slate-500">{r.table} · {r.size}</span>
                {r.error && <span className="ml-2 text-red-400">❌ {r.error}</span>}
              </span>
              {r.url && !r.error && (
                <span className="shrink-0 text-green-400 truncate max-w-[200px]" title={r.url}>✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
