import Link from "next/link";
import { ArrowLeft, ArrowRight, Coins, History, Search, UserRound } from "lucide-react";
import { getPokemonName } from "@/lib/mascot-data";
import { getTransactionHistory } from "../actions";

export const dynamic = "force-dynamic";

type Payload = {
  displayName?: string;
  pokemonName?: string;
  nickname?: string | null;
  level?: number;
  quantity?: number;
};

type OfferedItem = {
  displayName?: string;
  quantity?: number;
  pokemonId?: number;
  level?: number;
};

function isSameName(first?: string | null, second?: string | null) {
  return Boolean(
    first &&
    second &&
    first.trim().localeCompare(second.trim(), "pt-BR", { sensitivity: "base" }) === 0
  );
}

function listedAsset(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const value = payload as Payload;
  const originalName = value.pokemonName || value.displayName;
  const nickname = value.nickname?.trim();
  const name = originalName
    ? `${originalName}${nickname && !isSameName(originalName, nickname) ? ` (${nickname})` : ""}`
    : nickname;
  if (!name) return fallback;
  const level = typeof value.level === "number" ? ` Nv.${value.level}` : "";
  const quantity = typeof value.quantity === "number" && value.quantity > 1
    ? `${value.quantity}× `
    : "";
  return `${quantity}${name}${level}`;
}

function offeredAssets(items: unknown) {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const item = raw as OfferedItem;
    const quantity = typeof item.quantity === "number" && item.quantity > 1
      ? `${item.quantity}× `
      : "";
    if (typeof item.pokemonId === "number") {
      const originalName = getPokemonName(item.pokemonId);
      const offeredName = item.displayName?.replace(/\s+Nv\.\d+\s*$/i, "").trim();
      const nickname = offeredName && !isSameName(originalName, offeredName)
        ? ` (${offeredName})`
        : "";
      const level = typeof item.level === "number" ? ` Nv.${item.level}` : "";
      return `${quantity}${originalName}${nickname}${level}`;
    }
    return `${quantity}${item.displayName || "Item não identificado"}`;
  });
}

function pageHref(page: number, search: string) {
  const params = new URLSearchParams();
  if (search) params.set("jogador", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/bazar/historico${query ? `?${query}` : ""}`;
}

export default async function BazarHistoryPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const searchParams = await searchParamsPromise;
  const search = searchParams.jogador?.trim() ?? "";
  const requestedPage = Number.parseInt(searchParams.page ?? "1", 10);
  const result = await getTransactionHistory({
    search,
    page: Number.isFinite(requestedPage) ? requestedPage : 1,
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] to-[#201d38] p-5">
        <Link href="/bazar" className="mb-4 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-[#FFCB05]">
          <ArrowLeft size={13} /> Voltar ao Bazar
        </Link>
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-[#FFCB05]/10 p-2 text-[#FFCB05]"><History size={20} /></div>
          <div>
            <h1 className="font-pixel text-sm text-[#FFCB05]">Histórico de transações</h1>
            <p className="mt-1 text-xs text-slate-400">
              Consulte todo o histórico e veja o que cada jogador enviou e recebeu.
            </p>
          </div>
        </div>
      </div>

      <form className="flex flex-col gap-2 rounded-2xl border border-border bg-slate-950/40 p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            name="jogador"
            defaultValue={search}
            placeholder="Buscar quem enviou ou recebeu..."
            className="h-10 w-full rounded-xl border border-border bg-slate-900 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/50"
          />
        </label>
        <button className="h-10 rounded-xl bg-[#FFCB05] px-5 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700]">
          Buscar jogadores
        </button>
        {search && (
          <Link href="/bazar/historico" className="flex h-10 items-center justify-center rounded-xl border border-border px-4 text-xs text-slate-400 hover:text-slate-200">
            Limpar
          </Link>
        )}
      </form>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-300">{result.total}</span>{" "}
          {result.total === 1 ? "transação encontrada" : "transações encontradas"}
          {search ? ` envolvendo “${search}”` : ""}
        </p>
        <p className="text-[10px] text-slate-600">Página {result.page} de {result.totalPages}</p>
      </div>

      {result.transactions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-slate-500">
          Nenhuma transação encontrada para esse jogador.
        </div>
      ) : (
        <div className="space-y-3">
          {result.transactions.map((transaction) => {
            const sellerAsset = listedAsset(transaction.payload, transaction.description);
            const buyerAssets = offeredAssets(transaction.offerItems);
            if (transaction.offerCoins > 0) buyerAssets.push(`${transaction.offerCoins.toLocaleString("pt-BR")} ZC`);
            const received = buyerAssets.length > 0 ? buyerAssets : ["Sem contrapartida registrada"];

            return (
              <article key={transaction.id} className="rounded-2xl border border-border/70 bg-slate-950/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{sellerAsset}</p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {new Date(transaction.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-1 text-[9px] uppercase tracking-wide text-slate-500">
                    {transaction.listingType === "AUCTION" ? "Leilão" : transaction.offerItems ? "Troca" : "Venda"}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                  <div className="rounded-xl bg-slate-900/70 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
                      <UserRound size={11} /> {transaction.sellerName} enviou
                    </p>
                    <p className="mt-1.5 text-xs font-medium text-slate-200">{sellerAsset}</p>
                  </div>
                  <ArrowRight size={16} className="hidden self-center text-slate-600 sm:block" />
                  <div className="rounded-xl bg-slate-900/70 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
                      <UserRound size={11} /> {transaction.buyerName} enviou
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {received.map((asset, index) => (
                        <span key={`${asset}-${index}`} className="inline-flex items-center gap-1 rounded-lg border border-[#FFCB05]/15 bg-[#FFCB05]/5 px-2 py-1 text-xs text-slate-300">
                          {asset.endsWith(" ZC") && <Coins size={10} className="text-[#FFCB05]" />}
                          {asset}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-slate-600">
                  Resultado: {transaction.buyerName} recebeu {sellerAsset}; {transaction.sellerName} recebeu {received.join(" + ")}.
                </p>
              </article>
            );
          })}
        </div>
      )}

      {result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1, search)} className="rounded-xl border border-border px-4 py-2 text-xs text-slate-300 hover:border-[#FFCB05]/40">
              ← Anterior
            </Link>
          ) : <span />}
          <span className="text-xs text-slate-500">{result.page} / {result.totalPages}</span>
          {result.page < result.totalPages ? (
            <Link href={pageHref(result.page + 1, search)} className="rounded-xl border border-border px-4 py-2 text-xs text-slate-300 hover:border-[#FFCB05]/40">
              Próxima →
            </Link>
          ) : <span />}
        </div>
      )}
    </div>
  );
}
