"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Gift, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { PlayerSearchInput } from "@/components/player-search-input";
import { sendLigaCashGift } from "./actions";

export function LigaCashGiftForm({ senderPlayerId, balance }: { senderPlayerId: string; balance: number }) {
  const router = useRouter();
  const [recipientPlayerId, setRecipientPlayerId] = useState("");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();
  const parsedAmount = Number(amount);
  const canSend = recipientPlayerId && Number.isSafeInteger(parsedAmount) && parsedAmount > 0 && parsedAmount <= balance && title.trim().length > 0 && title.trim().length <= 80 && content.trim().length > 0 && content.trim().length <= 350;

  return (
    <section className="rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-cyan-400/10 via-slate-950/80 to-violet-500/10 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2.5 text-cyan-200"><Gift size={20} /></div>
        <div>
          <h2 className="font-bold text-white">Presentear com LigaCash</h2>
          <p className="mt-1 text-sm text-slate-400">O valor sai do seu saldo agora. O jogador verá sua mensagem na Caixa de presentes e receberá os LC ao resgatar.</p>
        </div>
      </div>
      <form className="mt-5 grid gap-4" onSubmit={(event) => {
        event.preventDefault();
        if (!canSend || pending) return;
        startTransition(async () => {
          const result = await sendLigaCashGift({ recipientPlayerId, amount: parsedAmount, title: title.trim(), content: content.trim() });
          if (result.error) { toast.error(result.error); return; }
          toast.success("Presente enviado! O jogador poderá resgatá-lo na Caixa de presentes.");
          setRecipientPlayerId(""); setAmount(""); setTitle(""); setContent("");
          router.refresh();
        });
      }}>
        <label className="space-y-1.5 text-xs font-semibold text-slate-300">
          <span>Jogador presenteado</span>
          <PlayerSearchInput value={recipientPlayerId} onChange={(id) => setRecipientPlayerId(id)} excludeIds={[senderPlayerId]} placeholder="Buscar jogador por nome ou nick..." />
        </label>
        <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
          <label className="space-y-1.5 text-xs font-semibold text-slate-300"><span>Quantidade de LC</span><input type="number" min={1} max={Math.max(1, balance)} step={1} value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400" /></label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-300"><span>Título <span className="text-slate-500">({title.length}/80)</span></span><input maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Um presente para você!" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400" /></label>
        </div>
        <label className="space-y-1.5 text-xs font-semibold text-slate-300"><span>Mensagem <span className="text-slate-500">({content.length}/350)</span></span><textarea maxLength={350} rows={4} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Escreva sua mensagem para o jogador..." className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm leading-6 text-white outline-none focus:border-cyan-400" /></label>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-400">Disponível: <strong className="text-cyan-200">{balance.toLocaleString("pt-BR")} LC</strong></p><button type="submit" disabled={!canSend || pending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"><Send size={15} />{pending ? "Enviando..." : "Enviar presente"}</button></div>
      </form>
    </section>
  );
}
