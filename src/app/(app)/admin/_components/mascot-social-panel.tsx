"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Swords, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerMascotSocialEvents } from "../actions";

export function MascotSocialPanel() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ battles: number; friendships: number; pairs: number } | null>(null);

  const handle = () => {
    startTransition(async () => {
      const r = await triggerMascotSocialEvents();
      if (r.error) { toast.error(r.error); return; }
      setResult(r);
      toast.success(`${r.battles} batalhas + ${r.friendships} amizades geradas!`);
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Swords size={16} className="text-[#FFCB05]" />
        <h3 className="font-semibold text-slate-200">Eventos Sociais de Mascotes</h3>
      </div>
      <p className="text-xs text-slate-500">
        Dispara batalhas e amizades aleatórias entre mascotes equipados de treinadores diferentes.
        Roda automaticamente a cada <strong className="text-slate-400">30 minutos</strong> via cron.
      </p>
      <Button type="button" disabled={pending} onClick={handle}
        className="gap-2 bg-slate-700 hover:bg-slate-600 text-white">
        <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
        {pending ? "Gerando eventos…" : "Disparar agora"}
      </Button>
      {result && (
        <div className="flex gap-6 rounded-xl border border-border bg-slate-900/50 px-4 py-3 text-xs">
          <div><p className="text-slate-500">Pares</p><p className="font-bold text-slate-200 text-base">{result.pairs}</p></div>
          <div><p className="text-slate-500">Batalhas</p><p className="font-bold text-red-400 text-base">{result.battles}</p></div>
          <div><p className="text-slate-500">Amizades</p><p className="font-bold text-green-400 text-base">{result.friendships}</p></div>
        </div>
      )}
    </div>
  );
}
