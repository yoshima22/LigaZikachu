"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteRedeemCode, saveRedeemCode } from "./actions";

type Item = { id: string; name: string; type: string; category: string };
type Reward = { itemId: string; name: string; quantity: number };
type Code = {
  id: string; code: string; description: string; active: boolean; expiresAt: string; expired: boolean;
  maxUses: number | null; uses: number; rewards: Reward[];
};

const EMPTY = { id: undefined as string | undefined, code: "", description: "", expiresAt: "", maxUses: "", active: true, rewards: [] as Reward[] };

export function RedeemCodesAdmin({ items, codes }: { items: Item[]; codes: Code[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY);
  const [category, setCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState(1);

  const categories = useMemo(() => ["Todos", ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => (category === "Todos" || i.category === category) && (!q || i.name.toLowerCase().includes(q) || i.type.toLowerCase().includes(q)))
      .slice(0, 40);
  }, [items, category, search]);

  function addReward(item: Item) {
    setForm((f) => {
      const existing = f.rewards.find((r) => r.itemId === item.id);
      const rewards = existing
        ? f.rewards.map((r) => (r.itemId === item.id ? { ...r, quantity: r.quantity + qty } : r))
        : [...f.rewards, { itemId: item.id, name: item.name, quantity: qty }];
      return { ...f, rewards };
    });
  }

  function save() {
    startTransition(async () => {
      const res = await saveRedeemCode({
        id: form.id, code: form.code, description: form.description, expiresAt: form.expiresAt,
        maxUses: form.maxUses ? Number(form.maxUses) : null, active: form.active,
        rewards: form.rewards.map(({ itemId, quantity }) => ({ itemId, quantity })),
      });
      if (res.error) return void toast.error(res.error);
      toast.success(form.id ? "Código atualizado." : "Código criado.");
      setForm(EMPTY);
      router.refresh();
    });
  }

  function toggle(c: Code) {
    startTransition(async () => {
      const res = await saveRedeemCode({ ...c, expiresAt: c.expiresAt, active: !c.active, rewards: c.rewards });
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  function remove(c: Code) {
    if (!confirm(`Excluir o código ${c.code}? O histórico de resgates dele também será apagado.`)) return;
    startTransition(async () => {
      const res = await deleteRedeemCode(c.id);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="font-semibold text-white">{form.id ? "Editar código" : "Novo código"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-400">Código
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ZIKA2026" className="uppercase" />
          </label>
          <label className="space-y-1 text-xs text-slate-400">Descrição (interna)
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-slate-400">Expira em (horário de Brasília — vazio = nunca)
            <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-slate-400">Limite de usos (vazio = ilimitado)
            <Input type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Ativo
        </label>

        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-xs font-semibold uppercase text-slate-400">Prêmios ({form.rewards.length})</p>
          <div className="flex flex-wrap gap-2">
            {form.rewards.map((r) => (
              <span key={r.itemId} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-xs text-primary">
                {r.name} x{r.quantity}
                <button type="button" onClick={() => setForm({ ...form, rewards: form.rewards.filter((x) => x.itemId !== r.itemId) })}><X size={12} /></button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-xl border border-border bg-slate-900/70 px-2 text-sm text-slate-100">
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar item..." className="min-w-40 flex-1" />
            <Input type="number" min={1} max={99} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} className="w-20" />
          </div>
          <div className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
            {matches.map((i) => (
              <button key={i.id} type="button" onClick={() => addReward(i)} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/5">
                <span className="truncate">{i.name}</span><Plus size={14} className="shrink-0 text-primary" />
              </button>
            ))}
            {matches.length === 0 && <p className="text-xs text-slate-500">Nenhum item encontrado.</p>}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={pending}>{form.id ? "Salvar alterações" : "Criar código"}</Button>
          {form.id && <Button variant="outline" onClick={() => setForm(EMPTY)}>Cancelar edição</Button>}
        </div>
      </Card>

      <div className="space-y-2">
        {codes.length === 0 && <p className="text-sm text-slate-500">Nenhum código criado ainda.</p>}
        {codes.map((c) => (
          <Card key={c.id} className="space-y-2 !p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-bold text-white">{c.code}</span>
              {c.expired ? <Badge tone="red">Expirado</Badge> : c.active ? <Badge tone="green">Ativo</Badge> : <Badge tone="slate">Desativado</Badge>}
              <span className="text-xs text-slate-400">
                {c.uses}{c.maxUses ? `/${c.maxUses}` : ""} usos · {c.expiresAt ? `expira ${c.expiresAt.replace("T", " ")}` : "sem expiração"}
              </span>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="outline" disabled={pending} onClick={() => toggle(c)}>{c.active ? "Desativar" : "Ativar"}</Button>
                <Button size="sm" variant="outline" onClick={() => { setForm({ ...c, maxUses: c.maxUses ? String(c.maxUses) : "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil size={14} /></Button>
                <Button size="sm" variant="destructive" disabled={pending} onClick={() => remove(c)}><Trash2 size={14} /></Button>
              </div>
            </div>
            {c.description && <p className="text-xs text-slate-400">{c.description}</p>}
            <p className="text-sm text-slate-200">{c.rewards.map((r) => `${r.name} x${r.quantity}`).join(" · ")}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: "green" | "red" | "slate"; children: React.ReactNode }) {
  const cls = { green: "bg-emerald-500/20 text-emerald-300", red: "bg-red-500/20 text-red-300", slate: "bg-slate-500/20 text-slate-300" }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}
