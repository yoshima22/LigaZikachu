"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";

export function InviteCodeCard({ code, invitedCount }: { code: string | null; invitedCount: number }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Código de convite copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Anote o código manualmente.");
    }
  };

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-sm font-semibold text-white">Seu código de convite</h2>
      <p className="mb-4 text-xs text-slate-500">
        Compartilhe este código de 6 dígitos com quem você quer convidar. Novas contas só podem ser criadas com um código de convite válido,
        e quem entrar pelo seu código é aprovado na hora e aparece na sua lista de convidados no perfil.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2 font-pixel text-xl tracking-[0.35em] text-[#FFCB05]">
          {code ?? "——————"}
        </span>
        <button
          type="button"
          onClick={copy}
          disabled={!code}
          className="rounded-xl border border-border bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          {copied ? "✓ Copiado" : "Copiar código"}
        </button>
        <span className="text-[11px] text-slate-500">
          {invitedCount > 0 ? `Você já convidou ${invitedCount} jogador${invitedCount === 1 ? "" : "es"}.` : "Você ainda não convidou ninguém."}
        </span>
      </div>
    </Card>
  );
}
