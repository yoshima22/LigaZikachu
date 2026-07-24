"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { COMBAT_ROLE_OPTIONS, getCombatRoleLabel, recommendCombatRole, type CombatRole } from "@/lib/combat-roles";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import { attackOrderRaidBossAction } from "../actions";
import { CombatRoleHelpButton } from "@/components/combat-role-help";
import { TeamCombatAnalysisButton } from "@/components/team-combat-analysis";

type RaidMascot = {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  statForce: number;
  statAgility: number;
  statInstinct: number;
  statVitality: number;
  statCharisma: number;
};

type RaidResult = Awaited<ReturnType<typeof attackOrderRaidBossAction>>;
type SuccessfulRaidResult = Extract<RaidResult, { ok: true }>;
type RecentRaidAttempt = { id: string; playerName: string; damage: number; createdAt: string };

function nameOf(mascot: RaidMascot) {
  return mascot.nickname ?? getPokemonName(mascot.pokemonId);
}

function total(mascot: RaidMascot) {
  return mascot.statForce + mascot.statAgility + mascot.statInstinct + mascot.statVitality + mascot.statCharisma;
}

function recommended(mascot: RaidMascot): CombatRole {
  return recommendCombatRole(mascot);
}

function RaidBattleModal({ result, onClose }: { result: SuccessfulRaidResult; onClose: () => void }) {
  const turns = Array.isArray(result.replay) ? result.replay : [];
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [hpMap, setHpMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = { __boss: result.boss.hpBefore };
    for (const mascot of result.team) initial[mascot.id] = mascot.maxHp;
    return initial;
  });

  const current = turns[Math.max(0, step - 1)] as Record<string, unknown> | undefined;
  const activeAttackerId = current?.action === "ATTACK" && typeof current.actorId === "string" ? current.actorId : null;
  const activeTargetId = current?.action === "BOSS_ATTACK" && typeof current.targetId === "string" ? current.targetId : null;
  const bossActive = current?.action === "BOSS_ATTACK";
  const bossHp = hpMap.__boss ?? result.boss.hpBefore;
  const bossHpPct = result.boss.maxHp > 0 ? Math.max(0, Math.round((bossHp / result.boss.maxHp) * 100)) : 0;

  useEffect(() => {
    if (!playing || step >= turns.length) return;
    const timer = window.setTimeout(() => {
      const turn = turns[step] as Record<string, unknown> | undefined;
      setHpMap((currentHp) => {
        if (!turn) return currentHp;
        const next = { ...currentHp };
        if (turn.action === "ATTACK") {
          next.__boss = Math.max(0, Number(turn.bossHp ?? next.__boss ?? 0));
        } else if (turn.action === "BOSS_ATTACK" && typeof turn.targetId === "string") {
          next[turn.targetId] = Math.max(0, Number(turn.targetHp ?? 0));
        } else if (turn.action === "KO" && typeof turn.actorId === "string") {
          next[turn.actorId] = 0;
        }
        return next;
      });
      setStep((value) => value + 1);
    }, Math.max(120, 820 / speed));
    return () => window.clearTimeout(timer);
  }, [playing, step, turns, speed]);

  function skipReplay() {
    const finalHp: Record<string, number> = { __boss: result.boss.hpAfter };
    for (const mascot of result.team) finalHp[mascot.id] = mascot.remainingHp;
    setHpMap(finalHp);
    setStep(turns.length);
    setPlaying(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3">
      <div className="max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-purple-500/40 bg-slate-950 shadow-2xl">
        <div className="relative overflow-hidden rounded-t-3xl border-b border-purple-500/25 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.3),transparent_45%),linear-gradient(180deg,#1e1038,#020617)] p-5">
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/30 p-2 text-slate-200 hover:text-white">
            <X size={16} />
          </button>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-200">Confronto contra a Ordem</p>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1.3fr] lg:items-center">
            <div className="text-center">
              <img
                src={getSpriteUrl(result.boss.pokemonId, true)}
                alt=""
                className={`mx-auto h-52 w-52 rounded-3xl object-contain p-2 drop-shadow-[0_0_35px_rgba(168,85,247,0.8)] transition sm:h-64 sm:w-64 ${bossActive ? "ring-4 ring-red-400/80 bg-red-500/10 scale-105" : ""}`}
                style={{ imageRendering: "pixelated" }}
              />
              <h2 className="mt-2 text-2xl font-black text-white">{result.boss.name}</h2>
              <p className="text-xs text-purple-200">{result.boss.megaPhase ? "Forma intensificada" : "Lider da Ordem"}</p>
              <div className="mt-3 h-4 overflow-hidden rounded-full bg-black/50 ring-1 ring-purple-300/25">
                <div className="h-full rounded-full bg-gradient-to-r from-red-600 via-orange-400 to-[#FFCB05]" style={{ width: `${bossHpPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-300">{bossHp.toLocaleString("pt-BR")} / {result.boss.maxHp.toLocaleString("pt-BR")} HP</p>
            </div>

            <div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {result.team.map((mascot) => {
                  const currentHp = hpMap[mascot.id] ?? mascot.maxHp;
                  const defeated = currentHp <= 0;
                  return (
                    <div key={mascot.id} className={`rounded-xl border p-2 text-center transition ${
                      defeated ? "border-red-500/30 bg-red-500/10 opacity-60 grayscale"
                      : activeAttackerId === mascot.id ? "border-[#FFCB05] bg-[#FFCB05]/10 shadow-[0_0_20px_rgba(255,203,5,0.25)]"
                      : activeTargetId === mascot.id ? "border-red-400 bg-red-500/10 shadow-[0_0_20px_rgba(248,113,113,0.25)]"
                      : "border-slate-700 bg-slate-900/70"
                    }`}>
                      <img src={getSpriteUrl(mascot.pokemonId, true)} alt="" className="mx-auto h-12 w-12 object-contain" style={{ imageRendering: "pixelated" }} />
                      <p className="truncate text-[10px] font-bold text-slate-100">{mascot.name}</p>
                      <p className="text-[9px] text-[#FFCB05]">{getCombatRoleLabel(mascot.combatRole)}</p>
                      <p className="text-[9px] text-slate-500">{Math.max(0, currentHp)}/{mascot.maxHp}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-950 ring-1 ring-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-green-400" style={{ width: `${Math.max(0, Math.min(100, (currentHp / mascot.maxHp) * 100))}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-black/25 p-4">
                <p className="text-sm font-bold text-white">
                  {current
                    ? current.action === "BOSS_ATTACK"
                      ? `${String(current.actor)} atingiu ${String(current.target)} causando ${Number(current.damage ?? 0).toLocaleString("pt-BR")} dano.`
                      : current.action === "KO"
                        ? `${String(current.actor)} caiu em combate.`
                        : `${String(current.actor)} causou ${Number(current.damage ?? 0).toLocaleString("pt-BR")} dano na Ordem${current.crit ? " com um golpe critico" : ""}.`
                    : step >= turns.length ? "Replay concluido." : "A investida começou."}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {step >= turns.length
                    ? "A equipe inteira foi retirada de combate. O dano causado ficou registrado na vida global da Ordem."
                    : `Turno ${Math.min(step + 1, turns.length)}/${Math.max(1, turns.length)}`}
                </p>
                <div className="mt-3 flex gap-2">
                  {[1, 2, 4].map((value) => (
                    <button key={value} type="button" onClick={() => setSpeed(value as 1 | 2 | 4)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${speed === value ? "border-[#FFCB05] bg-[#FFCB05]/10 text-[#FFCB05]" : "border-slate-700 text-slate-300"}`}>
                      {value}x
                    </button>
                  ))}
                  <button disabled={step >= turns.length} onClick={() => setPlaying((value) => !value)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-40">
                    {playing ? "Pausar" : "Continuar"}
                  </button>
                  <button disabled={step >= turns.length} onClick={skipReplay} className="rounded-lg bg-[#FFCB05] px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40">
                    Pular replay
                  </button>
                  <button onClick={onClose} className="ml-auto rounded-lg border border-purple-400/40 px-3 py-2 text-xs font-bold text-purple-100">
                    Fechar
                  </button>
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-300">
                Dano causado: <strong className="text-red-200">{result.damage.toLocaleString("pt-BR")}</strong>
                {result.defeatedMascots.length ? ` · Feridos: ${result.defeatedMascots.join(", ")}` : " · Nenhum mascote caiu."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OrderRaidTeamSelector({ mascots, cooldownText, recentAttempts = [] }: { mascots: RaidMascot[]; cooldownText?: string | null; recentAttempts?: RecentRaidAttempt[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, CombatRole>>({});
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<SuccessfulRaidResult | null>(null);

  const selectedMascots = selected.map((id) => mascots.find((mascot) => mascot.id === id)).filter(Boolean) as RaidMascot[];
  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    return mascots
      .filter((mascot) => !query || nameOf(mascot).toLowerCase().includes(query))
      .sort((a, b) => b.level - a.level || total(b) - total(a));
  }, [mascots, search]);

  function toggle(mascot: RaidMascot) {
    setSelected((current) => {
      if (current.includes(mascot.id)) return current.filter((id) => id !== mascot.id);
      if (current.length >= 6) {
        toast.error("A equipe da raid precisa ter exatamente 6 mascotes.");
        return current;
      }
      setRoles((currentRoles) => ({ ...currentRoles, [mascot.id]: currentRoles[mascot.id] ?? recommended(mascot) }));
      return [...current, mascot.id];
    });
  }

  function submit() {
    if (selected.length !== 6) {
      toast.error("Monte uma equipe completa com 6 mascotes.");
      return;
    }
    startTransition(async () => {
      const form = new FormData();
      for (const id of selected) {
        form.append("mascotId", id);
        form.append(`role:${id}`, roles[id] ?? "ATTACKER");
      }
      const response = await attackOrderRaidBossAction(form);
      if (!response?.ok) {
        toast.error(response?.message ?? "Nao foi possivel atacar a Ordem.");
        return;
      }
      setResult(response);
      toast.success(response.message);
    });
  }

  return (
    <>
      <div className="space-y-3">
        <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFCB05]">Equipe da Raid</p>
            <div className="flex items-center gap-2">
              <TeamCombatAnalysisButton mascots={selectedMascots} roles={roles} mode="RAID" />
              <span className="text-xs font-black text-[#FFCB05]">{selected.length}/6</span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedMascots.map((mascot) => (
              <div key={mascot.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 p-2">
                <img src={getSpriteUrl(mascot.pokemonId, true)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-100">{nameOf(mascot)}</p>
                  <p className="text-[10px] text-slate-500">Nv.{mascot.level} · Σ{total(mascot)}</p>
                  <div className="mt-1 flex items-center gap-1">
                    <select
                      value={roles[mascot.id] ?? recommended(mascot)}
                      onChange={(event) => setRoles((currentRoles) => ({ ...currentRoles, [mascot.id]: event.target.value as CombatRole }))}
                      className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-200"
                    >
                      {COMBAT_ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                    <CombatRoleHelpButton role={roles[mascot.id] ?? recommended(mascot)} stats={mascot} teamStats={selectedMascots} mode="RAID" />
                  </div>
                </div>
                <button type="button" onClick={() => toggle(mascot)} className="rounded px-2 py-1 text-xs font-black text-red-300 hover:bg-red-500/10">x</button>
              </div>
            ))}
            {Array.from({ length: Math.max(0, 6 - selectedMascots.length) }).map((_, index) => (
              <div key={index} className="min-h-[72px] rounded-lg border border-dashed border-slate-700/60 bg-slate-950/40" />
            ))}
          </div>
        </div>

        {cooldownText ? (
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/10 p-3 text-xs text-orange-100">{cooldownText}</div>
        ) : (
          <button disabled={pending || selected.length !== 6} type="button" onClick={submit} className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40">
            {pending ? "Atacando..." : "Atacar com equipe de 6"}
          </button>
        )}

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar mascote..." className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-200 outline-none focus:border-red-400/50" />
        </div>

        <div className="grid max-h-96 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {displayed.map((mascot) => {
            const picked = selected.includes(mascot.id);
            return (
              <button key={mascot.id} type="button" onClick={() => toggle(mascot)} className={`rounded-xl border p-2 text-left transition ${picked ? "border-[#FFCB05]/60 bg-[#FFCB05]/10" : "border-slate-800 bg-slate-950/60 hover:border-red-400/40"}`}>
                <div className="flex items-center gap-2">
                  <img src={getSpriteUrl(mascot.pokemonId, true)} alt="" className="h-11 w-11 object-contain" style={{ imageRendering: "pixelated" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-100">{nameOf(mascot)}</p>
                    <p className="text-[10px] text-slate-500">Nv.{mascot.level} · For {mascot.statForce} · Agi {mascot.statAgility} · Ins {mascot.statInstinct} · Vit {mascot.statVitality} · Car {mascot.statCharisma}</p>
                    <p className="text-[10px] text-[#FFCB05]">Recomendada: {getCombatRoleLabel(recommended(mascot))}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {recentAttempts.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/65 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-200">Últimos ataques contra a Ordem</p>
            <div className="space-y-1.5">
              {recentAttempts.map((attempt) => (
                <div key={attempt.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs">
                  <span className="truncate text-slate-200">{attempt.playerName}</span>
                  <span className="font-black text-red-200">{attempt.damage.toLocaleString("pt-BR")} dano</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {result && <RaidBattleModal result={result} onClose={() => { setResult(null); router.refresh(); }} />}
    </>
  );
}
