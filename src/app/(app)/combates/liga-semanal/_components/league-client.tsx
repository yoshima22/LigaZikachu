"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { WEEKLY_MODIFIERS, LEAGUE_ITEMS, POINTS, BATTLE_TIMES_BRT } from "../constants";
import { COMBAT_ROLE_OPTIONS, getCombatRoleLabel } from "@/lib/combat-roles";
import { getPokemonName, getPokemonTypes, getStaticSpriteUrl } from "@/lib/mascot-data";
import {
  startWeeklyLeagueNowAction,
  joinLeagueAction,
  setModifierAction,
  simulateRoundAction,
  seedLeagueItemsAction,
  saveDailyTeamAction,
  buyLeagueItemAction,
  finalizeLeagueAction,
  selectBattleItemsAction,
  cancelLeagueAction,
  deleteLeagueAction,
} from "../actions";

type Tab = "liga" | "times" | "resultados" | "colinha" | "itens" | "admin";

type PageData = {
  player: { id: string; displayName: string; walletBalance: number; isAdmin: boolean };
  currentLeague: any;
  participants: any[];
  myTeams: any[];
  todayMatches: any[];
  availableMascots: any[];
  leagueInventory: { type: string; quantity: number }[];
  selectedBattleItems: { battleSlot: number; effectType: string }[];
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

function LeagueTab({ data }: { data: PageData }) {
  const league = data.currentLeague;

  if (!league) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        Nenhuma liga ativa nesta semana. A próxima liga será criada automaticamente.
      </div>
    );
  }

  const mod = league.modifierJson as any;

  return (
    <div className="space-y-4">
      {/* League status */}
      <div className="rounded-2xl border border-border bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-100">Liga Semanal — {league.weekKey}</h2>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            league.status === "ACTIVE" ? "bg-green-500/20 text-green-300" :
            league.status === "REGISTRATION" ? "bg-yellow-500/20 text-yellow-300" :
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
        </div>
      </div>

      {/* Standings */}
      <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
        <h3 className="text-xs font-bold text-slate-300 mb-2">Classificação</h3>
        {data.participants.length === 0 ? (
          <p className="text-[11px] text-slate-500">Nenhum participante ainda.</p>
        ) : (
          <div className="space-y-1">
            {data.participants.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`w-5 text-center text-[10px] font-bold ${i < 3 ? "text-yellow-300" : "text-slate-500"}`}>{i + 1}°</span>
                  <span className="text-xs text-slate-200">{p.playerName ?? "Jogador"}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span>{p.points}pts</span>
                  <span>{p.wins}V {p.losses}D {p.draws}E</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
    setEditingSlot(slot);
    setSelected(existing ? (existing.mascotIdsJson as string[] ?? []) : []);
    setRoles(existing?.rolesJson ? (existing.rolesJson as Record<string, string>) : {});
    setSearch("");
    setTypeFilter(null);
    setPage(0);
  };

  const toggleMascot = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 6 ? [...prev, id] : prev);
  };

  const saveTeam = () => {
    if (!data.currentLeague || !editingSlot) return;
    startTransition(async () => {
      try {
        const res = await saveDailyTeamAction(data.currentLeague.id, editingSlot, selected, roles);
        if (res && "error" in res) { toast.error(res.error); return; }
        toast.success(`Time ${editingSlot} salvo!`);
        setEditingSlot(null);
        refresh();
      } catch (err) { toast.error(`Erro: ${String(err).slice(0, 150)}`); }
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
            return (
              <div key={i} className={`relative rounded-xl border p-2 flex flex-col items-center gap-0.5 min-h-[100px] ${m ? "bg-[#FFCB05]/10 border-[#FFCB05]/30" : "border-dashed border-slate-700"}`}>
                <span className="absolute top-1 left-1.5 text-[9px] text-slate-600 font-mono">{i + 1}</span>
                {m ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-9 w-9 object-contain" style={{ imageRendering: "pixelated" }} />
                    <p className="text-[8px] text-slate-300 truncate w-full text-center">{m.nickname ?? getPokemonName(m.pokemonId)}</p>
                    <p className="text-[8px] text-slate-500">Nv.{m.level}</p>
                    <select
                      value={roles[m.id] ?? "ATTACKER"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setRoles(prev => ({ ...prev, [m.id]: e.target.value }))}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-0.5 py-0.5 text-[7px] font-semibold text-yellow-300 outline-none"
                    >
                      {COMBAT_ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <button onClick={() => toggleMascot(m.id)} className="absolute top-0.5 right-0.5 rounded-full p-0.5 text-slate-600 hover:text-red-400 text-[10px]">✕</button>
                  </>
                ) : (
                  <span className="text-[10px] text-slate-700 mt-8">vazio</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Search + filter */}
        <div className="space-y-2">
          <div className="relative">
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Buscar mascote por nome..."
              className="w-full rounded-lg border border-border bg-slate-900 pl-3 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600" />
          </div>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => { setTypeFilter(null); setPage(0); }} className={`rounded-full px-2 py-0.5 text-[9px] font-semibold transition-colors ${!typeFilter ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-500 hover:text-slate-300"}`}>Todos</button>
            {ALL_TYPES.map(t => (
              <button key={t} onClick={() => { setTypeFilter(typeFilter === t ? null : t); setPage(0); }} className={`rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize transition-colors ${typeFilter === t ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-500 hover:text-slate-300"}`}>{t}</button>
            ))}
          </div>
        </div>

        {/* Mascot grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {paginated.map((m: any) => {
            const isSelected = selected.includes(m.id);
            const types = getPokemonTypes(m.pokemonId);
            return (
              <button key={m.id} onClick={() => toggleMascot(m.id)} className={`flex items-start gap-2 rounded-xl border p-2 text-left transition-colors ${
                isSelected ? "border-yellow-500/50 bg-yellow-500/10" : "border-border bg-slate-900/60 hover:border-slate-600"
              } ${!isSelected && selected.length >= 6 ? "opacity-30 pointer-events-none" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-10 w-10 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-200 truncate">{m.nickname ?? getPokemonName(m.pokemonId)}</p>
                  <p className="text-[9px] text-slate-500">Nv.{m.level}</p>
                  <div className="flex gap-0.5 mt-0.5">
                    {types.map(t => (
                      <span key={t} className={`rounded-full px-1.5 py-px text-[7px] font-bold text-white capitalize ${TYPE_COLORS[t] ?? "bg-slate-600"}`}>{t}</span>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-5 gap-px text-[7px]">
                    <span className="text-red-400" title="Força">F{m.statForce}</span>
                    <span className="text-blue-400" title="Agilidade">A{m.statAgility}</span>
                    <span className="text-purple-400" title="Instinto">I{m.statInstinct}</span>
                    <span className="text-green-400" title="Vitalidade">V{m.statVitality}</span>
                    <span className="text-pink-400" title="Carisma">C{m.statCharisma}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && <p className="text-xs text-slate-500 text-center py-3">Nenhum mascote encontrado.</p>}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-border bg-slate-800 px-3 py-1 text-[10px] text-slate-300 disabled:opacity-30">← Anterior</button>
            <span className="text-[10px] text-slate-500">{page + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-border bg-slate-800 px-3 py-1 text-[10px] text-slate-300 disabled:opacity-30">Próxima →</button>
          </div>
        )}

        <button onClick={saveTeam} disabled={pending || selected.length !== 6} className="w-full rounded-xl bg-yellow-500/20 border border-yellow-500/30 py-2.5 text-sm font-bold text-yellow-300 hover:bg-yellow-500/30 disabled:opacity-40 transition-colors">
          {pending ? "Salvando..." : `Salvar Time ${editingSlot} (${selected.length}/6)`}
        </button>
      </div>
    );
  }

  // ── Overview mode ────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Monte até 3 times por dia (6 mascotes cada, sem repetição entre times).</p>

      {[1, 2, 3].map(slot => {
        const team = data.myTeams.find((t: any) => t.battleSlot === slot);
        const mascotIds = team ? (team.mascotIdsJson as string[] ?? []) : [];
        const teamRoles = team?.rolesJson as Record<string, string> | undefined;
        return (
          <div key={slot} className="rounded-2xl border border-border bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300">Time {slot} — Combate {BATTLE_TIMES_BRT[slot - 1]}</h3>
              <div className="flex items-center gap-2">
                {team ? <span className="text-[10px] text-green-400">✓ Montado</span> : <span className="text-[10px] text-orange-400">Não montado</span>}
                <button onClick={() => startEditing(slot)} className="rounded-lg border border-border bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:text-yellow-300 transition-colors">
                  {team ? "Editar" : "Montar"}
                </button>
              </div>
            </div>
            {team && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {mascotIds.map((id: string, i: number) => {
                  const m = data.availableMascots.find((x: any) => x.id === id) as any;
                  if (!m) return <div key={id} className="rounded-xl border border-dashed border-slate-700 p-2 min-h-[80px] flex items-center justify-center text-[9px] text-slate-600">?</div>;
                  const types = getPokemonTypes(m.pokemonId);
                  const role = teamRoles?.[id];
                  return (
                    <div key={id} className="relative rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-2 flex flex-col items-center gap-0.5">
                      <span className="absolute top-1 left-1.5 text-[9px] text-slate-600 font-mono">{i + 1}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-9 w-9 object-contain" style={{ imageRendering: "pixelated" }} />
                      <p className="text-[8px] text-slate-300 truncate w-full text-center">{m.nickname ?? getPokemonName(m.pokemonId)}</p>
                      <p className="text-[8px] text-slate-500">Nv.{m.level}</p>
                      <div className="flex gap-0.5">
                        {types.map(t => <span key={t} className={`rounded-full px-1 py-px text-[6px] font-bold text-white capitalize ${TYPE_COLORS[t] ?? "bg-slate-600"}`}>{t}</span>)}
                      </div>
                      {role && <p className="text-[7px] font-semibold text-yellow-400">{getCombatRoleLabel(role)}</p>}
                    </div>
                  );
                })}
              </div>
            )}
            {!team && <p className="text-[10px] text-slate-500">Clique "Montar" para selecionar mascotes. Sem time, o sistema usará auto-preenchimento.</p>}
          </div>
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

function ResultsTab({ data }: { data: PageData }) {
  if (data.todayMatches.length === 0) {
    return <div className="py-10 text-center text-sm text-slate-500">Nenhum combate hoje ainda.</div>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-slate-300">Combates de Hoje</h3>
      {data.todayMatches.map((match: any) => (
        <div key={match.id} className="rounded-xl border border-border bg-slate-900/60 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-200">Rodada {match.roundNumber} — Slot {match.battleSlot}</span>
            <span className={`text-[10px] font-bold ${
              match.status === "RESOLVED" ? "text-green-400" : "text-yellow-400"
            }`}>{match.status}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{match.playerAId?.slice(0, 8)}...</span>
            <span className="font-bold text-slate-300">vs</span>
            <span>{match.playerBId?.slice(0, 8) ?? "BYE"}...</span>
          </div>
          {match.status === "RESOLVED" && (
            <div className="text-[10px] text-slate-500">
              {match.isDraw ? "Empate" : `Vencedor: ${match.winnerId?.slice(0, 8)}...`}
              {" · "}Sobr: {match.playerASurvivors} vs {match.playerBSurvivors}
              {" · "}Dano: {match.playerADamageDealt} vs {match.playerBDamageDealt}
            </div>
          )}
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
            {LEAGUE_ITEMS.filter((item) => getOwned(item.type) > 0 || selectedItems.includes(item.type)).map((item) => (
              <button key={item.type} onClick={() => toggleSelected(item.type)} className={`rounded-lg border p-2 text-left ${selectedItems.includes(item.type) ? "border-yellow-400 bg-yellow-400/10" : "border-border bg-slate-900/60"}`}>
                <span className="text-[10px] font-semibold text-slate-200">{item.name}</span>
                <span className="ml-2 text-[9px] text-slate-500">x{getOwned(item.type) + (selectedItems.includes(item.type) ? 1 : 0)}</span>
              </button>
            ))}
          </div>
          {data.leagueInventory.length === 0 && selectedItems.length === 0 && <p className="text-center text-[10px] text-slate-500">Nenhum item disponível para selecionar.</p>}
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
