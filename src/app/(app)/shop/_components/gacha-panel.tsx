"use client";

// Aba Invocações da ZikaShop: tela do jogador (abrir banner, missões, pacotes)
// e a configuração do admin. Enquanto o modo estiver em testes, a aba inteira
// só é montada para admin de plataforma — o gate fica na page.tsx.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Image as ImageIcon, Target, Wallet, Plus, Trash2, Clock, Percent, X, Shield, AlertTriangle } from "lucide-react";
import { getPokemonName, getStaticSpriteUrl, POKEMON_PT_NAMES } from "@/lib/mascot-data";
import {
  saveGachaBannerAction, deleteGachaBannerAction,
  saveGachaEntryAction, deleteGachaEntryAction,
  saveGachaPityAction, deleteGachaPityAction,
  saveGachaMissionAction, deleteGachaMissionAction, generateGachaMissionSetAction,
  saveGachaPackAction, deleteGachaPackAction,
  pullGachaBannerAction, buyGachaPackAction, claimGachaMissionAction,
} from "../gacha-actions";

/* ─────────────────────────────── tipos ─────────────────────────────── */

export type GachaEntryDTO = {
  id: string; kind: "EGG" | "MASCOT" | "ITEM"; label: string; rarity: string;
  weight: number; rateUp: boolean; imageUrl: string | null;
  eggType: string | null; pokemonId: number | null; itemId: string | null; quantity: number;
};
export type GachaPityDTO = { id: string; currency: Currency; everyPulls: number; rarity: string; counter: number };
export type GachaBannerDTO = {
  id: string; name: string; subtitle: string | null; flavor: string | null;
  imageUrl: string | null; mascotArtUrl: string | null;
  startsAt: string; endsAt: string; durationDays: number; active: boolean;
  costSingle: number; costMulti: number; ultraCostSingle: number; ultraCostMulti: number;
  guaranteedRarity: string; ultraGuaranteedRarity: string; rateUpMultiplier: number;
  entries: GachaEntryDTO[]; pityRules: GachaPityDTO[];
};
export type GachaMissionDTO = {
  id: string; bannerId: string | null; title: string; source: string; goal: number;
  reward: Currency; rewardAmount: number; rarityFilter: string | null; active: boolean; sortOrder: number;
  criteria: Record<string, unknown> | null;
  progress: number; claimed: boolean;
};
export type GachaPackDTO = {
  id: string; name: string; currency: Currency; amount: number; bonus: number;
  priceLc: number; active: boolean; sortOrder: number;
};

type Currency = "POKEBALL" | "ULTRABALL";

export type GachaPanelProps = {
  banners: GachaBannerDTO[];
  missions: GachaMissionDTO[];
  packs: GachaPackDTO[];
  wallet: { pokeballs: number; ultraballs: number };
  ligaCash: number;
  shopItems: Array<{ id: string; name: string }>;
  players: Array<{ id: string; name: string }>;
  icons: { pokeball: string; ultraball: string; celestialEgg: string; labEgg: string };
};

/* ───────────────────────────── constantes ───────────────────────────── */

const RARITIES = ["COMMON", "RARE", "EVENT", "SPECIAL", "LAB", "CELESTIAL"] as const;

const RARITY_LABEL: Record<string, string> = {
  COMMON: "Comum", RARE: "Raro", EVENT: "Evento", SPECIAL: "Especial",
  LAB: "De Laboratório", CELESTIAL: "Celestial",
};
const RARITY_COLOR: Record<string, string> = {
  COMMON: "#cbd5e1", RARE: "#60a5fa", EVENT: "#f87171",
  SPECIAL: "#fbbf24", LAB: "#c084fc", CELESTIAL: "#5eead4",
};
const EGG_TYPES = ["COMMON", "RARE", "EVENT", "SPECIAL", "LAB", "CELESTIAL"];
const POKEMON_TYPES = [
  ["NORMAL", "Normal"], ["FIRE", "Fogo"], ["WATER", "Água"], ["ELECTRIC", "Elétrico"], ["GRASS", "Planta"], ["ICE", "Gelo"],
  ["FIGHTING", "Lutador"], ["POISON", "Veneno"], ["GROUND", "Terra"], ["FLYING", "Voador"], ["PSYCHIC", "Psíquico"], ["BUG", "Inseto"],
  ["ROCK", "Pedra"], ["GHOST", "Fantasma"], ["DRAGON", "Dragão"], ["DARK", "Sombrio"], ["STEEL", "Aço"], ["FAIRY", "Fada"],
] as const;

const OBJECTIVE_SOURCES: Array<{ key: string; label: string; metric: string }> = [
  { key: "ARENA_Z", label: "Arena-Z", metric: "vitórias" },
  { key: "LIGA_RUSH", label: "Liga Rush", metric: "corridas" },
  { key: "LIGA_SEMANAL", label: "Liga Semanal", metric: "partidas" },
  { key: "BATALHA_TERRENO", label: "Batalha de Terreno", metric: "vitórias" },
  { key: "ARENA_DRAFT", label: "Arena Draft", metric: "drafts" },
  { key: "FIGURINHAS", label: "Coleção de Figurinhas", metric: "figurinhas" },
  { key: "BAZAR_VENDA", label: "Venda no Bazar", metric: "vendas" },
  { key: "BAZAR_GASTO_ZC", label: "Gasto de ZC no Bazar", metric: "ZC" },
  { key: "BAZAR_GASTO_LC", label: "Gasto de LC no Bazar", metric: "LC" },
  { key: "OVOS_ABERTOS", label: "Aberturas de ovos", metric: "ovos" },
  { key: "EXPEDICAO_CONCLUIDA", label: "Farm: expedições concluídas", metric: "expedições" },
  { key: "COMBATE_PVP", label: "Combate contra jogador", metric: "combates" },
  { key: "COMBATE_KO", label: "KO contra mascote em PvP", metric: "KOs" },
  { key: "LACOS", label: "Atividades de Laços", metric: "atividades" },
  { key: "ALBUM_COMPLETO", label: "Álbuns completados", metric: "álbuns" },
  { key: "LIGA_RUSH_VITORIA", label: "Vitórias na Liga Rush", metric: "vitórias" },
  { key: "LIGA_SEMANAL_VITORIA", label: "Vitórias na Liga Semanal", metric: "vitórias" },
  { key: "BAZAR_COMPRA", label: "Compras de outros jogadores", metric: "compras" },
  { key: "BAZAR_LEILAO_VENCIDO", label: "Leilões vencidos no Bazar", metric: "leilões" },
  { key: "ALBUM_PACOTES_COMPRADOS", label: "Pacotes de álbum comprados", metric: "pacotes" },
  { key: "MIAUVADAO_COMPRA_SLOT", label: "Compras em slot do Miauvadão", metric: "compras" },
  { key: "MIAUVADAO_APOSTA", label: "Apostas no Miauvadão", metric: "apostas" },
  { key: "MIAUVADAO_ACERTO", label: "Acertos no Miauvadão", metric: "acertos" },
  { key: "ZIKABET_ACERTO", label: "Acertos na ZikaBet", metric: "acertos" },
  { key: "ZIKALOOT_NUMERO", label: "Números escolhidos na ZikaLoot", metric: "números" },
  { key: "ARENA_DRAFT_PARTIDA", label: "Partidas na Arena Draft", metric: "partidas" },
];

const POKEMON_ID_BY_NAME = new Map(
  Object.entries(POKEMON_PT_NAMES).map(([id, name]) => [name.toLowerCase(), Number(id)]),
);
const POKEMON_NAME_SET = new Set(Object.values(POKEMON_PT_NAMES));

function resolvePokemonId(value: string) {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return POKEMON_ID_BY_NAME.get(trimmed.toLowerCase()) ?? null;
}

/** Arte de uma entrada: imagem própria > sprite do mascote > ovo de Lab/Celestial. */
function entryArt(entry: { imageUrl: string | null; kind: string; pokemonId?: number | null; rarity: string }, icons: GachaPanelProps["icons"]) {
  if (entry.imageUrl) return entry.imageUrl;
  if (entry.kind === "MASCOT" && entry.pokemonId) return getStaticSpriteUrl(entry.pokemonId);
  if (entry.rarity === "CELESTIAL") return icons.celestialEgg;
  if (entry.rarity === "LAB") return icons.labEgg;
  return null;
}

const inputCls = "w-full rounded-xl border border-border bg-slate-900/70 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-300/60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function localInput(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/* ─────────────────────────────── painel ─────────────────────────────── */

const SUBTABS = [
  { id: "player", label: "Tela do jogador", icon: <Sparkles size={14} /> },
  { id: "banner", label: "Banner", icon: <ImageIcon size={14} /> },
  { id: "pool", label: "Pool & Garantias", icon: <Percent size={14} /> },
  { id: "missions", label: "Missões semanais", icon: <Target size={14} /> },
  { id: "packs", label: "Pacotes LC", icon: <Wallet size={14} /> },
];

export function GachaPanel(props: GachaPanelProps) {
  const [tab, setTab] = useState("player");
  const [bannerId, setBannerId] = useState(props.banners[0]?.id ?? "");
  const banner = props.banners.find((b) => b.id === bannerId) ?? props.banners[0] ?? null;

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes gacha-shake { 0%,100%{transform:rotate(0) translateY(0)} 20%{transform:rotate(-14deg)} 40%{transform:rotate(14deg)} 60%{transform:rotate(-10deg) translateY(-6px)} 80%{transform:rotate(10deg)} }
        @keyframes gacha-burst { 0%{opacity:0;transform:scale(.2)} 40%{opacity:.9} 100%{opacity:0;transform:scale(3.2)} }
        @keyframes gacha-reveal { from{opacity:0;transform:translateY(18px) scale(.9)} to{opacity:1;transform:none} }
        @keyframes gacha-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      `}</style>

      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-200">
        <strong>Modo em testes.</strong> A aba Invocações está visível só para admin de plataforma. O que você configurar aqui já grava no banco e já vale para as aberturas.
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {SUBTABS.map((s) => (
          <button key={s.id} type="button" onClick={() => setTab(s.id)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === s.id ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200" : "border-border text-slate-400 hover:text-slate-200"
            }`}>
            {s.icon}{s.label}
          </button>
        ))}
        {props.banners.length > 0 && (
          <select value={banner?.id ?? ""} onChange={(e) => setBannerId(e.target.value)}
            className="ml-auto rounded-xl border border-border bg-slate-900/70 px-2 py-1.5 text-xs text-slate-300">
            {props.banners.map((b) => (
              <option key={b.id} value={b.id}>{b.active ? "● " : "○ "}{b.name}</option>
            ))}
          </select>
        )}
      </div>

      <datalist id="gacha-pokemon-list">
        {Object.entries(POKEMON_PT_NAMES).map(([id, name]) => <option key={id} value={name} />)}
      </datalist>

      {tab === "player" && <PlayerScreen {...props} banner={banner} />}
      {tab === "banner" && <BannerEditor banner={banner} onSelect={setBannerId} />}
      {tab === "pool" && (banner ? <PoolEditor banner={banner} shopItems={props.shopItems} icons={props.icons} /> : <Empty />)}
      {tab === "missions" && <MissionEditor missions={props.missions} banners={props.banners} players={props.players} />}
      {tab === "packs" && <PackEditor packs={props.packs} icons={props.icons} />}
    </div>
  );
}

function Empty() {
  return <p className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-slate-500">Crie um banner primeiro na aba Banner.</p>;
}

/* ─────────────────────────── 1. tela do jogador ─────────────────────────── */

type PullResult = { label: string; rarity: string; kind: string; imageUrl: string | null; pokemonId?: number | null; guaranteed: boolean };

function PlayerScreen({ banner, missions, packs, wallet, ligaCash, icons }: GachaPanelProps & { banner: GachaBannerDTO | null }) {
  const [pending, startTransition] = useTransition();
  const [pull, setPull] = useState<{ currency: Currency; results: PullResult[] } | null>(null);

  if (!banner) return <Empty />;

  const rarities = [...new Set(banner.entries.map((e) => e.rarity))].sort(
    (a, b) => RARITIES.indexOf(a as never) - RARITIES.indexOf(b as never),
  );
  // Ganham arte na tela: mascotes, destaques de rate-up e os ovos Lab/Celestial.
  // O resto é citado por texto (ícone de ovo comum é simples e repetido).
  const highlights = banner.entries.filter(
    (entry) => entryArt(entry, icons) !== null && (entry.kind === "MASCOT" || entry.rateUp || entry.rarity === "LAB" || entry.rarity === "CELESTIAL"),
  );
  const highlighted = new Set(highlights.map((entry) => entry.rarity));
  const textual = rarities.filter((rarity) => !highlighted.has(rarity));
  const rateUps = banner.entries.filter((e) => e.rateUp);
  const endsAt = new Date(banner.endsAt);
  const startsAt = new Date(banner.startsAt);
  const isLive = banner.active && startsAt <= new Date() && endsAt > new Date();

  function doPull(currency: Currency, count: 1 | 10) {
    startTransition(async () => {
      const result = await pullGachaBannerAction(banner!.id, currency, count);
      if ("error" in result && result.error) { toast.error(result.error); return; }
      setPull({ currency, results: (result.rewards ?? []) as PullResult[] });
    });
  }

  return (
    <div className="space-y-4">
      {!isLive && (
        <p className="flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
          <AlertTriangle size={14} className="shrink-0" />
          Banner fora do ar ({!banner.active ? "marcado como inativo" : "fora da janela de datas"}). Jogadores não conseguem abrir; como admin você ainda pode abrir para testar — o custo em moedas é cobrado normalmente.
        </p>
      )}
      <div className="relative overflow-hidden rounded-3xl border border-slate-700/60 bg-gradient-to-br from-[#0b1027] via-[#131a3d] to-[#07142b]">
        {banner.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={banner.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#050b1f]/70 via-[#050b1f]/30 to-[#050b1f]/85" />
        {banner.mascotArtUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={banner.mascotArtUrl} alt="" className="absolute left-6 top-1/2 hidden h-[26rem] -translate-y-1/2 object-contain lg:block"
            style={{ animation: "gacha-float 6s ease-in-out infinite" }} />
        )}

        <div className="relative p-6">
          <div className="mb-8 flex justify-end gap-3 text-sm font-bold">
            <span className="flex items-center gap-2 rounded-full border border-slate-500/40 bg-slate-950/70 px-4 py-1.5 text-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icons.pokeball} alt="" className="h-5 w-5" />{wallet.pokeballs}
            </span>
            <span className="flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-1.5 text-amber-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icons.ultraball} alt="" className="h-5 w-5" />{wallet.ultraballs}
            </span>
          </div>

          <div className="ml-auto max-w-xl space-y-5 text-right">
            <p className="inline-flex rounded-full border border-cyan-200/30 px-4 py-1 text-[10px] uppercase tracking-[0.3em] text-cyan-200">Evento de invocação</p>
            <div>
              <h2 className="font-pixel text-2xl text-white drop-shadow sm:text-4xl">{banner.name}</h2>
              {banner.subtitle && <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-300">{banner.subtitle}</p>}
            </div>
            {banner.flavor && <p className="text-sm text-slate-300">{banner.flavor}</p>}

            <div className="rounded-2xl border border-slate-600/50 bg-slate-950/70 p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-400">Raridades possíveis neste banner</p>
              {highlights.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-end gap-4">
                  {highlights.map((entry) => (
                    <div key={entry.id} className="flex w-20 flex-col items-center gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entryArt(entry, icons)!} alt="" className="h-16 w-16 object-contain drop-shadow" />
                      <span className="text-center text-[9px] leading-tight text-slate-200">{entry.label}</span>
                      <span className="text-[9px] uppercase tracking-wider" style={{ color: RARITY_COLOR[entry.rarity] }}>{RARITY_LABEL[entry.rarity]}</span>
                    </div>
                  ))}
                </div>
              )}
              {textual.length > 0 && (
                <p className="mt-3 text-[11px] text-slate-400">
                  Também saem ovos {textual.map((r) => RARITY_LABEL[r]).join(", ")}.
                </p>
              )}
              {rateUps.length > 0 && (
                <p className="mt-2 text-[11px] text-amber-200">
                  Chance aumentada ({banner.rateUpMultiplier}×): {rateUps.map((e) => e.label).join(", ")}.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <PullButton tone="blue" icon={icons.pokeball} title="Invocação" sub={`${banner.costSingle} Pokébola`} disabled={pending} onClick={() => doPull("POKEBALL", 1)} />
              <PullButton tone="gold" icon={icons.pokeball} title="Invocação x10" sub={`${banner.costMulti} Pokébolas · garante ${RARITY_LABEL[banner.guaranteedRarity]}+`} disabled={pending} onClick={() => doPull("POKEBALL", 10)} />
              <PullButton tone="ultra" icon={icons.ultraball} title="Ultra Invocação" sub={`${banner.ultraCostSingle} Ultra Bola`} disabled={pending} onClick={() => doPull("ULTRABALL", 1)} />
              <PullButton tone="ultra" icon={icons.ultraball} title="Ultra Invocação x10" sub={`${banner.ultraCostMulti} Ultra Bolas · garante ${RARITY_LABEL[banner.ultraGuaranteedRarity]}+`} disabled={pending} onClick={() => doPull("ULTRABALL", 10)} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            {banner.pityRules.map((rule) => (
              <span key={rule.id} className="flex items-center gap-2 rounded-xl border border-slate-600/60 bg-slate-950/70 px-3 py-1.5">
                <Shield size={12} />
                <span>
                  {RARITY_LABEL[rule.rarity]}+ garantido em {rule.everyPulls} de {rule.currency === "POKEBALL" ? "Pokébola" : "Ultra Bola"}
                  <span className="ml-1 text-slate-400">({rule.counter}/{rule.everyPulls})</span>
                </span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                  <span className="block h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, (rule.counter / rule.everyPulls) * 100)}%` }} />
                </span>
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1.5 rounded-xl border border-slate-600/60 bg-slate-950/70 px-3 py-1.5">
              <Clock size={12} /> Até {endsAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </span>
          </div>
        </div>
      </div>

      <MissionList missions={missions} icons={icons} />
      <PackList packs={packs.filter((p) => p.active)} ligaCash={ligaCash} icons={icons} />

      {pull && <PullAnimation pull={pull} icons={icons} onClose={() => setPull(null)} />}
    </div>
  );
}

function PullButton({ title, sub, tone, icon, disabled, onClick }: { title: string; sub: string; tone: "blue" | "gold" | "ultra"; icon: string; disabled: boolean; onClick: () => void }) {
  const styles = {
    blue: "border-sky-300/50 bg-sky-400/10 text-sky-100 hover:bg-sky-400/20",
    gold: "border-amber-300/60 bg-amber-400/15 text-amber-100 hover:bg-amber-400/25",
    ultra: "border-fuchsia-300/50 bg-fuchsia-400/10 text-fuchsia-100 hover:bg-fuchsia-400/20",
  }[tone];
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`flex items-center justify-center gap-3 rounded-2xl border px-4 py-3 text-center transition-colors disabled:opacity-50 ${styles}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className="h-8 w-8 shrink-0" />
      <span>
        <span className="block font-pixel text-[11px]">{title}</span>
        <span className="mt-1 block text-[10px] opacity-80">{sub}</span>
      </span>
    </button>
  );
}

function PullAnimation({ pull, icons, onClose }: { pull: { currency: Currency; results: PullResult[] }; icons: GachaPanelProps["icons"]; onClose: () => void }) {
  const ultra = pull.currency === "ULTRABALL";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6" onClick={onClose}>
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-700 bg-[#0b1027] p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-white"><X size={18} /></button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ultra ? icons.ultraball : icons.pokeball} alt="" className="mx-auto mb-6 h-24 w-24"
          style={{ animation: "gacha-shake .7s ease-in-out 2" }} />
        <div className="pointer-events-none absolute left-1/2 top-24 h-24 w-24 -translate-x-1/2 rounded-full blur-2xl"
          style={{ background: ultra ? "#fbbf24" : "#38bdf8", animation: "gacha-burst 1.4s ease-out 1.2s both" }} />
        <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-slate-400">
          {ultra ? "Ultra Invocação" : "Invocação"} x{pull.results.length}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {pull.results.map((result, index) => (
            <div key={index} className="flex h-32 w-24 flex-col items-center justify-center gap-1 rounded-xl border p-2"
              style={{ borderColor: RARITY_COLOR[result.rarity], background: `${RARITY_COLOR[result.rarity]}18`, animation: `gacha-reveal .45s ease-out ${1.4 + index * 0.12}s both` }}>
              {entryArt(result, icons) && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={entryArt(result, icons)!} alt="" className="h-12 w-12 object-contain" />
              )}
              <span className="text-[9px] leading-tight text-slate-200">{result.label}</span>
              <span className="text-[8px] uppercase" style={{ color: RARITY_COLOR[result.rarity] }}>{RARITY_LABEL[result.rarity]}</span>
              {result.guaranteed && <span className="text-[8px] text-amber-300">garantido</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MissionList({ missions, icons }: { missions: GachaMissionDTO[]; icons: GachaPanelProps["icons"] }) {
  const [pending, startTransition] = useTransition();
  const active = missions.filter((m) => m.active);
  if (active.length === 0) return null;

  function claim(id: string) {
    startTransition(async () => {
      const result = await claimGachaMissionAction(id);
      if (result.error) toast.error(result.error);
      else toast.success("Recompensa resgatada!");
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-slate-500">Missões desta semana</p>
      <div className="grid gap-2 md:grid-cols-2">
        {active.map((mission) => {
          const done = mission.progress >= mission.goal;
          return (
            <div key={mission.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-slate-950/60 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-200">{mission.title}</p>
                <div className="mt-2 h-1.5 w-48 max-w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, (mission.progress / mission.goal) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">{Math.min(mission.progress, mission.goal)} / {mission.goal}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="flex items-center gap-1 text-xs font-bold text-amber-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mission.reward === "POKEBALL" ? icons.pokeball : icons.ultraball} alt="" className="h-5 w-5" />
                  +{mission.rewardAmount}
                </span>
                <button type="button" disabled={!done || mission.claimed || pending} onClick={() => claim(mission.id)}
                  className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-[10px] font-bold text-cyan-200 disabled:opacity-40">
                  {mission.claimed ? "resgatado" : "resgatar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PackList({ packs, ligaCash, icons }: { packs: GachaPackDTO[]; ligaCash: number; icons: GachaPanelProps["icons"] }) {
  const [pending, startTransition] = useTransition();
  if (packs.length === 0) return null;

  function buy(id: string) {
    startTransition(async () => {
      const result = await buyGachaPackAction(id);
      if (result.error) toast.error(result.error);
      else toast.success("Pacote comprado!");
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-widest text-slate-500">Pacotes por LigaCash · saldo {ligaCash.toLocaleString("pt-BR")} LC</p>
      <div className="grid gap-3 md:grid-cols-3">
        {packs.map((pack) => (
          <div key={pack.id} className="rounded-2xl border border-border bg-slate-900/60 p-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pack.currency === "POKEBALL" ? icons.pokeball : icons.ultraball} alt="" className="h-10 w-10" />
              <div>
                <p className="text-sm font-bold text-slate-100">{pack.name}</p>
                <p className="text-xs text-slate-400">{pack.amount}{pack.bonus > 0 && <span className="text-emerald-300"> +{pack.bonus}</span>}</p>
              </div>
            </div>
            <button type="button" disabled={pending} onClick={() => buy(pack.id)}
              className="mt-3 w-full rounded-xl border border-cyan-300/50 bg-cyan-300/10 py-2 text-sm font-bold text-cyan-200 disabled:opacity-50">
              {pack.priceLc.toLocaleString("pt-BR")} LC
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── 2. editor do banner ─────────────────────────── */

const EMPTY_BANNER = {
  name: "", subtitle: "", flavor: "", imageUrl: "", mascotArtUrl: "",
  startsAt: localInput(new Date().toISOString()), durationDays: 14, active: false,
  costSingle: 1, costMulti: 10, ultraCostSingle: 1, ultraCostMulti: 10,
  guaranteedRarity: "RARE", ultraGuaranteedRarity: "SPECIAL", rateUpMultiplier: 3,
};

function BannerEditor({ banner, onSelect }: { banner: GachaBannerDTO | null; onSelect: (id: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(() => (banner ? bannerToForm(banner) : EMPTY_BANNER));
  const [editingId, setEditingId] = useState(banner?.id ?? "");

  // Troca de banner no seletor do topo: recarrega o formulário.
  if (banner && banner.id !== editingId) {
    setEditingId(banner.id);
    setForm(bannerToForm(banner));
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save(createNew: boolean) {
    startTransition(async () => {
      const result = await saveGachaBannerAction({
        id: createNew ? undefined : editingId || undefined,
        ...form,
        durationDays: form.durationDays as 7 | 14 | 30,
        guaranteedRarity: form.guaranteedRarity as never,
        ultraGuaranteedRarity: form.ultraGuaranteedRarity as never,
      });
      if (result.error) { toast.error(result.error); return; }
      toast.success("Banner salvo.");
      if (result.id) { setEditingId(result.id); onSelect(result.id); }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border border-border bg-slate-950/60 p-5">
        <Field label="Nome"><input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></Field>
        <Field label="Subtítulo"><input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={inputCls} /></Field>
        <Field label="Frase de efeito"><textarea rows={2} value={form.flavor} onChange={(e) => set("flavor", e.target.value)} className={inputCls} /></Field>
        <Field label="Imagem de fundo (URL)"><input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" className={inputCls} /></Field>
        <Field label="Arte do mascote em destaque (URL, fundo transparente)"><input value={form.mascotArtUrl} onChange={(e) => set("mascotArtUrl", e.target.value)} placeholder="https://…" className={inputCls} /></Field>
        <Field label="Início"><input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={inputCls} /></Field>
        <Field label="Duração">
          <div className="flex gap-2">
            {[7, 14, 30].map((days) => (
              <button key={days} type="button" onClick={() => set("durationDays", days)}
                className={`rounded-xl border px-4 py-2 text-xs ${form.durationDays === days ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-200" : "border-border text-slate-400"}`}>
                {days} dias
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pokébolas · 1 abertura"><input type="number" value={form.costSingle} onChange={(e) => set("costSingle", Number(e.target.value))} className={inputCls} /></Field>
          <Field label="Pokébolas · 10 aberturas"><input type="number" value={form.costMulti} onChange={(e) => set("costMulti", Number(e.target.value))} className={inputCls} /></Field>
          <Field label="Ultra Bolas · 1 abertura"><input type="number" value={form.ultraCostSingle} onChange={(e) => set("ultraCostSingle", Number(e.target.value))} className={inputCls} /></Field>
          <Field label="Ultra Bolas · 10 aberturas"><input type="number" value={form.ultraCostMulti} onChange={(e) => set("ultraCostMulti", Number(e.target.value))} className={inputCls} /></Field>
          <Field label="Garantia do x10 (Pokébola)">
            <select value={form.guaranteedRarity} onChange={(e) => set("guaranteedRarity", e.target.value)} className={inputCls}>
              {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]} ou superior</option>)}
            </select>
          </Field>
          <Field label="Garantia do x10 (Ultra Bola)">
            <select value={form.ultraGuaranteedRarity} onChange={(e) => set("ultraGuaranteedRarity", e.target.value)} className={inputCls}>
              {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]} ou superior</option>)}
            </select>
          </Field>
          <Field label="Multiplicador do rate-up"><input type="number" step="0.5" value={form.rateUpMultiplier} onChange={(e) => set("rateUpMultiplier", Number(e.target.value))} className={inputCls} /></Field>
          <Field label="Status">
            <button type="button" onClick={() => set("active", !form.active)}
              className={`w-full rounded-xl border px-3 py-2 text-xs font-bold ${form.active ? "border-emerald-300/60 bg-emerald-300/10 text-emerald-200" : "border-border text-slate-400"}`}>
              {form.active ? "Ativo" : "Inativo"}
            </button>
          </Field>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={pending} onClick={() => save(false)} className="flex-1 rounded-xl border border-cyan-300/50 bg-cyan-300/10 py-2 text-sm font-bold text-cyan-200 disabled:opacity-50">
            {editingId ? "Salvar alterações" : "Criar banner"}
          </button>
          {editingId && (
            <>
              <button type="button" disabled={pending} onClick={() => save(true)} className="rounded-xl border border-border px-3 text-xs text-slate-300">Duplicar</button>
              <button type="button" disabled={pending}
                onClick={() => startTransition(async () => {
                  if (!confirm("Apagar este banner e todo o conteúdo dele?")) return;
                  await deleteGachaBannerAction(editingId);
                  toast.success("Banner apagado.");
                  setEditingId(""); setForm(EMPTY_BANNER);
                })}
                className="rounded-xl border border-rose-400/40 px-3 text-xs text-rose-200">Apagar</button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
        <p className="mb-3 text-xs uppercase tracking-widest text-slate-500">Prévia da arte</p>
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-700 bg-gradient-to-br from-[#0b1027] to-[#132248] text-xs text-slate-500">
          {form.imageUrl
            ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
            : "informe a URL da imagem de fundo"}
        </div>
        <p className="mt-3 text-xs text-slate-500">Fundo em 1920×1080. A arte do mascote é desenhada por cima, à esquerda — use PNG/WebP com fundo transparente.</p>
      </div>
    </div>
  );
}

function bannerToForm(banner: GachaBannerDTO) {
  return {
    name: banner.name,
    subtitle: banner.subtitle ?? "",
    flavor: banner.flavor ?? "",
    imageUrl: banner.imageUrl ?? "",
    mascotArtUrl: banner.mascotArtUrl ?? "",
    startsAt: localInput(banner.startsAt),
    durationDays: banner.durationDays,
    active: banner.active,
    costSingle: banner.costSingle,
    costMulti: banner.costMulti,
    ultraCostSingle: banner.ultraCostSingle,
    ultraCostMulti: banner.ultraCostMulti,
    guaranteedRarity: banner.guaranteedRarity,
    ultraGuaranteedRarity: banner.ultraGuaranteedRarity,
    rateUpMultiplier: banner.rateUpMultiplier,
  };
}

/* ─────────────────────── 3. pool, rate-up e garantias ─────────────────────── */

function PoolEditor({ banner, shopItems, icons }: { banner: GachaBannerDTO; shopItems: Array<{ id: string; name: string }>; icons: GachaPanelProps["icons"] }) {
  const [pending, startTransition] = useTransition();
  const total = banner.entries.reduce((sum, entry) => sum + entry.weight * (entry.rateUp ? banner.rateUpMultiplier : 1), 0);

  function saveEntry(entry: Partial<GachaEntryDTO> & { id?: string }) {
    startTransition(async () => {
      const result = await saveGachaEntryAction({
        id: entry.id,
        bannerId: banner.id,
        kind: (entry.kind ?? "EGG") as never,
        label: entry.label ?? "Novo item",
        rarity: (entry.rarity ?? "COMMON") as never,
        weight: entry.weight ?? 1,
        rateUp: entry.rateUp ?? false,
        imageUrl: entry.imageUrl ?? null,
        eggType: entry.eggType ?? null,
        pokemonId: entry.pokemonId ?? null,
        itemId: entry.itemId ?? null,
        quantity: entry.quantity ?? 1,
      });
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border bg-slate-950/60 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-200">Conteúdo que pode sair em {banner.name}</p>
          <button type="button" disabled={pending}
            onClick={() => saveEntry({ kind: "EGG", label: "Ovo Comum", rarity: "COMMON", eggType: "COMMON", weight: 40 })}
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs text-slate-300"><Plus size={12} /> Adicionar</button>
        </div>

        <div className="space-y-2">
          {banner.entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} banner={banner} shopItems={shopItems} total={total}
              onSave={saveEntry}
              onDelete={() => startTransition(async () => { await deleteGachaEntryAction(entry.id); })} />
          ))}
          {banner.entries.length === 0 && <p className="text-xs text-slate-500">Nenhum conteúdo cadastrado — o banner não abre enquanto estiver vazio.</p>}
        </div>
      </div>

      <PityEditor banner={banner} icons={icons} />
    </div>
  );
}

function EntryRow({ entry, banner, shopItems, total, onSave, onDelete }: {
  entry: GachaEntryDTO; banner: GachaBannerDTO; shopItems: Array<{ id: string; name: string }>;
  total: number; onSave: (entry: Partial<GachaEntryDTO> & { id?: string }) => void; onDelete: () => void;
}) {
  const [draft, setDraft] = useState(entry);
  const effective = draft.weight * (draft.rateUp ? banner.rateUpMultiplier : 1);
  const dirty = JSON.stringify(draft) !== JSON.stringify(entry);

  function set<K extends keyof GachaEntryDTO>(key: K, value: GachaEntryDTO[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid items-end gap-2 rounded-xl border border-border/60 p-3 md:grid-cols-[1.2fr_.8fr_.9fr_.6fr_.6fr_.7fr_auto]">
      <Field label="Nome exibido"><input value={draft.label} onChange={(e) => set("label", e.target.value)} className={inputCls} /></Field>
      <Field label="Tipo">
        <select value={draft.kind} onChange={(e) => set("kind", e.target.value as GachaEntryDTO["kind"])} className={inputCls}>
          <option value="EGG">Ovo</option><option value="MASCOT">Mascote</option><option value="ITEM">Item da loja</option>
        </select>
      </Field>
      <Field label={draft.kind === "EGG" ? "Tipo de ovo" : draft.kind === "MASCOT" ? "Nº Pokédex" : "Item"}>
        {draft.kind === "EGG" ? (
          <select value={draft.eggType ?? ""} onChange={(e) => set("eggType", e.target.value)} className={inputCls}>
            {EGG_TYPES.map((type) => <option key={type} value={type}>{RARITY_LABEL[type]}</option>)}
          </select>
        ) : draft.kind === "MASCOT" ? (
          <div className="flex items-center gap-2">
            <input
              list="gacha-pokemon-list"
              defaultValue={draft.pokemonId ? getPokemonName(draft.pokemonId) : ""}
              placeholder="nome ou nº"
              onChange={(e) => {
                const id = resolvePokemonId(e.target.value);
                if (!id) return;
                setDraft((current) => ({
                  ...current,
                  pokemonId: id,
                  // Rótulo ainda no padrão? Acompanha o mascote escolhido.
                  label: !current.label || current.label === "Novo item" || POKEMON_NAME_SET.has(current.label)
                    ? getPokemonName(id)
                    : current.label,
                }));
              }}
              className={inputCls}
            />
            {draft.pokemonId ? (
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-slate-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getStaticSpriteUrl(draft.pokemonId)} alt="" className="h-8 w-8 object-contain" />
                #{draft.pokemonId}
              </span>
            ) : <span className="shrink-0 text-[10px] text-amber-300">escolha o mascote</span>}
          </div>
        ) : (
          <select value={draft.itemId ?? ""} onChange={(e) => set("itemId", e.target.value)} className={inputCls}>
            <option value="">selecione…</option>
            {shopItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        )}
      </Field>
      <Field label="Raridade">
        <select value={draft.rarity} onChange={(e) => set("rarity", e.target.value)} className={inputCls} style={{ color: RARITY_COLOR[draft.rarity] }}>
          {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}</option>)}
        </select>
      </Field>
      <Field label={`Peso · ${total > 0 ? ((effective / total) * 100).toFixed(2) : "0.00"}%`}>
        <input type="number" step="0.1" value={draft.weight} onChange={(e) => set("weight", Number(e.target.value))} className={inputCls} />
      </Field>
      <Field label="Rate-up">
        <button type="button" onClick={() => set("rateUp", !draft.rateUp)}
          className={`w-full rounded-xl border px-2 py-2 text-[10px] font-bold ${draft.rateUp ? "border-amber-300/60 bg-amber-300/10 text-amber-200" : "border-border text-slate-500"}`}>
          {draft.rateUp ? "destaque" : "normal"}
        </button>
      </Field>
      <div className="flex items-center gap-2 pb-1">
        <button type="button" disabled={!dirty} onClick={() => onSave(draft)}
          className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-[10px] font-bold text-cyan-200 disabled:opacity-30">salvar</button>
        <button type="button" onClick={onDelete} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function PityEditor({ banner, icons }: { banner: GachaBannerDTO; icons: GachaPanelProps["icons"] }) {
  const [pending, startTransition] = useTransition();
  const [everyPulls, setEveryPulls] = useState(10);
  const [rarity, setRarity] = useState("SPECIAL");
  const [currency, setCurrency] = useState<Currency>("POKEBALL");

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-slate-950/60 p-5">
      <div>
        <p className="text-sm font-bold text-slate-200">Aberturas garantidas (barras)</p>
        <p className="text-xs text-slate-500">
          A cada N aberturas sem tirar aquela raridade, a próxima vem garantida. Pokébola costuma levar uma barra simples; Ultra Bola aceita várias barras para as raridades mais altas.
        </p>
      </div>

      <div className="space-y-2">
        {banner.pityRules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3 text-xs text-slate-300">
            <span className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={rule.currency === "POKEBALL" ? icons.pokeball : icons.ultraball} alt="" className="h-6 w-6" />
              A cada <strong>{rule.everyPulls}</strong> aberturas → <strong style={{ color: RARITY_COLOR[rule.rarity] }}>{RARITY_LABEL[rule.rarity]}</strong> ou superior
            </span>
            <button type="button" disabled={pending} onClick={() => startTransition(async () => { await deleteGachaPityAction(rule.id); })}
              className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
          </div>
        ))}
        {banner.pityRules.length === 0 && <p className="text-xs text-slate-500">Sem barras configuradas: só vale a garantia do x10.</p>}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Moeda">
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={inputCls}>
            <option value="POKEBALL">Pokébola</option><option value="ULTRABALL">Ultra Bola</option>
          </select>
        </Field>
        <Field label="A cada N aberturas"><input type="number" value={everyPulls} onChange={(e) => setEveryPulls(Number(e.target.value))} className={`${inputCls} w-28`} /></Field>
        <Field label="Garante">
          <select value={rarity} onChange={(e) => setRarity(e.target.value)} className={inputCls}>
            {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]} ou superior</option>)}
          </select>
        </Field>
        <button type="button" disabled={pending}
          onClick={() => startTransition(async () => {
            const result = await saveGachaPityAction({ bannerId: banner.id, currency, everyPulls, rarity: rarity as never });
            if (result.error) toast.error(result.error); else toast.success("Barra criada.");
          })}
          className="rounded-xl border border-cyan-300/50 bg-cyan-300/10 px-4 py-2 text-xs font-bold text-cyan-200">Adicionar barra</button>
      </div>
    </div>
  );
}

/* ─────────────────────────── 4. missões semanais ─────────────────────────── */

function MissionEditor({ missions, banners, players }: { missions: GachaMissionDTO[]; banners: GachaBannerDTO[]; players: GachaPanelProps["players"] }) {
  const [pending, startTransition] = useTransition();

  function save(mission: Partial<GachaMissionDTO> & { id?: string }) {
    startTransition(async () => {
      const result = await saveGachaMissionAction({
        id: mission.id,
        bannerId: mission.bannerId ?? null,
        title: mission.title ?? "Nova missão",
        source: (mission.source ?? "ARENA_Z") as never,
        goal: mission.goal ?? 1,
        reward: (mission.reward ?? "POKEBALL") as never,
        rewardAmount: mission.rewardAmount ?? 1,
        rarityFilter: mission.rarityFilter ?? null,
        criteria: mission.criteria ?? null,
        active: mission.active ?? true,
        sortOrder: mission.sortOrder ?? 0,
      });
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-slate-950/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-200">Missões semanais</p>
          <p className="text-xs text-slate-500">Reiniciam toda segunda 00:00 (BRT). O progresso é contado automaticamente quando o jogador cumpre o objetivo; a recompensa é resgatada por ele na tela do banner.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => startTransition(async () => {
            const result = await generateGachaMissionSetAction();
            if (result.ok) toast.success(result.created ? `${result.created} missões automáticas criadas.` : "O conjunto automático já está disponível.");
          })} className="flex items-center gap-1 rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-bold text-amber-100"><Sparkles size={12} /> Gerar conjunto</button>
          <button type="button" disabled={pending} onClick={() => save({ title: "Nova missão", goal: 1 })}
            className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs text-slate-300"><Plus size={12} /> Nova missão</button>
        </div>
      </div>

      <div className="space-y-2">
        {missions.map((mission) => (
          <MissionRow key={mission.id} mission={mission} banners={banners} players={players} onSave={save}
            onDelete={() => startTransition(async () => { await deleteGachaMissionAction(mission.id); })} />
        ))}
        {missions.length === 0 && <p className="text-xs text-slate-500">Nenhuma missão cadastrada.</p>}
      </div>
    </div>
  );
}

function MissionRow({ mission, banners, players, onSave, onDelete }: {
  mission: GachaMissionDTO; banners: GachaBannerDTO[]; players: GachaPanelProps["players"];
  onSave: (mission: Partial<GachaMissionDTO> & { id?: string }) => void; onDelete: () => void;
}) {
  const [draft, setDraft] = useState(mission);
  const dirty = JSON.stringify(draft) !== JSON.stringify(mission);
  const source = OBJECTIVE_SOURCES.find((s) => s.key === draft.source);

  function set<K extends keyof GachaMissionDTO>(key: K, value: GachaMissionDTO[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  const criteria = draft.criteria ?? {};
  function setCriteria(key: string, value: string | number | boolean | undefined) {
    setDraft((current) => {
      const next = { ...(current.criteria ?? {}) };
      if (value === undefined || value === "") delete next[key]; else next[key] = value;
      return { ...current, criteria: Object.keys(next).length ? next : null };
    });
  }
  // Só os objetivos PvP carregam adversário e a espécie/tipo do alvo.
  const needsCombatFilters = ["COMBATE_PVP", "COMBATE_KO"].includes(draft.source);
  const needsBazarFilters = ["BAZAR_COMPRA", "BAZAR_VENDA", "BAZAR_LEILAO_VENCIDO"].includes(draft.source);
  const needsMiauvadaoFilters = draft.source.startsWith("MIAUVADAO_");
  const needsZikalootFilters = draft.source === "ZIKALOOT_NUMERO";
  const needsAlbumGeneration = ["ALBUM_COMPLETO", "ALBUM_PACOTES_COMPRADOS"].includes(draft.source);

  return (
    <div className="grid items-end gap-2 rounded-xl border border-border/60 p-3 md:grid-cols-[1.4fr_1fr_.7fr_.8fr_.5fr_.9fr_auto]">
      <Field label="Descrição"><input value={draft.title} onChange={(e) => set("title", e.target.value)} className={inputCls} /></Field>
      <Field label="Objetivo">
        <select value={draft.source} onChange={(e) => set("source", e.target.value)} className={inputCls}>
          {OBJECTIVE_SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </Field>
      <Field label={`Meta (${source?.metric ?? ""})`}><input type="number" value={draft.goal} onChange={(e) => set("goal", Number(e.target.value))} className={inputCls} /></Field>
      <Field label="Recompensa">
        <select value={draft.reward} onChange={(e) => set("reward", e.target.value as Currency)} className={inputCls}>
          <option value="POKEBALL">Pokébola</option><option value="ULTRABALL">Ultra Bola</option>
        </select>
      </Field>
      <Field label="Qtd."><input type="number" value={draft.rewardAmount} onChange={(e) => set("rewardAmount", Number(e.target.value))} className={inputCls} /></Field>
      <Field label="Raridade mínima (opcional)">
        <select value={draft.rarityFilter ?? ""} onChange={(e) => set("rarityFilter", e.target.value || null)} className={inputCls}>
          <option value="">qualquer</option>
          {RARITIES.map((r) => <option key={r} value={r}>{RARITY_LABEL[r]}+</option>)}
        </select>
      </Field>
      <div className="flex items-center gap-2 pb-1">
        <button type="button" onClick={() => set("active", !draft.active)}
          className={`rounded-lg border px-2 py-1 text-[10px] ${draft.active ? "border-emerald-300/50 text-emerald-200" : "border-border text-slate-500"}`}>
          {draft.active ? "ativa" : "off"}
        </button>
        <button type="button" disabled={!dirty} onClick={() => onSave(draft)}
          className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-[10px] font-bold text-cyan-200 disabled:opacity-30">salvar</button>
        <button type="button" onClick={onDelete} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
      </div>
      {banners.length > 0 && (
        <div className="md:col-span-7">
          <Field label="Vincular a um banner (opcional)">
            <select value={draft.bannerId ?? ""} onChange={(e) => set("bannerId", e.target.value || null)} className={inputCls}>
              <option value="">missão geral</option>
              {banners.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        </div>
      )}
      <div className="space-y-2 border-t border-border/50 pt-3 md:col-span-7">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Filtros opcionais — deixe em branco para aceitar qualquer caso</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {needsCombatFilters && <>
            <Field label="Adversário"><select value={String(criteria.opponentPlayerId ?? "")} onChange={(e) => setCriteria("opponentPlayerId", e.target.value || undefined)} className={inputCls}><option value="">qualquer jogador</option>{players.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></Field>
            <Field label="ID do mascote"><input type="number" value={String(criteria.pokemonId ?? "")} onChange={(e) => setCriteria("pokemonId", e.target.value ? Number(e.target.value) : undefined)} placeholder="ex.: 25" className={inputCls} /></Field>
            <Field label={draft.source === "COMBATE_KO" ? "Tipo do alvo derrotado" : "Tipo do mascote"}><select value={String(criteria.pokemonType ?? "")} onChange={(e) => setCriteria("pokemonType", e.target.value || undefined)} className={inputCls}><option value="">qualquer tipo</option>{POKEMON_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            {draft.source === "COMBATE_KO" && <><Field label="ID de quem causa o KO"><input type="number" value={String(criteria.attackerPokemonId ?? "")} onChange={(e) => setCriteria("attackerPokemonId", e.target.value ? Number(e.target.value) : undefined)} placeholder="ex.: 6" className={inputCls} /></Field><Field label="Tipo de quem causa o KO"><select value={String(criteria.attackerPokemonType ?? "")} onChange={(e) => setCriteria("attackerPokemonType", e.target.value || undefined)} className={inputCls}><option value="">qualquer tipo</option>{POKEMON_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></>}
          </>}
          {needsBazarFilters && <>
            <Field label="Vendedor"><select value={String(criteria.sellerPlayerId ?? "")} onChange={(e) => setCriteria("sellerPlayerId", e.target.value || undefined)} className={inputCls}><option value="">qualquer jogador</option>{players.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></Field>
            <Field label="Categoria"><input value={String(criteria.bazarCategory ?? "")} onChange={(e) => setCriteria("bazarCategory", e.target.value)} placeholder="ex.: MASCOT" className={inputCls} /></Field>
            <Field label="Tipo de anúncio"><input value={String(criteria.bazarListingType ?? "")} onChange={(e) => setCriteria("bazarListingType", e.target.value)} placeholder="ex.: DIRECT" className={inputCls} /></Field>
          </>}
          {needsMiauvadaoFilters && <Field label="Slot (0 = primeiro)"><input type="number" value={String(criteria.miauvadaoSlot ?? "")} onChange={(e) => setCriteria("miauvadaoSlot", e.target.value ? Number(e.target.value) : undefined)} className={inputCls} /></Field>}
          {needsZikalootFilters && <><Field label="Número exato"><input type="number" value={String(criteria.exactNumber ?? "")} onChange={(e) => setCriteria("exactNumber", e.target.value ? Number(e.target.value) : undefined)} className={inputCls} /></Field><Field label="Ticket especial"><select value={criteria.specialTicket === undefined ? "" : String(criteria.specialTicket)} onChange={(e) => setCriteria("specialTicket", e.target.value === "" ? undefined : e.target.value === "true")} className={inputCls}><option value="">qualquer</option><option value="true">somente especial</option><option value="false">somente comum</option></select></Field></>}
          {needsAlbumGeneration && <Field label="Geração do álbum"><input type="number" min="1" max="9" value={String(criteria.albumGeneration ?? "")} onChange={(e) => setCriteria("albumGeneration", e.target.value ? Number(e.target.value) : undefined)} placeholder="qualquer geração" className={inputCls} /></Field>}
          {["MIAUVADAO_APOSTA", "MIAUVADAO_ACERTO", "ZIKABET_ACERTO", "BAZAR_GASTO_ZC", "BAZAR_GASTO_LC"].includes(draft.source) && <Field label="Valor mínimo"><input type="number" value={String(criteria.minAmount ?? "")} onChange={(e) => setCriteria("minAmount", e.target.value ? Number(e.target.value) : undefined)} className={inputCls} /></Field>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── 5. pacotes LC ─────────────────────────── */

function PackEditor({ packs, icons }: { packs: GachaPackDTO[]; icons: GachaPanelProps["icons"] }) {
  const [pending, startTransition] = useTransition();

  function save(pack: Partial<GachaPackDTO> & { id?: string }) {
    startTransition(async () => {
      const result = await saveGachaPackAction({
        id: pack.id,
        name: pack.name ?? "Novo pacote",
        currency: (pack.currency ?? "POKEBALL") as never,
        amount: pack.amount ?? 1,
        bonus: pack.bonus ?? 0,
        priceLc: pack.priceLc ?? 100,
        active: pack.active ?? true,
        sortOrder: pack.sortOrder ?? 0,
      });
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-slate-950/60 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-200">Pacotes vendidos por LigaCash</p>
        <button type="button" disabled={pending} onClick={() => save({ name: "Novo pacote" })}
          className="flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs text-slate-300"><Plus size={12} /> Novo pacote</button>
      </div>
      <div className="space-y-2">
        {packs.map((pack) => (
          <PackRow key={pack.id} pack={pack} icons={icons} onSave={save}
            onDelete={() => startTransition(async () => { await deleteGachaPackAction(pack.id); })} />
        ))}
        {packs.length === 0 && <p className="text-xs text-slate-500">Nenhum pacote cadastrado.</p>}
      </div>
      <p className="text-xs text-slate-500">Pokébola e Ultra Bola só compram conteúdo de banner — não substituem ZC nem LC em nenhuma outra tela.</p>
    </div>
  );
}

function PackRow({ pack, icons, onSave, onDelete }: {
  pack: GachaPackDTO; icons: GachaPanelProps["icons"];
  onSave: (pack: Partial<GachaPackDTO> & { id?: string }) => void; onDelete: () => void;
}) {
  const [draft, setDraft] = useState(pack);
  const dirty = JSON.stringify(draft) !== JSON.stringify(pack);

  function set<K extends keyof GachaPackDTO>(key: K, value: GachaPackDTO[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid items-end gap-2 rounded-xl border border-border/60 p-3 md:grid-cols-[auto_1.4fr_.9fr_.6fr_.6fr_.8fr_auto]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={draft.currency === "POKEBALL" ? icons.pokeball : icons.ultraball} alt="" className="mb-1 h-10 w-10" />
      <Field label="Nome"><input value={draft.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></Field>
      <Field label="Moeda">
        <select value={draft.currency} onChange={(e) => set("currency", e.target.value as Currency)} className={inputCls}>
          <option value="POKEBALL">Pokébola</option><option value="ULTRABALL">Ultra Bola</option>
        </select>
      </Field>
      <Field label="Quantidade"><input type="number" value={draft.amount} onChange={(e) => set("amount", Number(e.target.value))} className={inputCls} /></Field>
      <Field label="Bônus"><input type="number" value={draft.bonus} onChange={(e) => set("bonus", Number(e.target.value))} className={inputCls} /></Field>
      <Field label="Preço (LC)"><input type="number" value={draft.priceLc} onChange={(e) => set("priceLc", Number(e.target.value))} className={inputCls} /></Field>
      <div className="flex items-center gap-2 pb-1">
        <button type="button" onClick={() => set("active", !draft.active)}
          className={`rounded-lg border px-2 py-1 text-[10px] ${draft.active ? "border-emerald-300/50 text-emerald-200" : "border-border text-slate-500"}`}>
          {draft.active ? "ativo" : "off"}
        </button>
        <button type="button" disabled={!dirty} onClick={() => onSave(draft)}
          className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-[10px] font-bold text-cyan-200 disabled:opacity-30">salvar</button>
        <button type="button" onClick={onDelete} className="text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
