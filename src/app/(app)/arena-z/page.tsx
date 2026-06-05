import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Swords, Bot, Coins, HeartPulse, History, ChevronDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import { ARENA_Z_CONFIG, getArenaBotPreview, getArenaRanking, formatTurnLog, getTeamTimeMultiplier, applyMultiplierToVault, syncDefeatedArenaTeams, applyPassiveIncome } from "@/lib/arena-z";
import { AdminMascotStateButton, BotBattleButton, DeleteTeamButton, OpportunisticAttackButton, PurgeAdminArenaButton, PvpBattleButton, RetireTeamButton, SusButton } from "./_components/arena-z-buttons";
import { ArenaTutorial } from "./_components/arena-tutorial";
import { AddMascotToTeamForm, CreateTeamForm } from "./_components/create-team-form";

export const dynamic = "force-dynamic";

function stateLabel(state: string, restingUntil?: Date | null) {
  if (state === "INJURED") return "Ferido";
  if (state === "RESTING") return restingUntil && restingUntil > new Date() ? `Repouso ate ${restingUntil.toLocaleString("pt-BR")}` : "Repouso concluido";
  if (state === "ARENA") return "Na Arena";
  return "Livre";
}

function teamStatusLabel(status: string) {
  if (status === "ACTIVE") return "Ativa";
  if (status === "DEFEATED") return "Derrotada";
  if (status === "RETIRED") return "Retirada";
  return status;
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

type TeamReadiness = {
  members: Array<{
    mascot: {
      arenaState: string;
      restingUntil: Date | null;
      nickname: string | null;
      pokemonId: number;
    };
  }>;
};

function getTeamBlockedReason(team: TeamReadiness) {
  const now = new Date();
  for (const member of team.members) {
    const name = member.mascot.nickname ?? getPokemonName(member.mascot.pokemonId);
    if (member.mascot.arenaState === "INJURED") return `${name} esta ferido e precisa de Atendimento SUS.`;
    if (member.mascot.restingUntil && member.mascot.restingUntil > now) {
      return `${name} esta em repouso ate ${member.mascot.restingUntil.toLocaleString("pt-BR")}.`;
    }
  }
  return null;
}

function getLootNumber(loot: unknown, key: "coins" | "exp") {
  if (!loot || typeof loot !== "object") return 0;
  const root = loot as { stolen?: unknown };
  if (!root.stolen || typeof root.stolen !== "object") return 0;
  const stolen = root.stolen as Record<string, unknown>;
  const value = stolen[key];
  return typeof value === "number" ? value : 0;
}

function readBattleLoot(loot: unknown) {
  if (!loot || typeof loot !== "object") return null;
  const data = loot as Record<string, unknown>;
  if (typeof data.coins === "number" || typeof data.exp === "number") {
    return {
      label: "Loot",
      coins: typeof data.coins === "number" ? data.coins : 0,
      exp: typeof data.exp === "number" ? data.exp : 0,
      food: typeof data.food === "number" ? data.food : 0,
      sweet: typeof data.sweet === "number" ? data.sweet : 0,
    };
  }
  if (data.stolen && typeof data.stolen === "object") {
    const stolen = data.stolen as Record<string, unknown>;
    return {
      label: "Roubado",
      coins: typeof stolen.coins === "number" ? stolen.coins : 0,
      exp: typeof stolen.exp === "number" ? stolen.exp : 0,
      food: typeof stolen.food === "number" ? stolen.food : 0,
      sweet: typeof stolen.sweet === "number" ? stolen.sweet : 0,
    };
  }
  return null;
}

export default async function ArenaZPage() {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");
  const admin = isAdmin(session.user.role);

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true },
  });
  if (!player) redirect("/dashboard");

  await syncDefeatedArenaTeams(player.id);

  const [wallet, mascots, teams, opponentTeams, battles, arenaRankingData, injuredRivals] = await Promise.all([
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
    // PvP: apenas equipes de outros jogadores que não são exclusivamente PvE
    prisma.arenaTeam.findMany({
      where: {
        playerId: { not: player.id },
        status: "ACTIVE",
        teamType: { in: ["PVP", "BOTH"] }, // não expõe times PvE exclusivos como alvo
      },
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
    getArenaRanking(20),
    // Mascotes de rivais que estão feridos (para ataque oportunista)
    prisma.mascot.findMany({
      where: {
        arenaState: "INJURED",
        playerId: { not: player.id },
        relationsAsB: { some: { mascotA: { playerId: player.id }, type: "RIVAL" } },
      },
      include: { player: { select: { displayName: true } } },
      take: 10,
    }),
  ]);

  const now = new Date();
  // Mascotes em equipes ativas não podem entrar em outra equipe
  const mascotIdsInActiveTeams = new Set(
    teams.filter(t => t.status === "ACTIVE").flatMap(t => t.members.map(m => m.mascot.id))
  );
  const availableMascots = mascots.filter(m =>
    (m.arenaState === "FREE" || (m.arenaState === "RESTING" && (!m.restingUntil || m.restingUntil <= now))) &&
    !m.bazarListed &&
    m.expeditions.length === 0 &&
    (!m.restingUntil || m.restingUntil <= now) &&
    !mascotIdsInActiveTeams.has(m.id) // já em equipe ativa = não disponível
  );
  const injuredMascots = mascots.filter(m => m.arenaState === "INJURED");
  const activeTeams = teams.filter(team => team.status === "ACTIVE");
  const teamBlockReasons = new Map(activeTeams.map(team => [team.id, getTeamBlockedReason(team)]));
  const readyActiveTeams = activeTeams.filter(team => !teamBlockReasons.get(team.id));
  const readyOpponentTeams = opponentTeams.filter(team => !getTeamBlockedReason(team));
  // 1. Aplica renda passiva para as equipes PRÓPRIAS do jogador
  await import("./actions").then(m => m.applyPassiveIncomeAction()).catch(() => null);

  // 2. Aplica renda passiva nos times ADVERSÁRIOS (PvP/BOTH) antes de exibir os cofres,
  //    para que o jogador veja o valor real e possa tomar decisão informada de ataque.
  //    Times PvE exclusivos NÃO são afetados por este processo.
  if (opponentTeams.length > 0) {
    await Promise.all(opponentTeams.map(t => applyPassiveIncome(t.id).catch(() => null)));
    // Re-lê apenas os campos de vault para refletir os valores atualizados
    const freshVaults = await prisma.arenaTeam.findMany({
      where: { id: { in: opponentTeams.map(t => t.id) } },
      select: { id: true, vaultCoins: true, vaultExp: true, vaultFood: true, vaultSweet: true },
    });
    const vaultMap = new Map(freshVaults.map(v => [v.id, v]));
    for (const team of opponentTeams) {
      const v = vaultMap.get(team.id);
      if (v) {
        team.vaultCoins = v.vaultCoins;
        team.vaultExp   = v.vaultExp;
        team.vaultFood  = v.vaultFood;
        team.vaultSweet = v.vaultSweet;
      }
    }
  }

  // Preview com dificuldade Normal por padrão (o jogador pode escolher no botão)
  const botPreviews = new Map<string, Awaited<ReturnType<typeof getArenaBotPreview>>>();
  for (const team of readyActiveTeams) {
    botPreviews.set(team.id, await getArenaBotPreview(player.id, team.id, "normal"));
  }
  const arenaRanking = arenaRankingData;

  return (
    <div className="space-y-6">
      <ArenaTutorial />
      <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-r from-[#1A1A2E] via-[#201d38] to-[#1A1A2E] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-red-300">
              <ShieldCheck size={14} />
              {admin ? "Experimental admin" : "Arena Bots"}
            </p>
            <h1 className="mt-2 flex items-center gap-3 font-pixel text-base text-[#FFCB05]">
              <Swords size={20} />
              Arena Z
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Modo automatico de combate entre mascotes. Monte equipes, enfrente bots, acumule loot em cofre e cuide dos mascotes feridos com Atendimento SUS.
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
          <p className="flex items-center gap-2 text-sm font-bold text-red-200"><Swords size={16} /> Arena PvP</p>
          <p className="mt-1 text-xs text-slate-400">Desafie equipes de outros jogadores. Vencer rouba 30% do cofre adversário. Cooldown de 10 min entre ataques.</p>
        </div>
      </div>

      {/* ── FAQ Arena Z ── */}
      <details className="rounded-2xl border border-border overflow-hidden group">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-slate-300 hover:text-white select-none">
          <span className="flex items-center gap-2">📖 Como funciona a Arena Z?</span>
          <ChevronDown size={14} className="text-slate-500 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border px-5 py-4 grid gap-4 sm:grid-cols-2 text-xs text-slate-400 leading-relaxed">
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">⚙️ Criar Equipe</p>
            <p>Selecione de 1 a 6 mascotes <strong className="text-slate-300">livres</strong> (não feridos, em repouso, expedição ou Bazar). A equipe entra na Arena automaticamente. Mascotes na Arena não podem sair para expedição.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">🤖 Arena Bots (PvE)</p>
            <p>Escolha a dificuldade (<strong className="text-slate-300">Fácil/Normal/Difícil</strong>) e o tempo da batalha. Bots são gerados automaticamente por faixa de nível. Vencer adiciona loot ao cofre da equipe. Cooldown: 3 min entre batalhas.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">⚔️ Arena PvP</p>
            <p>Ataque equipes ativas de outros jogadores. Vencer rouba <strong className="text-slate-300">30% do cofre</strong> adversário. Perder: mascotes ficam feridos e 40% do cofre é perdido. Cooldown: 10 min entre ataques, 30 min contra o mesmo time.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">💰 Cofre da Arena</p>
            <p>Cada vitória acumula ZC, EXP, comida e itens no cofre da equipe. Use <strong className="text-slate-300">Retirar e coletar</strong> para receber tudo. Se derrotado, perde parte do cofre.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">🤕 Ferimentos e SUS</p>
            <p>Mascotes derrotados ficam <strong className="text-red-400">Feridos</strong>. Pague {ARENA_Z_CONFIG.susCost} ZC no <strong className="text-slate-300">Atendimento SUS</strong> para curar. Após cura, repouso mínimo de {ARENA_Z_CONFIG.restAfterSusHours}h antes de voltar à Arena.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">😈 Ataques Oportunistas</p>
            <p>Se um rival seu estiver ferido, pode atacá-lo para roubar EXP e aumentar o repouso. Limitado a 1 ataque por período de ferimento. Aparece na seção &ldquo;Rivais Feridos&rdquo; quando disponível.</p>
          </div>
        </div>
      </details>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-border bg-slate-950/60 p-5">
          <h2 className="font-semibold text-slate-200">Criar equipe</h2>
          <p className="mt-1 text-xs text-slate-500">Apenas mascotes livres aparecem. Máximo de 6 por equipe.</p>
          <CreateTeamForm mascots={availableMascots.map(m => ({
            id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
            level: m.level, statForce: m.statForce, statAgility: m.statAgility,
            statVitality: m.statVitality, arenaState: m.arenaState,
          }))} />
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
                      <p className="text-[11px] text-slate-500">{teamStatusLabel(team.status)} | {team.members.length} mascote(s) | entrou {team.enteredAt.toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(team.status === "ACTIVE" || team.status === "DEFEATED") && <RetireTeamButton teamId={team.id} defeated={team.status === "DEFEATED"} />}
                      <DeleteTeamButton teamId={team.id} isAdmin={admin} />
                    </div>
                  </div>
                  {team.status === "DEFEATED" && (
                    <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
                      <p className="font-bold">Equipe derrotada</p>
                      <p className="mt-1 text-red-100/80">
                        Esta equipe saiu da Arena porque sofreu K.O./ferimento em combate. Cure os mascotes feridos com Atendimento SUS e colete o cofre restante para encerrar o ciclo.
                      </p>
                    </div>
                  )}
                  {(() => {
                    const mult = getTeamTimeMultiplier(team.enteredAt);
                    const hoursActive = (Date.now() - new Date(team.enteredAt).getTime()) / 3_600_000;
                    const vaultNow = applyMultiplierToVault(
                      { coins: team.vaultCoins, exp: team.vaultExp, food: team.vaultFood, sweet: team.vaultSweet },
                      mult, false
                    );
                    const multPct = Math.round((mult - 1) * 100);
                    return (
                      <div className="mt-3 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3 text-xs text-[#FFCB05] space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold"><Coins size={13} className="mr-1 inline" />Cofre: {fmtLoot(team)}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${mult >= 4 ? "bg-[#FFCB05] text-[#1A1A2E]" : "border border-[#FFCB05]/40 text-[#FFCB05]"}`}>
                            ×{mult.toFixed(1)}{mult >= 4 ? " MAX!" : ` (+${multPct}%)`}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500">{Math.floor(hoursActive)}h na Arena · cresce {ARENA_Z_CONFIG.multPerHour * 60}% por hora · máx ×{ARENA_Z_CONFIG.multCap}</p>
                        {(team.vaultCoins > 0 || team.vaultExp > 0) && (
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2">
                              <p className="font-semibold text-green-300">✅ Se retirar agora</p>
                              <p className="text-slate-300">{vaultNow.coins} ZC · {vaultNow.exp} EXP{vaultNow.food > 0 ? ` · ${vaultNow.food} 🍖` : ""}</p>
                            </div>
                            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2">
                              <p className="font-semibold text-red-300">⚠️ Se derrotado</p>
                              <p className="text-slate-300">~{Math.floor(vaultNow.coins * 0.4)} ZC perdidos</p>
                              <p className="text-slate-500">30% roubado · 10% queimado</p>
                            </div>
                          </div>
                        )}
                        <p className="text-[9px] text-slate-600 mt-1">
                          💰 Renda passiva: +{team.members.length} ZC e +{team.members.length * 2} EXP por hora (acumula no cofre automaticamente).
                        </p>
                        {mult < 4 && (
                          <p className="text-[9px] text-slate-600">
                            💡 Prof. Enguiça: Aguarde mais {Math.ceil((4 - mult) / ARENA_Z_CONFIG.multPerHour)}h para atingir o máximo de ×{ARENA_Z_CONFIG.multCap}!
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {team.members.map(member => (
                      <div key={member.id} className="rounded-xl border border-border/60 bg-slate-950/60 p-3">
                        <p className="truncate text-xs font-semibold text-slate-200">{member.mascot.nickname ?? getPokemonName(member.mascot.pokemonId)}</p>
                        <p className="text-[10px] text-slate-500">Slot {member.slot} | Nv.{member.mascot.level} | {stateLabel(member.mascot.arenaState, member.mascot.restingUntil)}</p>
                      </div>
                    ))}
                  </div>
                  {team.status === "ACTIVE" && teamBlockReasons.get(team.id) && (
                    <div className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-100">
                      <p className="font-bold">Equipe aguardando recuperacao</p>
                      <p className="mt-1 text-yellow-100/80">
                        {teamBlockReasons.get(team.id)} Quando o repouso acabar, a equipe volta a poder combater.
                      </p>
                    </div>
                  )}
                  {team.status === "ACTIVE" && team.members.length < 6 && (
                    <AddMascotToTeamForm
                      teamId={team.id}
                      mascots={availableMascots.map(m => ({
                        id: m.id, pokemonId: m.pokemonId, nickname: m.nickname,
                        level: m.level, statForce: m.statForce, statAgility: m.statAgility,
                        statVitality: m.statVitality, arenaState: m.arenaState,
                      }))}
                      slotsUsed={team.members.length}
                    />
                  )}
                  {team.status === "ACTIVE" && botPreviews.get(team.id) && (
                    <div className="mt-4 rounded-2xl border border-green-500/20 bg-green-500/5 p-3">
                      {(() => {
                        const bot = botPreviews.get(team.id)!;
                        return (
                          <>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="flex items-center gap-2 text-xs font-bold text-green-200">
                                  <Bot size={14} />
                                  Possivel bot (normal): {bot.trainerName}
                                </p>
                                <p className="mt-1 text-[10px] text-slate-500">
                                  Faixa Nv.{bot.levelBandMin}-{bot.levelBandMax} | Recompensa estimada: {bot.rewardRange.coinsMin}-{bot.rewardRange.coinsMax} ZC / {bot.rewardRange.expMin}-{bot.rewardRange.expMax} EXP
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-600">
                                  O bot mostrado acima será o adversário real ao clicar em Combater. Escolha a dificuldade para ajustar o nível.
                                </p>
                              </div>
                              <BotBattleButton teamId={team.id} cooldownMs={bot.cooldownMs ?? 0} cooldownAfterMs={ARENA_Z_CONFIG.botCooldownMinutes * 60_000} />
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              {bot.mascots.map(m => (
                                <div key={m.id} className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-slate-950/50 p-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={getSpriteUrl(m.pokemonId, true)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
                                  <span className="min-w-0">
                                    <span className="block truncate text-[11px] font-semibold text-slate-100">{m.name}</span>
                                    <span className="block text-[10px] text-slate-500">Nv.{m.level} | {m.type} | For {m.force} | Vit {m.vitality}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* PvP — aberto para todos os jogadores */}
          <div className="rounded-2xl border border-red-500/20 bg-slate-950/60 p-5">
            <h2 className="font-semibold text-slate-200">⚔️ Arena PvP</h2>
            <p className="mt-1 text-xs text-slate-500">
              Ataque equipes de outros jogadores. Vencer rouba 30% do cofre adversário. Perder = mascotes feridos e 40% do cofre perdido. Cooldown: 10 min entre ataques, 30 min contra o mesmo time.
            </p>
            <div className="mt-4 space-y-4">
              {activeTeams.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-slate-500">Crie uma equipe ativa antes de testar PvP.</p>
              ) : readyActiveTeams.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-slate-500">Sua equipe ativa ainda esta em repouso ou tem mascote ferido.</p>
              ) : readyOpponentTeams.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-slate-500">Nenhuma equipe adversaria ativa disponivel.</p>
              ) : readyActiveTeams.map(attackTeam => (
                <div key={attackTeam.id} className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-sm font-bold text-red-100">Atacando com: {attackTeam.name}</p>
                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    {readyOpponentTeams.map(defenseTeam => (
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
            <h2 className="font-semibold text-slate-200">🏆 Ranking Arena Z</h2>
            <p className="mt-1 text-xs text-slate-500">
              Calculado a partir dos combates PvE e PvP resolvidos.
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

          <div className={`grid gap-4 ${admin ? "lg:grid-cols-2" : ""}`}>
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

            {admin && <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
              <h2 className="font-semibold text-slate-200">Controles admin</h2>
              <p className="mt-1 text-xs text-slate-500">Ferramentas de teste para ferimento, repouso e liberar estado.</p>
              <div className="mt-3">
                <PurgeAdminArenaButton />
              </div>
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
            </div>}
          </div>

          {/* Ataques oportunistas */}
          {injuredRivals.length > 0 && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
              <h2 className="flex items-center gap-2 font-semibold text-red-200">😈 Rivais Feridos</h2>
              <p className="mt-1 text-xs text-slate-500">Seus rivais estão feridos. Aproveite para um ataque oportunista.</p>
              <div className="mt-4 space-y-2">
                {injuredRivals.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-slate-950/50 p-3">
                    <span>
                      <span className="block text-xs font-semibold text-slate-200">{m.nickname ?? getPokemonName(m.pokemonId)} (Nv.{m.level})</span>
                      <span className="text-[10px] text-slate-500">de {m.player.displayName} — Ferido</span>
                    </span>
                    <OpportunisticAttackButton mascotId={m.id} mascotName={m.nickname ?? getPokemonName(m.pokemonId)} ownerName={m.player.displayName} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-slate-950/60 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-slate-200"><History size={16} /> Historico recente</h2>
            <div className="mt-4 space-y-3">
              {battles.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum combate registrado.</p>
              ) : battles.map(battle => {
                const log = Array.isArray(battle.turnLog) ? battle.turnLog as Array<{ turn: number; actorName: string; targetName: string; damage: number; advantageApplied?: boolean; action: string }> : [];
                const loot = readBattleLoot(battle.lootResult);
                const injuredCount = Array.isArray(battle.injuredMascotIds) ? battle.injuredMascotIds.length : 0;
                return (
                  <details key={battle.id} className="rounded-xl border border-border bg-slate-900/40 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                      {battle.createdAt.toLocaleString("pt-BR")} | {battle.botName ?? "PvP"} | {battle.result}
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      {loot && (
                        <span className="rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2 py-1 text-[#FFCB05]">
                          {loot.label}: {loot.coins} ZC / {loot.exp} EXP{loot.food > 0 ? ` / ${loot.food} comida` : ""}{loot.sweet > 0 ? ` / ${loot.sweet} doce` : ""}
                        </span>
                      )}
                      {injuredCount > 0 && (
                        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-1 text-red-200">
                          {injuredCount} ferido(s)
                        </span>
                      )}
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-slate-400">
                      {formatTurnLog(log).slice(0, 12).map((line, i) => (
                        <p key={i}>{line}</p>
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
