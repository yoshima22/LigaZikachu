import Link from "next/link";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Monitor,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { WindowsInstallButton } from "./_components/windows-install-button";
import { AndroidUpdateButton } from "@/components/android-update";

const APK_PATH = "https://github.com/yoshima22/LigaZikachu/releases/latest/download/app-debug.apk";

export default function DownloadsPage() {
  return (
    <div className="space-y-6 pb-8">
      <script
        dangerouslySetInnerHTML={{
          __html: `window.addEventListener("beforeinstallprompt",function(event){event.preventDefault();window.__ligaInstallPrompt=event;});`,
        }}
      />
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-[#FFCB05]/25 bg-[#06152c] shadow-2xl shadow-blue-950/40">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 scale-105 bg-cover bg-[position:center_34%] opacity-30 blur-[1px]"
          style={{ backgroundImage: "url('/downloads/downloads-hero.webp')" }}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#031227]/45 via-[#031227]/80 to-[#031227]" />
        <div className="mx-auto flex min-h-[430px] max-w-4xl flex-col items-center justify-center px-5 py-14 text-center sm:px-10">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FFCB05]/35 bg-black/35 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#FFCB05] backdrop-blur-md">
            <Zap size={13} /> Cliente oficial da Liga
          </span>
          <h1 className="font-pixel text-3xl leading-tight text-white drop-shadow-[0_5px_0_#08142c] sm:text-5xl">
            Liga Zikachu
            <span className="mt-3 block text-[#FFCB05]">Downloads</span>
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-lg">
            Escolha sua plataforma, entre com a mesma conta e leve a Liga com você no computador ou no Android.
          </p>
          <a
            href="#plataformas"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#FFCB05] px-6 py-3.5 text-sm font-black uppercase tracking-wide text-[#111827] shadow-[0_10px_35px_rgba(255,203,5,0.3)] transition hover:-translate-y-0.5 hover:bg-yellow-300"
          >
            <Download size={20} /> Download agora
          </a>
        </div>
      </section>

      <section id="plataformas" className="scroll-mt-32">
        <AndroidUpdateButton />
        <div className="mb-4 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FFCB05]">Escolha sua plataforma</p>
          <h2 className="mt-1 text-2xl font-black text-white">Duas formas de entrar na Liga</h2>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <article className="relative overflow-hidden rounded-3xl border border-lime-400/35 bg-gradient-to-br from-lime-950/80 via-emerald-950/75 to-slate-950 p-5 shadow-xl sm:p-7">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-lime-400/10 blur-3xl" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-4 lg:min-h-[148px]">
                <div>
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-lime-300">Android</span>
                  <h3 className="mt-1 text-3xl font-black text-white">Aplicativo APK</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">
                    Baixe o arquivo oficial e instale diretamente no seu celular ou tablet Android.
                  </p>
                </div>
                <div className="rounded-2xl border border-lime-300/30 bg-lime-400/15 p-4 text-lime-300">
                  <Smartphone size={38} />
                </div>
              </div>

              <div className="my-6 grid grid-cols-3 gap-2 text-center text-xs">
                <InfoPill label="Versão" value="0.7.8" />
                <InfoPill label="Tamanho" value="2,48 MB" />
                <InfoPill label="Formato" value="APK" />
              </div>

              <a
                href={APK_PATH}
                download
                className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-lime-300 to-green-600 px-5 py-3.5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-[0_10px_30px_rgba(132,204,22,0.22)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                <Download size={21} /> Baixar APK
              </a>
              <p className="mt-3 text-center text-[11px] text-lime-100/70">
                O Android pode pedir autorização para instalar aplicativos desta fonte.
              </p>
            </div>
          </article>

          <article className="relative overflow-hidden rounded-3xl border border-cyan-400/35 bg-gradient-to-br from-cyan-950/75 via-blue-950/75 to-slate-950 p-5 shadow-xl sm:p-7">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-4 lg:min-h-[148px]">
                <div>
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Windows</span>
                  <h3 className="mt-1 text-3xl font-black text-white">Aplicativo do site</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">
                    Instale a Liga por um navegador compatível. Ela ganha atalho próprio, abre em uma janela separada e continua sempre ligada à versão atual do site.
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-300/30 bg-cyan-400/15 p-4 text-cyan-300">
                  <Monitor size={38} />
                </div>
              </div>

              <div className="my-6 grid grid-cols-3 gap-2 text-center text-xs">
                <InfoPill label="Tipo" value="PWA" />
                <InfoPill label="Atualização" value="Automática" />
                <InfoPill label="Navegador" value="Chrome/Edge/Opera*" />
              </div>

              <div className="mt-auto">
                <WindowsInstallButton />
              </div>
              <p className="mt-3 text-center text-[11px] text-cyan-100/70">
                Não é um arquivo .exe: é a instalação segura oferecida pelo próprio navegador.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/60 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Benefit icon={ShieldCheck} title="Arquivo oficial" text="APK disponibilizado diretamente pela Liga." />
        <Benefit icon={Sparkles} title="Mesma experiência" text="Seu progresso e sua conta continuam os mesmos." />
        <Benefit icon={Zap} title="Acesso rápido" text="Entre na Liga sem procurar a página toda vez." />
        <Benefit icon={Users} title="Uma comunidade" text="Todos jogam juntos, independentemente da plataforma." />
      </section>

      <details className="group rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-xs text-slate-400">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-bold text-slate-200">
          <CheckCircle2 size={15} className="text-emerald-400" /> Verificação do arquivo Android
          <span className="ml-auto text-[10px] text-slate-500 group-open:hidden">mostrar</span>
        </summary>
        <p className="mt-3 leading-relaxed">O aplicativo compara automaticamente o SHA-256 publicado com o arquivo baixado antes de abrir a instalação.</p>
      </details>

      <div className="text-center text-xs text-slate-500">
        Prefere continuar pelo navegador?{" "}
        <Link href="/dashboard" className="inline-flex items-center gap-1 font-bold text-[#FFCB05] hover:underline">
          Voltar para a Liga <ExternalLink size={12} />
        </Link>
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-2 py-2.5">
      <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="mt-1 block font-bold text-slate-100">{value}</span>
    </div>
  );
}

function Benefit({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl p-2">
      <div className="mt-0.5 text-[#FFCB05]"><Icon size={23} /></div>
      <div>
        <h3 className="text-sm font-black text-white">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{text}</p>
      </div>
    </div>
  );
}
