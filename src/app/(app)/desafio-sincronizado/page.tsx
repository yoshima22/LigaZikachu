import Image from "next/image";
import { Flame, Send, ShieldBan, Sparkles, Swords, Ticket, Waves } from "lucide-react";
import { SyncTicketSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { ensureSyncChallengeItems, getSideImage, getSideLabel, getSyncWindowState } from "@/lib/sync-challenge";
import { AdminTicketPanel } from "./_components/admin-ticket-panel";
import { adminSeedModifiersAction } from "./seed-modifiers-action";
import { SyncLineupPanel } from "./_components/sync-lineup-panel";
import { TeamConfirmPanel } from "./_components/team-confirm-panel";
import { SyncRoomPanel } from "./_components/sync-room-panel";
import { ModifierPanel } from "./_components/modifier-panel";
import { EventPreview } from "./_components/event-preview";
import { SimulationButton } from "./_components/simulation-button";
import { UndoSimulationButton } from "./_components/undo-simulation-button";
import {
  leaveTeamAction,
  confirmTeamAction,
  cancelSyncTeamAdminAction,
  combineSyncTicketsAction,
  createAdminSyncSimulationTeamAction,
  createOpenSyncTeamAction,
  grantDebugSyncHalfAction,
  grantValidSyncTicketForMeAction,
  joinOpenSyncTeamAction,
  transferSyncTicketHalfAction,
  updateSyncChallengeConfigAction,
} from "./actions";
import { adminFormRoomsAction } from "./combat-actions";

export const dynamic = "force-dynamic";

export default async function DesafioSincronizadoPage() {
  const session = await getAppSession();
  if (!session?.user) return null;

  const player = await getSessionPlayer(session.user.id);
  if (!player) {
    return <div className="py-20 text-center text-sm text-slate-500">Crie um jogador para acessar o evento.</div>;
  }

  const admin = isAdmin(session.user.role);
  await prisma.$transaction((tx) => ensureSyncChallengeItems(tx));

  const [halves, tickets, players, entries, config, openTeams] = await Promise.all([
    prisma.syncTicketHalf.findMany({
      where: { ownerId: player.id, status: { in: ["AVAILABLE", "SENT"] } },
      include: { generatedByPlayer: { select: { id: true, displayName: true, ptcglNick: true } } },
      orderBy: [{ side: "asc" }, { createdAt: "desc" }],
      take: 80,
    }),
    prisma.syncTicket.findMany({
      where: { ownerId: player.id, status: { in: ["AVAILABLE", "RESERVED"] } },
      include: {
        bannedUserA: { select: { id: true, displayName: true } },
        bannedUserB: { select: { id: true, displayName: true } },
        leftHalf: { include: { generatedByPlayer: { select: { displayName: true } } } },
        rightHalf: { include: { generatedByPlayer: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.player.findMany({
      where: { id: { not: player.id }, active: true, user: { status: "ACTIVE" } },
      select: { id: true, displayName: true, ptcglNick: true },
      orderBy: { displayName: "asc" },
      take: 80,
    }),
    prisma.syncChallengeEntry.findMany({
      where: { playerId: player.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, status: true, bansJson: true, consumedAt: true },
    }),
    prisma.syncChallengeConfig.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
    prisma.syncEventTeam.findMany({
      where: { status: { in: ["OPEN", "COMPLETE"] } },
      include: {
        playerA: { select: { id: true, displayName: true } },
        playerB: { select: { id: true, displayName: true } },
        ticketA: { include: { bannedUserA: { select: { displayName: true } }, bannedUserB: { select: { displayName: true } } } },
        ticketB: { include: { bannedUserA: { select: { displayName: true } }, bannedUserB: { select: { displayName: true } } } },
      },
      orderBy: { createdAt: "asc" },
      take: 24,
    }),
  ]);

  // Dupla ativa — inclui COMPLETE (aguardando confirmação) e fases de lineup
  const activeTeam = await prisma.syncEventTeam.findFirst({
    where: {
      status: { in: ["COMPLETE", "LINEUP_PENDING", "LINEUP_READY"] },
      OR: [{ playerAId: player.id }, { playerBId: player.id }],
    },
    include: {
      playerA: { select: { id: true, displayName: true } },
      playerB: { select: { id: true, displayName: true } },
      lineups: {
        include: { mascot: { select: { id: true, pokemonId: true, nickname: true, level: true } } },
        orderBy: { slot: "asc" },
      },
    },
  });

  const myMascots = activeTeam ? await prisma.mascot.findMany({
    where: { playerId: player.id },
    select: { id: true, pokemonId: true, nickname: true, level: true },
    orderBy: [{ level: "desc" }, { id: "asc" }],
    take: 200,
  }) : [];

  // Sala ativa ou finalizada hoje — dupla já foi atribuída a uma arena
  const activeRoom = await prisma.syncEventRoom.findFirst({
    where: {
      status: { not: "CANCELLED" },
      teams: { some: { OR: [{ playerAId: player.id }, { playerBId: player.id }] } },
    },
    orderBy: { formedAt: "desc" },
    include: {
      teams: {
        include: {
          playerA: { select: { id: true, displayName: true } },
          playerB: { select: { id: true, displayName: true } },
          lineups: { include: { mascot: { select: { id: true, pokemonId: true, nickname: true, level: true } } } },
        },
      },
      rounds: {
        include: {
          modifier: { select: { name: true, description: true, effectJson: true } },
          selections: true,
          matches: true,
        },
        orderBy: { roundNumber: "asc" },
      },
      scores: {
        include: { player: { select: { displayName: true } } },
        orderBy: [{ wins: "desc" }, { damageDone: "desc" }],
      },
    },
  });

  // Modificadores ativos — visíveis a todos para preview; admin vê todos
  const activeModifiers = await prisma.syncEventModifier.findMany({
    where: { active: true },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
  const allModifiers = admin ? await prisma.syncEventModifier.findMany({ orderBy: { active: "desc" } }) : [];

  // Ranking público de hoje — todas as salas do dia
  const { toBrtDateString } = await import("@/lib/date-utils");
  const todayDate = toBrtDateString(new Date());
  const todayRooms = await prisma.syncEventRoom.findMany({
    where: { date: todayDate, status: { not: "CANCELLED" } },
    orderBy: { roomIndex: "asc" },
    include: {
      teams: {
        include: {
          playerA: { select: { id: true, displayName: true } },
          playerB: { select: { id: true, displayName: true } },
        },
      },
      scores: {
        orderBy: [{ wins: "desc" }, { damageDone: "desc" }, { damageTaken: "asc" }],
        include: { player: { select: { id: true, displayName: true } } },
      },
    },
  });

  const leftHalves = halves.filter((half) => half.side === SyncTicketSide.LEFT);
  const rightHalves = halves.filter((half) => half.side === SyncTicketSide.RIGHT);
  const usableLeft = leftHalves.filter((half) => half.generatedByPlayerId !== player.id);
  const usableRight = rightHalves.filter((half) => half.generatedByPlayerId !== player.id);
  const availableTickets = tickets.filter((ticket) => ticket.status === "AVAILABLE");
  const windowState = getSyncWindowState(config, new Date(), { admin });

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-[#FFCB05]/25 bg-gradient-to-br from-[#170b06] via-[#0b1021] to-[#06131d]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#FFCB05]">
              <Sparkles size={14} /> Arena Sincronizada
            </div>
            <div>
              <h1 className="font-pixel text-lg text-[#FFCB05]">Desafio Sincronizado</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Monte tickets com outros jogadores, forme uma dupla e enfrente combates com regras surpresa. Metades geradas por voce
                precisam circular: voce nao pode usa-las no seu proprio ticket.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TicketCounter label="Esquerda" count={leftHalves.length} tone="fire" />
              <TicketCounter label="Direita" count={rightHalves.length} tone="water" />
              <TicketCounter label="Completos" count={tickets.length} tone="complete" />
            </div>
          </div>
          <div className="relative min-h-[240px]">
            <Image
              src="/events/desafio-sincronizado/ticket-completo-agua-fogo.webp"
              alt="Ticket completo do Desafio Sincronizado"
              fill
              sizes="(max-width: 1024px) 100vw, 420px"
              className="object-contain drop-shadow-[0_0_30px_rgba(255,203,5,0.25)]"
              priority
            />
          </div>
        </div>
      </section>

      {/* ── Preview público: recompensas + modificadores ─────────────── */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-[#FFCB05]" />
          <h2 className="font-semibold text-slate-100">O que está em jogo</h2>
        </div>
        <EventPreview modifiers={activeModifiers} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Ticket size={18} className="text-[#FFCB05]" />
          <h2 className="font-semibold text-slate-100">Minhas metades</h2>
        </div>
        <p className="mb-4 text-sm text-slate-400">
          Metades nao podem ser vendidas. Elas so circulam por presente/envio direto. A origem sempre fica gravada.
        </p>
        {halves.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-slate-500">
            Voce ainda nao possui metades. Elas podem cair em Arena, expedicoes, reciclagem e vitorias TCG validadas.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {halves.map((half) => (
              <div key={half.id} className="rounded-xl border border-border bg-slate-950/60 p-3">
                <div className="flex gap-3">
                  <Image src={getSideImage(half.side)} alt={getSideLabel(half.side)} width={72} height={96} className="h-24 w-16 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-100">{getSideLabel(half.side)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Gerada por: <span className="text-slate-200">{half.generatedByPlayer.displayName}</span>
                    </p>
                    <p className="text-xs text-slate-500">Origem: {half.sourceAction}</p>
                    {half.generatedByPlayerId === player.id && (
                      <p className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-200">
                        Voce gerou esta metade. Envie para outro jogador; voce nao pode usa-la.
                      </p>
                    )}
                  </div>
                </div>
                <form action={async (formData) => {
                  "use server";
                  await transferSyncTicketHalfAction(formData);
                }} className="mt-3 flex gap-2">
                  <input type="hidden" name="halfId" value={half.id} />
                  <select name="targetPlayerId" className="min-w-0 flex-1 rounded-lg border border-border bg-slate-950 px-2 py-2 text-xs text-slate-100">
                    {players.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.displayName}{target.ptcglNick ? ` (${target.ptcglNick})` : ""}
                      </option>
                    ))}
                  </select>
                  <button className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-100">
                    <Send size={13} /> Enviar
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-100">Janelas e duplas</h2>
            <p className="mt-1 text-xs text-slate-500">
              Criacao/entrada: {describeRegistrationWindow(config)}. Agora: {windowState.currentTime} BRT - {windowState.label}
            </p>
            {windowState.simulation && (
              <p className="mt-1 text-xs font-semibold text-amber-200">
                Simulacao admin ativa: voce pode testar a janela como se o evento estivesse acontecendo.
              </p>
            )}
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${windowState.isOpen ? "border-green-400/40 bg-green-500/10 text-green-200" : "border-slate-600 bg-slate-900 text-slate-400"}`}>
            {windowState.isOpen ? "Janela aberta" : "Janela fechada"}
          </span>
        </div>

        <form action={async (formData) => {
          "use server";
          await createOpenSyncTeamAction(formData);
        }} className="mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <select name="ticketId" className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100">
            {availableTickets.map((ticket) => (
              <option key={ticket.id} value={ticket.id}>
                Ticket com bans: {ticket.bannedUserA.displayName} / {ticket.bannedUserB.displayName}
              </option>
            ))}
          </select>
          <button disabled={availableTickets.length < 1 || !windowState.isOpen} className="rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            Criar dupla aberta
          </button>
        </form>

        {openTeams.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-slate-500">Nenhuma dupla aberta ou completa no momento.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {openTeams.map((team) => {
              const bannedByA = [team.ticketA.bannedUserA.displayName, team.ticketA.bannedUserB.displayName].join(" / ");
              return (
                <div key={team.id} className="rounded-xl border border-border bg-slate-950/60 p-4">
                  <p className="font-semibold text-slate-100">{team.playerA.displayName} {team.playerB ? `+ ${team.playerB.displayName}` : "+ aguardando parceiro"}</p>
                  <p className="mt-1 text-xs text-slate-500">Status: {team.status}</p>
                  <p className="mt-1 text-xs text-red-200">Bans do criador: {bannedByA}</p>
                  {team.status === "OPEN" && team.playerAId !== player.id && (
                    <form action={async (formData) => {
                      "use server";
                      await joinOpenSyncTeamAction(formData);
                    }} className="mt-3 grid gap-2">
                      <input type="hidden" name="teamId" value={team.id} />
                      <select name="ticketId" className="rounded-lg border border-border bg-slate-950 px-2 py-2 text-xs text-slate-100">
                        {availableTickets.map((ticket) => (
                          <option key={ticket.id} value={ticket.id}>
                            Meu ticket: bans {ticket.bannedUserA.displayName} / {ticket.bannedUserB.displayName}
                          </option>
                        ))}
                      </select>
                      <button disabled={availableTickets.length < 1 || !windowState.isOpen} className="rounded-lg border border-cyan-400/40 px-3 py-2 text-xs font-bold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">
                        Entrar nesta dupla
                      </button>
                    </form>
                  )}
                  {admin && (
                    <form action={async (formData) => {
                      "use server";
                      await cancelSyncTeamAdminAction(formData);
                    }} className="mt-3">
                      <input type="hidden" name="teamId" value={team.id} />
                      <button className="w-full rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200">
                        Cancelar dupla e liberar tickets
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Dupla ativa: confirmação e escalação ─────────────────────── */}
      {activeTeam && activeTeam.playerB && (() => {
        const isA = activeTeam.playerAId === player.id;
        const partner = isA ? activeTeam.playerB : activeTeam.playerA;
        const iConfirmed = isA ? activeTeam.confirmedA : activeTeam.confirmedB;
        const partnerConfirmed = isA ? activeTeam.confirmedB : activeTeam.confirmedA;
        const bothConfirmed = activeTeam.status !== "COMPLETE";

        const myLineup = activeTeam.lineups.filter((l) => l.playerId === player.id);
        const partnerLineup = activeTeam.lineups.filter((l) => l.playerId === partner.id);
        const myLocked = isA ? activeTeam.lineupStatusA === "LOCKED" : activeTeam.lineupStatusB === "LOCKED";
        const partnerLocked = isA ? activeTeam.lineupStatusB === "LOCKED" : activeTeam.lineupStatusA === "LOCKED";

        return (
          <section className="rounded-2xl border border-[#FFCB05]/20 bg-card p-5 space-y-5">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤝</span>
              <div>
                <h2 className="font-semibold text-slate-100">
                  {bothConfirmed ? "Escalação da dupla" : "Confirmar dupla"}
                </h2>
                <p className="text-xs text-slate-500">
                  {bothConfirmed
                    ? `Dupla com ${partner.displayName} confirmada. Escolha 9 Pokémon e trave sua escalação.`
                    : `Dupla formada com ${partner.displayName}. Ambos precisam confirmar.`}
                </p>
              </div>
            </div>

            {!bothConfirmed && (
              <TeamConfirmPanel
                partnerName={partner.displayName}
                iConfirmed={iConfirmed}
                partnerConfirmed={partnerConfirmed}
              />
            )}

            {admin && (
              <form action={async (fd) => { "use server"; await cancelSyncTeamAdminAction(fd); }} className="flex justify-end">
                <input type="hidden" name="teamId" value={activeTeam.id} />
                <button className="rounded-lg border border-red-400/30 bg-red-500/5 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/15">
                  Admin: cancelar dupla e liberar tickets
                </button>
              </form>
            )}

            {bothConfirmed && (
              <SyncLineupPanel
                teamId={activeTeam.id}
                playerId={player.id}
                partnerPlayerId={partner.id}
                partnerName={partner.displayName}
                myLineup={myLineup as Parameters<typeof SyncLineupPanel>[0]["myLineup"]}
                partnerLineup={partnerLineup as Parameters<typeof SyncLineupPanel>[0]["partnerLineup"]}
                myLocked={myLocked}
                partnerLocked={partnerLocked}
                myMascots={myMascots}
                isAdmin={admin}
              />
            )}
          </section>
        );
      })()}

      {/* ── Sala/Arena ativa ──────────────────────────────────────────── */}
      {activeRoom && (
        <section className="rounded-2xl border border-[#FFCB05]/20 bg-card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Swords size={18} className="text-[#FFCB05]" />
            <h2 className="font-semibold text-slate-100">Evento em andamento</h2>
          </div>
          <SyncRoomPanel
            room={activeRoom as unknown as Parameters<typeof SyncRoomPanel>[0]["room"]}
            playerId={player.id}
            isAdmin={admin}
            myLineupMascots={myMascots}
          />
        </section>
      )}

      {/* ── Ranking público de hoje ───────────────────────────────── */}
      {todayRooms.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Swords size={18} className="text-[#FFCB05]" />
            <h2 className="font-semibold text-slate-100">Ranking de hoje</h2>
          </div>
          <div className="space-y-6">
            {todayRooms.map((room) => {
              // Agrupa scores por dupla — pega o melhor de cada
              const teamMap = new Map<string, { name: string; wins: number; damageDone: number; damageTaken: number; finalPosition: number | null }>();
              for (const score of room.scores) {
                const team = room.teams.find((t) => t.id === score.teamId);
                if (!team) continue;
                const name = `${team.playerA.displayName}${team.playerB ? ` + ${team.playerB.displayName}` : ""}`;
                const existing = teamMap.get(score.teamId);
                if (!existing || score.wins > existing.wins) {
                  teamMap.set(score.teamId, {
                    name,
                    wins: score.wins,
                    damageDone: score.damageDone,
                    damageTaken: score.damageTaken,
                    finalPosition: score.finalPosition,
                  });
                }
              }
              const ranking = [...teamMap.values()].sort((a, b) => {
                if (a.finalPosition !== null && b.finalPosition !== null) return a.finalPosition - b.finalPosition;
                if (a.finalPosition !== null) return -1;
                if (b.finalPosition !== null) return 1;
                if (b.wins !== a.wins) return b.wins - a.wins;
                if (b.damageDone !== a.damageDone) return b.damageDone - a.damageDone;
                return a.damageTaken - b.damageTaken;
              });
              const medals = ["🥇", "🥈", "🥉", "4️⃣"];
              const statusLabels: Record<string, string> = {
                READY: "Aguardando início",
                ROUND_1: "Rodada 1",
                ROUND_2: "Rodada 2",
                ROUND_3: "Rodada 3",
                TIEBREAK: "Desempate",
                FINISHED: "Finalizado",
              };
              return (
                <div key={room.id}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200">Sala {room.roomIndex}</h3>
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-slate-400">
                      {statusLabels[room.status] ?? room.status}
                    </span>
                  </div>
                  {ranking.length === 0 ? (
                    <p className="text-xs text-slate-500">Combates ainda não iniciados.</p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-slate-950/60 text-slate-400">
                            <th className="p-2 text-left">#</th>
                            <th className="p-2 text-left">Dupla</th>
                            <th className="p-2 text-right">Vitórias</th>
                            <th className="p-2 text-right">Dano</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ranking.map((row, idx) => (
                            <tr key={row.name} className="border-b border-border/50 last:border-0">
                              <td className="p-2 text-base">{medals[idx] ?? idx + 1}</td>
                              <td className="p-2 font-medium text-slate-200">{row.name}</td>
                              <td className="p-2 text-right text-slate-300">{row.wins}</td>
                              <td className="p-2 text-right text-slate-400">{row.damageDone}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Admin: gerenciar salas e modificadores ───────────────────── */}
      {admin && (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-6">
          <div className="space-y-3">
            <h2 className="font-semibold text-slate-100">Admin — Gerenciar salas</h2>
            <form action={async () => {
              "use server";
              await adminFormRoomsAction();
            }}>
              <button className="rounded-lg border border-[#FFCB05]/40 px-4 py-2 text-sm font-bold text-[#FFCB05]">
                Fechar inscrições e formar salas agora
              </button>
            </form>
          </div>

          <div className="border-t border-border pt-5 space-y-3">
            <h2 className="font-semibold text-slate-100">Admin — Simulação completa</h2>
            <SimulationButton />
            <UndoSimulationButton />
          </div>

          <div className="border-t border-border pt-5 space-y-3">
            <h2 className="font-semibold text-slate-100">Admin — Modificadores de rodada</h2>
            <form action={async () => {
              "use server";
              await adminSeedModifiersAction();
            }} className="mb-3">
              <button className="inline-flex items-center gap-2 rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-200 hover:bg-violet-500/20">
                <Sparkles size={13} /> Popular todos os modificadores do PDF (upsert)
              </button>
            </form>
            <ModifierPanel modifiers={allModifiers} />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={18} className="text-[#FFCB05]" />
          <h2 className="font-semibold text-slate-100">Montar ticket completo</h2>
        </div>
        <p className="text-sm text-slate-400">
          Escolha uma metade esquerda e uma direita. As duas precisam ter sido geradas por jogadores diferentes e nenhuma pode ter sido gerada por voce.
        </p>
        <form action={async (formData) => {
          "use server";
          await combineSyncTicketsAction(formData);
        }} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select name="leftHalfId" className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100">
            {usableLeft.map((half) => (
              <option key={half.id} value={half.id}>
                Esquerda - gerada por {half.generatedByPlayer.displayName}
              </option>
            ))}
          </select>
          <select name="rightHalfId" className="rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100">
            {usableRight.map((half) => (
              <option key={half.id} value={half.id}>
                Direita - gerada por {half.generatedByPlayer.displayName}
              </option>
            ))}
          </select>
          <button disabled={usableLeft.length < 1 || usableRight.length < 1} className="rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
            Montar
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldBan size={18} className="text-red-300" />
          <h2 className="font-semibold text-slate-100">Meus tickets completos</h2>
        </div>
        {tickets.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum ticket completo montado ainda.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-xl border border-[#FFCB05]/20 bg-slate-950/60 p-4">
                <div className="flex gap-3">
                  <Image src="/events/desafio-sincronizado/ticket-completo-agua-fogo.webp" alt="Ticket completo" width={88} height={120} className="h-28 w-20 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#FFCB05]">Ticket completo</p>
                    <p className="mt-1 text-xs text-slate-400">Status: {ticket.status}</p>
                    <p className="mt-2 text-xs text-red-200">
                      Bans da sala: {ticket.bannedUserA.displayName} e {ticket.bannedUserB.displayName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Metades: {ticket.leftHalf.generatedByPlayer.displayName} + {ticket.rightHalf.generatedByPlayer.displayName}
                    </p>
                  </div>
                </div>
                {ticket.status === "AVAILABLE" ? (
                  <p className="mt-3 rounded-lg border border-[#FFCB05]/20 bg-[#FFCB05]/10 px-3 py-2 text-xs text-[#FFCB05]">
                    Disponivel para criar ou entrar em uma dupla na secao Janelas e duplas.
                  </p>
                ) : (
                  <p className="mt-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400">
                    Ticket ja reservado por uma dupla ativa.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold text-slate-100">Entradas consumidas antigas</h2>
        <p className="mt-1 text-xs text-slate-500">Mantido apenas para compatibilidade com registros criados antes da regra completa do PDF.</p>
        <div className="mt-4 space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma entrada antiga.</p>
          ) : entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-slate-950/60 p-3 text-xs text-slate-400">
              {new Date(entry.consumedAt).toLocaleString("pt-BR")} - {entry.status}
            </div>
          ))}
        </div>
      </section>

      {admin && (
        <section className="rounded-2xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 p-5">
          <h2 className="font-semibold text-[#FFCB05]">Ferramentas admin de teste</h2>
          <p className="mt-1 text-xs text-slate-400">Gera metade com voce como criador. Pela regra oficial, voce precisara enviar essa metade para outro jogador.</p>

          <AdminTicketPanel players={players} />

          <div className="mt-4 flex flex-wrap gap-2">
            <form action={async () => {
              "use server";
              await grantDebugSyncHalfAction("LEFT");
            }}>
              <button className="inline-flex items-center gap-2 rounded-lg border border-orange-400/50 px-3 py-2 text-xs font-bold text-orange-200"><Flame size={14} /> Gerar esquerda</button>
            </form>
            <form action={async () => {
              "use server";
              await grantDebugSyncHalfAction("RIGHT");
            }}>
              <button className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/50 px-3 py-2 text-xs font-bold text-cyan-100"><Waves size={14} /> Gerar direita</button>
            </form>
            <form action={async () => {
              "use server";
              await grantValidSyncTicketForMeAction();
            }}>
              <button className="inline-flex items-center gap-2 rounded-lg border border-[#FFCB05]/60 px-3 py-2 text-xs font-bold text-[#FFCB05]"><Ticket size={14} /> Gerar ticket válido</button>
            </form>
            <form action={async () => {
              "use server";
              await createAdminSyncSimulationTeamAction();
            }}>
              <button className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/50 px-3 py-2 text-xs font-bold text-emerald-100"><Sparkles size={14} /> Simular dupla completa</button>
            </form>
          </div>
        </section>
      )}

      {admin && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold text-slate-100">Configuracao do evento</h2>
          <form action={updateSyncChallengeConfigAction} className="mt-4 space-y-4">
            <div className="rounded-2xl border border-[#FFCB05]/20 bg-slate-950/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#FFCB05]">Agenda do proximo evento</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Datas em horario de Brasilia. A janela de inscricao controla quando jogadores podem criar/entrar em duplas.
                  </p>
                </div>
                <label className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                  <input name="adminSimulationEnabled" type="checkbox" defaultChecked={config.adminSimulationEnabled} className="mr-2" />
                  Simulacao admin ativa
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <DateTimeInput name="registrationOpensAt" label="Abre inscricoes" value={config.registrationOpensAt} />
                <DateTimeInput name="registrationClosesAt" label="Fecha inscricoes" value={config.registrationClosesAt} />
                <DateTimeInput name="round1At" label="Rodada 1" value={config.round1At} />
                <DateTimeInput name="round2At" label="Rodada 2" value={config.round2At} />
                <DateTimeInput name="round3At" label="Rodada 3" value={config.round3At} />
                <DateTimeInput name="tiebreakAt" label="Desempate" value={config.tiebreakAt} />
                <DateTimeInput name="rewardsAt" label="Premiacao" value={config.rewardsAt} />
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <label className="rounded-xl border border-border bg-slate-950/60 p-3 text-xs text-slate-300">
                <input name="ticketsEnabled" type="checkbox" defaultChecked={config.ticketsEnabled} className="mr-2" />
                Sistema ativo
              </label>
              <label className="rounded-xl border border-border bg-slate-950/60 p-3 text-xs text-slate-300">
                <input name="dropFromPve" type="checkbox" defaultChecked={config.dropFromPve} className="mr-2" />
                Drop PvE
              </label>
              <label className="rounded-xl border border-border bg-slate-950/60 p-3 text-xs text-slate-300">
                <input name="dropFromPvp" type="checkbox" defaultChecked={config.dropFromPvp} className="mr-2" />
                Drop PvP
              </label>
              <label className="rounded-xl border border-border bg-slate-950/60 p-3 text-xs text-slate-300">
                <input name="dropFromExpedition" type="checkbox" defaultChecked={config.dropFromExpedition} className="mr-2" />
                Drop expedição
              </label>
              <label className="rounded-xl border border-border bg-slate-950/60 p-3 text-xs text-slate-300">
                <input name="dropFromCraftingDustRecycle" type="checkbox" defaultChecked={config.dropFromCraftingDustRecycle} className="mr-2" />
                Drop reciclagem
              </label>
              <label className="rounded-xl border border-border bg-slate-950/60 p-3 text-xs text-slate-300">
                <input name="dropFromTcgMatch" type="checkbox" defaultChecked={config.dropFromTcgMatch} className="mr-2" />
                Drop vitória TCG
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <ChanceInput name="pveDropChance" label="PvE (%)" value={config.pveDropChance} />
              <ChanceInput name="pvpDropChance" label="PvP (%)" value={config.pvpDropChance} />
              <ChanceInput name="expedition3hDropChance" label="Expedição 3h (%)" value={config.expedition3hDropChance} />
              <ChanceInput name="expedition6hDropChance" label="Expedição 6h (%)" value={config.expedition6hDropChance} />
              <ChanceInput name="recycleDropChance" label="Reciclagem 6 mascotes (%)" value={config.recycleDropChance} />
              <ChanceInput name="tcgWinDropChance" label="Vitória TCG validada (%)" value={config.tcgWinDropChance} />
            </div>
            <button className="rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-950">Salvar configuração</button>
          </form>
        </section>
      )}
    </div>
  );
}

function TicketCounter({ label, count, tone }: { label: string; count: number; tone: "fire" | "water" | "complete" }) {
  const styles = {
    fire: "border-orange-400/30 bg-orange-500/10 text-orange-100",
    water: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
    complete: "border-[#FFCB05]/30 bg-[#FFCB05]/10 text-[#FFCB05]",
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 ${styles}`}>
      <p className="text-xs uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black">{count}</p>
    </div>
  );
}

function toDatetimeLocal(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(" ", "T");
}

function formatBrt(value?: Date | string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function describeRegistrationWindow(config: { registrationOpensAt?: Date | string | null; registrationClosesAt?: Date | string | null }) {
  const opens = formatBrt(config.registrationOpensAt);
  const closes = formatBrt(config.registrationClosesAt);
  if (opens && closes) return `${opens} ate ${closes} BRT`;
  if (opens) return `a partir de ${opens} BRT`;
  if (closes) return `ate ${closes} BRT`;
  return "14:00 ate 17:00 BRT";
}

function DateTimeInput({ name, label, value }: { name: string; label: string; value?: Date | string | null }) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <input
        name={name}
        type="datetime-local"
        defaultValue={toDatetimeLocal(value)}
        className="mt-1 w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100"
      />
    </label>
  );
}

function ChanceInput({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <input
        name={name}
        type="number"
        min={0}
        max={100}
        step={0.1}
        defaultValue={Math.round(value * 1000) / 10}
        className="mt-1 w-full rounded-xl border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100"
      />
    </label>
  );
}
