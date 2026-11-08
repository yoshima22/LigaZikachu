"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Loader2, PackageSearch, Plus, Search, ShieldAlert, Sparkles, Trash2, X } from "lucide-react";
import { getSpriteUrl, PERSONALITIES, PERSONALITY_LABEL } from "@/lib/mascot-data";
import { parseEggPrices, BUY_ORDER_DURATIONS, BUY_ORDER_NO_FUNDS_MESSAGE, BUY_ORDER_MAX_ACTIVE, ORDER_EGG_LABEL, ORDER_EGG_TYPES, ORDER_STAT_KEYS, ORDER_STAT_LABEL, type OrderStatKey, type BuyOrderView } from "@/lib/bazar-orders";
import { cancelBuyOrder, createBuyOrder, getBuyOrderSellOptions, sellToBuyOrder } from "../actions";

type Props = {
  orders: BuyOrderView[];
  playerId: string | null;
  species: [number, string][];
  items: { id: string; name: string }[];
  myActiveCount: number;
};

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expirando";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)} dias`;
  if (h >= 1) return `${h} h`;
  return `${Math.max(1, Math.floor(ms / 60_000))} min`;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#FFCB05]/25 bg-[#14142a] p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#FFCB05]">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function OrderThumb({ order }: { order: BuyOrderView }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-[#201d38]">
      {order.kind === "MASCOT" && order.pokemonId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={getSpriteUrl(order.pokemonId, true)} alt={order.label} className="h-20 w-20 object-contain [image-rendering:pixelated]"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = getSpriteUrl(order.pokemonId!); }} />
      ) : order.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={order.imageUrl} alt={order.label} className="h-16 w-16 object-contain" />
      ) : (
        <PackageSearch size={40} className="text-slate-500" />
      )}
    </div>
  );
}

function SellDialog({ order, onClose }: { order: BuyOrderView; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mascots, setMascots] = useState<{ id: string; level: number; nickname: string | null; price: number }[] | null>(null);
  const [pick, setPick] = useState<string>("");
  const [notice, setNotice] = useState<{ msg: string; noFunds: boolean } | null>(
    order.covered ? null : { msg: BUY_ORDER_NO_FUNDS_MESSAGE, noFunds: true },
  );

  useEffect(() => {
    if (order.kind !== "MASCOT") return;
    getBuyOrderSellOptions(order.id).then((r) => {
      if (r.error) setNotice({ msg: r.error, noFunds: false });
      setMascots(r.mascots ?? []);
      if (r.mascots?.[0]) setPick(r.mascots[0].id);
    });
  }, [order.id, order.kind]);

  function confirm() {
    start(async () => {
      const r = await sellToBuyOrder(order.id, order.kind === "MASCOT" ? pick : undefined);
      if (r.error) { setNotice({ msg: r.error, noFunds: Boolean(r.noFunds) }); return; }
      toast.success(`Venda concluída! +${(r.price ?? order.priceCoins).toLocaleString("pt-BR")} ZC na sua conta.`);
      onClose();
      router.refresh();
    });
  }

  const shownPrice = mascots?.find((m) => m.id === pick)?.price ?? order.priceCoins;
  const qty = order.kind === "ITEM" && order.quantity > 1 ? ` ×${order.quantity}` : "";
  return (
    <Modal title="Vender para o pedido" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-slate-900/60 p-3 text-sm">
          <p className="font-bold text-slate-100">{order.label}{qty}</p>
          <p className="mt-1 text-xs text-slate-400">Pedido de <strong className="text-slate-200">{order.buyer.displayName}</strong></p>
          <p className="mt-2 text-lg font-black text-[#FFCB05]">💰 {shownPrice.toLocaleString("pt-BR")} ZC</p>
          <p className="text-[11px] text-slate-500">Você recebe o valor integral, na hora.</p>
        </div>

        {order.kind === "MASCOT" && (
          mascots === null ? (
            <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Procurando seus mascotes…</p>
          ) : mascots.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-xs text-slate-400">
              Você não tem um {order.label} livre que atenda ao pedido. Mascotes equipados, protegidos ou reservados não aparecem.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-300">Qual mascote você vai vender?</p>
              {mascots.map((m) => (
                <label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${pick === m.id ? "border-[#FFCB05]/60 bg-[#FFCB05]/10" : "border-border hover:bg-white/5"}`}>
                  <input type="radio" name="mascot" checked={pick === m.id} onChange={() => setPick(m.id)} className="accent-[#FFCB05]" />
                  <span className="text-slate-200">{m.nickname || order.label}</span>
                  <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">Nv. {m.level}</span>
                  <span className="text-xs font-bold text-[#FFCB05]">{m.price.toLocaleString("pt-BR")} ZC</span>
                </label>
              ))}
              <p className="text-[11px] text-amber-300/80">Atenção: o mascote sai da sua conta para sempre.</p>
            </div>
          )
        )}

        {notice && (
          <div className={`flex gap-2 rounded-xl border p-3 text-xs ${notice.noFunds ? "border-amber-400/40 bg-amber-400/10 text-amber-100" : "border-red-500/30 bg-red-500/10 text-red-200"}`}>
            {notice.noFunds ? <Clock size={15} className="mt-0.5 shrink-0" /> : <ShieldAlert size={15} className="mt-0.5 shrink-0" />}
            <span>{notice.msg}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-xs text-slate-300 hover:bg-white/5">Voltar</button>
          <button
            onClick={confirm}
            disabled={pending || (order.kind === "MASCOT" && !pick) || notice?.noFunds}
            className="flex-1 rounded-xl bg-[#FFCB05] px-4 py-2.5 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
          >
            {pending ? "Vendendo…" : "Vender agora"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CreateDialog({ species, items, onClose }: { species: [number, string][]; items: { id: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"MASCOT" | "ITEM">("MASCOT");
  const [q, setQ] = useState("");
  const [pokemonId, setPokemonId] = useState<number | null>(null);
  const [shopItemId, setShopItemId] = useState<string>("");
  const [minLevel, setMinLevel] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [personality, setPersonality] = useState("");
  const [eggPrices, setEggPrices] = useState<Record<string, string>>({});
  const [topStats, setTopStats] = useState<OrderStatKey[]>([]);
  const [price, setPrice] = useState("");
  const [days, setDays] = useState<number>(7);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    const list = kind === "MASCOT"
      ? species.filter(([, n]) => n.toLowerCase().includes(t)).map(([id, n]) => ({ key: String(id), name: n }))
      : items.filter((i) => i.name.toLowerCase().includes(t)).map((i) => ({ key: i.id, name: i.name }));
    return list.slice(0, 8);
  }, [q, kind, species, items]);
  const chosen = kind === "MASCOT" ? species.find(([id]) => id === pokemonId)?.[1] : items.find((i) => i.id === shopItemId)?.name;

  function submit() {
    setError(null);
    start(async () => {
      const r = await createBuyOrder({
        kind, pokemonId: pokemonId ?? undefined, minLevel, personality: personality || undefined, eggPrices: Object.keys(eggPrices).length ? Object.fromEntries(Object.entries(eggPrices).map(([t, v]) => [t, Number(v)])) : undefined, topStats: topStats.length ? topStats : undefined, shopItemId: shopItemId || undefined,
        quantity, priceCoins: Number(price), durationDays: days,
      });
      if (r.error) { setError(r.error); return; }
      toast.success("Pedido publicado!");
      onClose();
      router.push("/bazar?tab=pedidos&mine=1");
      router.refresh();
    });
  }

  return (
    <Modal title="Novo pedido de compra" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900 p-1">
          {(["MASCOT", "ITEM"] as const).map((k) => (
            <button key={k} onClick={() => { setKind(k); setQ(""); setPokemonId(null); setShopItemId(""); }}
              className={`rounded-lg py-2 text-xs font-bold ${kind === k ? "bg-[#FFCB05] text-[#1A1A2E]" : "text-slate-400 hover:text-slate-200"}`}>
              {k === "MASCOT" ? "🐾 Mascote" : "🎒 Item"}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">{kind === "MASCOT" ? "Qual espécie você quer?" : "Qual item você quer?"}</label>
          {chosen ? (
            <div className="flex items-center justify-between rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-3 py-2 text-sm text-slate-100">
              {chosen}
              <button onClick={() => { setPokemonId(null); setShopItemId(""); setQ(""); }} className="text-xs text-slate-400 hover:text-slate-200">trocar</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Digite para buscar…" autoFocus
                  className="w-full rounded-xl border border-border bg-slate-900 py-2 pl-8 pr-3 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60" />
              </div>
              {matches.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-border">
                  {matches.map((m) => (
                    <button key={m.key} onClick={() => (kind === "MASCOT" ? setPokemonId(Number(m.key)) : setShopItemId(m.key))}
                      className="block w-full border-b border-border/60 px-3 py-2 text-left text-xs text-slate-200 last:border-0 hover:bg-white/5">{m.name}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {kind === "MASCOT" ? (
          <div className="space-y-3 rounded-xl border border-border/70 bg-slate-900/40 p-3">
            <p className="text-[11px] text-slate-500">Requisitos (opcionais): a venda automática só acontece com um mascote que atenda a tudo que você marcar.</p>
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1 text-[11px] font-semibold text-slate-300">Nível mín.
                <input type="number" min={1} max={100} value={minLevel} onChange={(e) => setMinLevel(Number(e.target.value))}
                  className="w-full rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60" />
              </label>
              <label className="col-span-2 space-y-1 text-[11px] font-semibold text-slate-300">Personalidade
                <select value={personality} onChange={(e) => setPersonality(e.target.value)}
                  className="w-full rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60">
                  <option value="">Qualquer</option>
                  {PERSONALITIES.map((p) => <option key={p} value={p}>{PERSONALITY_LABEL[p] ?? p}</option>)}
                </select>
              </label>
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-300">Origem do ovo <span className="font-normal text-slate-500">(marque as aceitas e dê um preço a cada — vazio = qualquer, preço único)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {ORDER_EGG_TYPES.map((t) => {
                  const on = t in eggPrices;
                  return (
                    <button key={t} type="button" onClick={() => setEggPrices((cur) => { const n = { ...cur }; if (on) delete n[t]; else n[t] = ""; return n; })}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${on ? "border-[#FFCB05]/60 bg-[#FFCB05]/15 text-[#FFCB05]" : "border-border text-slate-400 hover:text-slate-200"}`}>
                      {ORDER_EGG_LABEL[t]}
                    </button>
                  );
                })}
              </div>
              {Object.keys(eggPrices).length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {ORDER_EGG_TYPES.filter((t) => t in eggPrices).map((t) => (
                    <label key={t} className="flex items-center gap-2 text-[11px] text-slate-300">
                      <span className="w-32 shrink-0">{ORDER_EGG_LABEL[t]}</span>
                      <input type="number" min={1} inputMode="numeric" placeholder="ZC" value={eggPrices[t]}
                        onChange={(e) => setEggPrices((cur) => ({ ...cur, [t]: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60" />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-300">3 atributos mais altos <span className="font-normal text-slate-500">({topStats.length}/3 — deixe vazio para qualquer)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {ORDER_STAT_KEYS.map((k) => {
                  const on = topStats.includes(k);
                  return (
                    <button key={k} type="button" onClick={() => setTopStats((cur) => on ? cur.filter((x) => x !== k) : cur.length >= 3 ? cur : [...cur, k])}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${on ? "border-[#FFCB05]/60 bg-[#FFCB05]/15 text-[#FFCB05]" : "border-border text-slate-400 hover:text-slate-200"}`}>
                      {ORDER_STAT_LABEL[k]}
                    </button>
                  );
                })}
              </div>
              {topStats.length > 0 && topStats.length < 3 && <p className="text-[10px] text-amber-300">Marque exatamente 3 atributos.</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Quantidade (comprada de uma vez)</label>
            <input type="number" min={1} max={99} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60" />
          </div>
        )}

        {Object.keys(eggPrices).length === 0 || kind !== "MASCOT" ? (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Quanto você paga (ZC total)</label>
          <input type="number" min={1} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Ex.: 1500"
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60" />
        </div>
        ) : null}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">Validade</label>
          <div className="grid grid-cols-3 gap-2">
            {BUY_ORDER_DURATIONS.map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded-xl border py-2 text-xs ${days === d ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 text-[#FFCB05]" : "border-border text-slate-400 hover:bg-white/5"}`}>{d} dias</button>
            ))}
          </div>
        </div>

        <p className="rounded-xl bg-slate-900/70 p-3 text-[11px] leading-relaxed text-slate-400">
          Nada é cobrado agora. O ZC só sai da sua conta quando alguém vender. Máximo de {BUY_ORDER_MAX_ACTIVE} pedidos abertos.
        </p>
        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
        <button onClick={submit} disabled={pending || !chosen || (kind === "MASCOT" && Object.keys(eggPrices).length > 0 ? Object.values(eggPrices).some((v) => !(Number(v) > 0)) : !(Number(price) > 0)) || (topStats.length > 0 && topStats.length < 3)}
          className="w-full rounded-xl bg-[#FFCB05] px-4 py-2.5 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50">
          {pending ? "Publicando…" : "Publicar pedido"}
        </button>
      </div>
    </Modal>
  );
}

export function BuyOrdersPanel({ orders, playerId, species, items, myActiveCount }: Props) {
  const router = useRouter();
  const [selling, setSelling] = useState<BuyOrderView | null>(null);
  const [creating, setCreating] = useState(false);
  const [cancelling, startCancel] = useTransition();

  function cancel(id: string) {
    startCancel(async () => {
      const r = await cancelBuyOrder(id);
      if (r.error) toast.error(r.error); else { toast.success("Pedido cancelado."); router.refresh(); }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {playerId && (
          <button onClick={() => (myActiveCount >= BUY_ORDER_MAX_ACTIVE ? toast.error(`Você já tem ${BUY_ORDER_MAX_ACTIVE} pedidos abertos.`) : setCreating(true))}
            className="flex items-center gap-1.5 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700]">
            <Plus size={13} /> Novo pedido
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-3xl">📋</p>
          <p className="text-sm text-slate-500">Nenhum pedido aberto por aqui.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => (
            <article key={o.id} className={`flex flex-col gap-3 rounded-2xl border bg-slate-950/60 p-3 transition-colors ${o.canFulfill && o.covered ? "border-emerald-400/40" : "border-border"}`}>
              <OrderThumb order={o} />
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="truncate text-sm font-bold text-slate-100">
                  {o.label}{o.kind === "ITEM" && o.quantity > 1 ? ` ×${o.quantity}` : ""}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {o.kind === "MASCOT" ? `Mascote${o.minLevel > 1 ? ` · nível ${o.minLevel}+` : ""}` : "Item"} · por {o.mine ? "você" : o.buyer.displayName}
                </p>
                {o.kind === "MASCOT" && (o.personality || o.eggType || o.topStats) && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {o.personality && <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{PERSONALITY_LABEL[o.personality] ?? o.personality}</span>}
                    {o.eggType && <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">🥚 {parseEggPrices(o.eggType).map((e) => `${ORDER_EGG_LABEL[e.type] ?? e.type}${e.price ? ` ${e.price.toLocaleString("pt-BR")}` : ""}`).join(" · ")}</span>}
                    {o.topStats && <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">Top: {o.topStats.split(",").map((k) => ORDER_STAT_LABEL[k as OrderStatKey] ?? k).join(" · ")}</span>}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2 py-0.5 text-[11px] font-black text-[#FFCB05]">💰 {parseEggPrices(o.eggType).some((e) => e.price) ? "a partir de " : ""}{o.priceCoins.toLocaleString("pt-BR")} ZC</span>
                  {o.covered ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">✓ Venda imediata</span>
                  ) : (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">⏳ Sem saldo agora</span>
                  )}
                  {o.canFulfill && <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300"><Sparkles size={10} /> Você tem</span>}
                </div>
                <p className="flex items-center gap-1 pt-1 text-[10px] text-slate-500"><Clock size={10} /> expira em {timeLeft(o.expiresAt)}</p>
              </div>
              {o.mine ? (
                <button onClick={() => cancel(o.id)} disabled={cancelling}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50">
                  <Trash2 size={12} /> Cancelar pedido
                </button>
              ) : (
                <button onClick={() => (playerId ? setSelling(o) : toast.error("Faça login para vender."))}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${o.covered ? "bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]" : "border border-amber-400/30 text-amber-200 hover:bg-amber-400/10"}`}>
                  {o.covered ? "Vender agora" : "Ver detalhes"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {selling && <SellDialog order={selling} onClose={() => setSelling(null)} />}
      {creating && <CreateDialog species={species} items={items} onClose={() => setCreating(false)} />}
    </>
  );
}
