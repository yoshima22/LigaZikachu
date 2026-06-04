import { Coins } from "lucide-react";

interface Transaction {
  id: string;
  description: string;
  buyerName: string;
  sellerName: string;
  coinsAmount: number;
  category: string;
  createdAt: Date;
}

const CATEGORY_EMOJI: Record<string, string> = {
  MASCOT: "🐾", ITEM: "📦", COSMETIC: "✨",
};

export function BazarFeed({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-slate-600">
        Nenhuma transação ainda. Seja o primeiro a negociar!
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {transactions.map(tx => (
        <div key={tx.id} className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-slate-900/40 px-3 py-2">
          <span className="text-base shrink-0 mt-0.5">{CATEGORY_EMOJI[tx.category] ?? "📦"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-300 leading-snug">{tx.description}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              {tx.buyerName} ← {tx.sellerName}
              {" · "}
              {new Date(tx.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          {tx.coinsAmount > 0 && (
            <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-[#FFCB05]">
              <Coins size={9}/>{tx.coinsAmount.toLocaleString("pt-BR")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
