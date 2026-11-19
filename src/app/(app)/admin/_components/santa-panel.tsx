"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardTitle } from "@/components/ui/card";
import type { SantaSetting } from "@/lib/papai-noel";
import { saveSantaSettingAction } from "../santa-actions";

export function SantaPanel({ initial, windowLabel }: { initial: SantaSetting; windowLabel: string }) {
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const save = (next: SantaSetting) => {
    const prev = s;
    setS(next);
    start(async () => {
      const r = await saveSantaSettingAction(next);
      if (!r.ok) { setS(prev); toast.error(r.error ?? "Erro ao salvar."); } else toast.success("Papai Noel atualizado (vale em até 30 s).");
    });
  };
  return (
    <Card>
      <CardTitle>🎅 Papai Noel (evento de Natal)</CardTitle>
      <p className="mt-1 text-sm text-slate-400">Janela: {windowLabel}. Presente a cada 4–6 h por jogador.</p>
      <div className="mt-3 flex flex-col gap-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.enabled} disabled={pending} onChange={(e) => save({ ...s, enabled: e.target.checked })} /> Evento ligado</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={s.ignoreWindow} disabled={pending} onChange={(e) => save({ ...s, ignoreWindow: e.target.checked })} /> Ignorar janela de datas (teste — desligue depois)</label>
      </div>
    </Card>
  );
}
