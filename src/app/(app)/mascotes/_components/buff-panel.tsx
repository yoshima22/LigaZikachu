"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { useMascotBuffAction, useLuckyEggAction, useWeaknessPolicyAction, usePicnicBasketAction, useVacationTicketAction, useXpShareAction, removeXpShareAction, useRainbowFeatherAction, useMegaStoneAction } from "../actions";
import { getMegaStoneByType, isMegaStoneType } from "@/lib/mega-evolution";

interface BuffItem {
  id: string; name: string; type: string; quantity: number;
  description?: string; imageUrl?: string;
  metadata?: { eggTier?: string; adminLabOriginOverride?: boolean } | null;
}
interface MascotOption {
  id: string; name: string; pokemonId: number; level: number; isEquipped: boolean; isFavorite: boolean;
  hatchedFromEggType?: string | null; hatchedFromEggOrigin?: string | null;
}

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
  const [selectedMascot, setSelectedMascot] = useState<string>(mascots.find(m => m.isEquipped)?.id ?? mascots.find(m => m.isFavorite)?.id ?? "");

  if (buffs.length === 0) return null;

  const selectedBuffItem = buffs.find(b => b.id === selectedBuff);
  const isProtein = selectedBuffItem?.type === "MASCOT_BUFF_STAT";
  const isExpBuff = selectedBuffItem?.type === "MASCOT_BUFF_EXP";
  const isMegaStone = selectedBuffItem ? isMegaStoneType(selectedBuffItem.type) : false;
  const selectedMegaStone = selectedBuffItem ? getMegaStoneByType(selectedBuffItem.type) : null;
  const isAdminLabFeather = selectedBuffItem?.metadata?.adminLabOriginOverride === true;
  const eligibleMascots = isAdminLabFeather
    ? mascots.filter((m) => !m.hatchedFromEggType && !m.hatchedFromEggOrigin)
    : mascots;
  const mascotOptions = isMegaStone && selectedMegaStone
    ? eligibleMascots.filter((m) => m.pokemonId === selectedMegaStone.compatiblePokemonId && m.level >= selectedMegaStone.minLevel)
    : eligibleMascots;
  const selectedMascotDoses = selectedMascot ? (proteinDoses[selectedMascot] ?? 0) : 0;
  const proteinFull = selectedMascotDoses >= PROTEIN_LIMIT;
  const selectedMascotItem = mascots.find((mascot) => mascot.id === selectedMascot);
  const featherTier = selectedBuffItem?.metadata?.eggTier;
  const originKey = selectedMascotItem?.hatchedFromEggOrigin?.startsWith("GEN_CHOICE:")
    ? selectedMascotItem.hatchedFromEggOrigin.split(":")[1]
    : selectedMascotItem?.hatchedFromEggType;
  const originTier = !selectedMascotItem?.hatchedFromEggType ? "RARE"
    : originKey === "LAB" ? "LAB"
    : originKey === "SPECIAL" ? "SPECIAL"
    : originKey === "EVENT" ? "EVENT"
    : originKey === "RARE" ? "RARE"
    : "COMMON";
  const tierRank: Record<string, number> = { COMMON: 0, RARE: 1, EVENT: 2, SPECIAL: 3, LAB: 4 };
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
  const selectedMascotActiveBuffs = selectedMascot ? (activeBuffsByMascot[selectedMascot] ?? []) : [];
  const mascotHasExpBoost = selectedMascotActiveBuffs.includes("EXP_BOOST");

  const handleUse = () => {
    if (!selectedBuffItem) return;
    const isPlayerLevel = PLAYER_LEVEL_ITEMS.has(selectedBuffItem.type);
    const isDestructive = DESTRUCTIVE_ITEMS.has(selectedBuffItem.type);

    if (!isPlayerLevel && !selectedMascot) { toast.error("Selecione um mascote."); return; }
    if (isMegaStone && selectedMegaStone && !mascotOptions.some((m) => m.id === selectedMascot)) {
      toast.error(`Selecione um ${selectedMegaStone.compatiblePokemonName} Nv.${selectedMegaStone.minLevel}+ compatível.`);
      return;
    }

    if (isProtein && proteinFull) {
      toast.error(`Este mascote já recebeu ${PROTEIN_LIMIT} doses de Proteína Zika (limite máximo).`); return;
    }

    const mascotName = mascots.find(m => m.id === selectedMascot)?.name ?? "mascote";

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
      let r: { error?: string; replacedExistingBuff?: boolean; megaName?: string; statRange?: string };
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
          toast.success(`${mascotName} foi de férias com o Professor Carvalho! Volta em 7 dias. 🏖️`);
        } else if (t === "XP_SHARE" || t === "XP_SHARE_TEAM") {
          toast.success(`Compartilhador de XP equipado em ${mascotName}! 📡`);
        } else if (t === "RAINBOW_FEATHER") {
          toast.success(`${mascotName} renasceu no nível 1 com atributos ${r.statRange ?? "ressorteados"}! 🌈`);
        } else if (isMegaStoneType(t)) {
          toast.success(`${mascotName} despertou ${r.megaName ?? "uma Mega Evolução"}! 🔮`);
        } else if (t === "LUCKY_EGG") {
          toast.success(`Ovo da Sorte ativado em ${mascotName}! Próximo treinamento +20% EXP. 🥚`);
        } else if (t === "WEAKNESS_POLICY") {
          toast.success(`${mascotName} está protegido contra ataques oportunistas! 🛡️`);
        } else {
          toast.success("Item usado com sucesso! ✨");
        }
        router.refresh();
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-[#FFCB05]" />
        <h2 className="font-semibold text-slate-200">Itens Especiais</h2>
        <span className="text-xs text-slate-500">— use em seus mascotes</span>
      </div>

      {/* Lista de buffs disponíveis */}
      <div className="grid gap-2 sm:grid-cols-2">
        {buffs.map(buff => {
          const emoji = BUFF_EMOJI[buff.type] ?? (isMegaStoneType(buff.type) ? "🔮" : "✨");
          const isThisProtein = buff.type === "MASCOT_BUFF_STAT";
          const areas = EXP_BUFF_AREAS[buff.type];
          return (
            <button key={buff.id} type="button"
              onClick={() => setSelectedBuff(buff.id)}
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
          ) : (
          <select
            value={selectedMascot}
            onChange={e => setSelectedMascot(e.target.value)}
            className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]"
          >
            <option value="">Selecione o mascote</option>
            {mascotOptions.map(m => {
              const doses = isProtein ? (proteinDoses[m.id] ?? 0) : 0;
              const maxed = isProtein && doses >= PROTEIN_LIMIT;
              const hasBoost = isExpBuff && (activeBuffsByMascot[m.id] ?? []).includes("EXP_BOOST");
              return (
                <option key={m.id} value={m.id} disabled={maxed}>
                  {m.name}{m.isEquipped ? " ★ Companheiro" : m.isFavorite ? " ☆ Equipe Favorita" : ""}{isProtein && doses > 0 ? ` (${doses}/${PROTEIN_LIMIT} doses)` : ""}{maxed ? " — MÁXIMO" : ""}{hasBoost ? " ⚡ buff ativo" : ""}
                </option>
              );
            })}
          </select>
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
              (isAdminLabFeather && !mascotOptions.some((mascot) => mascot.id === selectedMascot)) ||
              (isProtein && proteinFull)
            }
            onClick={handleUse}
            className="rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Usando…" : "Usar item ✨"}
          </button>
        </div>
      )}
    </div>
  );
}
