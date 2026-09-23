"use client";

import { useEffect, useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";
import { X } from "lucide-react";
import { createLigaCashPayment, getLigaCashOrderStatus } from "./actions";

type Gift = { recipientPlayerId: string; title: string; content: string };
type PaidOrder = Awaited<ReturnType<typeof getLigaCashOrderStatus>>;

function CardForm({ publicKey, code, amountCents, gift, onPaid }: {
  publicKey: string; code: string; amountCents: number; gift?: Gift; onPaid: (order: PaidOrder) => void;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    initMercadoPago(publicKey, { locale: "pt-BR" });
    setReady(true);
  }, [publicKey]);

  useEffect(() => {
    if (!orderId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const order = await getLigaCashOrderStatus(orderId);
        if (stopped) return;
        if (order.status === "PAID") { onPaid(order); return; }
        if (["CANCELLED", "EXPIRED", "REFUNDED"].includes(order.status)) {
          setError("O pagamento não foi aprovado. Confira seus pedidos ou tente outro cartão.");
          setOrderId("");
          return;
        }
      } catch { /* Falha temporária: continuar acompanhando o pedido. */ }
      timer = setTimeout(check, 5_000);
    };
    timer = setTimeout(check, 2_000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [orderId, onPaid]);

  return <div className="space-y-4">
    <p className="text-sm text-slate-300">Total no cartão: <strong className="text-white">R$ {(amountCents / 100).toFixed(2).replace(".", ",")}</strong> (5% acima do Pix). Escolha 1 parcela para pagar à vista ou uma das opções de parcelamento disponíveis. O Mercado Pago exibirá eventuais juros antes da confirmação.</p>
    {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
    {orderId ? <p className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-sm text-cyan-100">Pagamento enviado. Aguardando confirmação do Mercado Pago; não faça outra cobrança enquanto verificamos.</p> : ready ? <div className="rounded-xl bg-white p-3 text-slate-900">
      <CardPayment
        initialization={{ amount: amountCents / 100 }}
        customization={{ paymentMethods: { minInstallments: 1, maxInstallments: 12, types: { included: ["credit_card"] } } }}
        locale="pt-BR"
        onError={() => setError("Não foi possível carregar o formulário de cartão. Tente novamente.")}
        onSubmit={async (data) => {
          setError("");
          const result = await createLigaCashPayment(
            code, data.payer.identification?.number ?? "", data.payer.email ?? "", gift,
            { token: data.token, paymentMethodId: data.payment_method_id, issuerId: data.issuer_id || undefined, installments: Number(data.installments) },
          );
          if (result.error || !result.orderId) { setError(result.error ?? "O Mercado Pago não aceitou o pagamento."); throw new Error("payment rejected"); }
          setOrderId(result.orderId);
        }}
      />
    </div> : <p className="text-sm text-slate-400">Carregando formulário seguro...</p>}
    <p className="text-xs text-slate-500">Os dados do cartão são processados pelo Mercado Pago e não ficam armazenados na Liga.</p>
  </div>;
}

export function CardCheckout({ publicKey, code, amountCents, gift, disabled = false, onPaid }: {
  publicKey: string; code: string; amountCents: number; gift?: Gift; disabled?: boolean; onPaid: (order: PaidOrder) => void;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" disabled={disabled || !publicKey} onClick={() => setOpen(true)} className="mt-2 w-full rounded-xl border border-violet-300/50 bg-violet-400/10 py-3 text-sm font-bold text-violet-100 hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-50">Pagar com cartão · R$ {(amountCents / 100).toFixed(2).replace(".", ",")}</button>
    {!publicKey && <p className="mt-1 text-center text-[11px] text-amber-300">Cartão temporariamente indisponível; falta configurar a chave pública do Mercado Pago.</p>}
    {open && <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/85 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="Pagar com cartão" className="mx-auto my-2 w-full max-w-xl rounded-2xl border border-violet-300/30 bg-slate-950 p-5 shadow-2xl sm:my-8 sm:p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black text-white">Pagar com cartão de crédito</h2><button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-lg border border-slate-700 p-2 text-slate-300"><X size={18} /></button></div>
        <CardForm publicKey={publicKey} code={code} amountCents={amountCents} gift={gift} onPaid={(order) => { setOpen(false); onPaid(order); }} />
      </section>
    </div>}
  </>;
}
