"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { WEEKLY_MODIFIERS, LEAGUE_ITEMS, POINTS, BATTLE_TIMES_BRT } from "../constants";
import { COMBAT_ROLE_OPTIONS } from "@/lib/combat-roles";
import {
  createLeagueAction,
  joinLeagueAction,
  setModifierAction,
  simulateRoundAction,
  seedLeagueItemsAction,
} from "../actions";

function pokeImg(id: number) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

type Tab = "liga" | "times" | "resultados" | "colinha" | "itens" | "admin";

type PageData = {
  player: { id: string; displayName: string };
  currentLeague: any;
  participants: any[];
  myTeams: any[];
  todayMatches: any[];
  availableMascots: any[];
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

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "liga", label: "Liga Atual", emoji: "🏆" },
    { id: "times", label: "Meus Times", emoji: "👥" },
    { id: "resultados", label: "Resultados", emoji: "📊" },
    { id: "colinha", label: "Colinha", emoji: "📋" },
    { id: "itens", label: "Itens", emoji: "🎒" },
    { id: "admin", label: "Admin", emoji: "⚙️" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">🏆 Liga Semanal dos Mascotes</h1>
          <p className="text-xs text-slate-400">Modo oculto · Apenas administradores</p>
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
        {tab === "times" && <TeamsTab data={data} />}
        {tab === "resultados" && <ResultsTab data={data} />}
        {tab === "colinha" && <ColinhaTab />}
        {tab === "itens" && <ItemsTab />}
        {tab === "admin" && <AdminTab data={data} refresh={refresh} />}
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
        Nenhuma liga ativa. Use a aba Admin para criar uma nova liga.
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
                  <span className="text-xs text-slate-200">{p.playerId}</span>
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

function TeamsTab({ data }: { data: PageData }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Monte até 3 times por dia (6 mascotes cada, sem repetição entre times).</p>

      {[1, 2, 3].map(slot => {
        const team = data.myTeams.find((t: any) => t.battleSlot === slot);
        return (
          <div key={slot} className="rounded-2xl border border-border bg-slate-900/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300">Time {slot} — Combate {BATTLE_TIMES_BRT[slot - 1]}</h3>
              {team ? (
                <span className="text-[10px] text-green-400">✓ Montado</span>
              ) : (
                <span className="text-[10px] text-orange-400">Não montado</span>
              )}
            </div>
            {team ? (
              <div className="flex gap-1 flex-wrap">
                {(team.mascotIdsJson as string[] ?? []).map((id: string) => {
                  const m = data.availableMascots.find((x: any) => x.id === id);
                  return m ? (
                    <div key={id} className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1">
                      <Image src={pokeImg(m.pokemonId)} alt="" width={24} height={24} unoptimized className="pixelated" />
                      <span className="text-[10px] text-slate-300">Nv.{m.level}</span>
                    </div>
                  ) : (
                    <span key={id} className="text-[10px] text-slate-500">{id.slice(0, 6)}</span>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">Sistema usará auto-preenchimento (favoritos → coleção).</p>
            )}
          </div>
        );
      })}

      <div className="text-[10px] text-slate-500">
        <p>Mascotes disponíveis: {data.availableMascots.length}</p>
        <p>Precisar de 18 mascotes diferentes para os 3 combates.</p>
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

function ItemsTab() {
  const positive = LEAGUE_ITEMS.filter(i => i.effectType === "POSITIVE");
  const negative = LEAGUE_ITEMS.filter(i => i.effectType === "NEGATIVE");

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Itens consumíveis por combate (até 2 por combate). Preços em ZikaCoins.</p>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-green-300">✨ Itens Positivos (próprio time)</h3>
        {positive.map(item => (
          <div key={item.type} className="flex items-center justify-between rounded-xl border border-border bg-slate-900/60 px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-slate-200">{item.name}</p>
              <p className="text-[10px] text-slate-400">{item.description}</p>
            </div>
            <span className="shrink-0 ml-2 text-xs font-bold text-yellow-300">{item.price} ZC</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-red-300">💀 Itens Negativos (adversário)</h3>
        {negative.map(item => (
          <div key={item.type} className="flex items-center justify-between rounded-xl border border-border bg-slate-900/60 px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-slate-200">{item.name}</p>
              <p className="text-[10px] text-slate-400">{item.description}</p>
            </div>
            <span className="shrink-0 ml-2 text-xs font-bold text-yellow-300">{item.price} ZC</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Admin ──────────────────────────────────────────────────────────────────

function AdminTab({ data, refresh }: { data: PageData; refresh: () => void }) {
  const [pending, startTransition] = useTransition();
  const [modId, setModId] = useState(WEEKLY_MODIFIERS[0].id);

  const createLeague = () => {
    startTransition(async () => {
      const res = await createLeagueAction();
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Liga semanal criada!");
      refresh();
    });
  };

  const setMod = () => {
    if (!data.currentLeague) { toast.error("Crie uma liga primeiro"); return; }
    startTransition(async () => {
      const res = await setModifierAction(data.currentLeague.id, modId);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Modificador definido!");
      refresh();
    });
  };

  const simRound = (slot: number) => {
    if (!data.currentLeague) { toast.error("Crie uma liga primeiro"); return; }
    startTransition(async () => {
      const res = await simulateRoundAction(data.currentLeague.id, slot);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(`Rodada slot ${slot} simulada!`);
      refresh();
    });
  };

  const seedItems = () => {
    startTransition(async () => {
      const res = await seedLeagueItemsAction();
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(`${(res as any).created ?? 0} itens criados!`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Create league */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
        <p className="text-xs font-bold text-blue-300">Criar Nova Liga Semanal</p>
        <p className="text-[10px] text-slate-400">Cria uma liga para a semana atual. Inclui o admin como participante.</p>
        <button onClick={createLeague} disabled={pending || !!data.currentLeague} className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-300 hover:bg-blue-500/20 disabled:opacity-40 transition-colors">
          {data.currentLeague ? "Liga já existe" : "Criar Liga"}
        </button>
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
