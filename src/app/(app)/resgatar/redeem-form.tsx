"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { redeemCodeAction } from "./actions";

export function RedeemForm() {
  const [code, setCode] = useState("");
  const [rewards, setRewards] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await redeemCodeAction(code);
      if (res.ok) {
        setRewards(res.rewards);
        setCode("");
        toast.success("Código resgatado!");
      } else {
        setRewards(null);
        toast.error(res.error);
      }
    });
  }

  return (
    <Card className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-2">
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CÓDIGO" autoComplete="off" className="uppercase" />
        <Button type="submit" disabled={pending || !code.trim()}>{pending ? "Resgatando..." : "Resgatar"}</Button>
      </form>
      {rewards && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <p className="mb-1 font-semibold">Você recebeu:</p>
          <ul className="list-disc pl-5">{rewards.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
    </Card>
  );
}
