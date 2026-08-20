import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { TowerLobby } from "./_components/tower-lobby";

export const dynamic = "force-dynamic";

// Torre dos Rebeldes — Fase 1: shell admin-only.
// Guard server-side com requirePlatformAdmin (ADMIN/SUPER_ADMIN). GM e USER são
// redirecionados — a segurança NÃO depende de esconder o link no frontend.
export default async function TorreDosRebeldesPage() {
  await requirePlatformAdmin();

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="relative min-h-[360px] overflow-hidden rounded-3xl border border-purple-500/35 bg-cover bg-center p-6 shadow-[0_0_60px_rgba(109,40,217,.18)]" style={{backgroundImage:"linear-gradient(90deg,rgba(5,2,12,.96),rgba(5,2,12,.48),rgba(5,2,12,.82)),url('/events/torre-dos-rebeldes/cover.png')"}}>
       <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#07040d] to-transparent" />
       <div className="relative max-w-2xl pt-24">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl">🗼</span>
          <h1 className="text-2xl font-black text-white">Torre dos Rebeldes</h1>
          <span className="rounded-full border border-purple-400/40 bg-purple-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-200">
            Evento em construção
          </span>
          <span className="rounded-full border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-300">
            Admin only
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          Uma expedição cooperativa para 1–3 jogadores. Escolha dois mascotes, atravesse
          salas cobertas pela névoa, neutralize mecanismos e enfrente os rebeldes em
          confrontos apresentados rodada por rodada. O progresso de vida permanece entre os andares.
        </p>
       </div>
      </header>

      <TowerLobby />

      <details className="rounded-2xl border border-purple-400/20 bg-slate-950/70 p-4 text-sm text-slate-300">
        <summary className="cursor-pointer font-black text-purple-200">🎨 Guia para gerar peças modulares do mapa</summary>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">Gere cada peça separadamente em PNG quadrado, vista superior ortográfica, fundo transparente, iluminação violeta gótica e sem personagens. Mantenha exatamente a mesma câmera e escala em todas.</p>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4"><span className="rounded-lg bg-black/30 p-2">Pisos: comum, rachado, rúnico e abismo</span><span className="rounded-lg bg-black/30 p-2">Paredes: reta, canto, junção e pilar</span><span className="rounded-lg bg-black/30 p-2">Portas: selada, fechada, aberta e destruída</span><span className="rounded-lg bg-black/30 p-2">Eventos: armadilha, escada, altar e saída</span></div>
        <p className="mt-3 rounded-lg border border-slate-800 bg-black/30 p-3 text-[11px] text-slate-400"><strong className="text-white">Prompt-base:</strong> “modular gothic haunted tower dungeon tile, orthographic top-down view, dark stone, purple spectral light, ornate black iron and gold details, transparent background, centered, no text, no characters, consistent 1:1 game asset, 512×512”.</p>
      </details>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-[11px] text-slate-500">
        <p>Ambiente restrito para validação do evento. Ações, cenas e encontros podem ser testados sem expor o modo aos jogadores.</p>
        <div className="mt-3">
          <Link href="/combates/liga-rush" className="font-bold text-[#FFCB05] hover:underline">← Voltar aos Combates</Link>
        </div>
      </section>
    </main>
  );
}
