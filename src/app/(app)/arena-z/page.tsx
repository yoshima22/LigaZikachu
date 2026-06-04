import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Swords, Bot, Lock, Coins, HeartPulse, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import { ARENA_Z_CONFIG } from "@/lib/arena-z";
import { createArenaTeamAction } from "./actions";
import { AdminMascotStateButton, BotBattleButton, RetireTeamButton, SusButton } from "./_components/arena-z-buttons";

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

export default async function ArenaZPage() {
  const session = await getAppSession();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/dashboard");

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true },
  });
  if (!player) redirect("/dashboard");

  const [wallet, mascots, teams, battles] = await Promise.all([
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
    prisma.arenaBattle.findMany({
      where: { attackerPlayerId: player.id },
      orderBy: { createdAt: "desc" },
      take: 10,
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
        <div className="rounded-2xl border border-slate-700 bg-slate-950/50 p-4 opacity-70">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-300"><Lock size={16} /> Arena PvP</p>
          <p className="mt-1 text-xs text-slate-500">Estrutura preparada no banco. Tela e desafios publicos ficam bloqueados ate a proxima fase.</p>
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
