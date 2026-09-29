"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { redeemCodeAction, type StoneOption } from "./actions";

type Notice = { tone: "warn" | "error"; text: string };

export function RedeemForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [rewards, setRewards] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [stones, setStones] = useState<StoneOption[] | null>(null);
  const [stoneSearch, setStoneSearch] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(stoneId?: string) {
    startTransition(async () => {
      const res = await redeemCodeAction(code, stoneId);
      setNotice(null);
      if (res.ok) {
        setRewards(res.rewards);
        setStones(null);
        setCode("");
        toast.success("Código resgatado!");
        router.refresh();
        return;
      }
      setRewards(null);
      if (res.reason === "CHOOSE_STONE") {
        setStones(res.options ?? []);
        setNotice(null);
        return;
      }
      setStones(null);
      if (res.reason === "ALREADY") {
        const when = res.redeemedAt
          ? new Date(res.redeemedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
          : null;
        setNotice({ tone: "warn", text: `Este código já foi resgatado por você${when ? ` em ${when}` : ""}. Cada código só pode ser usado uma vez por jogador.` });
      } else {
        setNotice({ tone: "error", text: res.error });
      }
    });
  }

  const shownStones = stones?.filter((s) => s.name.toLowerCase().includes(stoneSearch.trim().toLowerCase()));

  return (
    <Card className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); setStones(null); submit(); }} className="flex gap-2">
        <Input value={code} onChange={(e) => { setCode(e.target.value); setNotice(null); setStones(null); }} placeholder="CÓDIGO" autoComplete="off" className="uppercase" />
        <Button type="submit" disabled={pending || !code.trim()}>{pending ? "Resgatando..." : "Resgatar"}</Button>
      </form>

      {notice && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
            notice.tone === "warn" ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-red-500/40 bg-red-500/10 text-red-200"
          }`}
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{notice.text}</span>
        </div>
      )}

      {stones && (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-semibold text-white">Escolha sua Pedra de Mega</p>
          <Input value={stoneSearch} onChange={(e) => setStoneSearch(e.target.value)} placeholder="Buscar pedra..." />
          <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
            {shownStones?.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={pending}
                onClick={() => { if (confirm(`Receber ${s.name}? Essa escolha não pode ser desfeita.`)) submit(s.id); }}
                className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/5 disabled:opacity-50"
              >
                {s.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt="" className="h-8 w-8 shrink-0 object-contain" />
                )}
                <span className="truncate">{s.name}</span>
              </button>
            ))}
            {shownStones?.length === 0 && <p className="text-xs text-slate-500">Nenhuma pedra encontrada.</p>}
          </div>
        </div>
      )}

      {rewards && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <p className="mb-1 font-semibold">Você recebeu:</p>
          <ul className="list-disc pl-5">{rewards.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
    </Card>
  );
}
