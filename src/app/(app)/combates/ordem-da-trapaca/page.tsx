import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AlertTriangle, Bug, Eye, Flag, Radar, ShieldAlert, Skull, Sparkles } from "lucide-react";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getStaticSpriteUrl } from "@/lib/mascot-data";
import { ORDER_EVENT_IMAGES } from "@/lib/order-event-assets";
import { getBossHpPercent, getOrderEventPageData, RAID_PHASE_LABELS } from "@/lib/raid-event";
import {
  createOrderClueAction,
  prepareOrderEventAction,
  clearOrderSabotagesAction,
  resetOrderEventLocalAction,
  releaseDailyOrderCluesAction,
  releaseAllOrderCluesAction,
  revealNextOrderClueAction,
  resetOrderStepsForTestAction,
  resolveOrderStepForTestAction,
  seedOrderSabotagesAction,
  setOrderInjuryEmergencyAction,
  setOrderEventPhaseAction,
  submitOrderRaidPasswordAction,
  testOrderMascotInjuryAction,
  toggleOrderClueVisibilityAction,
  toggleOrderSabotageAction,
  healOrderRaidMascotSusAction,
  debugSetOrderBossHpPercentAction,
  debugRecalculateOrderBossHpAction,
} from "./actions";
import { resetOrderIntroForMeAction } from "../../_components/order-event-intro-actions";
import { OrderEventHelpButton } from "../../_components/order-event-intro-modal";
import { OrderRaidTeamSelector } from "./_components/order-raid-team-selector";
import { OrderRaidEscapeTimer } from "./_components/order-raid-escape-timer";

export const dynamic = "force-dynamic";

const PHASES = [
  "ANNOUNCED",
  "INVESTIGATION",
  "HIDEOUT_FOUND",
  "RAID_ACTIVE",
  "RAID_DEFEATED",
  "RAID_FAILED",
  "ENDED",
];

function phaseTone(phase: string) {
  if (phase === "RAID_ACTIVE") return "border-red-500/40 bg-red-500/10 text-red-200";
  if (phase === "HIDEOUT_FOUND") return "border-purple-500/40 bg-purple-500/10 text-purple-200";
  if (phase === "RAID_DEFEATED") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  if (phase === "RAID_FAILED") return "border-orange-500/40 bg-orange-500/10 text-orange-200";
  return "border-[#FFCB05]/35 bg-[#FFCB05]/10 text-[#FFCB05]";
}

function isRaidRevealed(phase: string) {
  return ["RAID_ACTIVE", "RAID_DEFEATED", "RAID_FAILED", "ENDED"].includes(phase);
}

const STEP_PUBLIC_LABELS: Record<string, string> = {
  ZIKALOOT_FAKE_NUMBER: "ZikaLoot roubada",
  BAZAR_SLOT_SIX_CLICKS: "Bazar sabotado",
  LAB_SMOKE_TO_MACHINE: "Laboratorio travado",
  MASCOT_LEAGUE_LAST_PLACE_THREE_CLICKS: "Liga Semanal adulterada",
  MASCOTS_EQUIPPED_WHISPER: "Mascotes atacados",
};

function effectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export default async function OrdemDaTrapacaPage({
  searchParams,
}: {
  searchParams?: Promise<{ pistas?: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");
  const admin = isAdmin(session.user.role);

  const params = await searchParams;
  const cluePage = Math.max(1, Number(params?.pistas ?? "1") || 1);
  const data = await getOrderEventPageData({ cluePage, cluePageSize: 12 });
  const event = data.event;
  if (!admin && (!event?.active || event.phase === "ENDED")) redirect("/dashboard");
  const hpPercent = event ? getBossHpPercent(event) : 0;
  const raidRevealed = event ? isRaidRevealed(event.phase) : false;
  const megaRevealed = raidRevealed && event ? hpPercent <= event.megaThresholdPercent : false;
  const visibleClues = data.clues.filter((clue) => clue.visible);
  const generalClues = data.clues.filter((clue) => !clue.relatedStepKey);
  const resolvedSteps = data.steps.filter((step) => step.resolvedAt);
  const cluePrevPage = Math.max(1, data.cluePagination.page - 1);
  const clueNextPage = Math.min(data.cluePagination.totalPages, data.cluePagination.page + 1);
  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  }).catch(() => null);
  type RaidAvailableMascot = {
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
  const emptyRaidMascots: RaidAvailableMascot[] = [];
  const [lastRaidAttempt, injuredMascots, raidAvailableMascots, recentRaidAttempts] = player && event?.id ? await Promise.all([
    prisma.raidBattleAttempt.findFirst({
      where: { raidEventId: event.id, playerId: player.id },
      select: { createdAt: true, damageToBoss: true, result: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mascot.findMany({
      where: { playerId: player.id, arenaState: "INJURED" },
      select: { id: true, pokemonId: true, nickname: true, level: true, injuredAt: true },
      orderBy: { injuredAt: "desc" },
      take: 12,
    }),
    prisma.mascot.findMany({
      where: {
        playerId: player.id,
        arenaState: "FREE",
        expeditions: { none: { status: "ACTIVE" } },
      },
      select: {
        id: true,
        pokemonId: true,
        nickname: true,
        level: true,
        statForce: true,
        statAgility: true,
        statInstinct: true,
        statVitality: true,
        statCharisma: true,
      },
      orderBy: [{ level: "desc" }, { statForce: "desc" }, { statInstinct: "desc" }],
      take: 120,
    }),
    prisma.raidBattleAttempt.findMany({
      where: { raidEventId: event.id },
      select: {
        id: true,
        damageToBoss: true,
        createdAt: true,
        player: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]) : [null, [], emptyRaidMascots, []];
  const raidCooldownUntil = lastRaidAttempt ? new Date(lastRaidAttempt.createdAt.getTime() + 30 * 60 * 1000) : null;
  const raidOnCooldown = raidCooldownUntil ? raidCooldownUntil.getTime() > Date.now() : false;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <section className="relative overflow-hidden rounded-3xl border border-purple-500/25 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.22),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(3,7,18,0.98))] p-5 shadow-2xl">
        <div className="absolute right-6 top-5 hidden rotate-6 text-7xl font-black text-purple-500/10 sm:block">TRAPAÇA</div>
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex-1 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-purple-200">
              <ShieldAlert size={14} />
              {admin ? "Painel da Ordem" : "Evento especial"}
            </div>
            <div>
              <h1 className="font-pixel text-3xl text-[#FFCB05] sm:text-4xl">Ordem da Trapaça</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                {admin
                  ? "Central de controle da investigação. Acompanhe pistas, travessuras, fases do mistério e o avanço coletivo da Liga contra a Ordem."
                  : "A Ordem da Trapaça invadiu a Liga. Pistas públicas serão liberadas ao longo da investigação."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full border px-3 py-1 font-semibold ${event ? phaseTone(event.phase) : "border-slate-700 bg-slate-900 text-slate-400"}`}>
                {event ? RAID_PHASE_LABELS[event.phase] ?? event.phase : "Não preparado"}
              </span>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">
                {event?.active ? "Investigação ativa" : "Investigação inativa"}
              </span>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-cyan-200">
                Mistério em progresso
              </span>
              <OrderEventHelpButton />
            </div>
          </div>

          <div className="rounded-3xl border border-purple-400/30 bg-slate-950/70 p-4 text-center">
            <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">{raidRevealed ? "Inimigo encontrado" : "Investigação"}</p>
            <div className="flex items-center justify-center gap-4">
              <img
                src={raidRevealed ? getStaticSpriteUrl(megaRevealed ? event?.bossMegaPokemonId ?? 10066 : event?.bossPokemonId ?? 302) : ""}
                alt=""
                className={raidRevealed ? "h-24 w-24 object-contain drop-shadow-[0_0_18px_rgba(168,85,247,0.55)]" : "hidden"}
                style={{ imageRendering: "pixelated" }}
              />
              {!raidRevealed && (<span className="flex h-24 w-24 items-center justify-center rounded-full border border-purple-400/25 bg-purple-500/10 text-4xl font-black text-purple-200">?</span>)}
            </div>
            <p className="mt-2 text-sm font-bold text-white">
              {raidRevealed ? (megaRevealed ? event?.bossMascotName ?? "Mega Sableye Trapaceiro" : event?.bossName ?? "Capitao Trambique") : "Esconderijo oculto"}
            </p>
            <p className="text-[11px] text-slate-400">{raidRevealed ? "O esconderijo foi encontrado. A Liga agora precisa avançar unida contra a Ordem." : "A investigação ainda está em andamento. Reúna pistas e resolva as travessuras para descobrir o próximo passo."}</p>
          </div>
        </div>
      </section>

      {!data.schemaReady && (
        <section className="rounded-2xl border border-orange-500/35 bg-orange-500/10 p-4 text-sm text-orange-100">
          <p className="font-bold">Schema do evento ainda não está aplicado neste banco.</p>
          <p className="mt-1 text-xs leading-relaxed text-orange-200/80">
            A tela foi carregada em modo seguro. Para testar localmente, use um banco local ou branch/dev do Supabase e rode
            <code className="mx-1 rounded bg-black/30 px-1.5 py-0.5">npx prisma db push</code>
            apontando para esse ambiente, nunca para produção sem aprovação.
          </p>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Eye size={16} />} label="Pistas visíveis" value={`${data.stats.visibleClues}/${data.stats.totalClues}`} />
        <StatCard icon={<Flag size={16} />} label="Etapas resolvidas" value={`${data.stats.resolvedSteps}/${data.stats.totalSteps}`} />
        <StatCard icon={<Bug size={16} />} label="Travessuras ativas" value={String(data.stats.activeSabotages)} />
        {raidRevealed ? (
          <StatCard icon={<Skull size={16} />} label="Investidas contra a Ordem" value={String(data.stats.battleAttempts)} />
        ) : (
          <StatCard icon={<Skull size={16} />} label="Porta do esconderijo" value={event?.phase === "HIDEOUT_FOUND" ? "Fechada" : "Oculta"} />
        )}
      </section>

      {event ? (
        <section className={`grid gap-4 ${raidRevealed ? "lg:grid-cols-[1.1fr_0.9fr]" : "lg:grid-cols-1"}`}>
          {event.phase === "HIDEOUT_FOUND" && (
            <div className="rounded-2xl border border-[#FFCB05]/35 bg-[#FFCB05]/10 p-4">
              <div className="mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FFCB05]">Porta do esconderijo</p>
                <h2 className="mt-1 text-lg font-black text-white">Digite a senha da Ordem</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  Compare os carimbos nos perfis dos jogadores. Em cada carimbo, apenas o digito verde esta na posicao certa.
                </p>
              </div>
              <form action={submitOrderRaidPasswordAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  name="password"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  className="rounded-xl border border-[#FFCB05]/30 bg-slate-950 px-4 py-3 font-pixel text-lg tracking-[0.35em] text-[#FFCB05] outline-none focus:border-[#FFCB05]"
                  required
                />
                <button className="rounded-xl bg-[#FFCB05] px-5 py-3 text-sm font-black text-slate-950 transition hover:brightness-110">
                  Abrir esconderijo
                </button>
              </form>
              <p className="mt-2 text-[10px] text-slate-500">Ao acertar, a porta se abre e a proxima fase comeca.</p>
            </div>
          )}

          {raidRevealed && (
          <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-100">
              <Radar size={16} className="text-red-300" />
              {raidRevealed ? "Resistência da Ordem" : "Esconderijo ainda oculto"}
            </div>
            <div className="mb-2 flex items-end justify-between text-xs">
              <span className="text-slate-400">{raidRevealed ? (megaRevealed ? event.bossMascotName : event.bossName) : "Investigacao em andamento"}</span>
              <span className="font-bold text-red-200">{raidRevealed ? `${event.bossHpCurrent.toLocaleString("pt-BR")} / ${event.bossHpMax.toLocaleString("pt-BR")}` : "HP oculto"}</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-950 ring-1 ring-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-red-600 via-orange-400 to-[#FFCB05]" style={{ width: raidRevealed ? `${hpPercent}%` : "0%" }} />
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-purple-400/25 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.16),transparent_58%),#050816]">
              <img
                src={ORDER_EVENT_IMAGES.captain}
                alt="Capitao Trambique"
                className="h-auto max-h-[520px] w-full object-contain"
                loading="lazy"
              />
            </div>
            {event.phase === "RAID_ACTIVE" && (
              <div className="mt-3">
                <OrderRaidEscapeTimer raidEndsAt={event.raidEndsAt} />
              </div>
            )}
            {raidRevealed && megaRevealed ? (
              <div className="mt-3 rounded-2xl border border-fuchsia-400/50 bg-fuchsia-500/15 p-3 text-left shadow-[0_0_24px_rgba(217,70,239,0.18)]">
                <p className="text-sm font-black text-fuchsia-100">Primeira Mega Evolução registrada na Liga!</p>
                <p className="mt-1 text-xs leading-relaxed text-fuchsia-100/80">
                  O chefe da Ordem revelou uma forma nunca vista nos combates da Liga Zikachu. A partir de agora, ele luta ainda mais acima do poder das equipes enviadas.
                </p>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                {raidRevealed ? "Cada investida reduz a resistência global do inimigo. O intervalo entre ataques é de 30 minutos por jogador." : "A investigação ainda precisa revelar o que existe dentro do esconderijo."}
              </p>
            )}
          </div>
          )}

          {event.phase === "RAID_ACTIVE" && (
            <div className="rounded-2xl border border-red-500/30 bg-red-950/10 p-4">
              <div className="mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-200">Confronto final</p>
                <h2 className="mt-1 text-lg font-black text-white">Atacar o esconderijo</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  Escolha exatamente 6 mascotes livres para atacar. Mascotes derrotados pela Ordem ficam feridos e usam o mesmo Atendimento SUS da Arena Z.
                </p>
              </div>
              <OrderRaidTeamSelector
                mascots={raidAvailableMascots}
                cooldownText={raidOnCooldown && raidCooldownUntil
                  ? `Sua equipe está se reagrupando. Próximo ataque após ${raidCooldownUntil.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}.`
                  : null}
                recentAttempts={recentRaidAttempts.map((attempt) => ({
                  id: attempt.id,
                  playerName: attempt.player.displayName,
                  damage: attempt.damageToBoss,
                  createdAt: attempt.createdAt.toISOString(),
                }))}
              />
              {lastRaidAttempt && (
                <p className="mt-3 text-[11px] text-slate-500">
                  Ultimo ataque: {lastRaidAttempt.damageToBoss.toLocaleString("pt-BR")} dano · {String(lastRaidAttempt.result)}
                </p>
              )}
            </div>
          )}

          {admin && <AdminPanel eventPhase={event.phase} />}
        </section>
      ) : admin ? (
        <section className="rounded-2xl border border-dashed border-purple-500/40 bg-purple-500/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
            <p className="font-bold text-purple-200">Evento ainda não preparado.</p>
              <p className="mt-1 text-xs text-slate-400">
                Clique para criar a base da investigação, ativar o evento para jogadores e preparar o desafio final com base nos mascotes mais fortes do servidor.
              </p>
            </div>
            <form action={prepareOrderEventAction}>
              <button className="rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-950 hover:bg-[#FFD84A]">
                Preparar evento
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-purple-500/25 bg-slate-900/60 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Radar size={17} className="text-purple-300" />
              Mapa da investigação
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Cada travessura precisa de pistas gerais e pistas específicas. Quando as duas barras fecham, a interação escondida da página afetada passa a resolver o mistério.
            </p>
          </div>
          <span className="rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-1 text-[10px] font-bold text-[#FFCB05]">
            Gerais visíveis: {data.clueProgress[0]?.visibleGeneralClues ?? generalClues.filter((clue) => clue.visible).length}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {data.clueProgress.map((progress) => {
            const label = STEP_PUBLIC_LABELS[progress.stepKey] ?? progress.stepKey;
            const generalPct = progress.requiredGeneralClues > 0 ? Math.min(100, Math.round((progress.visibleGeneralClues / progress.requiredGeneralClues) * 100)) : 100;
            const specificPct = progress.requiredSpecificClues > 0 ? Math.min(100, Math.round((progress.visibleSpecificClues / progress.requiredSpecificClues) * 100)) : 100;
            return (
              <div key={progress.stepKey} className={`rounded-xl border p-3 ${progress.resolvedAt ? "border-emerald-500/35 bg-emerald-500/10" : progress.solutionUnlocked ? "border-[#FFCB05]/35 bg-[#FFCB05]/10" : "border-slate-800 bg-slate-950/50"}`}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-100">{label}</p>
                    <p className="text-[10px] text-slate-500">/{progress.pageKey}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${progress.resolvedAt ? "bg-emerald-500/15 text-emerald-300" : progress.solutionUnlocked ? "bg-[#FFCB05]/15 text-[#FFCB05]" : "bg-slate-800 text-slate-400"}`}>
                    {progress.resolvedAt ? "Resolvida" : progress.solutionUnlocked ? "Solução liberada" : "Investigando"}
                  </span>
                </div>

                <div className="space-y-2">
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                      <span>Pistas gerais</span>
                      <span>{Math.min(progress.visibleGeneralClues, progress.requiredGeneralClues)}/{progress.requiredGeneralClues}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-purple-400" style={{ width: `${generalPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                      <span>Pistas específicas</span>
                      <span>{Math.min(progress.visibleSpecificClues, progress.requiredSpecificClues)}/{progress.requiredSpecificClues}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-[#FFCB05]" style={{ width: `${specificPct}%` }} />
                    </div>
                  </div>
                </div>

                {(admin ? progress.clues : progress.clues.filter((clue) => clue.visible)).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {(admin ? progress.clues : progress.clues.filter((clue) => clue.visible)).slice(0, 4).map((clue) => (
                      <p key={clue.id} className={`rounded-lg border px-2 py-1.5 text-[10px] ${clue.visible ? "border-slate-700 bg-slate-900/70 text-slate-300" : "border-slate-800 bg-slate-950/60 text-slate-600"}`}>
                        {clue.visible ? clue.clueText : "Pista ainda oculta"}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {raidRevealed && (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-red-500/25 bg-slate-900/60 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <Skull size={17} className="text-red-300" />
              Ranking de dano contra a Ordem
            </h2>
            {data.rankings.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Jogador</th>
                      <th className="px-3 py-2 text-right">Dano total</th>
                      <th className="px-3 py-2 text-right">Ataques</th>
                      <th className="px-3 py-2 text-right">Media</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.rankings.map((row, index) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 font-bold text-[#FFCB05]">{index + 1}</td>
                        <td className="px-3 py-2 font-semibold text-slate-100">{row.playerName}</td>
                        <td className="px-3 py-2 text-right text-red-200">{row.totalDamage.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{row.battleCount}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{Math.round(row.totalDamage / Math.max(1, row.battleCount)).toLocaleString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">Nenhum ataque registrado ainda.</p>
            )}
          </div>

          <div className="rounded-2xl border border-orange-500/25 bg-slate-900/60 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <AlertTriangle size={17} className="text-orange-300" />
              Atendimento SUS
            </h2>
            <p className="mb-3 text-xs text-slate-500">Mesmo atendimento da Arena Z: cura por 10 ZC e coloca o mascote em repouso antes de voltar ao banco.</p>
            {injuredMascots.length > 0 ? (
              <div className="space-y-2">
                {injuredMascots.map((mascot) => (
                  <div key={mascot.id} className="flex items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
                    <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-orange-100">{mascot.nickname ?? getPokemonName(mascot.pokemonId)}</p>
                      <p className="text-[10px] text-orange-200/70">Nv.{mascot.level} · Ferido em combate</p>
                    </div>
                    <form action={healOrderRaidMascotSusAction}>
                      <input type="hidden" name="mascotId" value={mascot.id} />
                      <button className="rounded-lg bg-[#FFCB05] px-3 py-1.5 text-[10px] font-black text-slate-950 hover:brightness-110">
                        Atendimento SUS · 10 ZC
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">
                Nenhum mascote ferido no momento.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <Sparkles size={17} className="text-[#FFCB05]" />
              Ranking de descobridores
            </h2>
            <div className="space-y-2">
              {data.clueRankings.length ? data.clueRankings.map((row, index) => (
                <div key={row.playerId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-100">
                      <span className="mr-2 text-[#FFCB05]">#{index + 1}</span>{row.playerName}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Última pista: {row.lastDiscoveredAt ? new Date(row.lastDiscoveredAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem data"}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-1 text-xs font-black text-[#FFCB05]">
                    {row.clueCount}
                  </span>
                </div>
              )) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">
                  Nenhuma pista foi atribuída a jogador ainda. As próximas pistas encontradas em expedições entram aqui.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Sparkles size={17} className="text-[#FFCB05]" />
                Pistas públicas
              </h2>
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[10px] font-bold text-slate-300">
                Página {data.cluePagination.page}/{data.cluePagination.totalPages}
              </span>
            </div>
            <div className="space-y-2">
              {(admin ? data.clues : visibleClues).length ? (admin ? data.clues : visibleClues).map((clue) => (
                <div key={clue.id} className={`rounded-xl border p-3 text-xs ${clue.visible ? "border-[#FFCB05]/25 bg-[#FFCB05]/5" : "border-slate-800 bg-slate-950/50 opacity-60"}`}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-200">{clue.rarity}</span>
                    <span className="text-[10px] text-slate-500">{clue.visible ? "Visível" : "Oculta"} · {clue.quality}</span>
                  </div>
                  <p className="leading-relaxed text-slate-300">{clue.clueText}</p>
                  {clue.discoveredByName && (
                    <p className="mt-2 text-[10px] text-[#FFCB05]">Descoberta por {clue.discoveredByName}</p>
                  )}
                  {admin && (
                    <form action={toggleOrderClueVisibilityAction} className="mt-2">
                      <input type="hidden" name="id" value={clue.id} />
                      <input type="hidden" name="visible" value={clue.visible ? "false" : "true"} />
                      <button className={`rounded-lg px-2 py-1 text-[10px] font-bold ${clue.visible ? "bg-slate-800 text-slate-300" : "bg-[#FFCB05]/15 text-[#FFCB05]"}`}>
                        {clue.visible ? "Ocultar" : "Liberar"}
                      </button>
                    </form>
                  )}
                </div>
              )) : (
                <p className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">
                  {admin ? "Nenhuma pista criada ainda." : "Nenhuma pista pública foi liberada ainda nesta página."}
                </p>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <a
                href={`?pistas=${cluePrevPage}`}
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${data.cluePagination.page <= 1 ? "pointer-events-none border-slate-800 text-slate-600" : "border-slate-700 text-slate-200 hover:border-[#FFCB05]/50"}`}
              >
                Anterior
              </a>
              <span className="text-[11px] text-slate-500">{data.cluePagination.total} pistas cadastradas</span>
              <a
                href={`?pistas=${clueNextPage}`}
                className={`rounded-xl border px-3 py-2 text-xs font-bold ${data.cluePagination.page >= data.cluePagination.totalPages ? "pointer-events-none border-slate-800 text-slate-600" : "border-slate-700 text-slate-200 hover:border-[#FFCB05]/50"}`}
              >
                Próxima
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <AlertTriangle size={17} className="text-purple-300" />
            {admin ? "Etapas do mistério" : "Descobertas da investigação"}
          </h2>
          <div className="space-y-2">
            {(admin ? data.steps : resolvedSteps).length ? (admin ? data.steps : resolvedSteps).map((step, index) => (
              <div key={step.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-100">
                      {index + 1}. {admin ? step.stepKey : STEP_PUBLIC_LABELS[step.stepKey] ?? "Descoberta da Ordem"}
                    </p>
                    {admin ? (
                      <p className="text-[11px] text-slate-500">
                        /{step.pageKey} · {step.interactionType} · geral {(data.clueProgress.find((entry) => entry.stepKey === step.stepKey)?.requiredGeneralClues ?? 0)} + especifica {(data.clueProgress.find((entry) => entry.stepKey === step.stepKey)?.requiredSpecificClues ?? step.requiredVisibleClues)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500">Uma parte do caminho foi confirmada pela Liga.</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${step.resolvedAt ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                    {step.resolvedAt ? "Resolvida" : "Pendente"}
                  </span>
                </div>
                {admin && step.requiredPreviousStepKey && (
                  <p className="mt-2 text-[10px] text-slate-500">Requer: {step.requiredPreviousStepKey}</p>
                )}
                {step.resolvedAt && (
                  <p className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-200">
                    {step.resolvedByName ?? "Um jogador"} resolveu esta travessura. Faltam {Math.max(0, data.stats.totalSteps - data.stats.resolvedSteps)} etapa(s) para abrir a fase da senha.
                  </p>
                )}
              </div>
            )) : (
              <p className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">
                {admin ? "Nenhuma etapa criada ainda." : "Nenhuma descoberta confirmada ainda. Continue acompanhando as pistas públicas."}
              </p>
            )}
          </div>
        </div>
      </section>

      {admin && event && (
        <section className="rounded-2xl border border-border bg-slate-900/60 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Eye size={17} className="text-cyan-300" />
                Admin de pistas
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Pistas públicas são compartilhadas por todos. Limite operacional: 10 novas pistas por dia BRT.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={revealNextOrderClueAction}>
                <button className="rounded-xl border border-[#FFCB05]/35 bg-[#FFCB05]/10 px-3 py-2 text-xs font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20">
                  Liberar 1 pista
                </button>
              </form>
              <form action={releaseDailyOrderCluesAction}>
                <button className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20">
                  Liberar até 10 hoje
                </button>
              </form>
            </div>
          </div>

          <form action={createOrderClueAction} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 md:grid-cols-[1fr_160px_140px_140px_auto]">
            <textarea
              name="clueText"
              required
              rows={2}
              placeholder="Texto da nova pista..."
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-[#FFCB05]/60"
            />
            <select name="relatedStepKey" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
              <option value="">Pista geral</option>
              {data.steps.map((step) => (
                <option key={step.stepKey} value={step.stepKey}>
                  {STEP_PUBLIC_LABELS[step.stepKey] ?? step.stepKey}
                </option>
              ))}
            </select>
            <select name="rarity" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
              <option value="COMMON">Comum</option>
              <option value="UNCOMMON">Incomum</option>
              <option value="RARE">Rara</option>
              <option value="VERY_RARE">Muito rara</option>
              <option value="FAKE">Falsa</option>
            </select>
            <select name="quality" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
              <option value="GOOD">Boa</option>
              <option value="OK">Ok</option>
              <option value="BAD">Ruim</option>
              <option value="JOKE">Piada</option>
              <option value="MISLEADING">Enganosa</option>
            </select>
            <button className="rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-slate-950 hover:bg-[#FFD84A]">
              Criar pista
            </button>
          </form>

          <p className="mt-3 text-[11px] text-slate-500">
            Ocultas restantes: {Math.max(0, data.stats.totalClues - data.stats.visibleClues)}. Visíveis totais: {data.stats.visibleClues}.
          </p>
        </section>
      )}

      {admin && event && (
        <section className="rounded-2xl border border-purple-500/25 bg-purple-950/10 p-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <ShieldAlert size={17} className="text-purple-300" />
                Testes admin da investigação
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Atalhos locais para testar o fluxo sem depender da janela real da ZikaLoot ou de liberar pistas uma por uma.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={releaseAllOrderCluesAction}>
                <button className="rounded-xl border border-[#FFCB05]/35 bg-[#FFCB05]/10 px-3 py-2 text-xs font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20">
                  Liberar todas as pistas
                </button>
              </form>
              <form action={resetOrderStepsForTestAction}>
                <button className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20">
                  Resetar descobertas
                </button>
              </form>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {data.steps.map((step, index) => (
              <form key={step.id} action={resolveOrderStepForTestAction} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <input type="hidden" name="stepKey" value={step.stepKey} />
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-100">{index + 1}. {STEP_PUBLIC_LABELS[step.stepKey] ?? step.stepKey}</p>
                    <p className="text-[10px] text-slate-500">{step.resolvedAt ? "Já resolvida" : `Exige ${step.requiredVisibleClues} pistas no fluxo real`}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${step.resolvedAt ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                    {step.resolvedAt ? "OK" : "Pendente"}
                  </span>
                </div>
                <button className="w-full rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-[10px] font-bold text-purple-200 hover:bg-purple-500/20">
                  Marcar como descoberta
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      {admin && event && (
        <section className="rounded-2xl border border-border bg-slate-900/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Bug size={17} className="text-purple-300" />
                Travessuras configuráveis
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                As travessuras representam os golpes da Ordem durante a investigação e se encerram quando a Liga supera cada etapa.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={seedOrderSabotagesAction}>
                <button className="rounded-xl border border-purple-500/35 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-200 hover:bg-purple-500/20">
                  Criar presets
                </button>
              </form>
              <form action={clearOrderSabotagesAction}>
                <button className="rounded-xl border border-orange-500/35 bg-orange-500/10 px-3 py-2 text-xs font-bold text-orange-200 hover:bg-orange-500/20">
                  Desativar todas
                </button>
              </form>
            </div>
          </div>

          {data.sabotages.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {data.sabotages.map((sabotage) => (
                <div key={sabotage.id} className={`rounded-xl border p-3 ${sabotage.active ? "border-purple-400/40 bg-purple-500/10" : "border-slate-800 bg-slate-950/50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-100">{sabotage.title}</p>
                      <p className="text-[10px] text-slate-500">{sabotage.systemKey} · {sabotage.sabotageType} · severidade {sabotage.severity}</p>
                    </div>
                    <form action={toggleOrderSabotageAction}>
                      <input type="hidden" name="id" value={sabotage.id} />
                      <input type="hidden" name="active" value={sabotage.active ? "false" : "true"} />
                      <button className={`rounded-lg px-2 py-1 text-[10px] font-bold ${sabotage.active ? "bg-red-500/15 text-red-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                        {sabotage.active ? "Desativar" : "Ativar"}
                      </button>
                    </form>
                  </div>
                  {sabotage.description && <p className="mt-2 text-xs leading-relaxed text-slate-400">{sabotage.description}</p>}
                  <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-black/30 p-2 text-[10px] text-slate-500">
                    {JSON.stringify(sabotage.effectJson, null, 2)}
                  </pre>
                  {effectRecord(sabotage.effectJson).kind === "RANDOM_MASCOT_INJURY" && (
                    <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-red-200">Proteção da Liga</p>
                      <p className="mt-1 text-[11px] text-red-100/80">
                        Limite diário: {String(effectRecord(sabotage.effectJson).dailyLimit ?? 2)} ferimentos. Barreira protetora: {effectRecord(sabotage.effectJson).emergencyDisabled === true ? "ativa, novos ataques estão bloqueados" : "inativa, a Ordem ainda pode atacar mascotes"}.
                      </p>
                      <form action={setOrderInjuryEmergencyAction} className="mt-2">
                        <input type="hidden" name="id" value={sabotage.id} />
                        <input type="hidden" name="emergencyDisabled" value={effectRecord(sabotage.effectJson).emergencyDisabled === true ? "false" : "true"} />
                        <button className={`rounded-lg px-3 py-1.5 text-[10px] font-black ${effectRecord(sabotage.effectJson).emergencyDisabled === true ? "bg-emerald-500/15 text-emerald-200" : "bg-red-500/20 text-red-100"}`}>
                          {effectRecord(sabotage.effectJson).emergencyDisabled === true ? "Baixar barreira protetora" : "Erguer barreira protetora"}
                        </button>
                      </form>
                      <form action={testOrderMascotInjuryAction} className="mt-2">
                        <button className="rounded-lg border border-red-300/35 bg-red-500/10 px-3 py-1.5 text-[10px] font-black text-red-100 hover:bg-red-500/20">
                          Testar ataque agora
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-500">
              Nenhuma travessura criada. Use “Criar presets” para preparar os golpes da Ordem nesta investigação.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-400">{icon}<span className="text-xs">{label}</span></div>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function AdminPanel({ eventPhase }: { eventPhase: string }) {
  return (
    <div className="rounded-2xl border border-purple-500/25 bg-purple-950/10 p-4">
      <p className="mb-3 text-sm font-bold text-purple-200">Painel de controle da Ordem</p>
      <div className="space-y-3">
        <form action={prepareOrderEventAction}>
          <button className="w-full rounded-xl border border-[#FFCB05]/35 bg-[#FFCB05]/10 px-3 py-2 text-xs font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20">
            Preparar investigação
          </button>
        </form>
        <form action={revealNextOrderClueAction}>
          <button className="w-full rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/20">
            Liberar próxima pista
          </button>
        </form>
        <form action={setOrderEventPhaseAction} className="grid grid-cols-[1fr_auto] gap-2">
          <select name="phase" defaultValue={eventPhase} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            {PHASES.map((phase) => <option key={phase} value={phase}>{RAID_PHASE_LABELS[phase] ?? phase}</option>)}
          </select>
          <button className="rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-500">
            Aplicar
          </button>
        </form>
        <form action={resetOrderEventLocalAction}>
          <button className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20">
            Resetar dados do evento
          </button>
        </form>
        <form action={resetOrderIntroForMeAction}>
          <button className="w-full rounded-xl border border-purple-300/35 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-100 hover:bg-purple-500/20">
            Debug: rever janela inicial
          </button>
        </form>
        <div className="grid gap-2 sm:grid-cols-2">
          <form action={debugRecalculateOrderBossHpAction}>
            <button className="w-full rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-500/20">
              Debug: recalcular HP
            </button>
          </form>
          <form action={debugSetOrderBossHpPercentAction}>
            <input type="hidden" name="percent" value="29" />
            <button className="w-full rounded-xl border border-orange-400/35 bg-orange-500/10 px-3 py-2 text-xs font-bold text-orange-100 hover:bg-orange-500/20">
              Debug: HP em 29%
            </button>
          </form>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Use estes controles para preparar a investigação, liberar pistas, ajustar fases e testar o fluxo antes da abertura oficial.
      </p>
    </div>
  );
}


