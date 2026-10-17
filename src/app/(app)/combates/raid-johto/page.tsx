import { redirect } from "next/navigation";
import { Crown, Flame, Swords, Trophy } from "lucide-react";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getStaticSpriteUrl } from "@/lib/mascot-data";
import { cleanupExpiredArenaResting } from "@/lib/arena-z";
import { getJohtoAdminSummary, getJohtoRaidState, isJohtoRaidVisibleToPlayers, type JohtoLeaderState } from "@/lib/johto-raid";
import { getJohtoInvitationForPlayer, getJohtoInvitationPreviewCandidates } from "@/lib/johto-invitation";
import type { RaidLabels } from "../ordem-da-trapaca/_components/order-raid-team-selector";
import { JohtoAdminControls } from "./_components/johto-admin-controls";
import { JohtoTeamSelector } from "./_components/johto-team-selector";
import { JohtoInvitationReviewButton } from "./_components/johto-invitation-review-button";
import { ComboMeter, Countdown, JohtoReplayList, JohtoRewardPicker, LeaderTeamButton } from "./_components/johto-extras";
import { attackJohtoRaidAction } from "./actions";
import { JohtoCooldownRefresh } from "./_components/johto-cooldown-refresh";
import { JohtoSusPanel } from "./_components/johto-sus-panel";

export const dynamic = "force-dynamic";

const TYPE_STYLE: Record<string, { label: string; color: string }> = {
  flying: { label: "Voador", color: "#8fa8ff" }, bug: { label: "Inseto", color: "#a8c93a" }, normal: { label: "Normal", color: "#c4b9a8" },
  ghost: { label: "Fantasma", color: "#8a6fc0" }, fighting: { label: "Lutador", color: "#d05a4a" }, steel: { label: "Metal", color: "#9fb4c7" },
  ice: { label: "Gelo", color: "#7fd6e8" }, dragon: { label: "Dragão", color: "#6a5fe0" },
};

const LABELS: RaidLabels = { foe: "o Líder", foeIn: "no Líder", subtitle: "Líder de Ginásio de Johto", globalName: "do Líder", recentTitle: "Últimos ataques ao líder" };
const fmt = (n: number) => n.toLocaleString("pt-BR");
const pctOf = (cur: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0);
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function HpBar({ current, max, big = false }: { current: number; max: number; big?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10 ${big ? "h-5" : "h-2"}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-red-600 via-orange-400 to-[#FFCB05] transition-all" style={{ width: `${pctOf(current, max)}%` }} />
    </div>
  );
}

function TrainerImage({ leader, size = 80, dim = false }: { leader: Pick<JohtoLeaderState, "image" | "name">; size?: number; dim?: boolean }) {
  return <img src={leader.image} alt={leader.name} width={size} height={size} className={`mx-auto ${dim ? "opacity-40 grayscale" : ""}`} style={{ imageRendering: "pixelated", width: size, height: size }} />;
}

function LeaderCard({ leader, days }: { leader: JohtoLeaderState; days: number }) {
  const type = TYPE_STYLE[leader.type];
  const gone = leader.status === "DEFEATED" || leader.status === "ESCAPED";
  // Moldura por estado: ATIVO (dourado, pulsando) · AGUARDANDO (cinza tracejado) · DERROTADO (verde) · VENCEU o prazo (vermelho).
  const frame = {
    CURRENT: { box: "border-2 border-[#FFCB05] bg-[#FFCB05]/10 shadow-[0_0_28px_rgba(255,203,5,0.35)] ring-1 ring-[#FFCB05]/40", badge: "bg-[#FFCB05] text-slate-950", label: "⚔️ ATIVO" },
    WAITING: { box: "border border-dashed border-slate-700 bg-slate-900/40 opacity-80", badge: "bg-slate-700 text-slate-200", label: "🔒 AGUARDANDO" },
    DEFEATED: { box: "border-2 border-emerald-500/60 bg-emerald-500/10", badge: "bg-emerald-500 text-slate-950", label: "✅ DERROTADO" },
    ESCAPED: { box: "border-2 border-red-500/60 bg-red-500/10", badge: "bg-red-500 text-white", label: "⛔ VENCEU O PRAZO" },
  }[leader.status];
  const border = frame.box;
  return (
    <div className={`relative rounded-2xl border p-3 text-center transition ${border}`}>
      <span className="absolute left-2 top-2 text-[10px] font-black text-slate-500">#{leader.position + 1}</span>
      <span className={`absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-black shadow ${frame.badge}`}>{frame.label}</span>
      <div className="pt-2"><TrainerImage leader={leader} dim={gone} /></div>
      <p className="mt-1 text-sm font-black text-white">{leader.name}</p>
      <p className="text-[10px] text-slate-400">{leader.city}</p>
      <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold text-slate-950" style={{ background: type?.color ?? "#999" }}>{type?.label ?? leader.type}</span>
      <div className="mt-2"><HpBar current={leader.hpCurrent} max={leader.hpMax} /></div>
      <p className="mt-1 text-[10px] font-semibold text-slate-300">
        {leader.status === "DEFEATED" ? `Derrotado${leader.finalBlowName ? ` · golpe final de ${leader.finalBlowName}` : ""}`
          : leader.status === "ESCAPED" ? "O líder venceu (prazo esgotado)"
            : leader.status === "CURRENT" && leader.expiresAt ? <Countdown to={leader.expiresAt} prefix="⏳ " doneText="Tempo esgotado" />
              : `Aguardando · ${days} dia${days > 1 ? "s" : ""} de prazo`}
      </p>
      {leader.status === "WAITING" && <p className="text-[9px] text-slate-500">começa quando o anterior cair ou vencer</p>}
      <LeaderTeamButton leader={leader} compact />
    </div>
  );
}

export default async function JohtoRaidPage({ searchParams }: { searchParams: Promise<{ susPage?: string; allySusPage?: string }> }) {
  const query = await searchParams;
  const susPage = Math.max(1, Number.parseInt(query.susPage ?? "1", 10) || 1);
  const allySusPage = Math.max(1, Number.parseInt(query.allySusPage ?? "1", 10) || 1);
  const SUS_PAGE_SIZE = 5;
  const session = await getAppSession();
  if (!session?.user) redirect("/login");
  const admin = isAdmin(session.user.role);
  const visible = await isJohtoRaidVisibleToPlayers();
  if (!admin && !visible) redirect("/dashboard");

  const player = await prisma.player.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  // Recuperação preguiçosa do repouso: mascotes que terminaram o descanso ficam
  // como RESTING no banco até a Arena ser aberta. Sem isto, mascotes já
  // recuperados não apareciam na lista FREE do raid.
  if (player?.id) await cleanupExpiredArenaResting(player.id).catch(() => null);
  const state = await getJohtoRaidState(player?.id);
  const invitation = !admin && player?.id ? await getJohtoInvitationForPlayer(player.id) : null;
  if (!state.event && !admin) redirect("/dashboard");

  const mascotSelect = { id: true, pokemonId: true, nickname: true, level: true, statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true, preferredCombatRole: true } as const;
  const freeWhere = player ? { playerId: player.id, arenaState: "FREE" as const, expeditions: { none: { status: "ACTIVE" as const } } } : null;
  const [freeMascots, injured, injuredTotal] = player && freeWhere
    ? await Promise.all([
      prisma.mascot.findMany({ where: freeWhere, select: mascotSelect, orderBy: [{ level: "desc" }], take: 250 }),
      prisma.mascot.findMany({ where: { playerId: player.id, arenaState: "INJURED" }, select: { id: true, pokemonId: true, nickname: true, level: true }, orderBy: { injuredAt: "desc" }, skip: (susPage - 1) * SUS_PAGE_SIZE, take: SUS_PAGE_SIZE }),
      prisma.mascot.count({ where: { playerId: player.id, arenaState: "INJURED" } }),
    ])
    : [[], [], 0];

  const adminBox = admin ? <JohtoAdminControls summary={await getJohtoAdminSummary(state)} testMascots={freeMascots} invitationCandidates={await getJohtoInvitationPreviewCandidates()} /> : null;
  if (!state.event) {
    return <div className="mx-auto max-w-5xl space-y-5 p-4">{adminBox}<p className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">O evento ainda não foi criado.</p></div>;
  }

  const event = state.event;
  const current = state.current;
  const canAttack = event.active && !event.defeatedAt && Boolean(current);
  const cooldownUntil = state.me?.cooldownUntil ? new Date(state.me.cooldownUntil) : null;
  const onCooldown = Boolean(cooldownUntil && cooldownUntil > new Date());
  const [alliedInjured, alliedInjuredTotal] = player ? await Promise.all([
    prisma.mascot.findMany({ where: { playerId: { not: player.id }, arenaState: "INJURED" }, select: { id: true, pokemonId: true, nickname: true, level: true, player: { select: { displayName: true } } }, orderBy: { injuredAt: "desc" }, skip: (allySusPage - 1) * SUS_PAGE_SIZE, take: SUS_PAGE_SIZE }),
    prisma.mascot.count({ where: { playerId: { not: player.id }, arenaState: "INJURED" } }),
  ]) : [[], 0];
  const currentType = current ? TYPE_STYLE[current.type] : null;
  const rewards = event.rewards;
  const pendingRewards = state.myRewards;
  const myPosition = state.me?.rankOnCurrent;

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      {adminBox}

      <header className="relative isolate overflow-hidden rounded-3xl border border-[#FFCB05]/25 bg-[radial-gradient(circle_at_top,rgba(255,203,5,0.14),transparent_50%),#1a1233] px-5 py-6 sm:p-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(90deg, rgba(26,18,51,.88) 0%, rgba(26,18,51,.78) 52%, rgba(26,18,51,.7) 100%), url('https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/events/johto/leaders-banner.png')",
            backgroundPosition: "center",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-full md:w-[72%]"
          style={{
            backgroundImage: "linear-gradient(90deg, #1a1233 0%, rgba(26,18,51,.94) 32%, rgba(26,18,51,.68) 68%, rgba(26,18,51,.38) 100%), url('https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/events/johto/leaders-banner.png')",
            backgroundPosition: "center, right bottom",
            backgroundSize: "cover, auto 100%",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div className="relative z-10">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FFCB05]">Evento especial · Semana 8</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-black text-white"><Swords className="text-[#FFCB05]" size={28} /> Líderes de Johto</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">Os oito líderes de ginásio de Johto enfrentam os treinadores com o time completo de 6 mascotes. Todo o dano que vocês causam é somado na vida do líder: o dano é persistente: cada mascote do líder tem uma vida enorme e, quando ela acaba, ele sai de todas as lutas seguintes. Quando os 6 caem, o líder cai. Cada líder fica disponível por até {event.leaderDays} dias — se ninguém o vencer a tempo, ele vence. Quem lutar ganha ZC e escolhe um mascote do próprio líder!</p>
        {invitation?.available && <JohtoInvitationReviewButton displayName={invitation.displayName} voteSubmitted={Boolean(invitation.voteSubmittedAt)} candidates={invitation.candidates} />}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
            <span>Vida total dos líderes</span>
            <span className="font-bold">{fmt(state.totalHpCurrent)} / {fmt(state.totalHpMax)} HP</span>
          </div>
          <HpBar current={state.totalHpCurrent} max={state.totalHpMax} big />
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
            <span>👥 {state.participants} treinadores</span><span>⚔️ {fmt(state.totalAttacks)} ataques</span>
            {current?.expiresAt && <span>⏳ {current.name}: <Countdown to={current.expiresAt} doneText="tempo esgotado" /></span>}
            {!event.active && !event.defeatedAt && <span className="font-bold text-amber-300">Ataques fechados no momento</span>}
          </div>
        </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {state.leaders.map((leader) => <LeaderCard key={leader.id} leader={leader} days={event.leaderDays} />)}
      </section>
      <p className="-mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-slate-500"><span>⚔️ ativo agora</span><span>🔒 ainda não chegou a vez</span><span>✅ derrotado pelo servidor</span><span>⛔ venceu o prazo</span></p>

      {event.defeatedAt && (
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
          <Crown className="mx-auto text-emerald-300" size={28} />
          <h2 className="mt-1 text-xl font-black text-emerald-100">O servidor venceu os Líderes de Johto! 🎉</h2>
          <p className="mt-1 text-sm text-emerald-100/80">Obrigado a todos os {state.participants} treinadores que lutaram nesta raid — a Liga Zikachu chega às chaves mais forte graças a vocês! As recompensas de cada líder continuam disponíveis para retirar abaixo, para quem atacou aquele líder (o ZC e o ovo já caíram na conta; falta escolher o mascote).</p>
        </section>
      )}

      <JohtoRewardPicker rewards={pendingRewards} choiceUsed={state.choiceUsed} clairItem={state.clairItem} allLeaders={state.leaders.map((l) => ({ name: l.name, pokemonIds: l.rosterPokemonIds }))} />

      <JohtoSusPanel
        mine={{ items: injured, page: susPage, totalPages: Math.max(1, Math.ceil(injuredTotal / SUS_PAGE_SIZE)), total: injuredTotal }}
        allies={{ items: alliedInjured.map((mascot) => ({ ...mascot, playerName: mascot.player.displayName })), page: allySusPage, totalPages: Math.max(1, Math.ceil(alliedInjuredTotal / SUS_PAGE_SIZE)), total: alliedInjuredTotal }}
        shieldAvailable={state.shield?.available ?? false}
      />


      {current && (
        <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-3xl border border-[#FFCB05]/30 bg-slate-900/70 p-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFCB05]">Enfrentando agora</p>
            <div className="mt-2"><TrainerImage leader={current} size={160} /></div>
            <h2 className="text-2xl font-black text-white">{current.name}</h2>
            <p className="text-xs text-slate-400">Líder de {current.city} · {current.badge}</p>
            <span className="mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-black text-slate-950" style={{ background: currentType?.color }}>Especialista em {currentType?.label}</span>
            <p className="mt-3 text-xs italic text-slate-400">“{current.quote}”</p>
            <div className="mt-4"><HpBar current={current.hpCurrent} max={current.hpMax} big /></div>
            <p className="mt-1 text-sm font-bold text-white">{fmt(current.hpCurrent)} / {fmt(current.hpMax)} HP</p>
            <p className="text-[11px] text-slate-400">{current.expiresAt && <Countdown to={current.expiresAt} prefix="⏳ " doneText="Tempo esgotado" />}</p>
            <div className="mt-2"><LeaderTeamButton leader={current} /></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {current.mascots.map((m) => (
                <div key={m.slot} className={`rounded-xl border p-2 ${m.defeated ? "border-red-500/20 bg-red-500/5" : "border-slate-800 bg-slate-950/50"}`}>
                  <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className={`mx-auto h-14 w-14 object-contain ${m.defeated ? "opacity-30 grayscale" : ""}`} style={{ imageRendering: "pixelated" }} />
                  <p className="truncate text-[10px] font-bold text-white">{m.name}</p>
                  <HpBar current={m.hpCurrent} max={m.hpMax} />
                  <p className="mt-0.5 truncate text-[9px] text-slate-400">{m.defeated ? `derrotado${m.defeatedByName ? ` por ${m.defeatedByName}` : ""}` : `${fmt(m.hpCurrent)} HP`}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-2 text-left text-[11px] text-sky-100/80">Cada mascote do líder tem 1/6 da vida total e a vida mostrada é a real. Seu time luta até cair: o dano que você causar fica registrado para todos. Quem cai na luta fica ferido, como na Arena, e precisa do SUS.</p>
          </div>
          <div className="rounded-3xl border border-border bg-slate-900/60 p-4">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><Flame size={17} className="text-orange-300" /> Monte sua equipe</h2>
            {canAttack ? (
              <>
                <p className="mb-3 text-xs text-slate-500">6 mascotes livres contra o time de 6 do líder. Espera de {event.cooldownMinutes} min entre ataques.</p>
                <div className="mb-3"><ComboMeter {...state.combo} /></div>
                <JohtoCooldownRefresh until={onCooldown && cooldownUntil ? cooldownUntil.toISOString() : null} />
                <JohtoTeamSelector
                  mascots={freeMascots}
                  labels={LABELS}
                  attackAction={attackJohtoRaidAction}
                  cooldownText={onCooldown && cooldownUntil ? `Sua equipe está se reagrupando. Próximo ataque após ${when(cooldownUntil.toISOString())}.` : null}
                  recentAttempts={[]}
                />
                {state.me && state.me.attacksOnCurrent > 0 && (
                  <p className="mt-3 text-[11px] text-slate-500">Contra {current.name}: {fmt(state.me.damageOnCurrent)} de dano em {state.me.attacksOnCurrent} ataque(s){myPosition ? ` · ${myPosition}º no ranking` : ""}.</p>
                )}
              </>
            ) : <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">Os ataques estão fechados no momento.</p>}
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white"><Trophy size={17} className="text-[#FFCB05]" /> Ranking de dano{current ? ` · ${current.name}` : ""}</h2>
          {current && <p className="-mt-2 mb-3 text-[10px] text-slate-500">Ranking exclusivo deste líder. Empates de dano são decididos pelo maior número de ataques.</p>}
          {state.currentRanking.length === 0 ? <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">Ninguém atacou este líder ainda. Seja o primeiro!</p> : (
            <ol className="space-y-1.5">
              {state.currentRanking.map((row, index) => (
                <li key={row.playerId} className={`rounded-xl border px-3 py-2 text-sm ${row.playerId === player?.id ? "border-[#FFCB05]/40 bg-[#FFCB05]/10" : "border-slate-800 bg-slate-950/50"}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-center font-black text-slate-400">{["🥇", "🥈", "🥉"][index] ?? index + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-bold text-white">{row.playerName}</span>
                    <span className="shrink-0 font-black text-red-200">{fmt(row.damage)}</span>
                  </div>
                  <p className="mt-0.5 pl-8 text-[10px] text-slate-500">{row.attackCount} atq · média {fmt(Math.round(row.damage / Math.max(1, row.attackCount)))} · recebido {fmt(row.damageReceived)} · maior {fmt(row.highestSingleDamage)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-slate-900/60 p-4 text-xs leading-5 text-slate-400">
            <h2 className="mb-2 text-sm font-bold text-white">Recompensas de cada líder derrotado</h2>
            <ul className="list-disc space-y-1 pl-4">
              <li><b className="text-slate-200">Quem atacou ao menos uma vez:</b> {fmt(rewards.participantZc)} ZC + escolha de um dos 6 mascotes do líder no nível {rewards.participantLevel}.</li>
              <li><b className="text-slate-200">🥇 1º em dano:</b> {fmt(rewards.top[0].zc)} ZC + mascote do líder no nível {rewards.top[0].level}.</li>
              <li><b className="text-slate-200">🥈 2º em dano:</b> {fmt(rewards.top[1].zc)} ZC + mascote no nível {rewards.top[1].level}.</li>
              <li><b className="text-slate-200">🥉 3º em dano:</b> {fmt(rewards.top[2].zc)} ZC + mascote no nível {rewards.top[2].level}.</li>
              <li>Quem fica no pódio recebe o prêmio do pódio no lugar do de participante.</li>
              <li className="font-bold text-amber-300">⚠️ Só dá para escolher UM mascote em toda a raid, de qualquer líder e faixa. Escolher um impede de escolher qualquer outro, inclusive de líderes futuros. Escolha com sabedoria!</li>
              <li>O mascote nasce de ovo especial: status sorteados proporcionais ao nível e personalidade aleatória.</li>
              <li><b className="text-slate-200">🎯 Golpe final:</b> o bônus de participante + um ovo especial com +{rewards.finalBlowEggBonusPct}% de chance de raridade.</li>
              <li><b className="text-slate-200">⚔️ Maior número de ataques:</b> um ovo especial com +{rewards.finalBlowEggBonusPct}% de chance de raridade. Em empate de dano, mais ataques decide a posição.</li>
              <li>A cada líder derrotado, o próximo entra com +300 mil de vida (dividida entre os 6 mascotes) e +950 ZC em cada prêmio de ZC.</li>
              <li className="font-bold text-indigo-200">🐉 Derrotar a Clair libera o Selo do Dragão para todos que lutaram contra ela: gasto ao escolher o mascote: permite pegar o mascote de qualquer líder e definir personalidade e atributo principal (item exclusivo desta página).</li>
<li>Se um líder não cair no prazo, ele vence e não há recompensa por ele.</li>
            </ul>
          </div>
        </div>
      </section>

      {state.defeatedRankings.length > 0 && (
        <section className="rounded-2xl border border-border bg-slate-900/60 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white"><Trophy size={17} className="text-emerald-300" /> Ranking dos líderes derrotados</h2>
          <div className="space-y-2">
            {state.defeatedRankings.map((d) => (
              <details key={d.leaderId} className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2">
                <summary className="cursor-pointer text-sm font-bold text-white">✅ {d.leaderName} <span className="text-[10px] font-normal text-slate-500">· {d.ranking.length} treinador(es)</span></summary>
                <ol className="mt-2 space-y-1.5">
                  {d.ranking.map((row, index) => (
                    <li key={row.playerId} className={`rounded-xl border px-3 py-2 text-sm ${row.playerId === player?.id ? "border-[#FFCB05]/40 bg-[#FFCB05]/10" : "border-slate-800 bg-slate-950/50"}`}>
                      <div className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-center font-black text-slate-400">{["🥇", "🥈", "🥉"][index] ?? index + 1}</span>
                        <span className="min-w-0 flex-1 truncate font-bold text-white">{row.playerName}</span>
                        <span className="shrink-0 font-black text-red-200">{fmt(row.damage)}</span>
                      </div>
                      <p className="mt-0.5 pl-8 text-[10px] text-slate-500">{row.attackCount} atq · maior {fmt(row.highestSingleDamage)}</p>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-slate-900/60 p-4">
        <h2 className="mb-1 text-lg font-bold text-white">Replays dos últimos {state.recent.length || 20} combates</h2>
        <p className="mb-3 text-xs text-slate-500">Assista às lutas de qualquer treinador e veja como os mascotes do líder estão caindo.</p>
        <JohtoReplayList fights={state.recent} />
      </section>
    </div>
  );
}
