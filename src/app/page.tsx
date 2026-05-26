import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trophy,
  Swords,
  TrendingUp,
  Zap,
  Gift,
  Calendar,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Star,
  Package,
  Clock,
} from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f0f1a] via-[#1a1a2e] to-[#0f0f1a]">
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="hex" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M20 0 L40 10 L40 30 L20 40 L0 30 L0 10 Z" fill="none" stroke="#FFCB05" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hex)"/>
          </svg>
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr] items-center">
            {/* Left */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-1.5">
                <Sparkles size={14} className="text-[#FFCB05]" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#FFCB05]">
                  Liga Zikachu • Versão Alpha
                </span>
              </div>

              <h1 className="font-pixel text-3xl font-black tracking-tight text-white sm:text-5xl leading-tight">
                Entre na arena da{" "}
                <span className="text-[#FFCB05] drop-shadow-[0_0_12px_#FFCB05]/30">
                  Liga Zikachu
                </span>
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Acompanhe campeonatos, registre partidas, dispute o{" "}
                <strong className="text-[#FFCB05]">Top do Dia</strong>, suba no{" "}
                <strong className="text-[#FFCB05]">Ranking Geral</strong> e receba seus{" "}
                <strong className="text-[#FFCB05]">códigos de booster</strong> em uma experiência
                criada para a nossa liga.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href="/login">
                  <Button
                    size="lg"
                    className="bg-[#FFCB05] text-[#1A1A2E] font-bold hover:bg-[#FFD700] shadow-[0_0_20px_#FFCB05]/20"
                  >
                    Entrar no app
                    <ChevronRight size={18} className="ml-1" />
                  </Button>
                </Link>
                <Link href="/torneios">
                  <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:border-[#FFCB05]/50 hover:text-[#FFCB05]">
                    <Trophy size={16} className="mr-2" />
                    Ver campeonatos
                  </Button>
                </Link>
              </div>

              <div className="rounded-xl border border-[#FFCB05]/10 bg-[#FFCB05]/5 px-4 py-3">
                <p className="text-xs text-slate-400 leading-relaxed">
                  <Zap size={12} className="inline text-[#FFCB05] mr-1" />
                  Estamos testando a primeira versão do app. Algumas funcionalidades ainda estão evoluindo enquanto migramos a lógica da planilha para uma experiência completa.
                </p>
              </div>
            </div>

            {/* Right card */}
            <Card className="border-[#FFCB05]/20 bg-gradient-to-br from-[#1A1A2E] to-[#2a1a3e]">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFCB05]/20">
                    <Star size={20} className="text-[#FFCB05]" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Sua liga em um só lugar</p>
                    <p className="text-xs text-slate-400">Temporada em preparação</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { icon: Calendar, text: "Temporadas e campeonatos" },
                    { icon: Swords, text: "Partidas e resultados validados" },
                    { icon: TrendingUp, text: "Ranking Geral e Top do Dia" },
                    { icon: Gift, text: "Premiações com códigos" },
                    { icon: Package, text: "Caixa de presentes dos jogadores" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 text-sm text-slate-300">
                      <Icon size={14} className="text-[#FFCB05] shrink-0" />
                      {text}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* O que é */}
      <section className="px-6 py-16 border-t border-slate-800/50">
        <div className="mx-auto max-w-4xl text-center space-y-4">
          <h2 className="font-pixel text-xl font-bold text-white sm:text-2xl">
            O que é a Liga Zikachu?
          </h2>
          <p className="text-slate-300 leading-relaxed">
            A Liga Zikachu é uma competição organizada de{" "}
            <strong className="text-[#FFCB05]">Pokémon TCG Live</strong>, criada para transformar
            partidas entre jogadores em uma experiência de temporada: com rankings, desafios,
            premiações, conquistas e momentos especiais a cada dia de campeonato.
          </p>
          <p className="text-slate-400 text-sm">
            O app nasce para substituir a antiga planilha da liga, mantendo as regras que já funcionam
            e adicionando uma experiência mais clara para jogadores e administradores.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl space-y-8">
          <h2 className="font-pixel text-xl font-bold text-white text-center sm:text-2xl">
            O que você poderá fazer no app
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Trophy,
                title: "Campeonatos e temporadas",
                desc: "Inscreva-se em torneios, acompanhe dias de campeonato e veja sua evolução durante a temporada.",
              },
              {
                icon: Swords,
                title: "Partidas e resultados",
                desc: "Veja suas partidas, acompanhe resultados validados e acompanhe o histórico da liga.",
              },
              {
                icon: TrendingUp,
                title: "Ranking Geral",
                desc: "Consulte o ranking acumulado da Liga Zikachu, considerando todas as partidas validadas de todos os campeonatos.",
              },
              {
                icon: Zap,
                title: "Top do Dia",
                desc: "Dispute o destaque de cada dia de campeonato. O Top do Dia é calculado apenas com os resultados daquele dia.",
              },
              {
                icon: Gift,
                title: "Códigos e premiações",
                desc: "Receba códigos de booster por participação, desempenho, sorteios e conquistas.",
              },
              {
                icon: Package,
                title: "Caixa de presentes",
                desc: "Seus códigos recebidos ficam organizados em uma área própria, com status de Não Ativado, Ativado ou Inválido.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <Card
                key={title}
                className="group border-slate-800 bg-slate-900/50 hover:border-[#FFCB05]/30 transition-all duration-300"
              >
                <CardContent className="p-5 space-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFCB05]/10 group-hover:bg-[#FFCB05]/20 transition-colors">
                    <Icon size={20} className="text-[#FFCB05]" />
                  </div>
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Ranking vs Top do Dia */}
      <section className="px-6 py-16 border-t border-slate-800/50">
        <div className="mx-auto max-w-4xl space-y-8">
          <h2 className="font-pixel text-xl font-bold text-white text-center sm:text-2xl">
            Ranking Geral vs Top do Dia
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} className="text-blue-400" />
                  <h3 className="font-semibold text-white">Ranking Geral</h3>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  O Ranking Geral mostra o desempenho acumulado dos jogadores ao longo de{" "}
                  <strong>todos os campeonatos e temporadas</strong> da Liga Zikachu.
                </p>
              </CardContent>
            </Card>

            <Card className="border-[#FFCB05]/20 bg-[#FFCB05]/5">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-[#FFCB05]" />
                  <h3 className="font-semibold text-white">Top do Dia</h3>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  O Top do Dia mostra o melhor desempenho dentro de um{" "}
                  <strong>dia específico de campeonato</strong>. Ele não é o ranking geral.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Alpha / Roadmap */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5">
              <Clock size={14} className="text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Versão Alpha</span>
            </div>
            <h2 className="font-pixel text-xl font-bold text-white sm:text-2xl">
              Em construção
            </h2>
            <p className="text-slate-300">
              Esta é uma versão Alpha da Liga Zikachu App. Estamos validando o fluxo principal da liga:
              autenticação, campeonatos, jogadores, rankings, resultados, códigos e painel administrativo.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Em desenvolvimento", text: "Experiência visual e fluxo de campeonato" },
              { label: "Em validação", text: "Rankings, Top do Dia e distribuição de códigos" },
              { label: "Em breve", text: "Mais automações, conquistas e relatórios" },
            ].map(({ label, text }) => (
              <Card key={label} className="border-slate-800 bg-slate-900/50">
                <CardContent className="p-4 text-center space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#FFCB05]">{label}</p>
                  <p className="text-sm text-slate-400">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Admin section */}
      <section className="px-6 py-16 border-t border-slate-800/50">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-center gap-3 justify-center">
            <ShieldCheck size={20} className="text-[#FFCB05]" />
            <h2 className="font-pixel text-lg font-bold text-white">
              Controle da liga sem depender da planilha
            </h2>
          </div>
          <p className="text-center text-slate-300">
            Administradores poderão validar resultados, corrigir informações, recalcular rankings,
            distribuir códigos, revisar códigos inválidos e acompanhar tudo com histórico de alterações.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Validar resultados",
              "Gerenciar campeonatos",
              "Calcular Top do Dia",
              "Distribuir prêmios",
              "Revisar códigos",
              "Auditar alterações",
            ].map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-xs text-slate-400"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-2xl text-center space-y-6">
          <h2 className="font-pixel text-2xl font-bold text-white">Pronto para entrar na liga?</h2>
          <p className="text-slate-300">
            Acesse sua conta, acompanhe seus campeonatos e veja seus presentes disponíveis.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/login">
              <Button
                size="lg"
                className="bg-[#FFCB05] text-[#1A1A2E] font-bold hover:bg-[#FFD700] shadow-[0_0_20px_#FFCB05]/20"
              >
                Entrar no app
                <ChevronRight size={18} className="ml-1" />
              </Button>
            </Link>
            <Link href="/torneios">
              <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:border-[#FFCB05]/50 hover:text-[#FFCB05]">
                <Trophy size={16} className="mr-2" />
                Ver campeonatos
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[#FFCB05]" />
            <span className="font-pixel text-sm text-[#FFCB05]">Liga Zikachu</span>
            <span className="text-xs text-slate-500">• Alpha</span>
          </div>
          <p className="text-xs text-slate-600">
            Experiência criada para a comunidade da Liga Zikachu.
          </p>
        </div>
      </footer>
    </div>
  );
}
