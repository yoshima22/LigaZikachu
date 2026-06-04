import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Swords, Bot, Lock, Coins, HeartPulse, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import { ARENA_Z_CONFIG } from "@/lib/arena-z";
import { createArenaTeamAction } from "./actions";
import { AdminMascotStateButton, BotBattleButton, PvpBattleButton, RetireTeamButton, SusButton } from "./_components/arena-z-buttons";

export const dynamic = "force-dynamic";

function stateLabel(state: string, restingUntil?: Date | null) {
  if (state === "INJURED") return "Ferido";
  if (state === "RESTING") return restingUntil && restingUntil > new Date() ? `Repouso ate ${restingUntil.toLocaleString("pt-BR")}` : "Repouso concluido";
  if (state === "ARENA") return "Na Arena";
  return "Livre";
}

function fmtLoot(team: { vaultCoins: number; vaultExp: number; vaultFood: number; vaultSweet: number }) {
  const parts = [
    `${team.vaultCoins} ZC`,
    `${team.vaultExp} EXP`,
    team.vaultFood > 0 ? `${team.vaultFood} comida` : null,
    team.vaultSweet > 0 ? `${team.vaultSweet} doce` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

type ArenaRankingRow = {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  stolenCoins: number;
  stolenExp: number;
};

function getLootNumber(loot: unknown, key: "coins" | "exp") {
  if (!loot || typeof loot !== "object") return 0;
  const root = loot as { stolen?: unknown };
  if (!root.stolen || typeof root.stolen !== "object") return 0;
  const stolen = root.stolen as Record<string, unknown>;
  const value = stolen[key];
  return typeof value === "number" ? value : 0;
}

export default async function ArenaZPage() {
  const session = await getAppSession();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/dashboard");

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true },
  });
  if (!player) redirect("/dashboard");

  const [wallet, mascots, teams, opponentTeams, battles, rankingBattles] = await Promise.all([
    prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id }, select: { balance: true } }),
    prisma.mascot.findMany({
      where: { playerId: player.id },
      include: { expeditions: { where: { status: "ACTIVE" }, take: 1 } },
      orderBy: [{ arenaState: "asc" }, { level: "desc" }],
    }),
    prisma.arenaTeam.findMany({
      where: { playerId: player.id },
      include: { members: { include: { mascot: true }, orderBy: { slot: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.arenaTeam.findMany({
      where: { playerId: { not: player.id }, status: "ACTIVE" },
      include: {
        player: { select: { displayName: true, ptcglNick: true } },
        members: { include: { mascot: true }, orderBy: { slot: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.arenaBattle.findMany({
      where: { OR: [{ attackerPlayerId: player.id }, { defenderPlayerId: player.id }] },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.arenaBattle.findMany({
      where: { status: "RESOLVED" },
      include: {
        attackerPlayer: { select: { id: true, displayName: true, ptcglNick: true } },
        defenderPlayer: { select: { id: true, displayName: true, ptcglNick: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
  ]);

  const now = new Date();
  const availableMascots = mascots.filter(m =>
    (m.arenaState === "FREE" || (m.arenaState === "RESTING" && m.restingUntil && m.restingUntil <= now)) &&
    !m.bazarListed &&
    m.expeditions.length === 0 &&
    (!m.restingUntil || m.restingUntil <= now)
  );
  const injuredMascots = mascots.filter(m => m.arenaState === "INJURED");
  const activeTeams = teams.filter(team => team.status === "ACTIVE");
  const rankingMap = new Map<string, ArenaRankingRow>();
  const ensureRow = (id: string, name: string) => {
    const existing = rankingMap.get(id);
    if (existing) return existing;
    const row = { playerId: id, name, wins: 0, losses: 0, draws: 0, stolenCoins: 0, stolenExp: 0 };
    rankingMap.set(id, row);
    return row;
  };
  for (const battle of rankingBattles) {
    if (battle.attackerPlayer) ensureRow(battle.attackerPlayer.id, battle.attackerPlayer.displayName ?? battle.attackerPlayer.ptcglNick);
    if (battle.defenderPlayer) ensureRow(battle.defenderPlayer.id, battle.defenderPlayer.displayName ?? battle.defenderPlayer.ptcglNick);
    if (battle.result === "DRAW") {
      if (battle.attackerPlayerId && battle.attackerPlayer) ensureRow(battle.attackerPlayerId, battle.attackerPlayer.displayName ?? battle.attackerPlayer.ptcglNick).draws++;
      if (battle.defenderPlayerId && battle.defenderPlayer) ensureRow(battle.defenderPlayerId, battle.defenderPlayer.displayName ?? battle.defenderPlayer.ptcglNick).draws++;
      continue;
    }
    if (battle.winnerPlayerId) {
      const winner = battle.winnerPlayerId === battle.attackerPlayerId ? battle.attackerPlayer : battle.defenderPlayer;
      if (winner) {
        const row = ensureRow(winner.id, winner.displayName ?? winner.ptcglNick);
        row.wins++;
        row.stolenCoins += getLootNumber(battle.lootResult, "coins");
        row.stolenExp += getLootNumber(battle.lootResult, "exp");
      }
    }
    if (battle.loserPlayerId) {
      const loser = battle.loserPlayerId === battle.attackerPlayerId ? battle.attackerPlayer : battle.defenderPlayer;
      if (loser) ensureRow(loser.id, loser.displayName ?? loser.ptcglNick).losses++;
    }
  }
  const arenaRanking = [...rankingMap.values()]
    .sort((a, b) => b.wins - a.wins || b.stolenCoins - a.stolenCoins || a.losses - b.losses || a.name.localeCompare(b.name))
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-red-300">
              <ShieldCheck size={14} />
              Experimental admin-only
            </p>
            <h1 className="mt-2 flex items-center gap-3 font-pixel text-base text-[#FFCB05]">
              <Swords size={20} />
              Arena Z
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Modo automatico de combate entre mascotes. Monte equipes, enfrente bots, acumule loot em cofre e teste ferimentos/repouso antes de liberar para jogadores.
            </p>
          </div>
          <div className="rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2 text-sm font-bold text-[#FFCB05]">
            {wallet?.balance.toLocaleString("pt-BR") ?? 0} ZC
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-green-300"><Bot size={16} /> Arena Bots</p>
          <p className="mt-1 text-xs text-slate-400">Disponivel neste MVP. Bots sao gerados por faixa de nivel e resolvidos no backend.</p>
        </div>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-200"><Lock size={16} /> Arena PvP admin</p>
          <p className="mt-1 text-xs text-slate-400">Disponivel apenas para admin testar. Desafios publicos continuam bloqueados para jogadores comuns.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-border bg-slate-950/60 p-5">
          <h2 className="font-semibold text-slate-200">Criar equipe</h2>
          <p className="mt-1 text-xs text-slate-500">Selecione de 1 a 6 mascotes livres. Mascotes em expedicao, Bazar, Arena, feridos ou repouso nao aparecem como validos.</p>
          <form action={async (formData) => {
            "use server";
            await createArenaTeamAction(formData);
          }} className="mt-4 space-y-4">
            <input
              name="name"
              placeholder="Nome da equipe"
              className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#FFCB05]/60"
            />
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {availableMascots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-slate-500">Nenhum mascote livre para montar equipe.</p>
              ) : availableMascots.map(m => (
                <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-slate-900/50 p-3 hover:border-[#FFCB05]/30">
                  <input type="checkbox" name="mascotIds" value={m.id} className="h-4 w-4 accent-[#FFCB05]" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getSpriteUrl(m.pokemonId, true)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-200">{m.nickname ?? getPokemonName(m.pokemonId)}</span>
                    <span className="text-[10px] text-slate-500">Nv.{m.level} | For {m.statForce} | Vel {m.statAgility} | Vit {m.statVitality}</span>
                  </span>
                </label>
              ))}
            </div>
            <button type="submit" className="w-full rounded-xl bg-[#FFCB05] py-3 text-sm font-bold text-[#1A1A2E]">
              Criar equipe Arena Z
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
            <h2 className="font-semibold text-slate-200">Equipes</h2>
            <div className="mt-4 space-y-3">
              {teams.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-slate-500">Nenhuma equipe criada ainda.</p>
              ) : teams.map(team => (
                <div key={team.id} className="rounded-2xl border border-border bg-slate-900/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-100">{team.name}</p>
                      <p className="text-[11px] text-slate-500">{team.status} | {team.members.length} mascote(s) | entrou {team.enteredAt.toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex gap-2">
                      {team.status === "ACTIVE" && <BotBattleButton teamId={team.id} />}
                      {team.status === "ACTIVE" && <RetireTeamButton teamId={team.id} />}
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3 text-xs text-[#FFCB05]">
                    <Coins size={13} className="mr-1 inline" />
                    Cofre: {fmtLoot(team)}
                    <p className="mt-1 text-[10px] text-slate-500">Derrota futura: 60% preservado, 30% roubavel, 10% risco do sistema.</p>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {team.members.map(member => (
                      <div key={member.id} className="rounded-xl border border-border/60 bg-slate-950/60 p-3">
                        <p className="truncate text-xs font-semibold text-slate-200">{member.mascot.nickname ?? getPokemonName(member.mascot.pokemonId)}</p>
                        <p className="text-[10px] text-slate-500">Slot {member.slot} | Nv.{member.mascot.level} | {stateLabel(member.mascot.arenaState, member.mascot.restingUntil)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
            <h2 className="font-semibold text-slate-200">Arena PvP experimental</h2>
            <p className="mt-1 text-xs text-slate-500">
              Escolha uma equipe sua ativa para atacar equipes de outros jogadores. O combate e automatico e registra roubo/preservacao do cofre.
            </p>
            <div className="mt-4 space-y-4">
              {activeTeams.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-slate-500">Crie uma equipe ativa antes de testar PvP.</p>
              ) : opponentTeams.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-slate-500">Nenhuma equipe adversaria ativa disponivel.</p>
              ) : activeTeams.map(attackTeam => (
                <div key={attackTeam.id} className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-sm font-bold text-red-100">Atacando com: {attackTeam.name}</p>
                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    {opponentTeams.map(defenseTeam => (
                      <div key={defenseTeam.id} className="rounded-xl border border-border bg-slate-950/60 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-slate-100">{defenseTeam.name}</p>
                            <p className="text-[10px] text-slate-500">
                              Dono: {defenseTeam.player.displayName ?? defenseTeam.player.ptcglNick} | {defenseTeam.members.length} mascote(s)
                            </p>
                            <p className="mt-1 text-[10px] text-[#FFCB05]">Cofre alvo: {fmtLoot(defenseTeam)}</p>
                          </div>
                          <PvpBattleButton attackTeamId={attackTeam.id} defenseTeamId={defenseTeam.id} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {defenseTeam.members.slice(0, 6).map(member => (
                            <span key={member.id} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-slate-400">
                              {member.mascot.nickname ?? getPokemonName(member.mascot.pokemonId)} Nv.{member.mascot.level}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
            <h2 className="font-semibold text-slate-200">Ranking experimental da Arena Z</h2>
            <p className="mt-1 text-xs text-slate-500">
              Calculado a partir dos ultimos combates resolvidos. Ainda e uma leitura admin para balanceamento.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Jogador</th>
                    <th className="py-2 pr-3 text-right">V</th>
                    <th className="py-2 pr-3 text-right">D</th>
                    <th className="py-2 pr-3 text-right">E</th>
                    <th className="py-2 pr-3 text-right">Aproveitamento</th>
                    <th className="py-2 pr-3 text-right">Loot roubado</th>
                  </tr>
                </thead>
                <tbody>
                  {arenaRanking.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500">Nenhum combate registrado ainda.</td>
                    </tr>
                  ) : arenaRanking.map((row, index) => {
                    const total = row.wins + row.losses + row.draws;
                    const winRate = total > 0 ? Math.round((row.wins / total) * 100) : 0;
                    return (
                      <tr key={row.playerId} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3 font-bold text-[#FFCB05]">{index + 1}</td>
                        <td className="py-2 pr-3 font-semibold text-slate-200">{row.name}</td>
                        <td className="py-2 pr-3 text-right text-green-300">{row.wins}</td>
                        <td className="py-2 pr-3 text-right text-red-300">{row.losses}</td>
                        <td className="py-2 pr-3 text-right text-slate-400">{row.draws}</td>
                        <td className="py-2 pr-3 text-right text-slate-300">{winRate}%</td>
                        <td className="py-2 pr-3 text-right text-[#FFCB05]">{row.stolenCoins} ZC / {row.stolenExp} EXP</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
              <h2 className="flex items-center gap-2 font-semibold text-slate-200"><HeartPulse size={16} /> Atendimento SUS</h2>
              <p className="mt-1 text-xs text-slate-500">Custo atual: {ARENA_Z_CONFIG.susCost} ZC. Apos cura, repouso minimo de {ARENA_Z_CONFIG.restAfterSusHours}h.</p>
              <div className="mt-4 space-y-2">
                {injuredMascots.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum mascote ferido.</p>
                ) : injuredMascots.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                    <span>
                      <span className="block text-xs font-semibold text-red-200">{m.nickname ?? getPokemonName(m.pokemonId)}</span>
                      <span className="text-[10px] text-slate-500">Ferido desde {m.injuredAt?.toLocaleString("pt-BR") ?? "agora"}</span>
                    </span>
                    <SusButton mascotId={m.id} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
              <h2 className="font-semibold text-slate-200">Controles admin</h2>
              <p className="mt-1 text-xs text-slate-500">Ferramentas de teste para ferimento, repouso e liberar estado.</p>
              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                {mascots.slice(0, 20).map(m => (
                  <div key={m.id} className="rounded-xl border border-border/60 bg-slate-900/40 p-3">
                    <p className="text-xs font-semibold text-slate-200">{m.nickname ?? getPokemonName(m.pokemonId)}</p>
                    <p className="mb-2 text-[10px] text-slate-500">{stateLabel(m.arenaState, m.restingUntil)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <AdminMascotStateButton mascotId={m.id} state="FREE" label="Livre" />
                      <AdminMascotStateButton mascotId={m.id} state="INJURED" label="Ferir" />
                      <AdminMascotStateButton mascotId={m.id} state="RESTING" label="Repouso" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-200"><History size={16} /> Historico recente</h2>
            <div className="mt-4 space-y-3">
              {battles.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum combate registrado.</p>
              ) : battles.map(battle => {
                const log = Array.isArray(battle.turnLog) ? battle.turnLog as Array<{ turn: number; actorName: string; targetName: string; damage: number; advantageApplied?: boolean; action: string }> : [];
                return (
                  <details key={battle.id} className="rounded-xl border border-border bg-slate-900/40 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                      {battle.createdAt.toLocaleString("pt-BR")} | {battle.botName ?? "PvP"} | {battle.result}
                    </summary>
                    <div className="mt-3 space-y-1 text-xs text-slate-400">
                      {log.slice(0, 12).map(turn => (
                        <p key={turn.turn}>
                          Turno {turn.turn}: {turn.actorName} {turn.action === "DEFEND" ? "defendeu" : `atacou ${turn.targetName} causando ${turn.damage} dano`}{turn.advantageApplied ? " (vantagem)" : ""}.
                        </p>
                      ))}
                      {log.length > 12 && <p className="text-slate-600">...mais {log.length - 12} turno(s)</p>}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <div className="text-center text-xs text-slate-600">
        <Link href="/mascotes" className="underline hover:text-[#FFCB05]">Voltar para Mascotes</Link>
      </div>
    </div>
  );
}
