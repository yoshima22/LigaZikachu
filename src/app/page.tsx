import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight, BookOpen, CirclePlay, Gift, Layers, Radio, Swords, Trophy, Tv, Zap,
} from "lucide-react";
import { auth } from "@/auth";
import { getManualSessionUser } from "@/lib/manual-session";
import { AutoRestoreSession } from "@/components/auth/auto-restore-session";
import { Reveal } from "@/components/home/reveal";
import { WeeklyReplayPreview } from "@/components/home/weekly-replay-preview";
import { listPublicQuickRooms } from "@/lib/quick-room";
import { getPublicWeeklyReplay } from "@/lib/public-weekly-replay-server";
import { SITE_LOGO_URL } from "@/lib/site-theme-assets";

// Só aparecem aqui modos já abertos aos jogadores (Torre dos Rebeldes e World Mode ainda são de admin).
const FEATURES: Array<{
  title: string; text: string; tag?: string; icon: ReactNode; href?: string; cta?: string;
}> = [
  {
    title: "Campeonato TCG",
    text: "Acompanhe o campeonato, registre seu deck e jogue as rodadas com a comunidade da Liga.",
    tag: "TCG", icon: <Trophy size={20} />, href: "/torneios", cta: "Ver campeonato",
  },
  {
    title: "Liga Semanal",
    text: "Escalone seu time e acompanhe os confrontos automáticos que movimentam a temporada.",
    tag: "Liga", icon: <Swords size={20} />,
  },
  {
    title: "Liga Rush",
    text: "Partidas rápidas para testar a formação, ganhar ritmo e voltar direto para a ação.",
    tag: "Rápida", icon: <Zap size={20} />,
  },
  {
    title: "ZikaChat",
    text: "Voz, chat, câmera e tela compartilhada para qualquer pessoa com o código da sala.",
    tag: "Livre", icon: <Radio size={20} />, href: "/salas", cta: "Abrir ZikaChat",
  },
  {
    title: "Zika TV",
    text: "Assista às mesas e transmissões da comunidade sem sair da Liga.",
    icon: <Tv size={20} />,
  },
  {
    title: "Arena Draft",
    text: "Escolha seu elenco no draft e entre em disputas rápidas com estratégia a cada rodada.",
    tag: "Beta", icon: <Layers size={20} />,
  },
];

const STEPS = [
  { n: "01", title: "Entre com um convite", text: "Novos jogadores criam a conta com o código de convite de quem já joga." },
  { n: "02", title: "Monte sua coleção", text: "Ganhe ovos, choque e treine mascotes e leve seu time para as arenas." },
  { n: "03", title: "Dispute e suba no ranking", text: "Torneios, Liga Semanal e Top do Dia valem posição no ranking e premiações." },
];

const TCG_HIGHLIGHTS = [
  { icon: <BookOpen size={18} />, title: "Decks e rodadas", text: "Registre suas listas, acompanhe a semana e encontre as partidas do campeonato." },
  { icon: <Trophy size={18} />, title: "Ranking do campeonato", text: "Cada resultado validado organiza a disputa e deixa clara a corrida pelo topo." },
  { icon: <Gift size={18} />, title: "Códigos e premiações", text: "A Liga entrega as recompensas do TCG pela sua Caixa de Presentes." },
];

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB05] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a12]";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const manualUser = await getManualSessionUser();
  if (manualUser) redirect("/dashboard");
  const [liveRooms, weeklyReplay] = await Promise.all([
    listPublicQuickRooms(3).catch(() => []),
    getPublicWeeklyReplay(),
  ]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#0a0a12] text-slate-200">
      <style>{`
        @keyframes home-glow { 0%,100% { opacity: .35; transform: scale(.92); } 50% { opacity: .8; transform: scale(1.06); } }
        .home-hero-glow { animation: home-glow 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .home-hero-glow { animation: none; } }
      `}</style>
      <AutoRestoreSession />

      {/* Fundo: luzes suaves, sem ruído */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-[#FFCB05]/10 blur-[120px]" />
        <div className="absolute -right-24 top-24 h-[320px] w-[320px] rounded-full bg-indigo-500/10 blur-[110px]" />
      </div>

      {/* Barra superior */}
      <header className="sticky top-0 z-30 border-b border-[#FFCB05]/20 bg-[#0d1020]/90 shadow-[0_10px_35px_rgba(0,0,0,.22)] backdrop-blur-xl">
        <div aria-hidden className="h-0.5 bg-gradient-to-r from-transparent via-[#FFCB05] to-transparent opacity-75" />
        <nav aria-label="Principal" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
          <Link href="/" className={`group flex min-w-0 items-center rounded-md ${FOCUS}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="site-brand-logo w-[142px] transition duration-300 group-hover:brightness-110 sm:w-[174px]" src={SITE_LOGO_URL} alt="Liga Zikachu" width={600} height={200} />
          </Link>
          <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-slate-950/45 p-1 text-sm text-slate-400 lg:flex">
            <a href="#novidades" className={`rounded-full px-3 py-1.5 transition hover:bg-white/[.07] hover:text-white ${FOCUS}`}>Novidades</a>
            <a href="#tcg" className={`rounded-full px-3 py-1.5 transition hover:bg-white/[.07] hover:text-white ${FOCUS}`}>Campeonato TCG</a>
            <Link href="/salas" className={`rounded-full px-3 py-1.5 transition hover:bg-white/[.07] hover:text-white ${FOCUS}`}>ZikaChat</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/criar-conta" className={`hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:text-white sm:inline-block ${FOCUS}`}>Criar conta</Link>
            <Link href="/login" className={`rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-black text-[#0a0a12] shadow-[0_6px_18px_rgba(255,203,5,.2)] transition hover:-translate-y-0.5 hover:bg-[#ffd633] ${FOCUS}`}>Entrar</Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-12 sm:pb-24 sm:pt-20">
          <div aria-hidden className="absolute left-5 right-5 top-10 h-[calc(100%-5rem)] rounded-[2rem] border border-white/[.06] bg-[linear-gradient(115deg,rgba(255,203,5,.07),transparent_38%,rgba(61,125,202,.11))]" />
          <div aria-hidden className="home-hero-glow absolute right-[12%] top-[12%] h-48 w-48 rounded-full bg-[#FFCB05]/10 blur-[70px]" />
          <div className="relative grid items-center gap-10 px-1 sm:px-7 lg:grid-cols-[.94fr_1.06fr] lg:px-10">
          <div className="space-y-7 lg:py-4">
            <Link href="/torneios" className={`group inline-flex items-center gap-2 rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 py-1 pl-1 pr-3 text-xs font-semibold text-[#fff1ad] hover:border-[#FFCB05]/60 ${FOCUS}`}>
              <span className="rounded-full bg-[#FFCB05] px-2 py-0.5 font-black text-[#0a0a12]">TCG</span>
              Campeonato, comunidade e batalhas
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </Link>

            <h1 className="max-w-[11ch] text-5xl font-black leading-[.96] tracking-[-.045em] text-white sm:text-6xl lg:text-7xl">
              A sua jornada
              <span className="block text-[#FFCB05]">começa na Liga.</span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Campeonato TCG, Liga Semanal, Liga Rush e mesas ao vivo em uma comunidade feita para jogar junto.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/login" className={`inline-flex items-center gap-2 rounded-xl bg-[#FFCB05] px-6 py-3 text-sm font-bold text-[#0a0a12] shadow-[0_8px_30px_-8px_rgba(255,203,5,0.55)] transition-transform hover:-translate-y-0.5 hover:bg-[#ffd633] ${FOCUS}`}>
                Entrar na Liga <ArrowRight size={16} />
              </Link>
              <Link href="/salas" className={`inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/[0.08] ${FOCUS}`}>
                <Radio size={16} /> Abrir o ZikaChat
              </Link>
              <Link href="/torneios" className={`rounded-lg px-2 py-2 text-sm text-slate-400 hover:text-white ${FOCUS}`}>Ver campeonatos →</Link>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-400"><span>• Campeonato TCG</span><span>• Liga Semanal e Rush</span><span>• ZikaChat sem cadastro</span></div>
          </div>

          <WeeklyReplayPreview replay={weeklyReplay} />
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-5 py-12 lg:grid-cols-2">
          <Reveal><Link href="/torneios" className={`group block h-full overflow-hidden rounded-3xl border border-[#FFCB05]/25 bg-[linear-gradient(135deg,#21192b,#12162d)] p-8 transition hover:-translate-y-1 hover:border-[#FFCB05]/55 sm:p-10 ${FOCUS}`}><p className="text-xs font-black uppercase tracking-[.24em] text-[#FFCB05]">Campeonato TCG da Liga</p><h2 className="mt-4 max-w-md text-3xl font-black leading-tight text-white">Monte seu deck. Suba no ranking.</h2><p className="mt-4 max-w-md leading-relaxed text-slate-300">Acompanhe rodadas, desafie jogadores e viva o campeonato que movimenta a Liga.</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-black text-[#FFCB05]">Conhecer o campeonato <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span></Link></Reveal>
          <Reveal delay={90}><Link href="/salas" className={`group block h-full overflow-hidden rounded-3xl border border-cyan-200/20 bg-[linear-gradient(135deg,#102633,#10172b)] p-8 transition hover:-translate-y-1 hover:border-cyan-200/55 sm:p-10 ${FOCUS}`}><p className="text-xs font-black uppercase tracking-[.24em] text-cyan-200">ZikaChat · sem conta</p><h2 className="mt-4 max-w-md text-3xl font-black leading-tight text-white">A mesa da comunidade está aberta.</h2><p className="mt-4 max-w-md leading-relaxed text-slate-300">Abra uma sala, entre por código e escolha as câmeras ou telas que quer assistir.</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-black text-cyan-200">Abrir ZikaChat <Radio size={16} className="transition-transform group-hover:translate-x-1" /></span></Link></Reveal>
          {liveRooms.length > 0 && <div className="lg:col-span-2"><p className="mb-3 text-xs font-black uppercase tracking-[.24em] text-red-300">● AO VIVO AGORA</p><div className="grid gap-4 md:grid-cols-3">{liveRooms.map((room) => <Link key={room.publicId} href="/salas" className={`rounded-2xl border border-white/10 bg-white/[.035] p-5 transition hover:-translate-y-1 hover:border-[#FFCB05]/40 ${FOCUS}`}><h3 className="truncate font-black text-white">{room.title}</h3><p className="mt-3 text-xs text-slate-400">{room.participants} conectados · {room.cameras + room.screens} fontes ativas</p></Link>)}</div></div>}
        </section>

        {/* Novidades */}
        <section id="novidades" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
          <div className="grid gap-4 md:grid-cols-3"><Reveal className="md:col-span-2">
            <p className="text-sm font-semibold text-[#FFCB05]">Novidades</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">O que a Liga ganhou recentemente</h2>
          </Reveal></div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => {
              const card = (
                <div className="group flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#FFCB05]/35 hover:bg-white/[0.055]">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFCB05]/10 text-[#FFCB05]">{f.icon}</span>
                    {f.tag && <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">{f.tag}</span>}
                  </div>
                  <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{f.text}</p>
                  {f.href && (
                    <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-semibold text-[#FFCB05]">
                      {f.cta} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </div>
              );
              return (
                <Reveal key={f.title} delay={(i % 3) * 80}>
                  {f.href ? <Link href={f.href} className={`block h-full rounded-2xl ${FOCUS}`}>{card}</Link> : card}
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
          <div className="grid gap-4 md:grid-cols-3"><Reveal className="md:col-span-2">
            <p className="text-sm font-semibold text-[#FFCB05]">Como funciona</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Três passos para entrar no jogo</h2>
          </Reveal></div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <li className="h-full list-none rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <span className="text-sm font-bold tabular-nums text-[#FFCB05]">{s.n}</span>
                  <h3 className="mt-3 text-lg font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.text}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* Campeonato TCG */}
        <section id="tcg" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
          <div className="grid gap-4 md:grid-cols-3"><Reveal className="md:col-span-2">
            <p className="text-sm font-semibold text-[#FFCB05]">Campeonato TCG</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">O card game também<span className="block">tem sua casa na Liga</span></h2>
            <p className="mt-4 leading-relaxed text-slate-400">Do deck à premiação, o campeonato reúne as ferramentas para acompanhar e jogar cada rodada com a comunidade.</p>
          </Reveal></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {TCG_HIGHLIGHTS.map((c, i) => (
              <Reveal key={c.title} delay={i * 90}>
                <div className="flex h-full gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-6">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[#FFCB05]">{c.icon}</span>
                  <div>
                    <h3 className="font-semibold text-white">{c.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{c.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Jogo da Liga */}
        <section className="mx-auto max-w-6xl px-5 py-8 sm:py-16">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-[linear-gradient(125deg,rgba(14,39,58,.86),rgba(18,16,38,.95))] p-7 sm:p-10">
              <div aria-hidden className="absolute -right-14 -top-16 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
              <div className="relative grid items-center gap-8 lg:grid-cols-[1.2fr_.8fr]">
                <div><p className="text-xs font-black uppercase tracking-[.24em] text-cyan-200">O jogo da Liga</p><h2 className="mt-3 max-w-xl text-3xl font-black leading-tight text-white sm:text-4xl">Monte seu time e transforme cada turno em estratégia.</h2><p className="mt-4 max-w-xl leading-relaxed text-slate-300">Treine seus mascotes, escolha posturas e leve sua formação para a Liga Semanal ou para a velocidade da Liga Rush. Os replays deixam a evolução do time visível.</p><Link href="/login" className={`mt-7 inline-flex items-center gap-2 rounded-xl border border-cyan-200/25 bg-cyan-200/10 px-4 py-2.5 text-sm font-black text-cyan-100 transition hover:-translate-y-0.5 hover:bg-cyan-200/15 ${FOCUS}`}>Conhecer o jogo <ArrowRight size={16} /></Link></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4"><Swords size={19} className="text-[#FFCB05]" /><h3 className="mt-3 font-black text-white">Liga Semanal</h3><p className="mt-1 text-sm leading-relaxed text-slate-400">Confrontos programados e ranking para acompanhar a temporada.</p></div><div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4"><CirclePlay size={19} className="text-cyan-200" /><h3 className="mt-3 font-black text-white">Liga Rush</h3><p className="mt-1 text-sm leading-relaxed text-slate-400">Ritmo rápido para experimentar novas formações.</p></div></div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Chamada final */}
        <section className="mx-auto max-w-6xl px-5 pb-24 pt-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#FFCB05]/15 via-white/[0.04] to-indigo-500/10 px-6 py-14 text-center sm:px-12">
              <Swords aria-hidden size={28} className="mx-auto text-[#FFCB05]" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">Pronto para entrar na Liga?</h2>
              <p className="mx-auto mt-3 max-w-lg text-slate-400">Entre com sua conta ou crie uma com o código de convite de um jogador.</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/login" className={`inline-flex items-center gap-2 rounded-xl bg-[#FFCB05] px-6 py-3 text-sm font-bold text-[#0a0a12] hover:bg-[#ffd633] ${FOCUS}`}>Entrar <ArrowRight size={16} /></Link>
                <Link href="/criar-conta" className={`rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.06] ${FOCUS}`}>Criar conta</Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/5 px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <span>Liga Zikachu · versão alpha</span>
          <div className="flex gap-5">
            <Link href="/salas" className={`rounded hover:text-white ${FOCUS}`}>ZikaChat</Link>
            <Link href="/login" className={`rounded hover:text-white ${FOCUS}`}>Entrar</Link>
            <Link href="/criar-conta" className={`rounded hover:text-white ${FOCUS}`}>Criar conta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
