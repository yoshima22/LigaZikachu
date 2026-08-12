"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Search, Unlock, X, CheckCircle2, Clock } from "lucide-react";
import { COMBAT_ROLE_OPTIONS, getCombatRoleLabel, normalizeCombatRole } from "@/lib/combat-roles";
import { getStaticSpriteUrl, getPokemonName } from "@/lib/mascot-data";
import { addLineupMascotAction, lockLineupAction, removeLineupMascotAction, adminClearLineupAction, setLineupCombatRoleAction } from "../lineup-actions";
import { CombatRoleHelpButton } from "@/components/combat-role-help";

interface LineupEntry {
  id: string;
  mascotId: string;
  slot: number;
  combatRole?: string | null;
  mascot: PlayerMascot;
}

interface PlayerMascot {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  statForce: number;
  statAgility: number;
  statCharisma: number;
  statInstinct: number;
  statVitality: number;
  megaEvolvedAt?: Date | string | null;
  megaEvolvedFromPokemonId?: number | null;
}

interface Props {
  teamId: string;
  playerId: string;
  partnerName: string;
  myLineup: LineupEntry[];
  partnerLineup: LineupEntry[];
  myLocked: boolean;
  partnerLocked: boolean;
  myMascots: PlayerMascot[];
  isAdmin: boolean;
  partnerPlayerId: string;
}

const SLOTS = 9;

export function SyncLineupPanel({
  teamId, playerId, partnerName,
  myLineup, partnerLineup,
  myLocked, partnerLocked,
  myMascots, isAdmin, partnerPlayerId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const inLineup = new Set(myLineup.map((l) => l.mascotId));
  const available = myMascots.filter(
    (m) => !inLineup.has(m.id) &&
      (m.nickname ?? getPokemonName(m.pokemonId)).toLowerCase().includes(search.toLowerCase())
  );
  const sorted = [...myLineup].sort((a, b) => a.slot - b.slot);
  const megaCount = sorted.filter((entry) => Boolean(entry.mascot.megaEvolvedAt || entry.mascot.megaEvolvedFromPokemonId)).length;
  const megaLimitValid = megaCount <= 3;
  const myTeamStats = sorted.map((entry) => ({
    ...entry.mascot,
    name: entry.mascot.nickname ?? getPokemonName(entry.mascot.pokemonId),
  }));
  const partnerTeamStats = partnerLineup.map((entry) => ({
    ...entry.mascot,
    name: entry.mascot.nickname ?? getPokemonName(entry.mascot.pokemonId),
  }));

  const act = (fn: () => Promise<{ error?: string }>) => {
    startTransition(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else router.refresh();
    });
  };

  const slotColor = (n: number) =>
    n <= myLineup.length ? "bg-[#FFCB05]/10 border-[#FFCB05]/30" : "border-dashed border-slate-700 bg-transparent";

  return (
    <div className="space-y-6">
      {/* Status da dupla */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <StatusCard name="Você" locked={myLocked} count={myLineup.length} />
        <StatusCard name={partnerName} locked={partnerLocked} count={partnerLineup.length} />
      </div>

      {myLocked && partnerLocked && (
        <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm font-semibold text-green-400">
          <CheckCircle2 size={16} /> Escalação completa! A dupla está pronta para o evento.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Minha escalação */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-200 text-sm">
              Minha escalação <span className="text-slate-500 font-normal">({myLineup.length}/{SLOTS})</span>
            </h3>
            {!myLocked && myLineup.length === SLOTS && (
              <button
                type="button"
                disabled={pending || !megaLimitValid}
                onClick={() => act(lockLineupAction)}
                className="flex items-center gap-1.5 rounded-lg bg-[#FFCB05] px-3 py-1.5 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
              >
                <Lock size={11} /> Travar escalação
              </button>
            )}
            {myLocked && (
              <span className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-400">
                <CheckCircle2 size={10} /> Travada
              </span>
            )}
          </div>

          <div className={`rounded-lg border px-3 py-2 text-[10px] ${megaLimitValid ? "border-cyan-500/20 bg-cyan-500/5 text-cyan-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
            Divisão Limitada: {megaCount}/3 megas entre os 9 enviados. Em cada partida, você poderá escolher no máximo 1 mega.
            {!megaLimitValid && " Remova uma mega para liberar o lock."}
          </div>

          {/* Grade de slots */}
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: SLOTS }, (_, i) => {
              const entry = sorted[i];
              return (
                <div
                  key={i}
                  className={`relative rounded-xl border p-2 flex flex-col items-center gap-1 min-h-[138px] ${slotColor(i + 1)}`}
                >
                  <span className="absolute top-1 left-1.5 text-[9px] text-slate-600 font-mono">{i + 1}</span>
                  {entry ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getStaticSpriteUrl(entry.mascot.pokemonId)}
                        alt=""
                        className="h-10 w-10 object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <p className="text-[9px] text-slate-300 text-center leading-tight truncate w-full text-center">
                        {entry.mascot.nickname ?? getPokemonName(entry.mascot.pokemonId)}
                      </p>
                      <p className="text-[9px] text-slate-500">Nv.{entry.mascot.level}</p>
                      <MascotStats mascot={entry.mascot} />
                      <div className="mt-0.5 flex w-full items-center gap-1">
                        <select
                          value={normalizeCombatRole(entry.combatRole)}
                          disabled={pending}
                          onChange={(event) => act(() => setLineupCombatRoleAction(entry.mascotId, event.target.value))}
                          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[8px] font-semibold text-slate-300 outline-none hover:border-[#FFCB05]/50 disabled:opacity-50"
                          title={myLocked ? "Escalacao travada: voce ainda pode ajustar a postura." : "Postura de combate"}
                        >
                          {COMBAT_ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                        <CombatRoleHelpButton
                          role={entry.combatRole}
                          stats={{ ...entry.mascot, name: entry.mascot.nickname ?? getPokemonName(entry.mascot.pokemonId) }}
                          teamStats={myTeamStats}
                          mode="SYNC"
                          className="h-5 w-5"
                        />
                      </div>
                      {!myLocked && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => act(() => removeLineupMascotAction(entry.mascotId))}
                          className="absolute top-0.5 right-0.5 rounded-full p-0.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-700 mt-12">vazio</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Seletor de mascotes */}
          {!myLocked && myLineup.length < SLOTS && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar mascote..."
                  className="w-full rounded-lg border border-border bg-slate-900 pl-7 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                {available.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-3">Nenhum mascote disponível.</p>
                ) : available.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={pending}
                    onClick={() => act(() => addLineupMascotAction(m.id))}
                    className="w-full flex items-center gap-2 rounded-lg border border-border bg-slate-900/60 px-2.5 py-1.5 text-left hover:border-[#FFCB05]/40 hover:bg-[#FFCB05]/5 transition-colors disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-7 w-7 object-contain shrink-0" style={{ imageRendering: "pixelated" }} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-slate-200">{m.nickname ?? getPokemonName(m.pokemonId)}</span>
                        <span className="shrink-0 text-[10px] text-slate-500">Nv.{m.level}</span>
                      </span>
                      <MascotStats mascot={m} className="mt-1" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Admin: limpar escalação */}
          {isAdmin && myLineup.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => { if (confirm("Limpar escalação e destravar?")) act(() => adminClearLineupAction(teamId, playerId)); }}
              className="text-[10px] text-red-500/60 hover:text-red-400 transition-colors"
            >
              Admin: limpar minha escalação
            </button>
          )}
        </div>

        {/* Escalação do parceiro */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-200 text-sm">
              {partnerName} <span className="text-slate-500 font-normal">({partnerLineup.length}/{SLOTS})</span>
            </h3>
            {partnerLocked ? (
              <span className="flex items-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-400">
                <CheckCircle2 size={10} /> Travada
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-500">
                <Clock size={10} /> Pendente
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: SLOTS }, (_, i) => {
              const entry = [...partnerLineup].sort((a, b) => a.slot - b.slot)[i];
              return (
                <div
                  key={i}
                  className={`relative rounded-xl border p-2 flex flex-col items-center gap-1 min-h-[138px] ${entry ? "bg-slate-800/40 border-slate-700" : "border-dashed border-slate-800 bg-transparent"}`}
                >
                  <span className="absolute top-1 left-1.5 text-[9px] text-slate-700 font-mono">{i + 1}</span>
                  {entry ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getStaticSpriteUrl(entry.mascot.pokemonId)}
                        alt=""
                        className="h-10 w-10 object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <p className="text-[9px] text-slate-400 text-center leading-tight truncate w-full text-center">
                        {entry.mascot.nickname ?? getPokemonName(entry.mascot.pokemonId)}
                      </p>
                      <p className="text-[9px] text-slate-600">Nv.{entry.mascot.level}</p>
                      <MascotStats mascot={entry.mascot} />
                      <div className="flex w-full items-center justify-center gap-1">
                        <p className="text-[8px] font-semibold text-slate-500">{getCombatRoleLabel(entry.combatRole)}</p>
                        <CombatRoleHelpButton
                          role={entry.combatRole}
                          stats={{ ...entry.mascot, name: entry.mascot.nickname ?? getPokemonName(entry.mascot.pokemonId) }}
                          teamStats={partnerTeamStats}
                          mode="SYNC"
                          className="h-5 w-5"
                        />
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => act(() => adminClearLineupAction(teamId, partnerPlayerId))}
                          className="absolute top-0.5 right-0.5 rounded-full p-0.5 text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Admin: limpar escalação do parceiro"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-slate-800 mt-12">—</span>
                  )}
                </div>
              );
            })}
          </div>
          {isAdmin && partnerLineup.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => { if (confirm(`Limpar escalação de ${partnerName} e destravar?`)) act(() => adminClearLineupAction(teamId, partnerPlayerId)); }}
              className="text-[10px] text-red-500/60 hover:text-red-400 transition-colors"
            >
              Admin: limpar escalação do parceiro
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/60 bg-slate-950/60 p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#FFCB05]">Colinha das posturas</p>
        <p className="mt-1 text-[9px] text-slate-500">Abra o “?” para consultar ação, prioridade e efeitos. Nos cards selecionados, os valores usam os atributos reais do mascote.</p>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {COMBAT_ROLE_OPTIONS.map((role) => (
            <div key={role.value} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-slate-200">{role.label}</p>
                <CombatRoleHelpButton role={role.value} mode="SYNC" className="h-5 w-5" />
              </div>
              <p className="mt-0.5 text-[9px] leading-snug text-slate-500">{role.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MascotStats({ mascot, className = "" }: { mascot: PlayerMascot; className?: string }) {
  const stats = [
    ["FOR", mascot.statForce],
    ["AGI", mascot.statAgility],
    ["CAR", mascot.statCharisma],
    ["INS", mascot.statInstinct],
    ["VIT", mascot.statVitality],
  ] as const;

  return (
    <div className={`grid w-full grid-cols-5 gap-0.5 ${className}`}>
      {stats.map(([label, value]) => (
        <span key={label} className="rounded bg-slate-950/70 px-0.5 py-1 text-center text-[7px] leading-none text-slate-500">
          {label}<strong className="mt-0.5 block text-[8px] text-slate-300">{value}</strong>
        </span>
      ))}
    </div>
  );
}

function StatusCard({ name, locked, count }: { name: string; locked: boolean; count: number }) {
  return (
    <div className={`rounded-xl border p-3 ${locked ? "border-green-500/30 bg-green-500/5" : "border-slate-700 bg-slate-900/40"}`}>
      <p className="text-[10px] text-slate-500 truncate">{name}</p>
      {locked ? (
        <p className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-green-400">
          <CheckCircle2 size={11} /> Escalação pronta
        </p>
      ) : (
        <p className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
          <Clock size={11} /> {count}/9 mascotes
        </p>
      )}
    </div>
  );
}
