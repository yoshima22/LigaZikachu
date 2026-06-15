"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Coins, Megaphone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendZikaCoinsToAllPlayers, updateGlobalNotice } from "../actions";

export function AdminCommunicationPanel({ initialNotice }: { initialNotice: string }) {
  const [notice, setNotice] = useState(initialNotice);
  const [coins, setCoins] = useState("");
  const [description, setDescription] = useState("Presente global da Liga");
  const [pendingNotice, startNotice] = useTransition();
  const [pendingCoins, startCoins] = useTransition();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-slate-950/50 p-5">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-[#FFCB05]" />
          <h3 className="font-semibold text-slate-200">Aviso global no menu</h3>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Escreva um aviso curto para aparecer na barra principal. Deixe vazio para esconder.
        </p>
        <textarea
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          maxLength={1000}
          rows={4}
          className="mt-3 w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
          placeholder="Ex.: Arena em manutenção hoje das 20h às 21h."
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-600">{notice.length}/1000</span>
          <Button
            type="button"
            disabled={pendingNotice}
            onClick={() => {
              startNotice(async () => {
                const result = await updateGlobalNotice(notice);
                if (result.error) toast.error(result.error);
                else {
                  setNotice(result.message ?? "");
                  toast.success(result.message ? "Aviso publicado." : "Aviso removido.");
                }
              });
            }}
            className="gap-2 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"
          >
            <Send size={13} />
            {pendingNotice ? "Salvando..." : "Salvar aviso"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-slate-950/50 p-5">
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-[#FFCB05]" />
          <h3 className="font-semibold text-slate-200">Enviar ZikaCoins para todos</h3>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Credita ZC na carteira de todos os jogadores ativos e registra transação admin.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr]">
          <input
            value={coins}
            onChange={(e) => setCoins(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Quantidade"
            className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={160}
            placeholder="Descrição da transação"
            className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
          />
        </div>
        <Button
          type="button"
          disabled={pendingCoins || !coins}
          onClick={() => {
            const amount = Number(coins);
            if (!amount) { toast.error("Informe a quantidade."); return; }
            if (!confirm(`Enviar ${amount.toLocaleString("pt-BR")} ZC para todos os jogadores ativos?`)) return;
            startCoins(async () => {
              const result = await sendZikaCoinsToAllPlayers(amount, description);
              if (result.error) toast.error(result.error);
              else {
                toast.success(`${result.sent} jogador(es) receberam ${amount.toLocaleString("pt-BR")} ZC.`);
                setCoins("");
              }
            });
          }}
          className="mt-3 gap-2 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40"
        >
          <Coins size={13} />
          {pendingCoins ? "Enviando..." : "Enviar ZC para todos"}
        </Button>
      </div>
    </div>
  );
}
