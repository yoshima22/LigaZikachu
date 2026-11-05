import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowRight, Crown, Gift, Layers, Link2, Radio, Shield, Sparkles, Swords, Trophy, Tv, TrendingUp,
} from "lucide-react";
import { auth } from "@/auth";
import { getManualSessionUser } from "@/lib/manual-session";
import { AutoRestoreSession } from "@/components/auth/auto-restore-session";
import { Reveal } from "@/components/home/reveal";
import { listPublicQuickRooms } from "@/lib/quick-room";

// Só aparecem aqui modos já abertos aos jogadores (Torre dos Rebeldes e World Mode ainda são de admin).
const FEATURES: Array<{
  title: string; text: string; tag?: string; icon: ReactNode; href?: string; cta?: string; wide?: boolean;
}> = [
  {
    title: "ZikaChat",
    text: "Salas de voz, chat e compartilhamento de tela para qualquer pessoa com o link. Sem cadastro, até 13 pessoas, e você escolhe quais telas assistir.",
    tag: "Novo", icon: <Radio size={20} />, href: "/salas", cta: "Criar uma sala", wide: true,
  },
  {
    title: "Posturas de combate",
    text: "Cumpra jornadas de treino com seus mascotes e desbloqueie 13 posturas, cada uma com efeito próprio nas batalhas.",
    tag: "Novo", icon: <Shield size={20} />,
  },
  {
    title: "Zika TV",
    text: "Transmissões ao vivo da Liga: acompanhe partidas e lives sem sair do app.",
    icon: <Tv size={20} />,
  },
  {
    title: "Laços",
    text: "Vínculos entre mascotes que evoluem com o tempo e geram efeitos e histórias.",
    tag: "Alpha", icon: <Link2 size={20} />,
  },
  {
    title: "Arena Draft",
    text: "Escolha seus mascotes em um draft e desafie outros jogadores em partidas rápidas.",
    tag: "Beta", icon: <Layers size={20} />,
  },
  {
    title: "Líderes de Johto",
    text: "Evento da comunidade contra os líderes de Johto, com ranking de dano e replays.",
    tag: "Beta", icon: <Crown size={20} />,
  },
];

const STEPS = [
  { n: "01", title: "Entre com um convite", text: "Novos jogadores criam a conta com o código de convite de quem já joga." },
  { n: "02", title: "Monte sua coleção", text: "Ganhe ovos, choque e treine mascotes e leve seu time para as arenas." },
  { n: "03", title: "Dispute e suba no ranking", text: "Torneios, Liga Semanal e Top do Dia valem posição no ranking e premiações." },
];

const COMPETE = [
  { icon: <Trophy size={18} />, title: "Ranking Geral", text: "A pontuação da temporada, atualizada a cada partida validada." },
  { icon: <TrendingUp size={18} />, title: "Top do Dia", text: "Quem mais brilhou hoje, com destaque para os melhores do dia." },
  { icon: <Gift size={18} />, title: "Premiações com códigos", text: "Códigos de booster entregues direto na sua Caixa de Presentes." },
];

const SPRITES = [
  { id: 25, className: "left-[6%] top-[10%] h-24 w-24", delay: "0s" },
  { id: 6, className: "right-[6%] top-[4%] h-28 w-28", delay: "-1.4s" },
  { id: 94, className: "left-[34%] top-[38%] h-24 w-24", delay: "-2.6s" },
  { id: 448, className: "left-[4%] bottom-[6%] h-24 w-24", delay: "-0.8s" },
  { id: 133, className: "right-[8%] bottom-[8%] h-24 w-24", delay: "-2s" },
];

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB05] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a12]";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const manualUser = await getManualSessionUser();
  if (manualUser) redirect("/dashboard");
  const liveRooms = await listPublicQuickRooms(3).catch(() => []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#0a0a12] text-slate-200">
      <style>{`
        @keyframes home-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        .home-float { animation: home-float 5.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .home-float { animation: none; } }
      `}</style>
      <AutoRestoreSession />

      {/* Fundo: luzes suaves, sem ruído */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-[#FFCB05]/10 blur-[120px]" />
        <div className="absolute -right-24 top-24 h-[320px] w-[320px] rounded-full bg-indigo-500/10 blur-[110px]" />
      </div>

      {/* Barra superior */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0a0a12]/75 backdrop-blur-md">
        <nav aria-label="Principal" className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          <Link href="/" className={`flex items-center gap-2 rounded-md font-semibold text-white ${FOCUS}`}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FFCB05] text-[#0a0a12]"><Sparkles size={15} /></span>
            Liga Zikachu
          </Link>
          <div className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            <a href="#novidades" className={`rounded-md hover:text-white ${FOCUS}`}>Novidades</a>
            <a href="#como-funciona" className={`rounded-md hover:text-white ${FOCUS}`}>Como funciona</a>
            <Link href="/salas" className={`rounded-md hover:text-white ${FOCUS}`}>ZikaChat</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/criar-conta" className={`hidden rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:text-white sm:inline-block ${FOCUS}`}>Criar conta</Link>
            <Link href="/login" className={`rounded-lg bg-[#FFCB05] px-4 py-1.5 text-sm font-semibold text-[#0a0a12] hover:bg-[#ffd633] ${FOCUS}`}>Entrar</Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-12 sm:pb-24 sm:pt-20">
          <div aria-hidden className="absolute left-5 right-5 top-10 h-[calc(100%-5rem)] rounded-[2rem] border border-white/[.06] bg-[linear-gradient(115deg,rgba(255,203,5,.07),transparent_38%,rgba(61,125,202,.11))]" />
          <div className="relative grid items-center gap-10 px-1 sm:px-7 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
          <div className="space-y-7">
            <Link href="/torneios" className={`group inline-flex items-center gap-2 rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 py-1 pl-1 pr-3 text-xs font-semibold text-[#fff1ad] hover:border-[#FFCB05]/60 ${FOCUS}`}>
              <span className="rounded-full bg-[#FFCB05] px-2 py-0.5 font-black text-[#0a0a12]">TCG</span>
              Campeonato, comunidade e batalhas
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </Link>

            <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-6xl">
              O seu próximo
              <span className="block text-[#FFCB05]">confronto começa aqui.</span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              A Liga Zikachu reúne campeonatos TCG, mascotes, desafios e mesas ao vivo em uma comunidade feita para jogar junto.
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

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-400"><span>• Campeonato TCG</span><span>• Mascotes e batalhas</span><span>• ZikaChat sem cadastro</span></div>
          </div>

          <div aria-hidden className="relative mx-auto aspect-[1.06] w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#FFCB05]/25 bg-[radial-gradient(circle_at_50%_36%,rgba(255,203,5,.25),transparent_26%),linear-gradient(145deg,#182953,#0b1027_58%,#171126)] p-4 shadow-2xl shadow-black/50">
            <div className="absolute inset-4 rounded-[1.45rem] border border-white/10" />
            <div className="absolute inset-x-[18%] top-[15%] bottom-[15%] rounded-[50%] border border-[#FFCB05]/35 bg-[radial-gradient(ellipse_at_center,rgba(255,203,5,.18),transparent_66%)]" />
            <div className="absolute left-7 top-7 rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 backdrop-blur"><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#FFCB05]">Liga Arena</p><p className="mt-0.5 text-xs font-bold text-white">Temporada em jogo</p></div>
            <div className="absolute bottom-7 right-7 rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-right backdrop-blur"><p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">Próximo passo</p><p className="mt-0.5 text-xs font-bold text-white">Escolha sua jornada</p></div>
            <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-[#FFCB05] bg-slate-950 text-[#FFCB05] shadow-[0_0_45px_rgba(255,203,5,.5)]"><Swords size={30} /></div>
            {SPRITES.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={s.id}
                src={`/sprites/pokemon/${s.id}.png`}
                alt=""
                width={112}
                height={112}
                className={`home-float absolute z-10 object-contain drop-shadow-[0_12px_18px_rgba(0,0,0,0.6)] ${s.className}`}
                style={{ imageRendering: "pixelated", animationDelay: s.delay }}
              />
            ))}
          </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-5 py-12 lg:grid-cols-2">
          <Reveal><Link href="/torneios" className={`group block h-full overflow-hidden rounded-3xl border border-[#FFCB05]/25 bg-[linear-gradient(135deg,#21192b,#12162d)] p-8 transition hover:-translate-y-1 hover:border-[#FFCB05]/55 sm:p-10 ${FOCUS}`}><p className="text-xs font-black uppercase tracking-[.24em] text-[#FFCB05]">Campeonato TCG da Liga</p><h2 className="mt-4 max-w-md text-3xl font-black leading-tight text-white">Monte seu deck. Suba no ranking.</h2><p className="mt-4 max-w-md leading-relaxed text-slate-300">Acompanhe rodadas, desafie jogadores e viva o campeonato que movimenta a Liga.</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-black text-[#FFCB05]">Conhecer o campeonato <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span></Link></Reveal>
          <Reveal delay={90}><Link href="/salas" className={`group block h-full overflow-hidden rounded-3xl border border-cyan-200/20 bg-[linear-gradient(135deg,#102633,#10172b)] p-8 transition hover:-translate-y-1 hover:border-cyan-200/55 sm:p-10 ${FOCUS}`}><p className="text-xs font-black uppercase tracking-[.24em] text-cyan-200">ZikaChat · sem conta</p><h2 className="mt-4 max-w-md text-3xl font-black leading-tight text-white">A mesa da comunidade está aberta.</h2><p className="mt-4 max-w-md leading-relaxed text-slate-300">Abra uma sala, entre por código e escolha as câmeras ou telas que quer assistir.</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-black text-cyan-200">Abrir ZikaChat <Radio size={16} className="transition-transform group-hover:translate-x-1" /></span></Link></Reveal>
          {liveRooms.length > 0 && <div className="lg:col-span-2"><p className="mb-3 text-xs font-black uppercase tracking-[.24em] text-red-300">● AO VIVO AGORA</p><div className="grid gap-4 md:grid-cols-3">{liveRooms.map((room) => <Link key={room.publicId} href="/salas" className={`rounded-2xl border border-white/10 bg-white/[.035] p-5 transition hover:-translate-y-1 hover:border-[#FFCB05]/40 ${FOCUS}`}><h3 className="truncate font-black text-white">{room.title}</h3><p className="mt-3 text-xs text-slate-400">{room.participants} conectados · {room.cameras + room.screens} fontes ativas</p></Link>)}</div></div>}
        </section>

        {/* Novidades */}
        <section id="novidades" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
          <Reveal>
            <p className="text-sm font-semibold text-[#FFCB05]">Novidades</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">O que a Liga ganhou recentemente</h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => {
              const card = (
                <div className={`group flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.05] ${f.wide ? "lg:col-span-2" : ""}`}>
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
                <Reveal key={f.title} delay={(i % 3) * 80} className={f.wide ? "lg:col-span-2" : ""}>
                  {f.href ? <Link href={f.href} className={`block h-full rounded-2xl ${FOCUS}`}>{card}</Link> : card}
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
          <Reveal>
            <p className="text-sm font-semibold text-[#FFCB05]">Como funciona</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">Três passos para entrar no jogo</h2>
          </Reveal>
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

        {/* Competição */}
        <section className="mx-auto max-w-6xl px-5 py-16">
          <Reveal>
            <p className="text-sm font-semibold text-[#FFCB05]">Competição</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">Cada partida conta</h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {COMPETE.map((c, i) => (
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
