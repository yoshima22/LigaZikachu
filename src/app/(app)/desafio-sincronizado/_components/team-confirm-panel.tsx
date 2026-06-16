"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Clock, LogOut, Users } from "lucide-react";
import { confirmTeamAction, leaveTeamAction } from "../actions";

interface Props {
  partnerName: string;
  iConfirmed: boolean;
  partnerConfirmed: boolean;
}

export function TeamConfirmPanel({ partnerName, iConfirmed, partnerConfirmed }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<{ error?: string }>) => {
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Você e <span className="font-semibold text-slate-200">{partnerName}</span> formaram uma dupla.
        Ambos precisam confirmar antes de escolherem seus Pokémon.
        Após a confirmação mútua, a dupla não pode ser desfeita sem intervenção do admin.
      </p>

      {/* Status de confirmação */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl border p-3 text-center ${iConfirmed ? "border-green-500/30 bg-green-500/5" : "border-slate-700 bg-slate-900/40"}`}>
          <p className="text-[10px] text-slate-500">Você</p>
          {iConfirmed ? (
            <p className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-green-400">
              <CheckCircle2 size={11} /> Confirmado
            </p>
          ) : (
            <p className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-500">
              <Clock size={11} /> Aguardando
            </p>
          )}
        </div>
        <div className={`rounded-xl border p-3 text-center ${partnerConfirmed ? "border-green-500/30 bg-green-500/5" : "border-slate-700 bg-slate-900/40"}`}>
          <p className="text-[10px] text-slate-500 truncate">{partnerName}</p>
          {partnerConfirmed ? (
            <p className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-green-400">
              <CheckCircle2 size={11} /> Confirmado
            </p>
          ) : (
            <p className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-500">
              <Clock size={11} /> Aguardando
            </p>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        {!iConfirmed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(confirmTeamAction)}
            className="flex items-center gap-2 rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
          >
            <Users size={14} /> Confirmar dupla
          </button>
        )}
        {!partnerConfirmed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Tem certeza que deseja sair desta dupla? Seu ticket voltará para o inventário.")) return;
              act(leaveTeamAction);
            }}
            className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
          >
            <LogOut size={14} /> Sair da dupla
          </button>
        )}
        {iConfirmed && !partnerConfirmed && (
          <p className="text-xs text-slate-500 self-center">
            Aguardando {partnerName} confirmar…
          </p>
        )}
      </div>
    </div>
  );
}
