"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripVertical, Loader2, Search, Sparkles, X, Zap } from "lucide-react";
import { useMascotBuffAction, useLuckyEggAction, useWeaknessPolicyAction, usePicnicBasketAction, useVacationTicketAction, useXpShareAction, removeXpShareAction, useRainbowFeatherAction, useMegaStoneAction, searchOwnedMascotsForItemAction } from "../actions";
import { getMegaStoneByType, isMegaStoneType } from "@/lib/mega-evolution";
import { PERSONALITY_LABEL, shortMascotCode } from "@/lib/mascot-data";

interface BuffItem {
  id: string; name: string; type: string; quantity: number;
  description?: string; imageUrl?: string;
  metadata?: { eggTier?: string; adminLabOriginOverride?: boolean } | null;
}
interface MascotOption {
  id: string; name: string; pokemonId: number; level: number; isEquipped: boolean; isFavorite: boolean;
  arenaState?: string;
  restingUntil?: Date | string | null;
  hatchedFromEggType?: string | null; hatchedFromEggOrigin?: string | null;
  proteinDoses?: number;
  activeBuffTypes?: string[];
}

type RainbowFeatherSnapshot = {
  name: string;
  pokemonName: string;
  level: number;
  personality: string;
  statForce: number;
  statAgility: number;
  statCharisma: number;
  statInstinct: number;
  statVitality: number;
};

type RainbowFeatherComparison = {
  before: RainbowFeatherSnapshot;
  after: RainbowFeatherSnapshot;
};

const FEATHER_STATS = [
  ["Força", "statForce"],
  ["Agilidade", "statAgility"],
  ["Carisma", "statCharisma"],
  ["Instinto", "statInstinct"],
  ["Vitalidade", "statVitality"],
] as const;

const BUFF_EMOJI: Record<string, string> = {
  MASCOT_BUFF_EXP:   "⚡",
  MASCOT_BUFF_STAT:  "💊",
  MASCOT_BUFF_HAPPY: "🍯",
  MASCOT_BUFF_LUCK:  "🍀",
  MASCOT_BUFF_MOOD:  "💧",
  LUCKY_EGG:         "🥚✨",
  WEAKNESS_POLICY:   "🛡️",
  PICNIC_BASKET:     "🧺⚡",
  VACATION_TICKET:   "🏖️",
  XP_SHARE:          "📡",
  XP_SHARE_TEAM:     "📡",
  RAINBOW_FEATHER:   "🌈",
};

// Onde cada buff de EXP se aplica
const EXP_BUFF_AREAS: Record<string, { label: string; applies: boolean }[]> = {
  MASCOT_BUFF_EXP: [
    { label: "Expedição",   applies: true },
    { label: "Arena",       applies: true },
    { label: "Interações",  applies: true },
    { label: "Férias",      applies: false },
  ],
  PICNIC_BASKET: [
    { label: "Expedição",   applies: true },
    { label: "Arena",       applies: false },
    { label: "Interações",  applies: false },
    { label: "Férias",      applies: false },
  ],
  LUCKY_EGG: [
    { label: "Expedição",   applies: true },
    { label: "Arena",       applies: false },
    { label: "Interações",  applies: false },
    { label: "Férias",      applies: false },
  ],
};

// Itens que não precisam de seleção de mascote (aplicados globalmente ou com lógica especial)
const PLAYER_LEVEL_ITEMS = new Set(["PICNIC_BASKET"]);
// Itens irreversíveis que precisam de confirmação extra
const DESTRUCTIVE_ITEMS = new Set(["RAINBOW_FEATHER"]);

const PROTEIN_LIMIT = 3;

interface Props {
  buffs: BuffItem[];
  mascots: MascotOption[];
  /** mascotId → número de doses de Proteína Zika já recebidas (máx 3) */
  proteinDoses?: Record<string, number>;
  /** mascotId → buffs ativos (para detectar sobreposição de EXP_BOOST) */
  activeBuffsByMascot?: Record<string, string[]>;
}

export function BuffPanel({ buffs, mascots, proteinDoses = {}, activeBuffsByMascot = {} }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedBuff, setSelectedBuff] = useState<string>("");
  // Task: só considera um mascote quando ele é escolhido de fato no campo de busca.
  const [selectedMascot, setSelectedMascot] = useState<string>("");
  const [selectedMascotObj, setSelectedMascotObj] = useState<MascotOption | null>(null);
  const [featherComparison, setFeatherComparison] = useState<RainbowFeatherComparison | null>(null);
  // Busca digitável de mascotes (não só favoritos) para o uso de itens.
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<MascotOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mascotPage, setMascotPage] = useState(0);
  const searchSeq = useRef(0);
  const comboRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const q = search.trim();
    setMascotPage(0);
    if (!q) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const seq = ++searchSeq.current;
    const timer = window.setTimeout(async () => {
      const res = await searchOwnedMascotsForItemAction(q);
      if (seq !== searchSeq.current) return;
      setSearching(false);
      if (res.error) { setResults([]); return; }
      setResults(res.mascots ?? []);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Fecha o dropdown de busca ao clicar fora dele.
  useEffect(() => {
    if (!showResults) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [showResults]);

  // Se o item selecionado acabou (saiu do inventário), esconde a barra de uso.
  useEffect(() => {
    if (selectedBuff && !buffs.some((b) => b.id === selectedBuff)) {
      setSelectedBuff("");
      setSelectedMascot("");
      setSelectedMascotObj(null);
      setSearch("");
      setResults([]);
      setShowResults(false);
    }
  }, [buffs, selectedBuff]);

  // ── Reorganização de itens (ordem manual + drag-and-drop) com paginação ──────
  const ITEMS_PER_PAGE = 12;
  const ORDER_STORAGE_KEY = "mascot-item-order-v1";
  const [itemOrder, setItemOrder] = useState<string[]>([]);
  const [reorderMode, setReorderMode] = useState(false);
  const [page, setPage] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY);
      if (raw) setItemOrder(JSON.parse(raw) as string[]);
    } catch { /* ignora armazenamento indisponível */ }
  }, []);

  const persistOrder = (ids: string[]) => {
    setItemOrder(ids);
    try { localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(ids)); } catch { /* ignora */ }
  };

  if (buffs.length === 0) return null;

  const selectedBuffItem = buffs.find(b => b.id === selectedBuff);
  const isProtein = selectedBuffItem?.type === "MASCOT_BUFF_STAT";
  const isExpBuff = selectedBuffItem?.type === "MASCOT_BUFF_EXP";
  const isMegaStone = selectedBuffItem ? isMegaStoneType(selectedBuffItem.type) : false;
  const selectedMegaStone = selectedBuffItem ? getMegaStoneByType(selectedBuffItem.type) : null;
  const isRainbowFeather = selectedBuffItem?.type === "RAINBOW_FEATHER";
  const isWeaknessPolicy = selectedBuffItem?.type === "WEAKNESS_POLICY";
  const isAdminLabFeather = selectedBuffItem?.metadata?.adminLabOriginOverride === true;
  const featherTier = selectedBuffItem?.metadata?.eggTier;
  const tierRank: Record<string, number> = { COMMON: 0, RARE: 1, EVENT: 2, SPECIAL: 3, LAB: 4 };
  const getOriginTier = (mascot: MascotOption) => {
    const originKey = mascot.hatchedFromEggOrigin?.startsWith("GEN_CHOICE:") || mascot.hatchedFromEggOrigin?.startsWith("GEN_RANDOM:")
      ? mascot.hatchedFromEggOrigin.split(":")[1]
      : mascot.hatchedFromEggType;
    return !mascot.hatchedFromEggType ? "RARE"
      : originKey === "LAB" ? "LAB"
      : originKey === "SPECIAL" ? "SPECIAL"
      : originKey === "EVENT" ? "EVENT"
      : originKey === "RARE" ? "RARE"
      : "COMMON";
  };
  const isEligible = (mascot: MascotOption) => {
    if (isWeaknessPolicy) {
      const hasActiveRest = Boolean(mascot.restingUntil && new Date(mascot.restingUntil) > new Date());
      return mascot.arenaState === "INJURED" || mascot.arenaState === "RESTING" || hasActiveRest;
    }
    if (isMegaStone && selectedMegaStone) {
      if (!(mascot.pokemonId === selectedMegaStone.compatiblePokemonId && mascot.level >= selectedMegaStone.minLevel)) return false;
    }
    if (!isRainbowFeather) return true;
    if (mascot.arenaState && mascot.arenaState !== "FREE") return false;
    if (isAdminLabFeather) return !mascot.hatchedFromEggType && !mascot.hatchedFromEggOrigin;
    if (!featherTier) return true;
    return tierRank[featherTier] >= tierRank[getOriginTier(mascot)];
  };
  // Lista base: resultados da busca digitada ou, sem busca, os favoritos/companheiro.
  const baseCandidates: MascotOption[] = search.trim()
    ? results
    : mascots.map((m) => ({ ...m, proteinDoses: proteinDoses[m.id] ?? m.proteinDoses ?? 0, activeBuffTypes: activeBuffsByMascot[m.id] ?? m.activeBuffTypes ?? [] }));
  const mascotOptions = baseCandidates.filter(isEligible);
  // Paginação do dropdown de busca de mascotes (9 por página).
  const MASCOT_PAGE_SIZE = 9;
  const mascotTotalPages = Math.max(1, Math.ceil(mascotOptions.length / MASCOT_PAGE_SIZE));
  const mascotSafePage = Math.min(mascotPage, mascotTotalPages - 1);
  const pagedMascotOptions = mascotOptions.slice(mascotSafePage * MASCOT_PAGE_SIZE, mascotSafePage * MASCOT_PAGE_SIZE + MASCOT_PAGE_SIZE);
  const selectedMascotDoses = selectedMascotObj?.proteinDoses ?? 0;
  const proteinFull = selectedMascotDoses >= PROTEIN_LIMIT;
  const selectedMascotItem = selectedMascotObj;
  const originTier = selectedMascotItem ? getOriginTier(selectedMascotItem) : "RARE";
  const featherAboveOrigin = selectedBuffItem?.type === "RAINBOW_FEATHER"
    && Boolean(featherTier)
    && tierRank[featherTier ?? "COMMON"] > tierRank[originTier];
  const featherWarning = isAdminLabFeather
    ? "Uso único por conta. O mascote receberá atributos de Ovo de Laboratório e terá essa origem registrada permanentemente."
    : featherAboveOrigin
    ? !selectedMascotItem?.hatchedFromEggType
      ? "Este mascote não possui ovo de origem registrado. Mesmo usando uma pena de Evento, Especial ou Laboratório, os atributos serão sorteados apenas no intervalo de Ovo Raro."
      : `Esta pena é superior ao ovo de origem registrado (${originTier === "COMMON" ? "Comum" : originTier === "RARE" ? "Raro" : originTier === "EVENT" ? "Evento" : originTier === "SPECIAL" ? "Especial" : "Laboratório"}). Ela pode ser usada, mas os atributos continuarão respeitando o intervalo da origem.`
    : null;

  // Verifica se o mascote selecionado já tem EXP_BOOST ativo
  const selectedMascotActiveBuffs = selectedMascotObj?.activeBuffTypes ?? [];
  const mascotHasExpBoost = selectedMascotActiveBuffs.includes("EXP_BOOST");

  const pickMascot = (mascot: MascotOption) => {
    setSelectedMascot(mascot.id);
    setSelectedMascotObj(mascot);
    setSearch("");
    setResults([]);
    setShowResults(false);
  };
  const clearMascot = () => {
    setSelectedMascot("");
    setSelectedMascotObj(null);
    setSearch("");
    setResults([]);
    setShowResults(false);
  };

  // Ordena os itens conforme a ordem salva; itens novos entram no fim.
  const orderedBuffs = (() => {
    const byId = new Map(buffs.map((b) => [b.id, b]));
    const seen = new Set<string>();
    const out: BuffItem[] = [];
    for (const id of itemOrder) {
      const b = byId.get(id);
      if (b) { out.push(b); seen.add(id); }
    }
    for (const b of buffs) if (!seen.has(b.id)) out.push(b);
    return out;
  })();
  const totalPages = Math.max(1, Math.ceil(orderedBuffs.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * ITEMS_PER_PAGE;
  const pageBuffs = orderedBuffs.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const moveItemTo = (id: string, globalIndex: number) => {
    const ids = orderedBuffs.map((b) => b.id).filter((x) => x !== id);
    const clamped = Math.max(0, Math.min(ids.length, globalIndex));
    ids.splice(clamped, 0, id);
    persistOrder(ids);
  };
  const nudgeItem = (id: string, delta: number) => {
    const currentIndex = orderedBuffs.findIndex((b) => b.id === id);
    if (currentIndex < 0) return;
    moveItemTo(id, currentIndex + delta);
  };
  const onRowPointerMove = (e: React.PointerEvent) => {
    if (!draggingId) return;
    const y = e.clientY;
    let targetLocal = pageBuffs.length - 1;
    for (let i = 0; i < pageBuffs.length; i++) {
      const el = rowRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) { targetLocal = i; break; }
    }
    if (pageBuffs[targetLocal]?.id !== draggingId) moveItemTo(draggingId, pageStart + targetLocal);
  };

  const handleUse = () => {
    if (!selectedBuffItem) return;
    const isPlayerLevel = PLAYER_LEVEL_ITEMS.has(selectedBuffItem.type);
    const isDestructive = DESTRUCTIVE_ITEMS.has(selectedBuffItem.type);

    if (!isPlayerLevel && !selectedMascot) { toast.error("Selecione um mascote."); return; }
    if (!isPlayerLevel && selectedMascotObj && !isEligible(selectedMascotObj)) {
      toast.error(isMegaStone && selectedMegaStone
        ? `Selecione um ${selectedMegaStone.compatiblePokemonName} Nv.${selectedMegaStone.minLevel}+ compatível.`
        : "Este mascote não é elegível para este item.");
      return;
    }

    if (isProtein && proteinFull) {
      toast.error(`Este mascote já recebeu ${PROTEIN_LIMIT} doses de Proteína Zika (limite máximo).`); return;
    }

    const mascotName = selectedMascotObj?.name ?? "mascote";

    let confirmMsg: string;
    if (isDestructive) {
      confirmMsg = `⚠️ ATENÇÃO: Usar ${selectedBuffItem.name} em ${mascotName} vai voltar o mascote ao nível 1 e sortear novamente personalidade e atributos. Esta ação é IRREVERSÍVEL.${featherWarning ? `\n\n${featherWarning}` : ""}\n\nTem certeza?`;
    } else if (isExpBuff && mascotHasExpBoost) {
      confirmMsg = `${mascotName} já tem uma Vitamina Elétrica ativa. Usar outra irá REMOVER o buff atual e aplicar um novo. Deseja continuar?`;
    } else if (isPlayerLevel) {
      confirmMsg = `Usar ${selectedBuffItem.name}? A próxima expedição terá -30% de duração e as iniciadas nas próximas 3h receberão bônus por modo.`;
    } else {
      confirmMsg = `Usar ${selectedBuffItem.name} em ${mascotName}?`;
    }

    if (!confirm(confirmMsg)) return;
    if (isDestructive && !confirm("Confirme novamente: isso não pode ser desfeito.")) return;

    startTransition(async () => {
      let r: {
        error?: string;
        replacedExistingBuff?: boolean;
        megaName?: string;
        statRange?: string;
        comparison?: RainbowFeatherComparison;
        honeyOutcome?: {
          type: "NEW_FRIEND" | "BONUS_EVENT";
          partnerName: string;
          message: string;
        } | null;
      };
      const t = selectedBuffItem.type;

      if (t === "LUCKY_EGG") r = await useLuckyEggAction(selectedMascot);
      else if (t === "WEAKNESS_POLICY") r = await useWeaknessPolicyAction(selectedMascot);
      else if (t === "PICNIC_BASKET") r = await usePicnicBasketAction();
      else if (t === "VACATION_TICKET") r = await useVacationTicketAction(selectedMascot);
      else if (t === "XP_SHARE" || t === "XP_SHARE_TEAM") r = await useXpShareAction(selectedMascot, selectedBuff);
      else if (t === "RAINBOW_FEATHER") r = await useRainbowFeatherAction(selectedMascot, selectedBuff);
      else if (isMegaStoneType(t)) r = await useMegaStoneAction(selectedMascot, selectedBuff);
      else r = await useMascotBuffAction(selectedMascot, selectedBuff);

      if (r.error) toast.error(r.error);
      else {
        if (r.replacedExistingBuff) {
          toast.success(`Vitamina Elétrica anterior removida. Novo buff aplicado em ${mascotName}! ⚡`);
        } else if (t === "PICNIC_BASKET") {
          toast.success("Piquenique ativado: próxima expedição -30% e bônus por modo durante 3h. 🧺");
        } else if (t === "VACATION_TICKET") {
          toast.success(`${mascotName} foi de férias com o Professor Carvalho! Volta em 5 dias. 🏖️`);
        } else if (t === "XP_SHARE" || t === "XP_SHARE_TEAM") {
          toast.success(`Compartilhador de XP equipado em ${mascotName}! 📡`);
        } else if (t === "RAINBOW_FEATHER") {
          toast.success(`${mascotName} renasceu no nível 1 com atributos ${r.statRange ?? "ressorteados"}! 🌈`);
          if (r.comparison) setFeatherComparison(r.comparison);
          else window.setTimeout(() => window.location.reload(), 600);
        } else if (isMegaStoneType(t)) {
          toast.success(`${mascotName} despertou ${r.megaName ?? "uma Mega Evolução"}! 🔮`);
        } else if (t === "LUCKY_EGG") {
          toast.success(`Ovo da Sorte ativado em ${mascotName}! Próximo treinamento +20% EXP. 🥚`);
        } else if (t === "WEAKNESS_POLICY") {
          toast.success(`${mascotName} se recuperou, saiu do repouso e voltou para o combate! 🛡️`);
        } else if (t === "MASCOT_BUFF_HAPPY" && r.honeyOutcome) {
          toast.success(r.honeyOutcome.message, { duration: 8000 });
        } else if (t === "MASCOT_BUFF_HAPPY") {
          toast.success(`${mascotName} ficou com felicidade máxima! A chance social não ativou desta vez. 🍯`);
        } else {
          toast.success("Item usado com sucesso! ✨");
        }
        // Cada uso concluído encerra a seleção atual, mesmo quando ainda restam
        // unidades do item. Isso evita que um segundo clique aplique novamente o
        // mesmo item/mascote por engano e devolve a busca ao estado inicial.
        searchSeq.current += 1;
        setSelectedBuff("");
        setSelectedMascot("");
        setSelectedMascotObj(null);
        setSearch("");
        setResults([]);
        setShowResults(false);
        setMascotPage(0);
        // A Pena mantém o painel montado para exibir o comparativo. O card é
        // recarregado ao fechar o modal; outros itens continuam atualizando já.
        if (t !== "RAINBOW_FEATHER" || !r.comparison) router.refresh();
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Zap size={16} className="text-[#FFCB05]" />
        <h2 className="font-semibold text-slate-200">Itens Especiais</h2>
        <span className="text-xs text-slate-500">— use em seus mascotes</span>
        {orderedBuffs.length > 1 && (
          <button
            type="button"
            onClick={() => { setReorderMode((v) => !v); setDraggingId(null); }}
            className={`ml-auto rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              reorderMode ? "border-[#FFCB05]/50 bg-[#FFCB05]/15 text-[#FFCB05]" : "border-border text-slate-400 hover:text-slate-200"
            }`}
          >
            {reorderMode ? "Concluir" : "Reorganizar"}
          </button>
        )}
      </div>

      {reorderMode ? (
        /* Modo de reorganização: lista arrastável (mouse e toque) com ajuste fino */
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">Arraste pela alça ⠿ para reordenar, ou use ▲ ▼ para mover entre páginas. A ordem fica salva neste dispositivo.</p>
          <div className="space-y-1.5" onPointerMove={onRowPointerMove} onPointerUp={() => setDraggingId(null)} onPointerCancel={() => setDraggingId(null)}>
            {pageBuffs.map((buff, localIndex) => {
              const emoji = BUFF_EMOJI[buff.type] ?? (isMegaStoneType(buff.type) ? "🔮" : "✨");
              const globalIndex = pageStart + localIndex;
              return (
                <div
                  key={buff.id}
                  ref={(el) => { rowRefs.current[localIndex] = el; }}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 transition-colors ${
                    draggingId === buff.id ? "border-[#FFCB05]/70 bg-[#FFCB05]/10 opacity-90" : "border-border bg-slate-900/40"
                  }`}
                >
                  <button
                    type="button"
                    onPointerDown={(e) => { setDraggingId(buff.id); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
                    className="shrink-0 cursor-grab touch-none text-slate-500 hover:text-slate-300 active:cursor-grabbing"
                    style={{ touchAction: "none" }}
                    aria-label="Arrastar para reordenar"
                  >
                    <GripVertical size={16} />
                  </button>
                  {buff.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={buff.imageUrl} alt="" className="h-7 w-7 shrink-0 object-contain" />
                  ) : (
                    <span className="shrink-0 text-xl">{emoji}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">{buff.name}</p>
                    <p className="text-[10px] text-[#FFCB05]">×{buff.quantity} · #{globalIndex + 1}</p>
                  </div>
                  <div className="flex shrink-0 flex-col">
                    <button type="button" disabled={globalIndex === 0} onClick={() => nudgeItem(buff.id, -1)} aria-label="Mover para cima" className="rounded p-0.5 text-slate-400 hover:text-[#FFCB05] disabled:opacity-30">
                      <ChevronUp size={13} />
                    </button>
                    <button type="button" disabled={globalIndex === orderedBuffs.length - 1} onClick={() => nudgeItem(buff.id, 1)} aria-label="Mover para baixo" className="rounded p-0.5 text-slate-400 hover:text-[#FFCB05] disabled:opacity-30">
                      <ChevronDown size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
      /* Lista de buffs disponíveis (paginada) */
      <div className="grid gap-2 sm:grid-cols-2">
        {pageBuffs.map(buff => {
          const emoji = BUFF_EMOJI[buff.type] ?? (isMegaStoneType(buff.type) ? "🔮" : "✨");
          const isThisProtein = buff.type === "MASCOT_BUFF_STAT";
          const areas = EXP_BUFF_AREAS[buff.type];
          return (
            <button key={buff.id} type="button"
              onClick={() => {
                setSelectedBuff(buff.id);
                clearMascot();
                if (buff.type === "WEAKNESS_POLICY") {
                  const firstRecoverable = mascots.find((mascot) => {
                    const hasActiveRest = Boolean(mascot.restingUntil && new Date(mascot.restingUntil) > new Date());
                    return mascot.arenaState === "INJURED" || mascot.arenaState === "RESTING" || hasActiveRest;
                  });
                  if (firstRecoverable) {
                    setSelectedMascot(firstRecoverable.id);
                    setSelectedMascotObj({ ...firstRecoverable, proteinDoses: proteinDoses[firstRecoverable.id] ?? 0, activeBuffTypes: activeBuffsByMascot[firstRecoverable.id] ?? [] });
                  }
                }
              }}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                selectedBuff === buff.id
                  ? "border-[#FFCB05]/50 bg-[#FFCB05]/10"
                  : "border-border bg-slate-900/40 hover:border-slate-600"
              }`}>
              {buff.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={buff.imageUrl} alt="" className="h-8 w-8 object-contain shrink-0 mt-0.5" />
              ) : (
                <span className="text-2xl shrink-0">{emoji}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{buff.name}</p>
                {buff.description && (
                  <p className="text-[10px] leading-relaxed text-slate-500">{buff.description}</p>
                )}
                <p className="text-[10px] text-[#FFCB05] mt-0.5">×{buff.quantity} disponível</p>

                {/* Indicador de onde o buff de EXP se aplica */}
                {areas && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {areas.map(a => (
                      <span key={a.label} className={`text-[9px] font-semibold px-1 rounded ${
                        a.applies ? "text-green-300 bg-green-500/10 border border-green-500/20" : "text-slate-600 bg-slate-800/40 border border-slate-700/30 line-through"
                      }`}>
                        {a.label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Indicador de limite da Proteína Zika */}
                {isThisProtein && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="flex gap-1">
                      {Array.from({ length: PROTEIN_LIMIT }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-4 rounded-full ${
                            i < selectedMascotDoses ? "bg-green-400" : "bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`text-[9px] font-semibold ${proteinFull ? "text-red-400" : "text-slate-400"}`}>
                      {selectedMascotDoses}/{PROTEIN_LIMIT} doses
                      {selectedMascot ? "" : " (selecione mascote)"}
                    </span>
                    {proteinFull && <span className="text-[9px] text-red-400 font-bold">MÁXIMO</span>}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      )}

      {/* Paginação dos itens */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage(safePage - 1)}
            className="flex items-center gap-1 rounded-lg border border-border bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            <ChevronLeft size={12} /> Anterior
          </button>
          <span className="text-[11px] text-slate-500">Página {safePage + 1} de {totalPages}</span>
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(safePage + 1)}
            className="flex items-center gap-1 rounded-lg border border-border bg-slate-900 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
          >
            Próxima <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* Alerta quando proteína selecionada e limite chegou */}
      {isProtein && selectedMascot && proteinFull && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Este mascote já recebeu {PROTEIN_LIMIT} doses de Proteína Zika — limite máximo atingido.
        </div>
      )}

      {/* Alerta de substituição de EXP_BOOST */}
      {isExpBuff && selectedMascot && mascotHasExpBoost && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>Este mascote já tem uma <strong>Vitamina Elétrica</strong> ativa. Usar outra irá remover o buff atual e aplicar um novo no lugar.</span>
        </div>
      )}

      {/* Seletor de mascote + botão */}
      {selectedBuff && (
        <div className="flex flex-wrap items-center gap-3">
          {selectedBuffItem && PLAYER_LEVEL_ITEMS.has(selectedBuffItem.type) ? (
            <p className="text-xs text-slate-400">Aplica-se automaticamente à Equipe Favorita, com até 6 mascotes livres.</p>
          ) : selectedMascotObj ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-3 py-2 text-xs text-slate-100">
              <span className="font-semibold">{selectedMascotObj.name}</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-[#FFCB05]">#{shortMascotCode(selectedMascotObj.id)}</span>
              <span className="text-[10px] text-slate-400">
                Nv.{selectedMascotObj.level}{selectedMascotObj.isEquipped ? " · ★ Companheiro" : selectedMascotObj.isFavorite ? " · ☆ Favorito" : ""}
              </span>
              <button type="button" onClick={clearMascot} aria-label="Trocar mascote" className="ml-1 rounded-full p-0.5 text-slate-400 hover:text-white">
                <X size={13} />
              </button>
            </div>
          ) : (
          <div ref={comboRef} className="relative w-full max-w-xs">
            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              onKeyDown={(e) => { if (e.key === "Escape") { setShowResults(false); (e.currentTarget as HTMLInputElement).blur(); } }}
              placeholder="Buscar mascote por nome ou código…"
              className="w-full rounded-xl border border-border bg-slate-900 py-2 pl-7 pr-8 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#FFCB05]"
            />
            {searching ? (
              <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-slate-500" />
            ) : search ? (
              <button type="button" onClick={() => { setSearch(""); setShowResults(false); }} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-500 hover:text-slate-200">
                <X size={13} />
              </button>
            ) : null}
            {showResults && (
              <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-slate-950 shadow-xl">
                <div className="max-h-64 overflow-y-auto">
                  {mascotOptions.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-slate-500">{searching ? "Buscando…" : "Nenhum mascote encontrado."}</p>
                  ) : pagedMascotOptions.map((m) => {
                    const doses = isProtein ? (m.proteinDoses ?? 0) : 0;
                    const maxed = isProtein && doses >= PROTEIN_LIMIT;
                    const hasBoost = isExpBuff && (m.activeBuffTypes ?? []).includes("EXP_BOOST");
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={maxed}
                        onClick={() => pickMascot(m)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="min-w-0 truncate">
                          {m.name}
                          <span className="ml-1.5 font-mono text-[10px] text-[#FFCB05]">#{shortMascotCode(m.id)}</span>
                          <span className="ml-1 text-[10px] text-slate-500">Nv.{m.level}{m.isEquipped ? " · ★" : m.isFavorite ? " · ☆" : ""}</span>
                        </span>
                        <span className="shrink-0 text-[9px] text-slate-500">
                          {isProtein && doses > 0 ? `${doses}/${PROTEIN_LIMIT}` : ""}{maxed ? " MÁX" : ""}{hasBoost ? " ⚡" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {mascotTotalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 border-t border-border bg-slate-950 px-2 py-1.5">
                    <button type="button" disabled={mascotSafePage <= 0} onClick={() => setMascotPage(mascotSafePage - 1)} className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40">
                      <ChevronLeft size={11} /> Anterior
                    </button>
                    <span className="text-[10px] text-slate-500">{mascotSafePage + 1}/{mascotTotalPages}</span>
                    <button type="button" disabled={mascotSafePage >= mascotTotalPages - 1} onClick={() => setMascotPage(mascotSafePage + 1)} className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40">
                      Próxima <ChevronRight size={11} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {isWeaknessPolicy && mascotOptions.length === 0 && (
            <p className="w-full text-xs text-slate-400">
              Nenhum mascote ferido ou em repouso, incluindo os mascotes do banco.
            </p>
          )}

          {/* Aviso de doses do mascote selecionado */}
          {isProtein && selectedMascot && selectedMascotDoses > 0 && !proteinFull && (
            <span className="text-[10px] text-amber-400 font-semibold">
              💊 {selectedMascotDoses}/{PROTEIN_LIMIT} doses usadas neste mascote
            </span>
          )}

          {selectedBuffItem?.type === "RAINBOW_FEATHER" && selectedMascot && (
            <div className="w-full space-y-2">
              <p className="text-[10px] text-red-400 font-semibold">
                ⚠️ IRREVERSÍVEL — volta à forma básica e ao nível 1, ressorteando personalidade e atributos
              </p>
              {featherWarning && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-300">
                  ⚠️ {featherWarning}
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={
              pending ||
              (!selectedMascot && !PLAYER_LEVEL_ITEMS.has(selectedBuffItem?.type ?? "")) ||
              (!PLAYER_LEVEL_ITEMS.has(selectedBuffItem?.type ?? "") && !(selectedMascotObj && isEligible(selectedMascotObj))) ||
              (isProtein && proteinFull)
            }
            onClick={handleUse}
            className="rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Usando…" : "Usar item ✨"}
          </button>
        </div>
      )}

      {featherComparison && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feather-comparison-title"
        >
          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-fuchsia-400/40 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-2xl shadow-fuchsia-950/50 sm:p-7">
            <button
              type="button"
              onClick={() => {
                setFeatherComparison(null);
                window.location.reload();
              }}
              className="absolute right-4 top-4 rounded-full border border-slate-700 bg-slate-900 p-2 text-slate-400 transition hover:border-slate-500 hover:text-white"
              aria-label="Fechar comparação"
            >
              <X size={18} />
            </button>

            <div className="mb-6 pr-12">
              <div className="mb-2 flex items-center gap-2 text-fuchsia-300">
                <Sparkles size={18} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Renascimento concluído</span>
              </div>
              <h3 id="feather-comparison-title" className="text-xl font-black text-white sm:text-2xl">
                Resultado da Pena Arco-Íris
              </h3>
              <p className="mt-1 text-xs text-slate-400">Confira exatamente o que mudou no mascote.</p>
            </div>

            <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
              {(["before", "after"] as const).map((side, index) => {
                const snapshot = featherComparison[side];
                const total = FEATHER_STATS.reduce((sum, [, key]) => sum + snapshot[key], 0);
                return (
                  <div key={side} className={`rounded-2xl border p-4 ${side === "after" ? "border-fuchsia-400/40 bg-fuchsia-500/10" : "border-slate-700 bg-slate-900/70"}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${side === "after" ? "text-fuchsia-300" : "text-slate-500"}`}>
                      {side === "before" ? "Antes" : "Depois"}
                    </p>
                    <p className="mt-2 text-lg font-bold text-white">{snapshot.name}</p>
                    {snapshot.name !== snapshot.pokemonName && <p className="text-[11px] text-slate-500">{snapshot.pokemonName}</p>}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-slate-950/70 p-3">
                        <p className="text-[9px] uppercase tracking-wide text-slate-500">Nível</p>
                        <p className="mt-1 text-lg font-black text-white">{snapshot.level}</p>
                      </div>
                      <div className="rounded-xl bg-slate-950/70 p-3">
                        <p className="text-[9px] uppercase tracking-wide text-slate-500">Personalidade</p>
                        <p className="mt-1 text-sm font-bold text-white">{PERSONALITY_LABEL[snapshot.personality] ?? snapshot.personality}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {FEATHER_STATS.map(([label, key]) => (
                        <div key={key} className="flex items-center justify-between rounded-lg bg-slate-950/50 px-3 py-2 text-xs">
                          <span className="text-slate-400">{label}</span>
                          <span className="font-black text-white">{snapshot[key]}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between rounded-lg border border-[#FFCB05]/25 bg-[#FFCB05]/10 px-3 py-2 text-xs">
                        <span className="font-bold text-[#FFCB05]">Total de atributos</span>
                        <span className="font-black text-[#FFCB05]">{total}</span>
                      </div>
                    </div>
                  </div>
                );
              }).reduce<React.ReactNode[]>((cards, card, index) => {
                if (index > 0) cards.push(
                  <div key="arrow" className="flex items-center justify-center text-fuchsia-300">
                    <ArrowRight className="rotate-90 sm:rotate-0" size={24} />
                  </div>,
                );
                cards.push(card);
                return cards;
              }, [])}
            </div>

            <button
              type="button"
              onClick={() => {
                setFeatherComparison(null);
                window.location.reload();
              }}
              className="mt-6 w-full rounded-xl bg-[#FFCB05] px-4 py-3 text-sm font-black text-[#1A1A2E] transition hover:bg-[#FFD700]"
            >
              Ver mascote atualizado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
