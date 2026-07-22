"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import { WEEKLY_MODIFIERS, LEAGUE_ITEMS, POINTS, BATTLE_TIMES_BRT } from "../constants";
import { COMBAT_ROLE_OPTIONS, getCombatRoleLabel, COMBAT_ROLE_DESCRIPTIONS, recommendCombatRole, type CombatRole } from "@/lib/combat-roles";
import { getPokemonName, getPokemonTypes, getStaticSpriteUrl, getTypeAdvantageMultiplier } from "@/lib/mascot-data";
import {
  startWeeklyLeagueNowAction,
  joinLeagueAction,
  setModifierAction,
  simulateRoundAction,
  seedLeagueItemsAction,
  saveDailyTeamAction,
  swapTeamSlotsAction,
  swapTeamMascotPositionsAction,
  clearTeamSlotAction,
  buyLeagueItemAction,
  finalizeLeagueAction,
  selectBattleItemsAction,
  cancelLeagueAction,
  deleteLeagueAction,
  purgeAdminsFromLeagueAction,
  toggleLeagueBetsAction,
  generateDailyMatchupsAction,
  purgeInactivePlayersAction,
  resetAndResimulateAction,
  fullLeagueResetAction,
  regenerateReplaysAction,
  getWeeklyScoutingAnalysisAction,
} from "../actions";
import { LeagueBattleReplayModal, type TurnLog } from "./league-battle-replay";
import { MysteryStepButton } from "@/app/(app)/combates/ordem-da-trapaca/_components/mystery-step-button";

type Tab = "liga" | "times" | "resultados" | "colinha" | "itens" | "admin";

type OpponentAnalysis = {
  playerId: string; playerName: string; matches: number; wins: number; losses: number; draws: number;
  score: number; winRate: number; averageDamage: number;
  topMascots: Array<{ pokemonId: number; name: string; uses: number }>;
  typePreferences: Array<{ name: string; count: number }>;
  rolePreferences: Array<{ name: string; count: number }>;
  recentMatches: Array<{ id: string; weekKey: string; opponentName: string; result: "W" | "L" | "D"; damage: number; resolvedAt: string | Date | null }>;
};

const SCOUTING_TYPE_LABELS: Record<string, string> = {
  normal: "Normal", fire: "Fogo", water: "Água", grass: "Planta", electric: "Elétrico",
  ice: "Gelo", fighting: "Lutador", poison: "Venenoso", ground: "Terrestre", flying: "Voador",
  psychic: "Psíquico", bug: "Inseto", rock: "Pedra", ghost: "Fantasma", dragon: "Dragão",
  dark: "Sombrio", steel: "Aço", fairy: "Fada",
};

type PageData = {
  player: { id: string; displayName: string; walletBalance: number; isAdmin: boolean };
  currentLeague: any;
  participants: any[];
  myTeams: any[];
  todayMatches: any[];
  availableMascots: any[];
  leagueInventory: { type: string; quantity: number }[];
  selectedBattleItems: { battleSlot: number; effectType: string }[];
  orderSabotage: {
    title: string;
    description: string | null;
    affectedSlots: number[];
    statMultiplier: number;
    affectedStats: string[];
  } | null;
  orderLeagueStepState?: {
    active: boolean;
    unlocked: boolean;
    resolved: boolean;
    generalClues: number;
    specificClues: number;
    requiredGeneralClues: number;
    requiredSpecificClues: number;
  };
  weekHighlights: Array<{ id: string; name: string; pokemonId: number; ownerId: string; ownerName: string; role: string; damageDealt: number; damageTaken: number; kosDealt: number; heals: number; attackActions: number; matches: number; wins: number }>;
  opponentAnalyses: Record<string, OpponentAnalysis>;
  lastChampion: {
    playerName: string; weekKey: string; points: number; wins: number; losses: number;
    avatarUrl: string | null; playerId: string;
    topAttacker: { name: string; pokemonId: number; damageDealt: number } | null;
    topDefender: { name: string; pokemonId: number; damageTaken: number } | null;
    topSupport: { name: string; pokemonId: number; heals: number } | null;
  } | null;
};

export function LeagueClient({ initialData }: { initialData: PageData }) {
  const [tab, setTab] = useState<Tab>("liga");
  const [data, setData] = useState(initialData);
  const [refreshing, startRefresh] = useTransition();

  const refresh = () => {
    startRefresh(async () => {
      try {
        const mod = await import("../actions");
        const res = await mod.getLeagueDataAction();
        if (res && !("error" in res)) setData(res as unknown as PageData);
      } catch {}
    });
  };

  const tabs = ([
    { id: "liga", label: "Liga Atual", emoji: "🏆" },
    { id: "times", label: "Meus Times", emoji: "👥" },
    { id: "resultados", label: "Resultados", emoji: "📊" },
    { id: "colinha", label: "Regras", emoji: "📋" },
    { id: "itens", label: "Itens", emoji: "🎒" },
    { id: "admin", label: "Admin", emoji: "⚙️" },
  ] satisfies { id: Tab; label: string; emoji: string }[]).filter((item) => item.id !== "admin" || data.player.isAdmin);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">🏆 Liga Semanal dos Mascotes</h1>
          <p className="text-xs text-slate-400">Liga automática de segunda a sexta · aberta a todos os jogadores</p>
          {!data.player.isAdmin && <span className="mt-1 inline-flex rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-300">Visão do jogador</span>}
        </div>
        <button onClick={refresh} disabled={refreshing} className="rounded-xl border border-border bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors">
          {refreshing ? "..." : "↻ Atualizar"}
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(({ id, label, emoji }) => (
          <button key={id} onClick={() => setTab(id)} className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${tab === id ? "bg-yellow-500/20 text-yellow-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}>
            {emoji} {label}
          </button>
        ))}
      </div>

      <div>
        {tab === "liga" && <LeagueTab data={data} />}
        {tab === "times" && <TeamsTab data={data} refresh={refresh} />}
        {tab === "resultados" && <ResultsTab data={data} />}
        {tab === "colinha" && <ColinhaTab />}
        {tab === "itens" && <ItemsTab data={data} refresh={refresh} />}
        {tab === "admin" && data.player.isAdmin && <AdminTab data={data} refresh={refresh} />}
      </div>
    </div>
  );
}

// ── Liga Atual ─────────────────────────────────────────────────────────────

function OrderSabotageBanner({
  sabotage,
  stepState,
  compact = false,
}: {
  sabotage: PageData["orderSabotage"];
  stepState?: PageData["orderLeagueStepState"];
  compact?: boolean;
}) {
  if (stepState?.resolved) return null;
  if (compact && !sabotage) return null;
  if (!sabotage && !stepState?.unlocked) return null;
  const hasActiveSabotage = !!sabotage;
  const statMultiplier = sabotage?.statMultiplier ?? 0.5;
  const affectedSlots = sabotage?.affectedSlots ?? [1, 2, 3];
  const percent = Math.round((1 - statMultiplier) * 100);
  const slots = affectedSlots.join(", ");

  return (
    <div className={`rounded-2xl border border-red-500/50 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.25),transparent_35%),rgba(127,29,29,0.18)] ${compact ? "p-3" : "p-4"} shadow-[0_0_24px_rgba(239,68,68,0.14)]`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-200">Alerta da Ordem da Trapaca</p>
          <p className={`${compact ? "text-xs" : "text-sm"} font-black text-white`}>
            {hasActiveSabotage
              ? `Slots ${slots} estao lutando com -${percent}% nos atributos.`
              : "A solucao para a sabotagem da Liga Semanal foi liberada."}
          </p>
          {!compact && hasActiveSabotage && (
            <p className="mt-1 text-[11px] leading-relaxed text-red-100/80">
              Isto e uma sabotagem ativa do evento, nao um erro do sistema. O efeito aparece nos combates e no replay ate a travessura ser resolvida.
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full border border-red-300/40 bg-red-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-red-100">
          {hasActiveSabotage ? "Debuff ativo" : "Solucao liberada"}
        </span>
      </div>
      {!compact && stepState && !stepState.resolved && (
        <div className="mt-4 rounded-xl border border-red-300/20 bg-slate-950/35 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-red-100/80">
                <span>Pistas gerais</span>
                <span>{stepState.generalClues}/{stepState.requiredGeneralClues}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-900">
                <div
                  className="h-full rounded-full bg-purple-400"
                  style={{ width: `${Math.min(100, (stepState.generalClues / Math.max(1, stepState.requiredGeneralClues)) * 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[10px] text-red-100/80">
                <span>Pistas da Liga Semanal</span>
                <span>{stepState.specificClues}/{stepState.requiredSpecificClues}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-900">
                <div
                  className="h-full rounded-full bg-[#FFCB05]"
                  style={{ width: `${Math.min(100, (stepState.specificClues / Math.max(1, stepState.requiredSpecificClues)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
          {stepState.unlocked ? (
            <div className="mt-3">
              <MysteryStepButton
                stepKey="MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS"
                returnPath="/combates/liga-semanal"
                className="w-full rounded-xl border border-[#FFCB05]/60 bg-[#FFCB05] px-4 py-2 text-xs font-black text-slate-950 shadow-[0_0_18px_rgba(255,203,5,0.22)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                showOnlySuccess
                pendingLabel="Corrigindo..."
                title="Resolver a sabotagem da Liga Semanal"
              >
                Corrigir tabela adulterada
              </MysteryStepButton>
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-red-100/75">
              Encontre mais pistas na Arena, Liga Semanal e expedicoes curtas para liberar a correcao.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LeagueTab({ data }: { data: PageData }) {
  const league = data.currentLeague;
  const [ownAnalysis, setOwnAnalysis] = useState<OpponentAnalysis | null>(null);
  const [analysisPending, startAnalysis] = useTransition();

  const loadOwnAnalysis = () => {
    startAnalysis(async () => {
      const response = await getWeeklyScoutingAnalysisAction(data.player.id);
      if ("error" in response) {
        toast.error(response.error);
        return;
      }
      setOwnAnalysis(response.analysis as OpponentAnalysis);
    });
  };

  if (!league && !data.lastChampion) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        Nenhuma liga ativa nesta semana. A próxima liga será criada automaticamente.
      </div>
    );
  }

  const mod = league?.modifierJson as any;

  return (
    <div className="space-y-4">
      {ownAnalysis && <OpponentAnalysisModal analysis={ownAnalysis} myMascots={data.availableMascots} showRecommendations={false} onClose={() => setOwnAnalysis(null)} />}
      <div className="flex justify-end">
        <button onClick={loadOwnAnalysis} disabled={analysisPending} className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-300 transition-colors hover:bg-cyan-400/15 disabled:cursor-wait disabled:opacity-50">
          {analysisPending ? "Calculando..." : "Ver análise própria"}
        </button>
      </div>
      {/* Champion banner */}
      {data.lastChampion && (
        <div className="relative overflow-hidden rounded-2xl border border-[#FFCB05]/40 bg-gradient-to-r from-[#1a1400] via-[#2a1d00] to-[#1a1400] p-5">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(45deg, transparent, transparent 20px, #FFCB05 20px, #FFCB05 21px)" }} />
          </div>
          <div className="relative space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {data.lastChampion.avatarUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.lastChampion.avatarUrl} alt="" className="h-16 w-16 rounded-full border-2 border-[#FFCB05]/50 object-cover" />
                    <span className="absolute -top-2 -right-1 text-xl drop-shadow-lg">👑</span>
                  </>
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFCB05]/20 border-2 border-[#FFCB05]/50 text-3xl">
                    👑
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#FFCB05]/60">Campeão da Semana</p>
                <p className="text-lg font-black text-[#FFCB05] drop-shadow-[0_0_12px_rgba(255,203,5,0.3)]">
                  {data.lastChampion.playerName}
                </p>
                <p className="text-xs text-slate-400">
                  {data.lastChampion.weekKey} · {data.lastChampion.wins}V {data.lastChampion.losses}D · {data.lastChampion.points} pts
                </p>
              </div>
            </div>

            {(data.lastChampion.topAttacker || data.lastChampion.topDefender || data.lastChampion.topSupport) && (
              <div className="grid grid-cols-3 gap-2">
                {data.lastChampion.topAttacker && (
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-red-500/20 bg-red-500/5 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getStaticSpriteUrl(data.lastChampion.topAttacker.pokemonId)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
                    <p className="text-[9px] font-bold text-red-400">⚔️ Atacante</p>
                    <p className="text-[10px] font-semibold text-slate-200 text-center truncate w-full">{getPokemonName(data.lastChampion.topAttacker.pokemonId) || data.lastChampion.topAttacker.name}</p>
                    <p className="text-[9px] text-slate-500">{data.lastChampion.topAttacker.damageDealt.toLocaleString()} dano</p>
                  </div>
                )}
                {data.lastChampion.topDefender && (
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-green-500/20 bg-green-500/5 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getStaticSpriteUrl(data.lastChampion.topDefender.pokemonId)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
                    <p className="text-[9px] font-bold text-green-400">🛡️ Defensor</p>
                    <p className="text-[10px] font-semibold text-slate-200 text-center truncate w-full">{getPokemonName(data.lastChampion.topDefender.pokemonId) || data.lastChampion.topDefender.name}</p>
                    <p className="text-[9px] text-slate-500">{data.lastChampion.topDefender.damageTaken.toLocaleString()} absorvido</p>
                  </div>
                )}
                {data.lastChampion.topSupport && (
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getStaticSpriteUrl(data.lastChampion.topSupport.pokemonId)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
                    <p className="text-[9px] font-bold text-cyan-400">💚 Suporte</p>
                    <p className="text-[10px] font-semibold text-slate-200 text-center truncate w-full">{getPokemonName(data.lastChampion.topSupport.pokemonId) || data.lastChampion.topSupport.name}</p>
                    <p className="text-[9px] text-slate-500">{data.lastChampion.topSupport.heals} curas</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!league && data.lastChampion && (
        <div className="py-6 text-center text-sm text-slate-500">
          A próxima liga será criada automaticamente na segunda-feira.
        </div>
      )}

      {league && (<>
      <OrderSabotageBanner sabotage={data.orderSabotage} stepState={data.orderLeagueStepState} />

      {/* League status */}
      <div className="rounded-2xl border border-border bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-100">Liga Semanal — {league.weekKey}</h2>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            league.status === "ACTIVE" ? "bg-green-500/20 text-green-300" :
            league.status === "REGISTRATION" ? "bg-yellow-500/20 text-yellow-300" :
            league.status === "FINISHED" ? "bg-blue-500/20 text-blue-300" :
            "bg-slate-700 text-slate-400"
          }`}>{league.status}</span>
        </div>

        {mod && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-1">
            <p className="text-xs font-bold text-purple-300">🎯 Modificador: {mod.name}</p>
            <p className="text-[11px] text-slate-400">{mod.description}</p>
            {mod.example && <p className="text-[10px] text-slate-500 italic">{mod.example}</p>}
          </div>
        )}

        <div className="text-[10px] text-slate-500">
          <p>Combates diários: {BATTLE_TIMES_BRT.join(" · ")} BRT</p>
          <p>Pontuação: Vitória {POINTS.WIN}pts · Empate {POINTS.DRAW}pt · Derrota {POINTS.LOSS}pts</p>
          <p>Desempate: Pontos → Vitórias → Saldo de Sobreviventes → Dano Causado → Dano Recebido (menor)</p>
        </div>
      </div>

      {/* Standings table */}
      <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
        <h3 className="text-xs font-bold text-slate-300 mb-3">Classificação ({data.participants.length} jogadores)</h3>
        {data.participants.length === 0 ? (
          <p className="text-[11px] text-slate-500">Nenhum participante ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-slate-500 border-b border-slate-700/50">
                  <th className="pb-2 pr-2 font-semibold">#</th>
                  <th className="pb-2 pr-2 font-semibold">Jogador</th>
                  <th className="pb-2 pr-2 font-semibold text-center">Pts</th>
                  <th className="pb-2 pr-2 font-semibold text-center">V</th>
                  <th className="pb-2 pr-2 font-semibold text-center">D</th>
                  <th className="pb-2 pr-2 font-semibold text-center">E</th>
                  <th className="pb-2 pr-2 font-semibold text-center" title="W/O recebidos">WO</th>
                  <th className="pb-2 pr-2 font-semibold text-center" title="Byes recebidos">Bye</th>
                  <th className="pb-2 pr-2 font-semibold text-center" title="Saldo de mascotes sobreviventes">Sobr</th>
                  <th className="pb-2 pr-2 font-semibold text-center" title="Dano total causado">Dano+</th>
                  <th className="pb-2 pr-2 font-semibold text-center" title="Dano total recebido (menor é melhor)">Dano−</th>
                  <th className="pb-2 font-semibold text-center" title="Times registrados hoje">Hoje</th>
                </tr>
              </thead>
              <tbody>
                {data.participants.map((p: any, i: number) => {
                  const isMe = p.playerId === data.player.id;
                  const rankColor = i === 0 ? "text-yellow-300" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-slate-500";
                  const teamsToday = p.teamsToday ?? 0;
                  return (
                    <tr key={p.id} className={`text-[11px] border-b border-slate-800/30 ${isMe ? "bg-yellow-500/5" : ""}`}>
                      <td className={`py-1.5 pr-2 font-bold ${rankColor}`}>{i + 1}°</td>
                      <td className="py-1.5 pr-2">
                        <span className={`font-semibold ${isMe ? "text-yellow-300" : "text-slate-200"}`}>{p.playerName}</span>
                        {isMe && <span className="ml-1 text-[9px] text-yellow-500">(você)</span>}
                      </td>
                      <td className="py-1.5 pr-2 text-center font-bold text-slate-100">{p.points}</td>
                      <td className="py-1.5 pr-2 text-center text-green-400">{p.wins}</td>
                      <td className="py-1.5 pr-2 text-center text-red-400">{p.losses}</td>
                      <td className="py-1.5 pr-2 text-center text-slate-400">{p.draws}</td>
                      <td className="py-1.5 pr-2 text-center text-orange-400">{p.woLosses || "–"}</td>
                      <td className="py-1.5 pr-2 text-center text-slate-500">{p.byes || "–"}</td>
                      <td className="py-1.5 pr-2 text-center text-cyan-400">{p.survivorsScore}</td>
                      <td className="py-1.5 pr-2 text-center text-slate-300">{p.damageDealt.toLocaleString()}</td>
                      <td className="py-1.5 pr-2 text-center text-slate-500">{(p.damageTaken ?? 0).toLocaleString()}</td>
                      <td className="py-1.5 text-center">
                        {teamsToday >= 3 ? (
                          <span className="text-green-400" title="3/3 times registrados">✓✓✓</span>
                        ) : teamsToday > 0 ? (
                          <span className="text-yellow-400" title={`${teamsToday}/3 times registrados`}>{"✓".repeat(teamsToday)}{"·".repeat(3 - teamsToday)}</span>
                        ) : (
                          <span className="text-slate-600" title="Nenhum time registrado hoje">···</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-slate-600">
          <span>Pts = Pontos</span>
          <span>V = Vitórias</span>
          <span>D = Derrotas</span>
          <span>E = Empates</span>
          <span>WO = W/O recebido</span>
          <span>Sobr = Saldo sobreviventes</span>
          <span>Dano+ = Causado</span>
          <span>Dano− = Recebido</span>
          <span>Hoje = Times registrados</span>
        </div>
      </div>

      {/* Highlights */}
      {data.weekHighlights.length > 0 && <WeekHighlights highlights={data.weekHighlights} />}
      </>)}
    </div>
  );
}

// ── Destaques da Semana ────────────────────────────────────────────────────

type HighlightEntry = PageData["weekHighlights"][number];

const HIGHLIGHT_CATEGORIES: Array<{
  title: string;
  emoji: string;
  color: string;
  sortFn: (a: HighlightEntry, b: HighlightEntry) => number;
  valueFn: (h: HighlightEntry) => string;
  filterFn?: (h: HighlightEntry) => boolean;
}> = [
  { title: "Maior Dano Causado", emoji: "⚔️", color: "text-red-400", sortFn: (a, b) => b.damageDealt - a.damageDealt, valueFn: h => `${h.damageDealt.toLocaleString()} dano` },
  { title: "Mais KOs", emoji: "💀", color: "text-orange-400", sortFn: (a, b) => b.kosDealt - a.kosDealt, valueFn: h => `${h.kosDealt} KOs`, filterFn: h => h.kosDealt > 0 },
  { title: "Mais Resistente", emoji: "🛡️", color: "text-green-400", sortFn: (a, b) => b.damageTaken - a.damageTaken, valueFn: h => `${h.damageTaken.toLocaleString()} dano absorvido` },
  { title: "Melhor Cuidador", emoji: "💚", color: "text-cyan-400", sortFn: (a, b) => b.heals - a.heals, valueFn: h => `${h.heals} curas`, filterFn: h => h.heals > 0 },
  { title: "Maior Taxa de Vitória", emoji: "🏆", color: "text-yellow-400", sortFn: (a, b) => (b.wins / Math.max(1, b.matches)) - (a.wins / Math.max(1, a.matches)), valueFn: h => `${Math.round((h.wins / Math.max(1, h.matches)) * 100)}% (${h.wins}V/${h.matches}P)`, filterFn: h => h.matches >= 2 },
  { title: "Mais Presente", emoji: "📅", color: "text-violet-400", sortFn: (a, b) => b.matches - a.matches, valueFn: h => `${h.matches} combates`, filterFn: h => h.matches > 0 },
  { title: "Maior Dano Médio", emoji: "📈", color: "text-pink-400", sortFn: (a, b) => (b.damageDealt / Math.max(1, b.matches)) - (a.damageDealt / Math.max(1, a.matches)), valueFn: h => `${Math.round(h.damageDealt / Math.max(1, h.matches)).toLocaleString()} por combate`, filterFn: h => h.matches >= 2 && h.damageDealt > 0 },
  { title: "Melhor Finalizador", emoji: "🎯", color: "text-amber-400", sortFn: (a, b) => (b.kosDealt / Math.max(1, b.matches)) - (a.kosDealt / Math.max(1, a.matches)), valueFn: h => `${(h.kosDealt / Math.max(1, h.matches)).toFixed(1)} KOs/combate`, filterFn: h => h.matches >= 2 && h.kosDealt > 0 },
  { title: "Atacante Ágil", emoji: "💨", color: "text-sky-400", sortFn: (a, b) => b.attackActions - a.attackActions, valueFn: h => `${h.attackActions} ataques`, filterFn: h => h.attackActions > 0 },
];

function WeekHighlights({ highlights }: { highlights: HighlightEntry[] }) {
  if (highlights.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-slate-900/60 p-4 space-y-4">
      <h3 className="text-sm font-bold text-[#FFCB05]">🌟 Destaques da Semana</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {HIGHLIGHT_CATEGORIES.map(cat => {
          const filtered = cat.filterFn ? highlights.filter(cat.filterFn) : highlights.filter(h => h.damageDealt > 0);
          if (filtered.length === 0) return null;
          const sorted = [...filtered].sort(cat.sortFn);
          const top = sorted[0];
          if (!top) return null;

          return (
            <div key={cat.title} className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-3 flex items-center gap-3">
              {top.pokemonId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getStaticSpriteUrl(top.pokemonId)} alt="" className="h-12 w-12 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
              ) : (
                <span className="text-2xl">{cat.emoji}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-500">{cat.emoji} {cat.title}</p>
                <p className={`text-sm font-bold ${cat.color}`}>{getPokemonName(top.pokemonId) || top.name} <span className="font-medium text-slate-400">({top.ownerName})</span></p>
                <p className="text-[10px] text-slate-400">{top.name !== getPokemonName(top.pokemonId) ? `"${top.name}" · ` : ""}{cat.valueFn(top)}</p>
                <p className="text-[9px] text-slate-500">{top.role}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top 3 per category */}
      <details className="group">
        <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300">Ver ranking completo por categoria ▾</summary>
        <div className="mt-3 space-y-3">
          {HIGHLIGHT_CATEGORIES.map(cat => {
            const filtered = cat.filterFn ? highlights.filter(cat.filterFn) : highlights.filter(h => h.damageDealt > 0);
            const sorted = [...filtered].sort(cat.sortFn).slice(0, 5);
            if (sorted.length === 0) return null;
            return (
              <div key={cat.title}>
                <p className="text-[10px] font-bold text-slate-400 mb-1">{cat.emoji} {cat.title}</p>
                {sorted.map((h, i) => (
                  <div key={h.id} className="flex items-center gap-2 py-0.5">
                    <span className={`w-4 text-right text-[10px] font-bold ${i === 0 ? "text-yellow-300" : "text-slate-500"}`}>{i + 1}.</span>
                    {h.pokemonId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getStaticSpriteUrl(h.pokemonId)} alt="" className="h-6 w-6 object-contain shrink-0" style={{ imageRendering: "pixelated" }} />
                    ) : null}
                    <span className="text-[10px] text-slate-300 truncate">{getPokemonName(h.pokemonId) || h.name}{h.name !== getPokemonName(h.pokemonId) ? ` "${h.name}"` : ""} <span className="text-slate-500">({h.ownerName})</span></span>
                    <span className={`ml-auto text-[10px] font-semibold ${cat.color}`}>{cat.valueFn(h)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

// ── Meus Times ─────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  normal: "bg-slate-500", fire: "bg-red-500", water: "bg-blue-500", grass: "bg-green-500",
  electric: "bg-yellow-400", ice: "bg-cyan-400", fighting: "bg-orange-600", poison: "bg-purple-500",
  ground: "bg-amber-600", flying: "bg-indigo-400", psychic: "bg-pink-500", bug: "bg-lime-500",
  rock: "bg-stone-500", ghost: "bg-violet-600", dragon: "bg-indigo-600", dark: "bg-slate-700",
  steel: "bg-slate-400", fairy: "bg-pink-400",
};

const ALL_TYPES = ["fire","water","grass","electric","ice","fighting","poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy","normal"] as const;

const MASCOTS_PER_PAGE = 12;

function TeamsTab({ data, refresh }: { data: PageData; refresh: () => void }) {
  const [pending, startTransition] = useTransition();
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [movingMascot, setMovingMascot] = useState<{ slot: number; index: number; name: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const usedInOtherSlots = (slot: number) => {
    const otherTeams = data.myTeams.filter((t: any) => t.battleSlot !== slot);
    return new Set(otherTeams.flatMap((t: any) => (t.mascotIdsJson as string[]) ?? []));
  };

  const startEditing = (slot: number) => {
    const existing = data.myTeams.find((t: any) => t.battleSlot === slot);
    setMovingMascot(null);
    setEditingSlot(slot);
    const ids = existing ? (existing.mascotIdsJson as string[] ?? []) : [];
    setSelected(ids);
    // Restore saved roles + auto-recommend for any mascot without a saved role
    const savedRoles = (existing?.rolesJson as Record<string, string>) ?? {};
    const mergedRoles: Record<string, string> = { ...savedRoles };
    for (const id of ids) {
      if (!mergedRoles[id]) {
        const m = data.availableMascots.find((x: any) => x.id === id);
        if (m) mergedRoles[id] = recommendCombatRole(m as any);
      }
    }
    setRoles(mergedRoles);
    setSearch("");
    setTypeFilter(null);
    setPage(0);
  };

  const toggleMascot = (id: string) => {
    if (selected.includes(id)) {
      setSelected(prev => prev.filter(x => x !== id));
      setRoles(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
    } else if (selected.length < 6) {
      setSelected(prev => [...prev, id]);
      const m = data.availableMascots.find((x: any) => x.id === id);
      if (m) {
        const rec = recommendCombatRole(m as any);
        setRoles(prev => ({ ...prev, [id]: prev[id] ?? rec }));
      }
    }
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleMascotPositionClick = (slot: number, index: number, name: string) => {
    if (!data.currentLeague) return;
    if (!movingMascot) {
      setMovingMascot({ slot, index, name });
      return;
    }
    if (movingMascot.slot === slot && movingMascot.index === index) {
      setMovingMascot(null);
      return;
    }

    const from = movingMascot;
    setMovingMascot(null);
    startTransition(async () => {
      try {
        const res = await swapTeamMascotPositionsAction(data.currentLeague.id, from.slot, from.index, slot, index);
        if (res && "error" in res) {
          toast.error(res.error);
          return;
        }
        toast.success(`${from.name} reposicionado.`);
        refresh();
      } catch (err) {
        toast.error(`Erro: ${String(err).slice(0, 100)}`);
      }
    });
  };

  const saveTeam = () => {
    setSaveError(null);
    if (!data.currentLeague || !editingSlot) return;
    startTransition(async () => {
      try {
        const res = await saveDailyTeamAction(data.currentLeague.id, editingSlot, selected, roles);
        if (res && "error" in res) { setSaveError(res.error ?? "Erro desconhecido"); toast.error(res.error); return; }
        setSaveError(null);
        toast.success(`Time ${editingSlot} salvo!`);
        setEditingSlot(null);
        refresh();
      } catch (err) {
        const msg = `Erro: ${String(err).slice(0, 200)}`;
        setSaveError(msg);
        toast.error(msg);
      }
    });
  };

  if (!data.currentLeague) {
    return <div className="py-10 text-center text-sm text-slate-500">Aguarde a abertura automática da liga desta semana.</div>;
  }

  // ── Editing mode ─────────────────────────────────────────────
  if (editingSlot) {
    const used = usedInOtherSlots(editingSlot);
    const allAvailable = data.availableMascots.filter((m: any) => !used.has(m.id));

    const filtered = allAvailable.filter((m: any) => {
      const name = (m.nickname ?? getPokemonName(m.pokemonId)).toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (typeFilter) {
        const types = getPokemonTypes(m.pokemonId);
        if (!types.includes(typeFilter)) return false;
      }
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / MASCOTS_PER_PAGE));
    const paginated = filtered.slice(page * MASCOTS_PER_PAGE, (page + 1) * MASCOTS_PER_PAGE);

    const selectedMascots = selected.map(id => data.availableMascots.find((m: any) => m.id === id)).filter(Boolean);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100">Montando Time {editingSlot} — {BATTLE_TIMES_BRT[editingSlot - 1]}</h3>
          <button onClick={() => setEditingSlot(null)} className="text-xs text-slate-400 hover:text-slate-200">← Voltar</button>
        </div>

        {/* Slot grid (selected mascots) */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => {
            const m = selectedMascots[i] as any;
            const currentRole = m ? (roles[m.id] ?? "ATTACKER") as CombatRole : null;
            const recRole = m ? recommendCombatRole(m as any) : null;
            return (
              <div key={i} className={`relative rounded-xl border p-2 flex flex-col items-center gap-1 min-h-[120px] ${m ? "bg-[#FFCB05]/10 border-[#FFCB05]/30" : "border-dashed border-slate-700"}`}>
                <span className="absolute top-1 left-1.5 text-[10px] text-slate-500 font-mono font-bold">{i + 1}</span>
                {m ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
                    <p className="text-[10px] font-semibold text-slate-200 truncate w-full text-center">{m.nickname ?? getPokemonName(m.pokemonId)}</p>
                    <p className="text-[9px] text-slate-400">Nv.{m.level}</p>
                    <select
                      value={currentRole ?? "ATTACKER"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setRoles(prev => ({ ...prev, [m.id]: e.target.value }))}
                      title={currentRole ? COMBAT_ROLE_DESCRIPTIONS[currentRole] : ""}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[9px] font-semibold text-yellow-300 outline-none hover:border-yellow-500/50"
                    >
                      {COMBAT_ROLE_OPTIONS.map(r => (
                        <option key={r.value} value={r.value} title={r.description}>
                          {r.label}{r.value === recRole ? " ★" : ""}
                        </option>
                      ))}
                    </select>
                    {recRole && currentRole !== recRole && (
                      <p className="text-[8px] text-cyan-400">Sugerido: {getCombatRoleLabel(recRole)}</p>
                    )}
                    <button onClick={() => toggleMascot(m.id)} className="absolute top-0.5 right-0.5 rounded-full p-1 text-slate-500 hover:text-red-400 text-xs">✕</button>
                  </>
                ) : (
                  <span className="text-xs text-slate-700 mt-10">vazio</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Tooltip da postura selecionada */}
        {selectedMascots.length > 0 && (() => {
          const lastM = selectedMascots[selectedMascots.length - 1] as any;
          const lastRole = (roles[lastM?.id] ?? "ATTACKER") as CombatRole;
          return (
            <div className="rounded-lg border border-slate-700/50 bg-slate-900/80 px-3 py-2">
              <p className="text-[11px] font-semibold text-yellow-300">{getCombatRoleLabel(lastRole)}</p>
              <p className="text-[10px] text-slate-400">{COMBAT_ROLE_DESCRIPTIONS[lastRole]}</p>
            </div>
          );
        })()}

        {/* Search + filter */}
        <div className="space-y-2">
          <div className="relative">
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar mascote por nome..."
              className="w-full rounded-lg border border-border bg-slate-900 pl-3 pr-3 py-2.5 text-sm text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-500" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => { setTypeFilter(null); setPage(0); }} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${!typeFilter ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-500 hover:text-slate-300"}`}>Todos</button>
            {ALL_TYPES.map(t => (
              <button key={t} onClick={() => { setTypeFilter(typeFilter === t ? null : t); setPage(0); }} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${typeFilter === t ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-500 hover:text-slate-300"}`}>{t}</button>
            ))}
          </div>
        </div>

        {/* Mascot grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {paginated.map((m: any) => {
            const isSelected = selected.includes(m.id);
            const types = getPokemonTypes(m.pokemonId);
            const rec = recommendCombatRole(m as any);
            return (
              <button key={m.id} onClick={() => toggleMascot(m.id)} className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                isSelected ? "border-yellow-500/50 bg-yellow-500/10" : "border-border bg-slate-900/60 hover:border-slate-600"
              } ${!isSelected && selected.length >= 6 ? "opacity-30 pointer-events-none" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-12 w-12 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200 truncate">{m.nickname ?? getPokemonName(m.pokemonId)}</p>
                  <p className="text-[11px] text-slate-400">Nv.{m.level}</p>
                  <div className="flex gap-1 mt-1">
                    {types.map(t => (
                      <span key={t} className={`rounded-full px-2 py-0.5 text-[9px] font-bold text-white capitalize ${TYPE_COLORS[t] ?? "bg-slate-600"}`}>{t}</span>
                    ))}
                  </div>
                  <div className="mt-1.5 grid grid-cols-5 gap-0.5 text-[10px] font-semibold">
                    <span className="text-red-400" title="Força">F{m.statForce}</span>
                    <span className="text-blue-400" title="Agilidade">A{m.statAgility}</span>
                    <span className="text-purple-400" title="Instinto">I{m.statInstinct}</span>
                    <span className="text-green-400" title="Vitalidade">V{m.statVitality}</span>
                    <span className="text-pink-400" title="Carisma">C{m.statCharisma}</span>
                  </div>
                  <p className="mt-1 text-[9px] text-cyan-400/80" title={COMBAT_ROLE_DESCRIPTIONS[rec]}>★ {getCombatRoleLabel(rec)}</p>
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Nenhum mascote encontrado.</p>}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-border bg-slate-800 px-4 py-1.5 text-xs text-slate-300 disabled:opacity-30">← Anterior</button>
            <span className="text-xs text-slate-500">{page + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-border bg-slate-800 px-4 py-1.5 text-xs text-slate-300 disabled:opacity-30">Próxima →</button>
          </div>
        )}

        <button onClick={saveTeam} disabled={pending || selected.length !== 6} className="w-full rounded-xl bg-yellow-500/20 border border-yellow-500/30 py-2.5 text-sm font-bold text-yellow-300 hover:bg-yellow-500/30 disabled:opacity-40 transition-colors">
          {pending ? "Salvando..." : `Salvar Time ${editingSlot} (${selected.length}/6)`}
        </button>
        {saveError && <p className="text-xs text-red-400 text-center mt-1">{saveError}</p>}
      </div>
    );
  }

  // ── Overview mode ────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Monte até 3 times por dia (6 mascotes cada, sem repetição entre times).</p>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
        {movingMascot ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>Reposicionando <span className="font-bold text-yellow-300">{movingMascot.name}</span>. Clique em outro mascote para trocar de lugar.</span>
            <button type="button" onClick={() => setMovingMascot(null)} className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300 hover:text-white">
              cancelar
            </button>
          </div>
        ) : (
          <span>Para reposicionar, clique em um mascote montado e depois em outro slot ocupado. A postura acompanha o mascote.</span>
        )}
      </div>

      {[1, 2, 3].map((slot, idx) => {
        const nextSlot = slot < 3 ? slot + 1 : null;
        const team = data.myTeams.find((t: any) => t.battleSlot === slot);
        const mascotIds = team ? (team.mascotIdsJson as string[] ?? []) : [];
        const isCleared = team?.source === "CLEARED" || (team && mascotIds.length === 0);
        const hasTeam = team && mascotIds.length > 0;
        const teamRoles = team?.rolesJson as Record<string, string> | undefined;
        return (
          <React.Fragment key={slot}>
          <div className="rounded-2xl border border-border bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300">Time {slot} — Combate {BATTLE_TIMES_BRT[slot - 1]}</h3>
              <div className="flex items-center gap-2">
                {isCleared ? (
                  <span className="text-[10px] text-slate-500">🗑 Limpo</span>
                ) : hasTeam ? (
                  team.inherited
                    ? <span className="text-[10px] text-cyan-400">↩ Herdado</span>
                    : <span className="text-[10px] text-green-400">✓ Montado</span>
                ) : <span className="text-[10px] text-orange-400">Não montado</span>}
                <button onClick={() => startEditing(slot)} className="rounded-lg border border-border bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:text-yellow-300 transition-colors">
                  {hasTeam ? "Editar" : "Montar"}
                </button>
                {hasTeam && (
                  <button
                    onClick={() => {
                      if (!confirm(`Limpar Time ${slot}? Os mascotes ficarão livres e o sistema usará auto-preenchimento.`)) return;
                      startTransition(async () => {
                        try {
                          const res = await clearTeamSlotAction(data.currentLeague.id, slot);
                          if (res && "error" in res) { toast.error(res.error); return; }
                          toast.success(`Time ${slot} limpo.`);
                          refresh();
                        } catch (err) { toast.error(`Erro: ${String(err).slice(0, 100)}`); }
                      });
                    }}
                    disabled={pending}
                    className="rounded-lg border border-red-500/30 bg-red-500/5 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
            {hasTeam && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {mascotIds.map((id: string, i: number) => {
                  const m = data.availableMascots.find((x: any) => x.id === id) as any;
                  if (!m) return <div key={id} className="rounded-xl border border-dashed border-slate-700 p-2 min-h-[80px] flex items-center justify-center text-[9px] text-slate-600">?</div>;
                  const types = getPokemonTypes(m.pokemonId);
                  const role = teamRoles?.[id] || recommendCombatRole(m as any);
                  const mascotName = m.nickname ?? getPokemonName(m.pokemonId);
                  const isMoving = movingMascot?.slot === slot && movingMascot.index === i;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={pending}
                      onClick={() => handleMascotPositionClick(slot, i, mascotName)}
                      title={isMoving ? "Clique novamente para cancelar" : "Clique para escolher este mascote para reposicionar"}
                      className={`relative rounded-xl border p-2 flex flex-col items-center gap-0.5 text-left transition-all disabled:opacity-50 ${
                        isMoving
                          ? "border-yellow-300 bg-yellow-400/20 shadow-[0_0_18px_rgba(255,203,5,0.35)]"
                          : "border-[#FFCB05]/20 bg-[#FFCB05]/5 hover:border-yellow-400/60 hover:bg-yellow-400/10"
                      }`}
                    >
                      <span className="absolute top-1 left-1.5 text-[9px] text-slate-600 font-mono">{i + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-9 w-9 object-contain" style={{ imageRendering: "pixelated" }} />
                      <p className="text-[8px] text-slate-300 truncate w-full text-center">{mascotName}</p>
                      <p className="text-[8px] text-slate-500">Nv.{m.level}</p>
                      <div className="flex gap-0.5">
                        {types.map(t => <span key={t} className={`rounded-full px-1 py-px text-[6px] font-bold text-white capitalize ${TYPE_COLORS[t] ?? "bg-slate-600"}`}>{t}</span>)}
                      </div>
                      <p className={`text-[7px] font-semibold ${teamRoles?.[id] ? "text-yellow-400" : "text-slate-500"}`}>{getCombatRoleLabel(role)}</p>
                    </button>
                  );
                })}
              </div>
            )}
            {isCleared && <p className="text-[10px] text-slate-500">Time limpo. O sistema usará auto-preenchimento no horário do combate, ou monte um novo time.</p>}
            {!hasTeam && !isCleared && <p className="text-[10px] text-slate-500">Clique "Montar" para selecionar mascotes. Sem time, o sistema usará auto-preenchimento.</p>}
          </div> {/* end team card */}
          {nextSlot && (
            <div className="flex justify-center -my-1">
              <button
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const res = await swapTeamSlotsAction(data.currentLeague.id, slot, nextSlot);
                      if (res && "error" in res) { toast.error(res.error); return; }
                      toast.success(`Time ${slot} ↔ Time ${nextSlot} trocados!`);
                      refresh();
                    } catch (err) { toast.error(`Erro: ${String(err).slice(0, 100)}`); }
                  });
                }}
                disabled={pending}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[10px] text-slate-400 hover:text-yellow-300 hover:border-yellow-500/30 disabled:opacity-30 transition-colors"
              >
                ↕ Trocar Time {slot} ↔ {nextSlot}
              </button>
            </div>
          )}
          </React.Fragment>
        );
      })}

      <div className="text-[10px] text-slate-500">
        <p>Mascotes disponíveis: {data.availableMascots.length}</p>
        <p>Precisa de 18 mascotes diferentes para os 3 combates do dia.</p>
      </div>
    </div>
  );
}

// ── Resultados ─────────────────────────────────────────────────────────────

function buildMascotRecommendations(analysis: OpponentAnalysis, mascots: PageData["availableMascots"]) {
  const opponentPool = analysis.topMascots.filter((mascot) => mascot.pokemonId > 0);
  const totalOpponentUses = Math.max(1, opponentPool.reduce((sum, mascot) => sum + mascot.uses, 0));
  const scored = mascots.map((mascot) => {
    const types = getPokemonTypes(mascot.pokemonId);
    let offensive = 1;
    let incoming = 1;
    let bestTargetName = "";
    let bestTargetMultiplier = 0;
    if (opponentPool.length > 0) {
      offensive = opponentPool.reduce((sum, target) => {
        const multiplier = getTypeAdvantageMultiplier(types, getPokemonTypes(target.pokemonId));
        if (multiplier > bestTargetMultiplier) {
          bestTargetName = getPokemonName(target.pokemonId) || target.name;
          bestTargetMultiplier = multiplier;
        }
        return sum + multiplier * target.uses;
      }, 0) / totalOpponentUses;
      incoming = opponentPool.reduce((sum, target) => sum + getTypeAdvantageMultiplier(getPokemonTypes(target.pokemonId), types) * target.uses, 0) / totalOpponentUses;
    }
    const stats = Number(mascot.statForce ?? 0) + Number(mascot.statAgility ?? 0) + Number(mascot.statInstinct ?? 0) + Number(mascot.statVitality ?? 0) + Number(mascot.statCharisma ?? 0);
    const score = offensive * 55 - incoming * 28 + Math.min(100, Number(mascot.level ?? 1)) * 0.3 + stats * 0.025;
    const reasons: string[] = [];
    if (bestTargetName && bestTargetMultiplier > 1) reasons.push(`vantagem contra ${bestTargetName}`);
    if (incoming < 0.98) reasons.push("boa resistência ao padrão rival");
    if (offensive > 1.05) reasons.push("pressão ofensiva favorável");
    if (Number(mascot.level ?? 1) >= 75) reasons.push(`nível ${mascot.level}`);
    if (reasons.length === 0) reasons.push("bom equilíbrio de atributos e confronto");
    return { mascot, score, offensive, incoming, reasons: reasons.slice(0, 2), role: recommendCombatRole(mascot) };
  }).sort((a, b) => b.score - a.score);

  // Evita uma sugestão excessivamente repetitiva: no máximo 2 mascotes com o mesmo tipo primário.
  const selected: typeof scored = [];
  const primaryTypeCounts = new Map<string, number>();
  for (const entry of scored) {
    const primaryType = getPokemonTypes(entry.mascot.pokemonId)[0] ?? "normal";
    if ((primaryTypeCounts.get(primaryType) ?? 0) >= 2) continue;
    selected.push(entry);
    primaryTypeCounts.set(primaryType, (primaryTypeCounts.get(primaryType) ?? 0) + 1);
    if (selected.length === 6) break;
  }
  if (selected.length < 6) {
    for (const entry of scored) {
      if (!selected.includes(entry)) selected.push(entry);
      if (selected.length === 6) break;
    }
  }
  return selected;
}

function OpponentAnalysisModal({ analysis, myMascots, showRecommendations = true, onClose }: { analysis: OpponentAnalysis; myMascots: PageData["availableMascots"]; showRecommendations?: boolean; onClose: () => void }) {
  const maxType = Math.max(1, ...analysis.typePreferences.map((entry) => entry.count));
  const maxRole = Math.max(1, ...analysis.rolePreferences.map((entry) => entry.count));
  const recommendations = buildMascotRecommendations(analysis, myMascots);
  const resultColor = { W: "bg-emerald-500 text-emerald-950", L: "bg-red-500 text-white", D: "bg-slate-500 text-white" } as const;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-cyan-400/25 bg-[#080d1c] shadow-2xl shadow-cyan-950/40" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-800 bg-[#080d1c]/95 p-5 backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400">{showRecommendations ? "Scouting do adversário do dia" : "Sua análise na Liga Semanal"}</p>
            <h2 className="mt-1 text-xl font-black text-white">{analysis.playerName}</h2>
            <p className="text-xs text-slate-500">Histórico consolidado de todas as Ligas Semanais registradas.</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white">Fechar ✕</button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Score geral", analysis.score, "text-yellow-300"], ["Combates", analysis.matches, "text-white"],
              ["Vitórias", analysis.wins, "text-emerald-400"], ["Derrotas", analysis.losses, "text-red-400"],
              ["Dano médio", analysis.averageDamage.toLocaleString(), "text-orange-300"],
            ].map(([label, value, color]) => <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3"><p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-1 text-xl font-black ${color}`}>{value}</p></div>)}
          </div>

          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/55 p-4 lg:flex-col lg:justify-center">
              <div className="grid h-32 w-32 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#22d3ee ${analysis.winRate}%, #172033 0)` }}>
                <div className="grid h-24 w-24 place-items-center rounded-full bg-[#0b1120] text-center"><div><p className="text-2xl font-black text-cyan-300">{analysis.winRate}%</p><p className="text-[9px] uppercase text-slate-500">vitórias</p></div></div>
              </div>
              <p className="text-xs text-slate-400"><span className="font-bold text-slate-200">{analysis.wins}V</span> · {analysis.draws}E · {analysis.losses}D</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              <h3 className="text-xs font-bold text-slate-200">Top 6 mascotes mais utilizados</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {analysis.topMascots.map((mascot, index) => <div key={`${mascot.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-slate-950/60 px-3 py-2">
                  <span className="w-4 text-xs font-black text-cyan-500">#{index + 1}</span>
                  {mascot.pokemonId > 0 && <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-9 w-9 object-contain" style={{ imageRendering: "pixelated" }} />}
                  <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{getPokemonName(mascot.pokemonId) || mascot.name}</p><p className="text-[9px] text-slate-500">{mascot.name !== getPokemonName(mascot.pokemonId) ? `“${mascot.name}” · ` : ""}{mascot.uses} escalações</p></div>
                </div>)}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[["Preferência de tipos", analysis.typePreferences, maxType, "bg-cyan-400"], ["Posturas mais usadas", analysis.rolePreferences, maxRole, "bg-violet-400"]].map(([title, entries, max, bar]) => (
              <div key={String(title)} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
                <h3 className="text-xs font-bold text-slate-200">{String(title)}</h3>
                <div className="mt-3 space-y-2">{(entries as Array<{ name: string; count: number }>).map((entry) => <div key={entry.name}><div className="mb-1 flex justify-between text-[10px]"><span className="capitalize text-slate-300">{title === "Preferência de tipos" ? (SCOUTING_TYPE_LABELS[entry.name.toLowerCase()] ?? entry.name) : entry.name}</span><span className="text-slate-500">{entry.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(8, (entry.count / Number(max)) * 100)}%` }} /></div></div>)}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
            <h3 className="text-xs font-bold text-slate-200">Últimos 5 jogos</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">{analysis.recentMatches.map((match) => <div key={match.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><span className={`inline-grid h-6 w-6 place-items-center rounded-lg text-[10px] font-black ${resultColor[match.result]}`}>{match.result === "W" ? "V" : match.result === "L" ? "D" : "E"}</span><p className="mt-2 truncate text-[10px] font-semibold text-slate-200">vs {match.opponentName}</p><p className="text-[9px] text-slate-500">{match.weekKey} · {match.damage.toLocaleString()} dano</p></div>)}</div>
          </div>

          {showRecommendations && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Seu elenco contra este adversário</p><h3 className="mt-1 text-sm font-black text-white">6 mascotes recomendados</h3></div>
              <p className="text-[9px] text-slate-500">Sugestão por confronto de tipos, nível e atributos; não altera suas equipes.</p>
            </div>
            <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] px-3 py-2 text-[9px] leading-relaxed text-slate-400">
              <p><span className="font-bold text-cyan-300">Como ler:</span> o <span className="font-semibold text-yellow-300">Índice</span> é uma pontuação comparativa para ordenar apenas os seus mascotes — não representa chance de vitória. Ele combina vantagem de tipos contra o histórico do rival, risco defensivo, nível e atributos.</p>
              <p className="mt-1"><span className="font-semibold text-cyan-300">Ataque</span> acima de 1,00× indica confronto ofensivo favorável. <span className="font-semibold text-emerald-300">Risco</span> abaixo de 1,00× indica que o mascote tende a resistir melhor aos tipos mais usados pelo adversário.</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map(({ mascot, score, offensive, incoming, reasons, role }, index) => {
                const types = getPokemonTypes(mascot.pokemonId);
                return <div key={mascot.id} className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/70 p-3">
                  <span className="absolute right-2 top-2 text-2xl font-black text-slate-800">#{index + 1}</span>
                  <div className="flex items-center gap-3">
                    <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-12 w-12 object-contain" style={{ imageRendering: "pixelated" }} />
                    <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{getPokemonName(mascot.pokemonId)}</p><p className="truncate text-[9px] text-slate-500">{mascot.nickname ? `“${mascot.nickname}” · ` : ""}Nv.{mascot.level} · {getCombatRoleLabel(role)}</p></div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">{types.map((type) => <span key={type} className="rounded-full bg-slate-800 px-2 py-0.5 text-[8px] font-semibold text-slate-300">{SCOUTING_TYPE_LABELS[type] ?? type}</span>)}</div>
                  <p className="mt-2 text-[9px] leading-relaxed text-emerald-200/80">{reasons.join(" · ")}</p>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center"><div className="rounded-lg bg-slate-900 p-1"><p className="text-[7px] text-slate-600">ÍNDICE</p><p className="text-[10px] font-bold text-yellow-300">{Math.round(score)}</p></div><div className="rounded-lg bg-slate-900 p-1"><p className="text-[7px] text-slate-600">ATAQUE</p><p className="text-[10px] font-bold text-cyan-300">{offensive.toFixed(2)}×</p></div><div className="rounded-lg bg-slate-900 p-1"><p className="text-[7px] text-slate-600">RISCO</p><p className={`text-[10px] font-bold ${incoming <= 1 ? "text-emerald-300" : "text-red-300"}`}>{incoming.toFixed(2)}×</p></div></div>
                </div>;
              })}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

function ResultsTab({ data }: { data: PageData }) {
  const [replayMatch, setReplayMatch] = useState<any>(null);
  const [opponentAnalysis, setOpponentAnalysis] = useState<OpponentAnalysis | null>(null);
  const [analysisTargetId, setAnalysisTargetId] = useState<string | null>(null);
  const [analysisPending, startAnalysis] = useTransition();

  const loadOpponentAnalysis = (playerId: string) => {
    setAnalysisTargetId(playerId);
    startAnalysis(async () => {
      const response = await getWeeklyScoutingAnalysisAction(playerId);
      if ("error" in response) toast.error(response.error);
      else setOpponentAnalysis(response.analysis as OpponentAnalysis);
      setAnalysisTargetId(null);
    });
  };

  if (data.todayMatches.length === 0) {
    return <div className="py-10 text-center text-sm text-slate-500">Matchups ainda não gerados. Admin pode gerar na aba Admin.</div>;
  }

  const slotGroups = [1, 2, 3].map(slot => ({
    slot,
    time: BATTLE_TIMES_BRT[slot - 1],
    matches: data.todayMatches.filter((m: any) => m.battleSlot === slot),
  }));

  return (
    <div className="space-y-4">
      {replayMatch && replayMatch.replayJson && (
        <LeagueBattleReplayModal
          playerAName={replayMatch.playerAName}
          playerBName={replayMatch.playerBName ?? "???"}
          playerAId={replayMatch.playerAId}
          winnerId={replayMatch.winnerId}
          isDraw={replayMatch.isDraw}
          replay={replayMatch.replayJson as TurnLog[]}
          playerASurvivors={replayMatch.playerASurvivors}
          playerBSurvivors={replayMatch.playerBSurvivors}
          orderSabotage={data.orderSabotage}
          onFinish={() => setReplayMatch(null)}
        />
      )}
      {opponentAnalysis && <OpponentAnalysisModal analysis={opponentAnalysis} myMascots={data.availableMascots} onClose={() => setOpponentAnalysis(null)} />}

      <h3 className="text-sm font-bold text-slate-200">Confrontos de Hoje</h3>
      <OrderSabotageBanner sabotage={data.orderSabotage} stepState={data.orderLeagueStepState} compact />

      {slotGroups.map(({ slot, time, matches }) => (
        <div key={slot} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-yellow-300">Rodada {slot}</span>
            <span className="text-[10px] text-slate-500">{time} BRT</span>
          </div>

          {matches.length === 0 ? (
            <p className="text-[11px] text-slate-600 pl-2">Sem confrontos nesta rodada.</p>
          ) : matches.map((match: any) => {
            const odds = match.resultJson as any;
            const isScheduled = match.status === "SCHEDULED";
            const isResolved = match.status === "RESOLVED";
            const isBye = match.status === "BYE";
            const winnerIsA = match.winnerId === match.playerAId;
            const winnerIsB = match.winnerId === match.playerBId;
            const involvesMe = match.playerAId === data.player.id || match.playerBId === data.player.id;
            const opponentId = match.playerAId === data.player.id ? match.playerBId : match.playerBId === data.player.id ? match.playerAId : null;

            if (isBye) {
              return (
                <div key={match.id} className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-2 text-[11px] text-slate-500">
                  {match.playerAName} — <span className="text-slate-600">BYE (+3 pts)</span>
                </div>
              );
            }

            return (
              <div key={match.id} className={`rounded-xl border p-3 space-y-1 ${
                involvesMe ? "ring-1 ring-[#FFCB05]/45 " : ""
              }${
                isScheduled ? "border-yellow-500/20 bg-yellow-500/5" :
                isResolved ? "border-green-500/20 bg-green-500/5" :
                "border-border bg-slate-900/60"
              }`}>
                <div className="flex items-center justify-between">
                  {isScheduled && <span className="text-[10px] font-semibold text-yellow-400">⏳ Agendado</span>}
                  {isResolved && <span className="text-[10px] font-semibold text-green-400">✓ Resolvido</span>}
                </div>

                {/* Matchup card */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                  <div className={`text-right ${match.playerAId === data.player.id ? "text-[#FFCB05]" : isResolved && winnerIsA ? "text-green-300" : "text-slate-200"}`}>
                    <p className="text-xs font-bold">{match.playerAName}</p>
                    {odds?.oddsA && isScheduled && <p className="text-[10px] text-yellow-400 font-semibold">{Number(odds.oddsA).toFixed(2)}×</p>}
                    {isResolved && <p className="text-[9px] text-slate-500">Dano: {match.playerADamageDealt} | Sobr: {match.playerASurvivors}</p>}
                  </div>

                  <span className="text-xs font-bold text-slate-500 px-2">vs</span>

                  <div className={`text-left ${match.playerBId === data.player.id ? "text-[#FFCB05]" : isResolved && winnerIsB ? "text-green-300" : "text-slate-200"}`}>
                    <p className="text-xs font-bold">{match.playerBName ?? "—"}</p>
                    {odds?.oddsB && isScheduled && <p className="text-[10px] text-yellow-400 font-semibold">{Number(odds.oddsB).toFixed(2)}×</p>}
                    {isResolved && <p className="text-[9px] text-slate-500">Dano: {match.playerBDamageDealt} | Sobr: {match.playerBSurvivors}</p>}
                  </div>
                </div>

                {isResolved && match.isDraw && <p className="text-[10px] text-center text-slate-400 font-semibold">Empate</p>}
                {opponentId && involvesMe && (
                  <button disabled={analysisPending && analysisTargetId === opponentId} onClick={() => loadOpponentAnalysis(opponentId)} className="mt-1 w-full rounded-lg border border-cyan-400/25 bg-cyan-400/5 py-1 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-400/10 disabled:cursor-wait disabled:opacity-50 transition-colors">
                    {analysisPending && analysisTargetId === opponentId ? "Calculando..." : "Analisar adversário"}
                  </button>
                )}
                {isResolved && match.replayJson && (
                  <button
                    onClick={() => setReplayMatch(match)}
                    className="mt-1 w-full rounded-lg border border-[#FFCB05]/20 bg-[#FFCB05]/5 py-1 text-[10px] font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/10 transition-colors"
                  >
                    Ver Replay
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Colinha ────────────────────────────────────────────────────────────────

function ColinhaTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-slate-900/60 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-100">📋 Status</h3>
        <div className="space-y-1 text-[11px]">
          <p><span className="font-semibold text-red-400">Força</span> — aumenta dano e ajuda ações ofensivas</p>
          <p><span className="font-semibold text-blue-400">Agilidade</span> — melhora iniciativa, esquiva e ações rápidas</p>
          <p><span className="font-semibold text-pink-400">Carisma</span> — melhora suporte, encorajamento, blefes e efeitos sociais</p>
          <p><span className="font-semibold text-purple-400">Instinto</span> — melhora leitura, efeitos especiais, debuffs e oportunismo</p>
          <p><span className="font-semibold text-green-400">Vitalidade</span> — aumenta resistência, sobrevivência e defesa</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-slate-900/60 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-100">⚔️ Posturas de Combate</h3>
        <div className="space-y-2">
          {COMBAT_ROLE_OPTIONS.map(({ value, label, description }) => (
            <div key={value} className="rounded-lg bg-slate-800/50 px-3 py-2">
              <p className="text-xs font-semibold text-yellow-300">{label}</p>
              <p className="text-[10px] text-slate-400">{description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-slate-900/60 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-100">📅 Regras da Liga</h3>
        <div className="space-y-1 text-[10px] text-slate-400">
          <p>• Liga roda de segunda a sexta, zerada toda semana</p>
          <p>• 3 combates por dia: 20:00, 20:10, 20:20 BRT</p>
          <p>• Cada combate é 6v6</p>
          <p>• Mascotes NÃO podem repetir no mesmo dia (precisa de até 18 diferentes)</p>
          <p>• Mascotes NÃO ficam bloqueados/feridos — modo isolado</p>
          <p>• Até 2 itens por combate</p>
          <p>• Vitória: 3pts | Empate: 1pt | Derrota: 0pts</p>
          <p>• Top 3 recebem Caixa Surpresa + Ovo de Evento</p>
          <p>• Participação válida ganha 1 Ovo de Evento</p>
          <p>• Restante da tabela ganha ZikaCoins proporcionais</p>
        </div>
      </div>
    </div>
  );
}

// ── Itens ──────────────────────────────────────────────────────────────────

function ItemsTab({ data, refresh }: { data: PageData; refresh: () => void }) {
  const [pending, startTransition] = useTransition();
  const [battleSlot, setBattleSlot] = useState(1);
  const [selectedItems, setSelectedItems] = useState<string[]>(() => data.selectedBattleItems.filter((item) => item.battleSlot === 1).map((item) => item.effectType));
  const positive = LEAGUE_ITEMS.filter(i => i.effectType === "POSITIVE");
  const negative = LEAGUE_ITEMS.filter(i => i.effectType === "NEGATIVE");
  const balance = data.player.walletBalance;

  const getOwned = (type: string) => data.leagueInventory.find(i => i.type === type)?.quantity ?? 0;

  const changeSlot = (slot: number) => {
    setBattleSlot(slot);
    setSelectedItems(data.selectedBattleItems.filter((item) => item.battleSlot === slot).map((item) => item.effectType));
  };

  const toggleSelected = (type: string) => {
    setSelectedItems((current) => current.includes(type) ? current.filter((item) => item !== type) : current.length < 2 ? [...current, type] : current);
  };

  const saveSelection = () => {
    if (!data.currentLeague) return;
    startTransition(async () => {
      const result = await selectBattleItemsAction(data.currentLeague.id, battleSlot, selectedItems);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success(`Itens do combate ${battleSlot} reservados.`);
      refresh();
    });
  };

  const buy = (type: string) => {
    startTransition(async () => {
      try {
        const res = await buyLeagueItemAction(type);
        if (res && "error" in res) { toast.error(res.error); return; }
        toast.success("Item comprado!");
        refresh();
      } catch (err) { toast.error(`Erro: ${String(err).slice(0, 150)}`); }
    });
  };

  function ItemRow({ item }: { item: typeof LEAGUE_ITEMS[number] }) {
    const owned = getOwned(item.type);
    const canBuy = balance >= item.price;
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-slate-900/60 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-slate-200">{item.name}</p>
            {owned > 0 && (
              <span className="rounded-full bg-green-500/20 px-1.5 py-px text-[9px] font-bold text-green-400">×{owned}</span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">{item.description}</p>
        </div>
        <button
          onClick={() => buy(item.type)}
          disabled={pending || !canBuy}
          className="shrink-0 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs font-bold text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-40 transition-colors"
        >
          {item.price} ZC
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.currentLeague && (
        <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/5 p-4 space-y-3">
          <div>
            <p className="text-xs font-bold text-yellow-300">Preparar itens do combate</p>
            <p className="text-[10px] text-slate-400">Escolha ate 2. Eles ficam reservados agora e so sao consumidos quando o combate acontece.</p>
          </div>
          <div className="rounded-xl border border-border bg-slate-950/50 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Seu inventário disponível</p>
            {data.leagueInventory.length === 0 ? (
              <p className="text-[10px] text-slate-500">Você ainda não possui itens da Liga. Compre na ZikaShop, negocie no Bazar ou encontre em drops.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {data.leagueInventory.map((entry) => {
                  const item = LEAGUE_ITEMS.find((candidate) => candidate.type === entry.type);
                  return <span key={entry.type} className="rounded-full border border-green-500/25 bg-green-500/10 px-2 py-1 text-[9px] text-green-200">{item?.name ?? entry.type} ×{entry.quantity}</span>;
                })}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((slot) => <button key={slot} onClick={() => changeSlot(slot)} className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] ${battleSlot === slot ? "border-yellow-400 bg-yellow-400/15 text-yellow-200" : "border-border text-slate-400"}`}>Combate {slot}<br />{BATTLE_TIMES_BRT[slot - 1]}</button>)}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {LEAGUE_ITEMS.map((item) => {
              const owned = getOwned(item.type);
              const isSelected = selectedItems.includes(item.type);
              const available = owned + (isSelected ? 1 : 0);
              const canSelect = available > 0 && !isSelected && selectedItems.length < 2;
              return (
                <button key={item.type} onClick={() => { if (isSelected || canSelect) toggleSelected(item.type); }}
                  disabled={!isSelected && !canSelect}
                  className={`rounded-lg border p-2 text-left transition-colors ${
                    isSelected ? "border-yellow-400 bg-yellow-400/10" :
                    available > 0 ? "border-border bg-slate-900/60 hover:border-slate-600" :
                    "border-border/30 bg-slate-950/30 opacity-40"
                  }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-200">{item.name}</span>
                    {available > 0 ? (
                      <span className="rounded-full bg-green-500/20 px-1.5 py-px text-[8px] font-bold text-green-400">×{available}</span>
                    ) : (
                      <span className="text-[8px] text-slate-600">sem estoque</span>
                    )}
                  </div>
                  <p className="text-[8px] text-slate-500 mt-0.5">{item.effectType === "POSITIVE" ? "✨" : "💀"} {item.description.slice(0, 60)}...</p>
                  {isSelected && <p className="text-[8px] text-yellow-300 mt-0.5 font-semibold">✓ Selecionado para este combate</p>}
                </button>
              );
            })}
          </div>
          <button onClick={saveSelection} disabled={pending} className="w-full rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">Salvar itens ({selectedItems.length}/2)</button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Itens consumíveis por combate (até 2 por combate).</p>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-yellow-300">
          💰 {balance.toLocaleString()} ZC
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-green-300">✨ Itens Positivos (próprio time)</h3>
        {positive.map(item => <ItemRow key={item.type} item={item} />)}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-red-300">💀 Itens Negativos (adversário)</h3>
        {negative.map(item => <ItemRow key={item.type} item={item} />)}
      </div>
    </div>
  );
}

// ── Admin ──────────────────────────────────────────────────────────────────

function AdminTab({ data, refresh }: { data: PageData; refresh: () => void }) {
  const [pending, startTransition] = useTransition();
  const [modId, setModId] = useState(WEEKLY_MODIFIERS[0].id);

  const [lastResult, setLastResult] = useState<string | null>(null);
  const [resimSlots, setResimSlots] = useState<Set<number>>(new Set());

  const createLeague = () => {
    setLastResult("Processando...");
    startTransition(async () => {
      try {
        const res = await startWeeklyLeagueNowAction();
        if (res && "error" in res) {
          setLastResult(`Erro: ${res.error}`);
          toast.error(res.error);
          return;
        }
        const msg = `Liga sincronizada com ${(res as any).participants ?? 0} jogadores!`;
        setLastResult(msg);
        toast.success(msg);
        refresh();
      } catch (err) {
        const msg = `Exceção: ${String(err).slice(0, 200)}`;
        setLastResult(msg);
        toast.error(msg);
      }
    });
  };

  const setMod = () => {
    if (!data.currentLeague) { toast.error("Crie uma liga primeiro"); return; }
    startTransition(async () => {
      try {
        const res = await setModifierAction(data.currentLeague.id, modId);
        if (res && "error" in res) { toast.error(res.error); return; }
        toast.success("Modificador definido!");
        refresh();
      } catch (err) { toast.error(`Exceção: ${String(err).slice(0, 150)}`); }
    });
  };

  const simRound = (slot: number) => {
    if (!data.currentLeague) { toast.error("Crie uma liga primeiro"); return; }
    startTransition(async () => {
      try {
        const res = await simulateRoundAction(data.currentLeague.id, slot);
        if (res && "error" in res) { toast.error(res.error); return; }
        toast.success(`Rodada slot ${slot} simulada!`);
        refresh();
      } catch (err) { toast.error(`Exceção: ${String(err).slice(0, 150)}`); }
    });
  };

  const seedItems = () => {
    startTransition(async () => {
      try {
        const res = await seedLeagueItemsAction();
        if (res && "error" in res) { toast.error(res.error); return; }
        toast.success(`${(res as any).created ?? 0} itens criados!`);
      } catch (err) { toast.error(`Exceção: ${String(err).slice(0, 150)}`); }
    });
  };

  const finalizeLeague = () => {
    if (!data.currentLeague || !confirm("Encerrar a liga e distribuir todas as recompensas agora?")) return;
    startTransition(async () => {
      try {
        const res = await finalizeLeagueAction(data.currentLeague.id);
        if ("error" in res) { toast.error(res.error); return; }
        toast.success(`Liga encerrada. ${(res as any).granted} jogadores premiados.`);
        refresh();
      } catch (err) { toast.error(`Exceção: ${String(err).slice(0, 150)}`); }
    });
  };

  const cancelLeague = () => {
    if (!data.currentLeague || !confirm("Cancelar a liga atual? Todos os dados (partidas, times, itens) serão removidos. A liga ficará com status CANCELLED.")) return;
    startTransition(async () => {
      try {
        const res = await cancelLeagueAction(data.currentLeague.id);
        if (res && "error" in res) { toast.error(res.error); return; }
        toast.success("Liga cancelada.");
        refresh();
      } catch (err) { toast.error(`Exceção: ${String(err).slice(0, 150)}`); }
    });
  };

  const genMatchups = (force = false) => {
    if (!data.currentLeague) { toast.error("Crie uma liga primeiro"); return; }
    if (force && !confirm("Refazer a chave do dia? Matchups atuais serão deletados e BYEs revertidos.")) return;
    startTransition(async () => {
      try {
        const res = await generateDailyMatchupsAction(data.currentLeague.id, force);
        if (res && "error" in res) { toast.error(res.error); return; }
        toast.success(`${(res as any).matchups ?? 0} confrontos gerados para hoje!`);
        refresh();
      } catch (err) { toast.error(`Exceção: ${String(err).slice(0, 150)}`); }
    });
  };

  const purgeAdmins = () => {
    if (!data.currentLeague) return;
    startTransition(async () => {
      try {
        const res = await purgeAdminsFromLeagueAction(data.currentLeague.id);
        if (res && "error" in res) { toast.error(res.error); return; }
        toast.success(`${(res as any).removed ?? 0} admin(s) removido(s) do torneio.`);
        refresh();
      } catch (err) { toast.error(`Exceção: ${String(err).slice(0, 150)}`); }
    });
  };

  const deleteLeague = () => {
    if (!data.currentLeague || !confirm("EXCLUIR completamente a liga? Isso remove TUDO (liga, participantes, partidas, times). Essa ação não pode ser desfeita.")) return;
    startTransition(async () => {
      try {
        const res = await deleteLeagueAction(data.currentLeague.id);
        if (res && "error" in res) { toast.error(res.error); return; }
        toast.success("Liga excluída completamente.");
        refresh();
      } catch (err) { toast.error(`Exceção: ${String(err).slice(0, 150)}`); }
    });
  };

  return (
    <div className="space-y-6">
      {data.currentLeague && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
          <p className="text-xs font-bold text-yellow-300">Encerramento e premios</p>
          <p className="text-[10px] text-slate-400">Fecha a semana uma unica vez, define a classificacao e envia ovos, caixas e ZikaCoins. Participantes sem combate valido nao recebem premio.</p>
          <button onClick={finalizeLeague} disabled={pending || data.currentLeague.status === "FINISHED"} className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-bold text-yellow-300 disabled:opacity-40">
            Encerrar e distribuir recompensas
          </button>
        </div>
      )}

      {/* Purge admins */}
      {data.currentLeague && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
          <p className="text-xs font-bold text-orange-300">Remover Admins do Torneio</p>
          <p className="text-[10px] text-slate-400">Remove todas as contas admin do chaveamento, partidas e ranking da liga atual.</p>
          <button onClick={purgeAdmins} disabled={pending} className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs font-bold text-orange-300 hover:bg-orange-500/20 disabled:opacity-40 transition-colors">
            Remover Admins
          </button>
        </div>
      )}

      {/* Full league reset */}
      {data.currentLeague && (
        <div className="rounded-xl border border-red-600/30 bg-red-600/5 p-4 space-y-3">
          <p className="text-xs font-bold text-red-300">⚡ Zerar Tabela e Resimular Tudo</p>
          <p className="text-[10px] text-slate-400">Zera TODOS os pontos/vitórias/derrotas, remove inativos, gera nova chave diversificada e simula os 3 rounds com as equipes registradas.</p>
          <button
            onClick={() => {
              if (!confirm("ATENÇÃO: Isso vai zerar TODA a tabela e resimular os 3 rounds do zero. Continuar?")) return;
              startTransition(async () => {
                try {
                  const res = await fullLeagueResetAction(data.currentLeague.id);
                  if (res && "error" in res) { toast.error(res.error); return; }
                  toast.success(`Reset completo! ${(res as any).matchups ?? 0} confrontos, 3 rounds simulados.`);
                  refresh();
                } catch (err) { toast.error(`Erro: ${String(err).slice(0, 150)}`); }
              });
            }}
            disabled={pending}
            className="rounded-xl border border-red-600/30 bg-red-600/10 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-600/20 disabled:opacity-40 transition-colors"
          >
            {pending ? "Processando..." : "Zerar e Resimular Tudo"}
          </button>
        </div>
      )}

      {/* Purge inactive players */}
      {data.currentLeague && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
          <p className="text-xs font-bold text-orange-300">Limpar Jogadores Inativos</p>
          <p className="text-[10px] text-slate-400">Remove jogadores deletados, suspensos ou inativos da liga atual (partidas, times, stats).</p>
          <button
            onClick={() => {
              startTransition(async () => {
                try {
                  const res = await purgeInactivePlayersAction(data.currentLeague.id);
                  if (res && "error" in res) { toast.error(res.error); return; }
                  toast.success(`${(res as any).removed ?? 0} jogador(es) inativo(s) removido(s).`);
                  refresh();
                } catch (err) { toast.error(`Erro: ${String(err).slice(0, 150)}`); }
              });
            }}
            disabled={pending}
            className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs font-bold text-orange-300 hover:bg-orange-500/20 disabled:opacity-40 transition-colors"
          >
            Limpar Jogadores Inativos
          </button>
        </div>
      )}

      {/* Reset and re-simulate slots */}
      {data.currentLeague && (
        <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-4 space-y-3">
          <p className="text-xs font-bold text-pink-300">Resetar e Resimular Rodadas</p>
          <p className="text-[10px] text-slate-400">Reverte stats, deleta partidas dos slots selecionados e re-simula os combates.</p>
          <div className="flex gap-2">
            {[1, 2, 3].map(slot => (
              <label key={slot} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resimSlots.has(slot)}
                  onChange={() => setResimSlots(prev => {
                    const next = new Set(prev);
                    if (next.has(slot)) next.delete(slot);
                    else next.add(slot);
                    return next;
                  })}
                  className="rounded border-slate-600"
                />
                <span className="text-[10px] text-slate-300">Slot {slot} ({BATTLE_TIMES_BRT[slot - 1]})</span>
              </label>
            ))}
          </div>
          <button
            onClick={() => {
              if (resimSlots.size === 0) { toast.error("Selecione pelo menos 1 slot."); return; }
              if (!confirm(`Resetar e resimular slots ${[...resimSlots].join(", ")}? Stats serao revertidos e novos combates simulados.`)) return;
              startTransition(async () => {
                try {
                  const res = await resetAndResimulateAction(data.currentLeague.id, [...resimSlots]);
                  if (res && "error" in res) { toast.error(res.error); return; }
                  toast.success("Slots resimulados com sucesso!");
                  setResimSlots(new Set());
                  refresh();
                } catch (err) { toast.error(`Erro: ${String(err).slice(0, 150)}`); }
              });
            }}
            disabled={pending || resimSlots.size === 0}
            className="rounded-xl border border-pink-500/30 bg-pink-500/10 px-4 py-2 text-xs font-bold text-pink-300 hover:bg-pink-500/20 disabled:opacity-40 transition-colors"
          >
            Resetar e Resimular ({resimSlots.size} slot{resimSlots.size !== 1 ? "s" : ""})
          </button>
        </div>
      )}

      {/* Cancel / Delete league */}
      {data.currentLeague && data.currentLeague.status !== "FINISHED" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-3">
          <p className="text-xs font-bold text-red-300">Cancelar / Excluir Liga</p>
          <p className="text-[10px] text-slate-400">Cancelar mantém o registro mas remove dados. Excluir apaga tudo permanentemente.</p>
          <div className="flex gap-2">
            <button onClick={cancelLeague} disabled={pending} className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-40 transition-colors">
              Cancelar Liga
            </button>
            <button onClick={deleteLeague} disabled={pending} className="flex-1 rounded-xl border border-red-700/30 bg-red-700/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-700/20 disabled:opacity-40 transition-colors">
              Excluir Completamente
            </button>
          </div>
        </div>
      )}
      {/* Toggle bets */}
      {data.currentLeague && (() => {
        const betsOn = (data.currentLeague.modifierJson as any)?.betsEnabled !== false;
        return (
          <div className="rounded-xl border border-slate-600/30 bg-slate-800/30 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Apostas da Liga no ZikaBet</p>
              <p className="text-[10px] text-slate-500">{betsOn ? "Jogadores podem apostar nos combates da liga." : "Apostas desabilitadas. Combates não aparecem no ZikaBet."}</p>
            </div>
            <button
              onClick={() => {
                startTransition(async () => {
                  try {
                    const res = await toggleLeagueBetsAction(data.currentLeague.id, !betsOn);
                    if (res && "error" in res) { toast.error(res.error); return; }
                    toast.success(betsOn ? "Apostas desabilitadas. Todas as apostas abertas foram reembolsadas." : "Apostas habilitadas!");
                    refresh();
                  } catch (err) { toast.error(`Erro: ${String(err).slice(0, 100)}`); }
                });
              }}
              disabled={pending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${betsOn ? "bg-green-500" : "bg-slate-600"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${betsOn ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        );
      })()}

      {/* Create league */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
        <p className="text-xs font-bold text-blue-300">Contingência do cron</p>
        <p className="text-[10px] text-slate-400">Cria ou completa a semana, inscreve todos os jogadores ativos, sorteia o modificador do dia e ativa a Liga.</p>
        <button onClick={createLeague} disabled={pending || data.currentLeague?.status === "FINISHED"} className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-300 hover:bg-blue-500/20 disabled:opacity-40 transition-colors">
          {pending ? "Processando..." : data.currentLeague ? "Sincronizar Liga Automática Agora" : "Iniciar Liga Automática Agora"}
        </button>
        {lastResult && (
          <p className={`text-[10px] mt-1 ${lastResult.startsWith("Erro") || lastResult.startsWith("Exceção") ? "text-red-400" : "text-green-400"}`}>
            {lastResult}
          </p>
        )}
      </div>

      {/* Set modifier */}
      <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
        <p className="text-xs font-bold text-purple-300">Definir Modificador Semanal</p>
        <select value={modId} onChange={(e) => setModId(e.target.value)} className="w-full rounded-lg border border-border bg-slate-800 px-3 py-2 text-xs text-slate-200">
          {WEEKLY_MODIFIERS.map(m => (
            <option key={m.id} value={m.id}>{m.name} — {m.description.slice(0, 60)}...</option>
          ))}
        </select>
        <button onClick={setMod} disabled={pending} className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/20 disabled:opacity-40 transition-colors">
          Definir Modificador
        </button>
      </div>

      {/* Generate matchups */}
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 space-y-3">
        <p className="text-xs font-bold text-cyan-300">Gerar Confrontos do Dia</p>
        <p className="text-[10px] text-slate-400">Gera os 3 rounds do dia com odds automáticas. Os jogadores poderão ver os confrontos antes dos combates.</p>
        <div className="flex gap-2">
          <button onClick={() => genMatchups(false)} disabled={pending} className="flex-1 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-40 transition-colors">
            Gerar Matchups + Odds
          </button>
          <button onClick={() => genMatchups(true)} disabled={pending} className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs font-bold text-orange-300 hover:bg-orange-500/20 disabled:opacity-40 transition-colors">
            Refazer Chave
          </button>
        </div>
      </div>

      {/* Regenerate replays only */}
      {data.currentLeague && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
          <p className="text-xs font-bold text-indigo-300">Regenerar Replays</p>
          <p className="text-[10px] text-slate-400">Resimula os combates de hoje apenas para atualizar as animações de replay. Ranking e resultados não são alterados.</p>
          <button
            onClick={() => {
              startTransition(async () => {
                try {
                  const res = await regenerateReplaysAction(data.currentLeague.id);
                  if (res && "error" in res) { toast.error(res.error); return; }
                  toast.success(`${(res as any).updated ?? 0} replay(s) regenerado(s)!`);
                  refresh();
                } catch (err) { toast.error(`Erro: ${String(err).slice(0, 150)}`); }
              });
            }}
            disabled={pending}
            className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-40 transition-colors"
          >
            {pending ? "Regenerando..." : "Regenerar Replays (sem alterar ranking)"}
          </button>
        </div>
      )}

      {/* Simulate round */}
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
        <p className="text-xs font-bold text-green-300">Simular Rodada</p>
        <p className="text-[10px] text-slate-400">Roda uma rodada de combates para o slot selecionado. Todos os participantes jogam.</p>
        <div className="flex gap-2">
          {[1, 2, 3].map(slot => (
            <button key={slot} onClick={() => simRound(slot)} disabled={pending} className="flex-1 rounded-xl border border-green-500/30 bg-green-500/10 py-2 text-xs font-bold text-green-300 hover:bg-green-500/20 disabled:opacity-40 transition-colors">
              Slot {slot} ({BATTLE_TIMES_BRT[slot - 1]})
            </button>
          ))}
        </div>
      </div>

      {/* Seed items */}
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
        <p className="text-xs font-bold text-yellow-300">Seed — Itens da Liga (desabilitados)</p>
        <button onClick={seedItems} disabled={pending} className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs font-bold text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-40 transition-colors">
          Criar Itens
        </button>
      </div>

      {/* Modifiers catalog */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 space-y-2">
        <p className="text-xs font-bold text-slate-300">Catálogo de Modificadores ({WEEKLY_MODIFIERS.length})</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {WEEKLY_MODIFIERS.map(m => (
            <div key={m.id} className="text-[10px]">
              <span className="font-semibold text-slate-300">{m.name}</span>
              <span className="ml-1 text-slate-500">— {m.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
