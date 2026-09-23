"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import { PlayerSearchInput } from "@/components/player-search-input";
import { createLigaCashPayment, getLigaCashOrderStatus } from "./actions";
import { CardCheckout } from "./card-checkout";

type Product = { code: string; label: string; amount: number; cents: number };
type Pix = { orderId: string; code: string; image?: string; expiresAt: string };

export function LigaCashGiftForm({ senderPlayerId, products, cardPublicKey }: { senderPlayerId: string; products: Product[]; cardPublicKey: string }) {
  const router = useRouter();
  const [recipientPlayerId, setRecipientPlayerId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [productCode, setProductCode] = useState(products[0]?.code ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [pix, setPix] = useState<Pix | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const product = products.find((item) => item.code === productCode);
  const canBuy = Boolean(product && recipientPlayerId && title.trim() && title.trim().length <= 80 && content.trim() && content.trim().length <= 350 && cpf.replace(/\D/g, "").length === 11 && /^\S+@\S+\.\S+$/.test(email.trim()));

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  useEffect(() => {
    if (!pix) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const result = await getLigaCashOrderStatus(pix.orderId);
        if (stopped) return;
        if (result.status === "PAID") {
          setPix(null);
          setConfirmed(true);
          toast.success(`Presente confirmado para ${recipientName}!`);
          router.refresh();
          return;
        }
        if (["CANCELLED", "EXPIRED", "REFUNDED"].includes(result.status)) {
          setPix(null);
          toast.error("Esta cobrança não está mais aguardando pagamento.");
          return;
        }
      } catch {
        // Uma falha temporária de rede não cancela o pedido.
      }
      timer = setTimeout(check, 5_000);
    };
    timer = setTimeout(check, 3_000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [pix, recipientName, router]);

  function buyGift() {
    if (!canBuy || pending || pix) return;
    startTransition(async () => {
      const result = await createLigaCashPayment(productCode, cpf, email, { recipientPlayerId, title: title.trim(), content: content.trim() });
      if (result.error) { toast.error(result.error); return; }
      if (!result.orderId || !result.qrCode || !result.expiresAt) { toast.error("Não foi possível gerar o PIX."); return; }
      setPix({ orderId: result.orderId, code: result.qrCode, image: result.qrCodeBase64, expiresAt: result.expiresAt });
      setConfirmed(false);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-cyan-400/10 via-slate-950/80 to-violet-500/10 p-5 text-left transition hover:border-cyan-300/50 hover:bg-cyan-300/10 sm:p-6">
        <span className="flex items-center gap-3"><span className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2.5 text-cyan-200"><Gift size={20} /></span><span><span className="block font-bold text-white">Comprar LigaCash de presente</span><span className="mt-1 block text-xs text-slate-400">Escolha um pacote, escreva uma mensagem e pague por Pix ou cartão.</span></span></span>
        <span className="shrink-0 text-xs font-bold text-cyan-200">{pix ? "PIX pendente" : confirmed ? "Presente enviado" : "Abrir"}</span>
      </button>
      {open && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/85 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="liga-cash-gift-title" className="mx-auto my-2 w-full max-w-3xl rounded-2xl border border-cyan-300/25 bg-[linear-gradient(135deg,#07101f,#10102b)] p-5 shadow-2xl sm:my-8 sm:p-6">
      <div className="flex justify-end"><button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Fechar janela de presente" className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:border-cyan-300/50 hover:text-white"><X size={18} /></button></div>
      <div className="flex items-start gap-3"><div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2.5 text-cyan-200"><Gift size={20} /></div><div><h2 id="liga-cash-gift-title" className="font-bold text-white">Comprar LigaCash de presente</h2><p className="mt-1 text-sm text-slate-400">Escolha um pacote e pague por Pix ou cartão. Seu saldo de LC não será usado. Após a confirmação, o jogador verá sua mensagem na Caixa de presentes e poderá resgatar o pacote.</p></div></div>
      <div className="mt-5 grid gap-4">
        <label className="space-y-1.5 text-xs font-semibold text-slate-300"><span>Jogador presenteado</span><PlayerSearchInput value={recipientPlayerId} onChange={(id, player) => { setRecipientPlayerId(id); setRecipientName(player?.displayName ?? ""); }} excludeIds={[senderPlayerId]} placeholder="Buscar jogador por nome ou nick..." /></label>
        <div><p className="mb-2 text-xs font-semibold text-slate-300">Pacote</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{products.map((item) => <button key={item.code} type="button" onClick={() => setProductCode(item.code)} className={`rounded-xl border p-3 text-left transition ${productCode === item.code ? "border-cyan-300 bg-cyan-300/10" : "border-slate-700 bg-slate-950 hover:border-slate-500"}`}><span className="block text-xs font-bold text-white">{item.label}</span><span className="mt-1 block text-sm font-black text-cyan-200">{item.amount.toLocaleString("pt-BR")} LC</span><span className="text-xs text-slate-400">R$ {(item.cents / 100).toFixed(2).replace(".", ",")}</span></button>)}</div></div>
        <label className="space-y-1.5 text-xs font-semibold text-slate-300"><span>Título ({title.length}/80)</span><input maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Um presente para você!" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400" /></label>
        <label className="space-y-1.5 text-xs font-semibold text-slate-300"><span>Mensagem ({content.length}/350)</span><textarea maxLength={350} rows={4} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Escreva sua mensagem para o jogador..." className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm leading-6 text-white outline-none focus:border-cyan-400" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-xs font-semibold text-slate-300"><span>E-mail do pagador</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pagador@email.com" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400" /></label><label className="space-y-1.5 text-xs font-semibold text-slate-300"><span>CPF do pagador</span><input inputMode="numeric" value={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="000.000.000-00" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400" /></label></div>
        <p className="text-[11px] text-slate-500">E-mail e CPF são enviados ao Mercado Pago e não são salvos pela Liga.</p>
        <button type="button" onClick={buyGift} disabled={!canBuy || pending || Boolean(pix)} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">{pending ? "Gerando PIX..." : `Comprar ${product?.amount.toLocaleString("pt-BR") ?? ""} LC para ${recipientName || "outro jogador"}`}</button>
        {product && recipientPlayerId && title.trim() && content.trim() && <CardCheckout publicKey={cardPublicKey} code={productCode} amountCents={Math.ceil(product.cents*1.05)} gift={{recipientPlayerId,title:title.trim(),content:content.trim()}} disabled={Boolean(pix)||pending||title.trim().length>80||content.trim().length>350} onPaid={(order)=>{if(order.status!=="PAID")return;setConfirmed(true);toast.success(`Presente confirmado para ${recipientName}!`);router.refresh();}}/>}
      </div>
      {pix && <div className="mt-5 rounded-2xl border border-cyan-300/30 bg-slate-950 p-5 text-center"><h3 className="font-bold text-cyan-200">PIX do presente gerado</h3><p className="mt-1 text-xs text-slate-400">Válido até {new Date(pix.expiresAt).toLocaleString("pt-BR")}. O presente aparece após o pagamento ser confirmado.</p>{pix.image && <img src={`data:image/png;base64,${pix.image}`} alt="QR Code PIX do presente" className="mx-auto my-4 h-56 w-56 rounded-xl bg-white p-2" />}<button type="button" onClick={async () => { await navigator.clipboard.writeText(pix.code); setCopied(true); }} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 px-4 py-2 text-xs font-bold text-cyan-200">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Código copiado" : "Copiar código PIX"}</button></div>}
      {confirmed && <p className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm font-semibold text-emerald-200">Pagamento confirmado! O presente está na Caixa de presentes de {recipientName}.</p>}
        </section>
      </div>}
    </>
  );
}
