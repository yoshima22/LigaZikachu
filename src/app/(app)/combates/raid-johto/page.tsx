import { redirect } from "next/navigation";
import { AlertTriangle, Crown, Flame, Swords, Trophy } from "lucide-react";
import { getAppSession } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getSpriteUrl, getStaticSpriteUrl } from "@/lib/mascot-data";
import { getJohtoAdminSummary, getJohtoRaidState, isJohtoRaidVisibleToPlayers, type JohtoLeaderState } from "@/lib/johto-raid";
import { OrderRaidTeamSelector, type RaidLabels } from "../ordem-da-trapaca/_components/order-raid-team-selector";
import { JohtoAdminControls } from "./_components/johto-admin-controls";
import { attackJohtoRaidAction, healJohtoMascotSusAction } from "./actions";

export const dynamic = "force-dynamic";

const TYPE_STYLE: Record<string, { label: string; color: string }> = {
  flying: { label: "Voador", color: "#8fa8ff" }, bug: { label: "Inseto", color: "#a8c93a" }, normal: { label: "Normal", color: "#c4b9a8" },
  ghost: { label: "Fantasma", color: "#8a6fc0" }, fighting: { label: "Lutador", color: "#d05a4a" }, steel: { label: "Aço", color: "#9fb4c7" },
  ice: { label: "Gelo", color: "#7fd6e8" }, dragon: { label: "Dragão", color: "#6a5fe0" },
};

const LABELS: RaidLabels = { foe: "o Líder", foeIn: "no Líder", subtitle: "Líder de Ginásio de Johto", globalName: "do Líder", recentTitle: "Últimos ataques ao líder" };
const fmt = (n: number) => n.toLocaleString("pt-BR");
const pctOf = (cur: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0);

function HpBar({ current, max, big = false }: { current: number; max: number; big?: boolean }) {
  const pct = pctOf(current, max);
  return (
    <div className={`overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10 ${big ? "h-5" : "h-2"}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-red-600 via-orange-400 to-[#FFCB05] transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function LeaderCard({ leader }: { leader: JohtoLeaderState }) {
  const type = TYPE_STYLE[leader.type];
  const defeated = leader.status === "DEFEATED";
  return (
    <div className={`relative rounded-2xl border p-3 text-center transition ${leader.status === "CURRENT" ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 shadow-[0_0_24px_rgba(255,203,5,0.15)]" : defeated ? "border-emerald-500/30 bg-emerald-500/5" : "border-slate-800 bg-slate-900/50"}`}>
      <span className="absolute left-2 top-2 text-[10px] font-black text-slate-500">#{leader.position + 1}</span>
      <img src={getStaticSpriteUrl(leader.pokemonId)} alt="" className={`mx-auto h-16 w-16 object-contain ${defeated ? "opacity-40 grayscale" : leader.status === "WAITING" ? "opacity-70" : ""}`} style={{ imageRendering: "pixelated" }} />
      <p className="mt-1 text-sm font-black text-white">{leader.name}</p>
      <p className="text-[10px] text-slate-400">{leader.city}</p>
      <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold text-slate-950" style={{ background: type?.color ?? "#999" }}>{type?.label ?? leader.type}</span>
      <div className="mt-2"><HpBar current={leader.hpCurrent} max={leader.hpMax} /></div>
      <p className="mt-1 text-[10px] font-semibold text-slate-300">
        {defeated ? `Derrotado${leader.finalBlowName ? ` por ${leader.finalBlowName}` : ""}` : leader.status === "CURRENT" ? `${fmt(leader.hpCurrent)} HP` : "Aguardando"}
      </p>
    </div>
  );
}

export default async function JohtoRaidPage() {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");
  const admin = isAdmin(session.user.role);
  const visible = await isJohtoRaidVisibleToPlayers();
  if (!admin && !visible) redirect("/dashboard");

  const player = await prisma.player.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  const state = await getJohtoRaidState(player?.id);
  if (!state.event && !admin) redirect("/dashboard");

  const adminBox = admin ? <JohtoAdminControls summary={await getJohtoAdminSummary(state)} /> : null;
  if (!state.event) {
    return <div className="mx-auto max-w-5xl space-y-5 p-4">{adminBox}<p className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">O evento ainda não foi criado.</p></div>;
  }

  const event = state.event;
  const ended = Boolean(event.endsAt && new Date(event.endsAt) < new Date());
  const canAttack = event.active && !event.defeatedAt && !ended && Boolean(state.current);
  const cooldownUntil = state.me?.cooldownUntil ? new Date(state.me.cooldownUntil) : null;
  const onCooldown = Boolean(cooldownUntil && cooldownUntil > new Date());

  const [mascots, injured] = player && canAttack
    ? await Promise.all([
      prisma.mascot.findMany({
        where: { playerId: player.id, arenaState: "FREE", expeditions: { none: { status: "ACTIVE" } } },
        select: { id: true, pokemonId: true, nickname: true, level: true, statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true },
        orderBy: [{ level: "desc" }], take: 200,
      }),
      prisma.mascot.findMany({ where: { playerId: player.id, arenaState: "INJURED" }, select: { id: true, pokemonId: true, nickname: true, level: true }, orderBy: { injuredAt: "desc" }, take: 12 }),
    ])
    : [[], player ? await prisma.mascot.findMany({ where: { playerId: player.id, arenaState: "INJURED" }, select: { id: true, pokemonId: true, nickname: true, level: true }, orderBy: { injuredAt: "desc" }, take: 12 }) : []];

  const ranking = state.ranking;
  const top = (value: (r: (typeof ranking)[number]) => number) => [...ranking].sort((a, b) => value(b) - value(a) || b.totalDamage - a.totalDamage)[0];
  const achievements = ranking.length === 0 ? [] : [
    { icon: "💥", title: "Maior golpe", row: top((r) => r.highestSingleDamage), value: (r: (typeof ranking)[number]) => `${fmt(r.highestSingleDamage)} dano` },
    { icon: "⚔️", title: "Mais ataques", row: top((r) => r.attackCount), value: (r: (typeof ranking)[number]) => `${r.attackCount} ataques` },
    { icon: "🧭", title: "Mais líderes enfrentados", row: top((r) => r.leaders), value: (r: (typeof ranking)[number]) => `${r.leaders} de 8 líderes` },
    { icon: "🎯", title: "Mais golpes finais", row: top((r) => r.finalBlows), value: (r: (typeof ranking)[number]) => `${r.finalBlows} golpe(s) final(is)` },
  ].filter((a) => a.row && a.value(a.row).charAt(0) !== "0");

  const current = state.current;
  const currentType = current ? TYPE_STYLE[current.type] : null;
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4">
      {adminBox}

      <header className="relative overflow-hidden rounded-3xl border border-[#FFCB05]/25 bg-[radial-gradient(circle_at_top,rgba(255,203,5,0.18),transparent_50%),linear-gradient(180deg,#1a1233,#050816)] p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FFCB05]">Evento especial · Semana 8</p>
        <h1 className="mt-1 flex items-center gap-2 text-3xl font-black text-white"><Swords className="text-[#FFCB05]" size={28} /> Líderes de Johto</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">Os oito líderes de ginásio de Johto bloqueiam o caminho para as chaves. Todos os treinadores lutam juntos: derrubem um por vez e, se o servidor vencer, todos que participaram ganham prêmios — e quem se destacar leva ainda mais.</p>
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
            <span>Vida total dos líderes</span>
            <span className="font-bold">{fmt(state.totalHpCurrent)} / {fmt(state.totalHpMax)} HP</span>
          </div>
          <HpBar current={state.totalHpCurrent} max={state.totalHpMax} big />
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-400">
            <span>👥 {state.participants} treinadores</span><span>⚔️ {fmt(state.totalAttacks)} ataques</span>
            {event.endsAt && <span>⏳ Termina em {new Date(event.endsAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</span>}
            {!event.active && !event.defeatedAt && <span className="font-bold text-amber-300">Ataques ainda fechados</span>}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {state.leaders.map((leader) => <LeaderCard key={leader.id} leader={leader} />)}
      </section>

      {event.defeatedAt && (
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
          <Crown className="mx-auto text-emerald-300" size={28} />
          <h2 className="mt-1 text-xl font-black text-emerald-100">O servidor venceu os Líderes de Johto!</h2>
          <p className="mt-1 text-sm text-emerald-100/80">{event.rewardsGrantedAt ? "Os prêmios foram entregues — confira as notificações e a carteira." : "Os prêmios serão entregues em instantes."}</p>
        </section>
      )}

      {current && canAttack && (
        <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-3xl border border-[#FFCB05]/30 bg-slate-900/70 p-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFCB05]">Enfrentando agora</p>
            <img src={getSpriteUrl(current.pokemonId, true)} alt="" className="mx-auto mt-2 h-44 w-44 object-contain drop-shadow-[0_0_30px_rgba(255,203,5,0.35)]" style={{ imageRendering: "pixelated" }} />
            <h2 className="text-2xl font-black text-white">{current.name}</h2>
            <p className="text-xs text-slate-400">Líder de {current.city} · {current.badge}</p>
            <span className="mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-black text-slate-950" style={{ background: currentType?.color }}>Tipo {currentType?.label}</span>
            <p className="mt-3 text-xs italic text-slate-400">“{current.quote}”</p>
            <div className="mt-4"><HpBar current={current.hpCurrent} max={current.hpMax} big /></div>
            <p className="mt-1 text-sm font-bold text-white">{fmt(current.hpCurrent)} / {fmt(current.hpMax)} HP</p>
            <p className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-2 text-[11px] text-sky-100/80">Dica: mascotes com vantagem contra o tipo {currentType?.label} causam até +30% de dano; o líder também bate mais forte nos tipos que ele domina. Cada derrota deixa o mascote ferido.</p>
          </div>
          <div className="rounded-3xl border border-border bg-slate-900/60 p-4">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-white"><Flame size={17} className="text-orange-300" /> Monte sua equipe</h2>
            <p className="mb-3 text-xs text-slate-500">6 mascotes livres. Espera de {event.cooldownMinutes} min entre ataques. O dano vai direto para a vida do líder, somado ao de todos os treinadores.</p>
            <OrderRaidTeamSelector
              mascots={mascots}
              labels={LABELS}
              attackAction={attackJohtoRaidAction}
              cooldownText={onCooldown && cooldownUntil ? `Sua equipe está se reagrupando. Próximo ataque após ${cooldownUntil.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}.` : null}
              recentAttempts={state.recent.map((a) => ({ id: a.id, playerName: `${a.playerName} → ${a.leaderName}`, damage: a.damage, createdAt: a.createdAt }))}
            />
            {state.me && state.me.attackCount > 0 && (
              <p className="mt-3 text-[11px] text-slate-500">Você: {fmt(state.me.totalDamage)} de dano em {state.me.attackCount} ataque(s){state.me.rank ? ` · ${state.me.rank}º no ranking` : ""}.</p>
            )}
          </div>
        </section>
      )}

      {injured.length > 0 && (
        <section className="rounded-2xl border border-orange-500/25 bg-slate-900/60 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-white"><AlertTriangle size={16} className="text-orange-300" /> Atendimento SUS</h2>
          <div className="space-y-2">
            {injured.map((mascot) => (
              <div key={mascot.id} className="flex items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/10 p-2.5">
                <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-9 w-9 object-contain" style={{ imageRendering: "pixelated" }} />
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-orange-100">{mascot.nickname ?? getPokemonName(mascot.pokemonId)} <span className="text-[10px] font-normal text-orange-200/70">Nv.{mascot.level}</span></p>
                <form action={healJohtoMascotSusAction}>
                  <input type="hidden" name="mascotId" value={mascot.id} />
                  <button className="rounded-lg bg-[#FFCB05] px-3 py-1.5 text-[10px] font-black text-slate-950 hover:brightness-110">Atendimento SUS · 10 ZC</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white"><Trophy size={17} className="text-[#FFCB05]" /> Ranking de dano</h2>
          {ranking.length === 0 ? <p className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-500">Ninguém atacou ainda. Seja o primeiro!</p> : (
            <ol className="space-y-1.5">
              {ranking.slice(0, 15).map((row, index) => (
                <li key={row.playerId} className={`rounded-xl border px-3 py-2 ${row.playerId === player?.id ? "border-[#FFCB05]/40 bg-[#FFCB05]/10" : "border-slate-800 bg-slate-950/50"}`}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-center font-black text-slate-400">{["🥇", "🥈", "🥉"][index] ?? index + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-bold text-white">{row.playerName}</span>
                    <span className="font-black text-red-200">{fmt(row.totalDamage)}</span>
                  </div>
                  {row.badges.length > 0 && <div className="mt-1 flex flex-wrap gap-1 pl-8">{row.badges.map((badge) => <span key={badge} className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] text-slate-200">{badge}</span>)}</div>}
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-slate-900/60 p-4">
            <h2 className="mb-3 text-lg font-bold text-white">Conquistas do evento</h2>
            {achievements.length === 0 ? <p className="text-sm text-slate-500">As conquistas aparecem conforme os treinadores atacam.</p> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {achievements.map((a) => (
                  <div key={a.title} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{a.icon} {a.title}</p>
                    <p className="mt-1 truncate text-sm font-bold text-white">{a.row!.playerName}</p>
                    <p className="text-xs text-amber-300">{a.value(a.row!)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-slate-900/60 p-4 text-xs leading-5 text-slate-400">
            <h2 className="mb-2 text-sm font-bold text-white">Prêmios se o servidor vencer</h2>
            <ul className="list-disc space-y-1 pl-4">
              <li>Todo treinador que atacou pelo menos uma vez: ZC + ovo raro exclusivo.</li>
              <li>Top 3 em dano total, maior golpe, mais ataques e quem enfrentou mais líderes.</li>
              <li>Bônus por cada golpe final que derrubar um líder.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
