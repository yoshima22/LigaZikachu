"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/ui/image-upload";
import { TitleDisplay } from "@/components/ui/title-display";
import type { TitleRarity, TitleTheme } from "@/components/ui/title-display";
import { createDefaultMascotShopItems, createShopItem, updateShopItem, deleteShopItem, toggleShopItem, reorderShopItem } from "../../actions";
import { getSuggestedPrice } from "@/lib/shop-config";
import { ChevronUp, ChevronDown } from "lucide-react";

const rarityOpts  = ["COMMON","UNCOMMON","RARE","EPIC","LEGENDARY","MYTHIC","RELIC"] as const;
const themeOpts   = ["NEUTRAL","ELECTRIC","FIRE","WATER","GRASS","ZIKABET"] as const;
const effectOpts  = ["NONE","LIGHTNING_STRIKE","BOSS_ALERT","CHAMPION_ARENA","COIN_RAIN","DIMENSIONAL_RIFT","ULTRA_RARE_REVEAL","GLITCH_HACK","SLOT_MACHINE","ELEMENTAL_AURA","MIAUVADAO_SEAL"] as const;
const typeOpts = [
  "TITLE","BANNER","FRAME","ZIKALOOT_TICKET",
  "EGG_COMMON","EGG_RARE","EGG_SPECIAL","EGG_GEN1","EGG_GEN2",
  "MASCOT_FOOD","MASCOT_SWEET",
  "MASCOT_BUFF_EXP","MASCOT_BUFF_STAT","MASCOT_BUFF_HAPPY","MASCOT_BUFF_LUCK","MASCOT_BUFF_MOOD",
  "LUCKY_EGG","WEAKNESS_POLICY","PICNIC_BASKET","VACATION_TICKET","XP_SHARE","RAINBOW_FEATHER",
] as const;
const typeLabel: Record<string, string> = {
  TITLE: "Título", BANNER: "Banner",
  FRAME: "Moldura",
  ZIKALOOT_TICKET: "Ticket ZikaLoot",
  EGG_COMMON: "Ovo Comum",
  EGG_RARE: "Ovo Raro",
  EGG_SPECIAL: "Ovo Especial",
  EGG_GEN1: "Ovo Gen 1 (Kanto)",
  EGG_GEN2: "Ovo Gen 2 (Johto)",
  MASCOT_FOOD: "Comida de Mascote",
  MASCOT_SWEET: "Doce de Mascote",
  MASCOT_BUFF_EXP:   "⚡ Vitamina Elétrica (Buff EXP)",
  MASCOT_BUFF_STAT:  "💊 Proteína Zika (Buff Stats)",
  MASCOT_BUFF_HAPPY: "🍯 Bala de Mel (Buff Felicidade)",
  MASCOT_BUFF_LUCK:  "🍀 Amuleto da Sorte (Buff Expedição)",
  MASCOT_BUFF_MOOD:  "💧 Água Sagrada (Reset Humor)",
  LUCKY_EGG:         "🥚✨ Ovo da Sorte",
  WEAKNESS_POLICY:   "🛡️ Política de Fraqueza",
  PICNIC_BASKET:     "🧺⚡ Cesta de Piquenique Chocante",
  VACATION_TICKET:   "🏖️ Ticket de Férias do Prof. Carvalho",
  XP_SHARE:          "📡 Compartilhador de XP",
  RAINBOW_FEATHER:   "🌈 Pena Arco-Íris",
};
const rarityLabel: Record<string, string> = {
  COMMON: "⚪ Comum", UNCOMMON: "🟢 Incomum", RARE: "🔵 Raro",
  EPIC: "🟣 Épico", LEGENDARY: "🟠 Lendário", MYTHIC: "🟡 Mítico", RELIC: "💎 Relíquia"
};
const themeLabel: Record<string, string> = {
  NEUTRAL: "Neutro", ELECTRIC: "⚡ Elétrico", FIRE: "🔥 Fogo",
  WATER: "🌊 Água", GRASS: "🌿 Grama", ZIKABET: "🎰 ZikaBet"
};
const effectLabel: Record<string, string> = {
  NONE:              "Nenhum",
  LIGHTNING_STRIKE:  "⚡ Relâmpago de Tela",
  BOSS_ALERT:        "😤 Alerta de Boss",
  CHAMPION_ARENA:    "🏆 Arena Campeão",
  COIN_RAIN:         "🪙 Chuva de Moedas",
  DIMENSIONAL_RIFT:  "🌀 Ruptura Dimensional",
  ULTRA_RARE_REVEAL: "💎 Carta Ultra Rara",
  GLITCH_HACK:       "💻 Glitch Hacker",
  SLOT_MACHINE:      "🎰 Máquina Caça-Níquel",
  ELEMENTAL_AURA:    "🔥 Aura Elemental",
  MIAUVADAO_SEAL:    "😸 Miauvadão Aprova",
};

interface Item {
  id: string; type: string; name: string; description: string | null;
  imageUrl: string | null; rarity: string; price: number; active: boolean; owners: number;
  metadata?: unknown; theme?: string; flavorText?: string | null; entranceEffect?: string;
}

type FrameMeta    = { frameScale: number; frameOffsetX: number; frameOffsetY: number };
type BannerMeta   = { focusX: number; focusY: number };
type BuffMeta     = { buffHours: number; expMultiplierPct: number; happinessBonus: number };
type VacationMeta = { vacationDays: number; expBonus: number; eggChancePct: number };

const BUFF_ITEM_TYPES     = new Set(["MASCOT_BUFF_EXP", "PICNIC_BASKET", "LUCKY_EGG"]);
const VACATION_ITEM_TYPES = new Set(["VACATION_TICKET"]);

type FormData = {
  type: typeof typeOpts[number]; name: string; description: string;
  imageUrl: string; rarity: typeof rarityOpts[number]; price: number;
  frameMeta: FrameMeta;
  bannerMeta: BannerMeta;
  buffMeta: BuffMeta;
  vacationMeta: VacationMeta;
  theme: typeof themeOpts[number];
  flavorText: string;
  entranceEffect: typeof effectOpts[number];
};
const DEFAULT_FRAME_META:    FrameMeta    = { frameScale: 2.0, frameOffsetX: 0, frameOffsetY: 0 };
const DEFAULT_BANNER_META:   BannerMeta   = { focusX: 50, focusY: 50 };
const DEFAULT_BUFF_META:     BuffMeta     = { buffHours: 2, expMultiplierPct: 25, happinessBonus: 5 };
const DEFAULT_VACATION_META: VacationMeta = { vacationDays: 7, expBonus: 6000, eggChancePct: 30 };

const EMPTY: FormData = {
  type: "TITLE", name: "", description: "", imageUrl: "", rarity: "COMMON", price: 100,
  frameMeta: DEFAULT_FRAME_META,
  bannerMeta: DEFAULT_BANNER_META,
  buffMeta: DEFAULT_BUFF_META,
  vacationMeta: DEFAULT_VACATION_META,
  theme: "NEUTRAL",
  flavorText: "",
  entranceEffect: "NONE",
};

const itemToForm = (i: Item & { metadata?: unknown }): FormData => {
  const meta = i.metadata && typeof i.metadata === "object" && !Array.isArray(i.metadata)
    ? (i.metadata as Partial<FrameMeta & BannerMeta & BuffMeta & VacationMeta>)
    : {};
  return {
    type: i.type as typeof typeOpts[number], name: i.name, description: i.description ?? "",
    imageUrl: i.imageUrl ?? "", rarity: i.rarity as typeof rarityOpts[number], price: i.price,
    frameMeta: {
      frameScale:   meta.frameScale   ?? 2.0,
      frameOffsetX: meta.frameOffsetX ?? 0,
      frameOffsetY: meta.frameOffsetY ?? 0,
    },
    bannerMeta: {
      focusX: (meta as Partial<BannerMeta>).focusX ?? 50,
      focusY: (meta as Partial<BannerMeta>).focusY ?? 50,
    },
    buffMeta: {
      buffHours:        meta.buffHours        ?? DEFAULT_BUFF_META.buffHours,
      expMultiplierPct: meta.expMultiplierPct ?? DEFAULT_BUFF_META.expMultiplierPct,
      happinessBonus:   meta.happinessBonus   ?? DEFAULT_BUFF_META.happinessBonus,
    },
    vacationMeta: {
      vacationDays:  meta.vacationDays  ?? DEFAULT_VACATION_META.vacationDays,
      expBonus:      meta.expBonus      ?? DEFAULT_VACATION_META.expBonus,
      eggChancePct:  meta.eggChancePct  ?? DEFAULT_VACATION_META.eggChancePct,
    },
    theme: (i.theme as typeof themeOpts[number]) ?? "NEUTRAL",
    flavorText: i.flavorText ?? "",
    entranceEffect: (i.entranceEffect as typeof effectOpts[number]) ?? "NONE",
  };
};

// ── Preview e editor do banner ────────────────────────────────────────────────

function BannerMetaEditor({ bannerMeta, setBannerMeta, imageUrl }: {
  bannerMeta: BannerMeta;
  setBannerMeta: (m: BannerMeta) => void;
  imageUrl: string;
}) {
  const objectPosition = `${bannerMeta.focusX}% ${bannerMeta.focusY}%`;
  return (
    <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-4 md:col-span-2 lg:col-span-3">
      <p className="text-xs font-semibold text-[#FFCB05]">⚙ Ponto de foco do Banner</p>
      <p className="text-xs text-slate-500">
        Ajusta qual região do banner fica visível quando a imagem é cortada em telas menores.
        O retículo amarelo indica o ponto de foco atual.
      </p>

      {/* Preview do banner em proporção 4:1 */}
      <div className="relative w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
        style={{ aspectRatio: "4 / 1" }}>
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Banner preview"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition }}
            />
            {/* Gradiente igual ao perfil */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f1a]/70 via-[#0f0f1a]/20 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a]/60 via-transparent to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-600">
            Adicione a imagem do banner acima para ver o preview
          </div>
        )}
        {/* Retículo do ponto de foco */}
        <div className="pointer-events-none absolute" style={{
          left: `${bannerMeta.focusX}%`,
          top:  `${bannerMeta.focusY}%`,
          transform: "translate(-50%, -50%)",
        }}>
          <div className="h-6 w-px bg-[#FFCB05]" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }} />
          <div className="w-6 h-px bg-[#FFCB05]" style={{ position: "absolute", top: "50%",  transform: "translateY(-50%)" }} />
          <div className="h-3 w-3 rounded-full border-2 border-[#FFCB05] bg-transparent"
            style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }} />
        </div>
        {/* Simulação do avatar + nome como no perfil */}
        <div className="absolute bottom-2 left-3 flex items-center gap-2 opacity-60">
          <div className="h-8 w-8 rounded-lg bg-slate-600" />
          <div className="space-y-0.5">
            <div className="h-2 w-16 rounded bg-white/60" />
            <div className="h-1.5 w-10 rounded bg-[#FFCB05]/60" />
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Foco horizontal (X)</span>
            <span className="text-slate-300 font-semibold">{bannerMeta.focusX}%</span>
          </div>
          <input type="range" min="0" max="100" step="1"
            value={bannerMeta.focusX}
            onChange={e => setBannerMeta({ ...bannerMeta, focusX: parseInt(e.target.value) })}
            className="w-full accent-[#FFCB05]" />
          <p className="text-[10px] text-slate-600">0% = esquerda · 50% = centro · 100% = direita</p>
        </label>
        <label className="block space-y-1 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Foco vertical (Y)</span>
            <span className="text-slate-300 font-semibold">{bannerMeta.focusY}%</span>
          </div>
          <input type="range" min="0" max="100" step="1"
            value={bannerMeta.focusY}
            onChange={e => setBannerMeta({ ...bannerMeta, focusY: parseInt(e.target.value) })}
            className="w-full accent-[#FFCB05]" />
          <p className="text-[10px] text-slate-600">0% = topo · 50% = centro · 100% = base</p>
        </label>
      </div>
      <button type="button" onClick={() => setBannerMeta(DEFAULT_BANNER_META)}
        className="text-xs text-slate-500 hover:text-slate-300 underline">
        Resetar para centro (50%, 50%)
      </button>
    </div>
  );
}

// Preview interativo da moldura sobre um avatar placeholder
// AVATAR deve ser idêntico ao perfil real (80px) para calibração 1:1
function FramePreview({ imageUrl, frameMeta }: { imageUrl: string; frameMeta: FrameMeta }) {
  const AVATAR = 80; // igual ao perfil real em jogadores/[id]/page.tsx
  const { frameScale, frameOffsetX, frameOffsetY } = frameMeta;
  const frameSize = AVATAR * frameScale;
  // Ancora a moldura no CENTRO do avatar usando transform translate(-50%,-50%)
  // Isso garante crescimento simétrico em todas as direções ao aumentar a escala
  const anchorLeft = AVATAR / 2 + frameOffsetX;
  const anchorTop  = AVATAR / 2 + frameOffsetY;

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-slate-500">Preview</p>
      {/* Wrapper extra para garantir overflow visível nos 4 lados */}
      <div className="relative" style={{ width: AVATAR + 80, height: AVATAR + 80 }}>
        {/* Avatar centralizado no wrapper */}
        <div
          className="absolute rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center border border-slate-700 shadow"
          style={{ left: 40, top: 40, width: AVATAR, height: AVATAR }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          {/* Grade de referência */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
            <div className="h-px w-full bg-white" />
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
            <div className="w-px h-full bg-white" />
          </div>
        </div>
        {/* Moldura ancorada no centro do avatar */}
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Moldura preview"
            className="pointer-events-none absolute z-10 object-contain"
            style={{
              left: 40 + anchorLeft,
              top:  40 + anchorTop,
              width: frameSize,
              height: frameSize,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>
      <p className="text-[10px] text-slate-600">
        Escala: {frameScale.toFixed(2)}× · X: {frameOffsetX}px · Y: {frameOffsetY}px · Tamanho: {Math.round(frameSize)}px
      </p>
    </div>
  );
}

function FrameMetaEditor({ frameMeta, setFrameMeta, imageUrl }: {
  frameMeta: FrameMeta;
  setFrameMeta: (m: FrameMeta) => void;
  imageUrl: string;
}) {
  return (
    <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-4 md:col-span-2 lg:col-span-3">
      <p className="text-xs font-semibold text-[#FFCB05]">⚙ Posicionamento da Moldura</p>
      <div className="flex gap-6 flex-wrap items-start">
        {/* Preview */}
        <FramePreview imageUrl={imageUrl} frameMeta={frameMeta} />
        {/* Sliders */}
        <div className="flex-1 min-w-[220px] space-y-4">
          <label className="block space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Escala (tamanho relativo ao avatar)</span>
              <span className="text-[#FFCB05] font-semibold">{frameMeta.frameScale.toFixed(2)}×</span>
            </div>
            <input type="range" min="0.5" max="4.0" step="0.05"
              value={frameMeta.frameScale}
              onChange={e => setFrameMeta({ ...frameMeta, frameScale: parseFloat(e.target.value) })}
              className="w-full accent-[#FFCB05]" />
            <p className="text-[10px] text-slate-600">
              1.0 = mesmo tamanho · 2.0 = padrão (moldura 2× o avatar) · 3.0 = muito maior
            </p>
          </label>
          <label className="block space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Deslocamento horizontal (X)</span>
              <span className="text-slate-300 font-semibold">{frameMeta.frameOffsetX}px</span>
            </div>
            <input type="range" min="-80" max="80" step="1"
              value={frameMeta.frameOffsetX}
              onChange={e => setFrameMeta({ ...frameMeta, frameOffsetX: parseInt(e.target.value) })}
              className="w-full accent-[#FFCB05]" />
            <p className="text-[10px] text-slate-600">Negativo = esquerda · Positivo = direita</p>
          </label>
          <label className="block space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Deslocamento vertical (Y)</span>
              <span className="text-slate-300 font-semibold">{frameMeta.frameOffsetY}px</span>
            </div>
            <input type="range" min="-80" max="80" step="1"
              value={frameMeta.frameOffsetY}
              onChange={e => setFrameMeta({ ...frameMeta, frameOffsetY: parseInt(e.target.value) })}
              className="w-full accent-[#FFCB05]" />
            <p className="text-[10px] text-slate-600">Negativo = sobe (ótimo para chapéus) · Positivo = desce</p>
          </label>
          <button
            type="button"
            onClick={() => setFrameMeta(DEFAULT_FRAME_META)}
            className="text-xs text-slate-500 hover:text-slate-300 underline"
          >
            Resetar para padrão
          </button>
        </div>
      </div>
    </div>
  );
}

function BuffMetaEditor({ buffMeta, setBuffMeta, itemType }: {
  buffMeta: BuffMeta;
  setBuffMeta: (m: BuffMeta) => void;
  itemType: string;
}) {
  const showHappiness = itemType === "PICNIC_BASKET";
  const showExpPct    = itemType === "MASCOT_BUFF_EXP" || itemType === "PICNIC_BASKET" || itemType === "LUCKY_EGG";
  return (
    <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-4 md:col-span-2 lg:col-span-3">
      <p className="text-xs font-semibold text-[#FFCB05]">⚡ Configurações de Buff</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1 text-xs text-slate-400">
          <div className="flex justify-between">
            <span>Duração (horas)</span>
            <span className="text-[#FFCB05] font-semibold">{buffMeta.buffHours}h</span>
          </div>
          <input type="number" min={1} max={72} step={1}
            value={buffMeta.buffHours}
            onChange={e => setBuffMeta({ ...buffMeta, buffHours: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
          <p className="text-[10px] text-slate-600">Quanto tempo o buff dura após uso</p>
        </label>
        {showExpPct && (
          <label className="space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Bônus de EXP (%)</span>
              <span className="text-[#FFCB05] font-semibold">+{buffMeta.expMultiplierPct}%</span>
            </div>
            <input type="number" min={1} max={200} step={1}
              value={buffMeta.expMultiplierPct}
              onChange={e => setBuffMeta({ ...buffMeta, expMultiplierPct: Math.max(1, parseInt(e.target.value) || 1) })}
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
            <p className="text-[10px] text-slate-600">Percentual adicional de EXP (25 = +25%)</p>
          </label>
        )}
        {showHappiness && (
          <label className="space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Bônus de Felicidade</span>
              <span className="text-[#FFCB05] font-semibold">+{buffMeta.happinessBonus}</span>
            </div>
            <input type="number" min={0} max={50} step={1}
              value={buffMeta.happinessBonus}
              onChange={e => setBuffMeta({ ...buffMeta, happinessBonus: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
            <p className="text-[10px] text-slate-600">Felicidade extra por interação/batalha</p>
          </label>
        )}
      </div>
      <p className="text-[10px] text-slate-500">
        Esses valores são lidos em tempo real pelo sistema — sem necessidade de reiniciar.
      </p>
    </div>
  );
}

function VacationMetaEditor({ vacationMeta, setVacationMeta }: {
  vacationMeta: VacationMeta;
  setVacationMeta: (m: VacationMeta) => void;
}) {
  return (
    <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-4 md:col-span-2 lg:col-span-3">
      <p className="text-xs font-semibold text-[#FFCB05]">🏖️ Parâmetros do Ticket de Férias</p>
      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span>Duração (dias)</span>
            <span className="text-[#FFCB05] font-semibold">{vacationMeta.vacationDays}d</span>
          </div>
          <input type="number" min={1} max={30} step={1}
            value={vacationMeta.vacationDays}
            onChange={e => setVacationMeta({ ...vacationMeta, vacationDays: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
          <p className="text-[10px] text-slate-600">Dias que o mascote fica de férias</p>
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span>EXP ao voltar</span>
            <span className="text-[#FFCB05] font-semibold">{vacationMeta.expBonus.toLocaleString("pt-BR")}</span>
          </div>
          <input type="number" min={100} max={100000} step={100}
            value={vacationMeta.expBonus}
            onChange={e => setVacationMeta({ ...vacationMeta, expBonus: Math.max(100, parseInt(e.target.value) || 100) })}
            className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
          <p className="text-[10px] text-slate-600">EXP concedido ao resgatar as férias</p>
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span>Chance de Ovo (%)</span>
            <span className="text-[#FFCB05] font-semibold">{vacationMeta.eggChancePct}%</span>
          </div>
          <input type="number" min={0} max={100} step={1}
            value={vacationMeta.eggChancePct}
            onChange={e => setVacationMeta({ ...vacationMeta, eggChancePct: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
            className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
          <p className="text-[10px] text-slate-600">Probabilidade de trazer um Ovo Comum</p>
        </label>
      </div>
      <p className="text-[10px] text-slate-500">
        Esses valores são lidos em tempo real pelo sistema — sem necessidade de reiniciar.
      </p>
    </div>
  );
}

function ItemForm({ form, setForm, onSave, onCancel, pending, label }: {
  form: FormData; setForm: (f: FormData) => void;
  onSave: () => void; onCancel: () => void; pending: boolean; label: string;
}) {
  const isFrame    = (form.type as string) === "FRAME";
  const isBanner   = (form.type as string) === "BANNER";
  const isTitle    = (form.type as string) === "TITLE";
  const isBuff     = BUFF_ITEM_TYPES.has(form.type);
  const isVacation = VACATION_ITEM_TYPES.has(form.type);
  const isMascotItem = ["EGG_COMMON","EGG_RARE","EGG_SPECIAL","EGG_GEN1","EGG_GEN2","MASCOT_FOOD","MASCOT_SWEET","MASCOT_BUFF_EXP","MASCOT_BUFF_STAT","MASCOT_BUFF_HAPPY","MASCOT_BUFF_LUCK","MASCOT_BUFF_MOOD"].includes(form.type);
  return (
    <div className="grid gap-3 rounded-xl border border-border bg-slate-900/50 p-4 md:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-xs text-slate-400">
        <span>Tipo</span>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof typeOpts[number] })}
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]">
          {typeOpts.map((t) => <option key={t} value={t}>{typeLabel[t]}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Nome</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Mestre do Caos"
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span>Preço (ZC)</span>
          <button type="button"
            className="text-[10px] text-[#FFCB05] hover:underline"
            onClick={() => setForm({ ...form, price: getSuggestedPrice(form.type, form.rarity) })}>
            Sugerir ({getSuggestedPrice(form.type, form.rarity).toLocaleString("pt-BR")} ZC)
          </button>
        </div>
        <input type="number" min={1} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Raridade</span>
        <select value={form.rarity} onChange={(e) => {
          const newRarity = e.target.value as typeof rarityOpts[number];
          setForm({ ...form, rarity: newRarity, price: getSuggestedPrice(form.type, newRarity) });
        }}
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]">
          {rarityOpts.map((r) => <option key={r} value={r}>{rarityLabel[r]}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Descrição</span>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Descrição opcional"
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
      </label>
      <ImageUpload
        value={form.imageUrl}
        onChange={(url) => setForm({ ...form, imageUrl: url })}
        label="Imagem"
        maxMb={10}
        hint={
          isBanner
            ? "Banner: qualquer resolução. Proporção 4:1 (ex: 1200×300px) recomendada. Use o editor abaixo para ajustar o foco."
            : isFrame
            ? "Moldura: PNG com fundo transparente recomendado. Use o editor abaixo para ajustar posição e escala."
            : (form.type as string) === "TITLE"
            ? "Título: sem imagem necessária — o nome do item já é exibido como texto."
            : (form.type as string) === "ZIKALOOT_TICKET"
            ? "Ticket: qualquer imagem decorativa."
            : isMascotItem
            ? "Mascote: imagem opcional. Ovos podem usar /mascot/egg-common.png."
            : "Imagem opcional para o item."
        }
      />
      {/* Tema e frase de sabor — apenas para títulos */}
      {isTitle && (
        <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-3 md:col-span-2 lg:col-span-3">
          <p className="text-xs font-semibold text-[#FFCB05]">✨ Configuração do Título</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-400">
              <span>Tema visual</span>
              <select
                value={form.theme}
                onChange={e => setForm({ ...form, theme: e.target.value as typeof themeOpts[number] })}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
              >
                {themeOpts.map(t => <option key={t} value={t}>{themeLabel[t]}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Efeito de entrada <span className="text-slate-600">(tela inteira ao abrir o perfil)</span></span>
              <select
                value={form.entranceEffect}
                onChange={e => setForm({ ...form, entranceEffect: e.target.value as typeof effectOpts[number] })}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
              >
                {effectOpts.map(e => <option key={e} value={e}>{effectLabel[e]}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-slate-400">
              <span>Frase de sabor <span className="text-slate-600">(aparece abaixo do título no perfil)</span></span>
              <input
                value={form.flavorText}
                onChange={e => setForm({ ...form, flavorText: e.target.value })}
                placeholder='Ex: "Seu nome já faz parte da história."'
                maxLength={200}
                className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]"
              />
            </label>
          </div>
          {/* Preview do título */}
          {form.name && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-slate-950/60 p-3">
              <span className="text-xs text-slate-500 shrink-0">Preview:</span>
              <TitleDisplay
                name={form.name}
                rarity={form.rarity as TitleRarity}
                theme={form.theme as TitleTheme}
                flavorText={form.flavorText || null}
                context="inventory"
              />
            </div>
          )}
        </div>
      )}

      {/* Editor de posicionamento — apenas para molduras */}
      {isFrame && (
        <FrameMetaEditor
          imageUrl={form.imageUrl}
          frameMeta={form.frameMeta}
          setFrameMeta={(m) => setForm({ ...form, frameMeta: m })}
        />
      )}
      {/* Editor de ponto de foco — apenas para banners */}
      {isBanner && (
        <BannerMetaEditor
          imageUrl={form.imageUrl}
          bannerMeta={form.bannerMeta}
          setBannerMeta={(m) => setForm({ ...form, bannerMeta: m })}
        />
      )}
      {/* Editor de configurações de buff */}
      {isBuff && (
        <BuffMetaEditor
          itemType={form.type}
          buffMeta={form.buffMeta}
          setBuffMeta={(m) => setForm({ ...form, buffMeta: m })}
        />
      )}
      {/* Editor de parâmetros do Ticket de Férias */}
      {isVacation && (
        <VacationMetaEditor
          vacationMeta={form.vacationMeta}
          setVacationMeta={(m) => setForm({ ...form, vacationMeta: m })}
        />
      )}
      <div className="flex gap-2 md:col-span-2 lg:col-span-3">
        <Button type="button" disabled={!form.name || pending} onClick={onSave}
          className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">{label}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

export function ShopAdminPanel({ items }: { items: Item[] }) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormData>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormData>(EMPTY);

  const buildPayload = (f: FormData) => ({
    ...f,
    imageUrl: f.imageUrl || undefined,
    description: f.description || undefined,
    metadata:
      f.type === "FRAME"              ? f.frameMeta    :
      f.type === "BANNER"             ? f.bannerMeta   :
      BUFF_ITEM_TYPES.has(f.type)     ? f.buffMeta     :
      VACATION_ITEM_TYPES.has(f.type) ? f.vacationMeta :
      undefined,
    theme: f.type === "TITLE" ? f.theme : undefined,
    flavorText: f.type === "TITLE" && f.flavorText ? f.flavorText : null,
    entranceEffect: f.type === "TITLE" ? f.entranceEffect : undefined,
  });

  const handleCreate = () => startTransition(async () => {
    try {
      const result = await createShopItem(buildPayload(createForm));
      if (result.error) { toast.error(result.error); return; }
      toast.success("Item criado!"); setCreateForm(EMPTY); setShowCreate(false);
    } catch { toast.error("Erro ao criar item."); }
  });

  const handleUpdate = (id: string) => startTransition(async () => {
    try {
      const result = await updateShopItem(id, buildPayload(editForm));
      if (result.error) { toast.error(result.error); return; }
      toast.success("Item atualizado!"); setEditingId(null);
    } catch { toast.error("Erro ao atualizar item."); }
  });

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Jogadores que já possuem o item manterão no inventário.`)) return;
    startTransition(async () => {
      try {
        const result = await deleteShopItem(id);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Item excluído.");
      } catch { toast.error("Erro ao excluir."); }
    });
  };

  const handleToggle = (id: string, active: boolean) => startTransition(async () => {
    try {
      const result = await toggleShopItem(id, !active);
      if (result.error) { toast.error(result.error); return; }
      toast.success(active ? "Item desativado." : "Item ativado.");
    } catch { toast.error("Erro."); }
  });

  const handleCreateDefaults = () => startTransition(async () => {
    try {
      const result = await createDefaultMascotShopItems();
      if (result.error) { toast.error(result.error); return; }
      toast.success(result.created ? `${result.created} item(ns) de mascote criado(s).` : "Itens padrão de mascote já existiam.");
    } catch { toast.error("Erro ao criar itens padrão de mascote."); }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setShowCreate(!showCreate)}
          className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
          <Plus size={14} /> Novo item
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleCreateDefaults}>
          Criar itens padrão de mascote
        </Button>
        {showCreate && (
          <div className="basis-full pt-2">
            <ItemForm form={createForm} setForm={setCreateForm}
              onSave={handleCreate} onCancel={() => setShowCreate(false)}
              pending={pending} label="Criar" />
          </div>
        )}
      </div>

      {/* Itens agrupados por categoria */}
      {typeOpts.map((type) => {
        const groupItems = items.filter((i) => i.type === type);
        if (groupItems.length === 0) return null;
        return (
          <div key={type} className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 border-b border-border pb-2">
              <span className="text-[#FFCB05]">
                {type === "BANNER" ? "🖼" : type === "FRAME" ? "🔵" : type === "TITLE" ? "🏷" : type.startsWith("EGG") ? "🥚" : type.startsWith("MASCOT") ? "🍬" : "🎟"}
              </span>
              {typeLabel[type]}
              <span className="text-slate-600 font-normal normal-case tracking-normal">({groupItems.length})</span>
            </h3>
            {groupItems.map((item) => (
              <div key={item.id}>
                {editingId === item.id ? (
                  <div className="mt-2">
                    <ItemForm form={editForm} setForm={setEditForm}
                      onSave={() => handleUpdate(item.id)} onCancel={() => setEditingId(null)}
                      pending={pending} label="Salvar" />
                  </div>
                ) : (
                  <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-slate-950/60 px-4 py-3 ${item.active ? "" : "opacity-50"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      {item.imageUrl && !item.imageUrl.startsWith("data:") && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.name}
                          className={`rounded object-cover bg-slate-800 ${type === "BANNER" ? "h-8 w-24" : "h-10 w-10"}`} />
                      )}
                      <div>
                        <p className="font-medium text-slate-200">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          {rarityLabel[item.rarity]} · {item.price.toLocaleString("pt-BR")} ZC · {item.owners} dono{item.owners !== 1 ? "s" : ""}
                          {!item.active && <span className="ml-2 text-slate-600">[inativo]</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Reordenar dentro da categoria */}
                      <div className="flex flex-col">
                        <button type="button" disabled={pending}
                          onClick={() => startTransition(async () => { await reorderShopItem(item.id, "up"); })}
                          className="rounded p-0.5 text-slate-600 hover:text-slate-300"><ChevronUp size={13} /></button>
                        <button type="button" disabled={pending}
                          onClick={() => startTransition(async () => { await reorderShopItem(item.id, "down"); })}
                          className="rounded p-0.5 text-slate-600 hover:text-slate-300"><ChevronDown size={13} /></button>
                      </div>
                      <button type="button" disabled={pending}
                        onClick={() => { setEditingId(item.id); setEditForm(itemToForm(item)); }}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200"><Pencil size={14} /></button>
                      <button type="button" disabled={pending} onClick={() => handleToggle(item.id, item.active)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200">
                        {item.active ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button type="button" disabled={pending} onClick={() => handleDelete(item.id, item.name)}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
