"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setSpecEnabledAction } from "@/app/(app)/spec/admin-actions";

export function SpecAdminToggle({ enabled, providerConfigured, estimatedGb, gbLimit }: { enabled: boolean; providerConfigured: boolean; estimatedGb?: number; gbLimit?: number }) {
  const [pending, start] = useTransition();
  const toggle = () => start(async () => {
    const res = await setSpecEnabledAction(!enabled);
    if (!res.ok) toast.error(res.error ?? "Falha ao salvar.");
    else toast.success(!enabled ? "Modo SPEC ativado." : "Modo SPEC desativado.");
  });
  return (
    <div className="rounded-xl border border-purple-500/30 bg-purple-950/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-purple-200">Admin · Modo SPEC {enabled ? "ativado" : "desativado"}</p>
          <p className="text-[10px] text-slate-500">
            {providerConfigured ? "Provedor de vídeo (Cloudflare) configurado." : "⚠️ Provedor de vídeo ainda não configurado — as lives não conectam até definir as credenciais da Cloudflare."}
          </p>
          {typeof estimatedGb === "number" && typeof gbLimit === "number" && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              Uso estimado no mês: <span className={estimatedGb >= gbLimit ? "font-bold text-red-300" : "text-slate-400"}>{estimatedGb.toFixed(1)} GB</span> / {gbLimit} GB (auto-desliga ao atingir).
            </p>
          )}
        </div>
        <button type="button" onClick={toggle} disabled={pending} role="switch" aria-checked={enabled}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-[#FFCB05]" : "bg-slate-600"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>
    </div>
  );
}
