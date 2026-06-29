"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { seedSpecialTicketAndRetroGrant } from "../actions";

export function SeedSpecialTicketButton() {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-2">
      <p className="text-xs font-bold text-purple-300">⭐ Ticket ZikaLoot Especial</p>
      <p className="text-[10px] text-slate-400">Cria o item no banco (se não existir) e concede retroativamente para jogadores que já resgataram o dia 21 do Passe Apoiador.</p>
      <button
        onClick={() => {
          startTransition(async () => {
            try {
              const res = await seedSpecialTicketAndRetroGrant();
              if (res.error) { toast.error(res.error); return; }
              toast.success(`${res.seeded ? "Item criado. " : ""}${res.granted ?? 0} jogador(es) receberam ticket especial retroativamente.`);
            } catch (err) { toast.error(`Erro: ${String(err).slice(0, 150)}`); }
          });
        }}
        disabled={pending}
        className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/20 disabled:opacity-40 transition-colors"
      >
        {pending ? "Processando..." : "Seed + Conceder Retroativamente"}
      </button>
    </div>
  );
}
