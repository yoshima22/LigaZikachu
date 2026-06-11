"use client";

import { useState, useTransition, useMemo } from "react";
import { Search, Loader2, FlaskConical, ShoppingBag, X } from "lucide-react";
import { recycleMascotAction, tradeDustForCoinsAction, tradeDustForEggAction } from "../actions";
import type { MascotRarity } from "../rarity";

type LabMascot = {
  id: string;
  pokemonId: number;
  name: string;
  nickname: string | null;
  level: number;
  isShiny: boolean;
  spriteUrl: string;
  rarity: MascotRarity;
  dust: number;
  recyclable: boolean;
  isFavorite: boolean;
};

type WeeklyUsage = { coinsTraded: number; commonEggs: number; rareEggs: number; specialEggs: number };
type Limits = { coinsTraded: number; commonEggs: number; rareEggs: number; specialEggs: number };
type Costs = { coins: number; commonEgg: number; rareEgg: number; specialEgg: number };

const RARITY_LABEL: Record<MascotRarity, string> = {
  COMMON: "Comum",
  RARE: "Raro",
  SPECIAL: "Especial",
};

const RARITY_COLOR: Record<MascotRarity, string> = {
  COMMON: "text-slate-400 border-slate-600",
  RARE: "text-blue-400 border-blue-600/40",
  SPECIAL: "text-[#FFCB05] border-[#FFCB05]/40",
};

const PAGE_SIZE = 12;

interface Props {
  initialDust: number;
  initialMascots: LabMascot[];
  initialWeeklyUsage: WeeklyUsage;
  limits: Limits;
  costs: Costs;
}

export function LabClient({ initialDust, initialMascots, initialWeeklyUsage, limits, costs }: Props) {
  const [tab, setTab] = useState<"recycle" | "shop">("recycle");
  const [dust, setDust] = useState(initialDust);
  const [mascots, setMascots] = useState(initialMascots);
  const [weeklyUsage, setWeeklyUsage] = useState(initialWeeklyUsage);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [isPending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return mascots;
    const q = search.toLowerCase();
    return mascots.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.nickname ?? "").toLowerCase().includes(q),
    );
  }, [mascots, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const showFeedback = (ok: boolean, message: string) => {
    setFeedback({ ok, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleRecycle = (mascotId: string) => {
    start(async () => {
      const res = await recycleMascotAction(mascotId);
      if (!res.ok) { showFeedback(false, res.error); return; }
      setDust((d) => d + res.dust);
      setMascots((prev) => prev.filter((m) => m.id !== mascotId));
      setConfirmId(null);
      showFeedback(true, `+${res.dust} Pó de Criação obtido!`);
    });
  };

  const handleTradeCoins = () => {
    start(async () => {
      const res = await tradeDustForCoinsAction();
      if (!res.ok) { showFeedback(false, res.error); return; }
      setDust((d) => d - costs.coins);
      setWeeklyUsage((w) => ({ ...w, coinsTraded: w.coinsTraded + 1 }));
      showFeedback(true, `+400 ZikaCoins adicionados à sua carteira!`);
    });
  };

  const handleTradeEgg = (tier: "COMMON" | "RARE" | "SPECIAL") => {
    start(async () => {
      const res = await tradeDustForEggAction(tier);
      if (!res.ok) { showFeedback(false, res.error); return; }
      const costMap = { COMMON: costs.commonEgg, RARE: costs.rareEgg, SPECIAL: costs.specialEgg };
      const fieldMap = { COMMON: "commonEggs", RARE: "rareEggs", SPECIAL: "specialEggs" } as const;
      setDust((d) => d - costMap[tier]);
      setWeeklyUsage((w) => ({ ...w, [fieldMap[tier]]: w[fieldMap[tier]] + 1 }));
      const labels = { COMMON: "Ovo Comum", RARE: "Ovo Raro", SPECIAL: "Ovo Especial" };
      showFeedback(true, `${labels[tier]} adicionado à sua incubadora!`);
    });
  };

  const confirmMascot = mascots.find((m) => m.id === confirmId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFCB05]/10 text-2xl">
          🧪
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Laboratório do Prof. Enguiça</h1>
          <p className="text-sm text-slate-400">Recicle mascotes e troque Pó de Criação por recompensas.</p>
        </div>
        {/* Dust counter */}
        <div className="ml-auto flex items-center gap-2 rounded-2xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 px-4 py-2">
          <span className="text-lg">🧫</span>
          <span className="text-base font-bold text-[#FFCB05]">{dust}</span>
          <span className="text-xs text-slate-400">Pó</span>
        </div>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.ok
              ? "border-green-500/40 bg-green-500/10 text-green-400"
              : "border-red-500/40 bg-red-500/10 text-red-400"
          }`}
        >
          {feedback.ok ? "✓" : "✗"} {feedback.message}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {(["recycle", "shop"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? "bg-[#FFCB05] text-[#1A1A2E]"
                : "border border-border text-slate-400 hover:text-white"
            }`}
          >
            {t === "recycle" ? <><FlaskConical size={15} /> Reciclar Mascotes</> : <><ShoppingBag size={15} /> Loja de Pó</>}
          </button>
        ))}
      </div>

      {/* ── RECYCLE TAB ── */}
      {tab === "recycle" && (
        <div>
          <p className="mb-4 text-xs text-slate-500">
            Recicle mascotes para obter Pó de Criação. Mascotes favoritos não podem ser reciclados.
            O pó base é: Comum = 1, Raro = 2, Especial = 3 — duplicatas aumentam o multiplicador (1.5× na 2ª cópia, 3× da 3ª em diante).
          </p>

          {/* Search */}
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-slate-900 px-3 py-2">
            <Search size={14} className="shrink-0 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar mascote por nome ou apelido…"
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
            />
            {search && (
              <button onClick={() => { setSearch(""); setPage(0); }} className="text-slate-500 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>

          {mascots.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">Você não tem mascotes ainda.</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum mascote encontrado.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {paged.map((m) => (
                <div
                  key={m.id}
                  className={`relative flex flex-col items-center gap-1 rounded-2xl border p-3 text-center ${
                    m.recyclable
                      ? "border-border bg-slate-900 hover:border-slate-600"
                      : "border-slate-800 bg-slate-900/50 opacity-50"
                  }`}
                >
                  <img src={m.spriteUrl} alt="" className="h-14 w-14 object-contain" />
                  <p className="line-clamp-1 text-xs font-bold text-white">
                    {m.nickname || m.name}
                  </p>
                  <p className="text-[10px] text-slate-500">Lv.{m.level}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${RARITY_COLOR[m.rarity]}`}>
                    {RARITY_LABEL[m.rarity]}
                  </span>
                  {m.recyclable ? (
                    <button
                      onClick={() => setConfirmId(m.id)}
                      disabled={isPending}
                      className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-1 text-[10px] font-semibold text-[#FFCB05] transition-colors hover:bg-slate-700 disabled:opacity-40"
                    >
                      🧫 {m.dust} pó
                    </button>
                  ) : (
                    <span className="mt-1 text-[9px] text-slate-600">
                      {m.isFavorite ? "⭐ Favorito" : "Em batalha"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg px-3 py-1.5 hover:bg-slate-800 disabled:opacity-30"
              >
                ← Anterior
              </button>
              <span>{page + 1} / {totalPages} · {filtered.length} mascotes</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg px-3 py-1.5 hover:bg-slate-800 disabled:opacity-30"
              >
                Próximo →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── SHOP TAB ── */}
      {tab === "shop" && (
        <div className="space-y-3">
          <p className="mb-4 text-xs text-slate-500">
            Troque Pó de Criação por ZikaCoins ou ovos. Cada item tem um limite semanal que reinicia toda segunda-feira.
          </p>

          {/* 400 ZC */}
          <ShopItem
            emoji="🪙"
            title="400 ZikaCoins"
            description="Adicionados diretamente à sua carteira."
            cost={costs.coins}
            dust={dust}
            used={weeklyUsage.coinsTraded}
            limit={limits.coinsTraded}
            isPending={isPending}
            onBuy={handleTradeCoins}
          />

          {/* Ovo Comum */}
          <ShopItem
            emoji="🥚"
            title="Ovo Comum"
            description="Mascote do pool geral de pokémons."
            cost={costs.commonEgg}
            dust={dust}
            used={weeklyUsage.commonEggs}
            limit={limits.commonEggs}
            isPending={isPending}
            onBuy={() => handleTradeEgg("COMMON")}
          />

          {/* Ovo Raro */}
          <ShopItem
            emoji="💙"
            title="Ovo Raro"
            description="Starters, fan-favorites e pokémons especiais."
            cost={costs.rareEgg}
            dust={dust}
            used={weeklyUsage.rareEggs}
            limit={limits.rareEggs}
            isPending={isPending}
            onBuy={() => handleTradeEgg("RARE")}
          />

          {/* Ovo Especial */}
          <ShopItem
            emoji="⭐"
            title="Ovo Especial"
            description="Pool exclusivo dos pokémons mais raros e cobiçados."
            cost={costs.specialEgg}
            dust={dust}
            used={weeklyUsage.specialEggs}
            limit={limits.specialEggs}
            isPending={isPending}
            onBuy={() => handleTradeEgg("SPECIAL")}
          />
        </div>
      )}

      {/* ── Confirm modal ── */}
      {confirmMascot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-slate-900 p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-white">Reciclar Mascote?</h2>
            <p className="mb-4 text-sm text-slate-400">
              Essa ação é irreversível. O mascote será permanentemente removido.
            </p>
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-border bg-slate-800/60 px-4 py-3">
              <img src={confirmMascot.spriteUrl} alt="" className="h-14 w-14 object-contain" />
              <div>
                <p className="font-bold text-white">{confirmMascot.nickname || confirmMascot.name}</p>
                <p className="text-xs text-slate-400">{confirmMascot.name} · Lv.{confirmMascot.level}</p>
                <p className="text-sm font-bold text-[#FFCB05]">🧫 +{confirmMascot.dust} pó de criação</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 rounded-xl border border-border py-2 text-sm font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRecycle(confirmMascot.id)}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {isPending ? <Loader2 size={15} className="mx-auto animate-spin" /> : "Reciclar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShopItem({
  emoji, title, description, cost, dust, used, limit, isPending, onBuy,
}: {
  emoji: string; title: string; description: string; cost: number;
  dust: number; used: number; limit: number; isPending: boolean; onBuy: () => void;
}) {
  const atLimit = used >= limit;
  const canAfford = dust >= cost;
  const disabled = atLimit || !canAfford || isPending;

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-slate-900 px-4 py-3">
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400">{description}</p>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-xs font-bold text-[#FFCB05]">🧫 {cost} pó</span>
          <span className={`text-[10px] ${atLimit ? "text-red-400" : "text-slate-500"}`}>
            {used}/{limit} esta semana
          </span>
        </div>
      </div>
      <button
        onClick={onBuy}
        disabled={disabled}
        className="shrink-0 rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-[#1A1A2E] transition-colors hover:bg-[#FFD700] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : "Trocar"}
      </button>
    </div>
  );
}
