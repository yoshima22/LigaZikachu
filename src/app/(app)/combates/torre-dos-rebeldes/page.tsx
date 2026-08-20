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
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="rounded-2xl border border-purple-500/25 bg-gradient-to-r from-purple-950/40 via-slate-950 to-[#1a1400]/40 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl">🗼</span>
          <h1 className="text-2xl font-black text-white">Torre dos Rebeldes</h1>
          <span className="rounded-full border border-purple-400/40 bg-purple-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-purple-200">
            Em desenvolvimento
          </span>
          <span className="rounded-full border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-300">
            Admin only
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
          Roguelike cooperativo (1–3 jogadores) sobre o motor tático da Arena Z, com
          exploração procedural, fog server-side, Survivor persistente e progressão
          comunitária. Esta página é o shell inicial do modo — acessível somente à
          equipe <strong className="text-white">ADMIN</strong> enquanto está em construção.
        </p>
      </header>

      <TowerLobby />

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-[11px] text-slate-500">
        <p>
          Fase 4 (lobby &amp; entrada): criação de expedição, seleção de 2 mascotes, Função
          de Expedição e ritmo. O gameplay (mapa, exploração e combates) chega nas próximas
          fases. Multiplayer 1–3 será adicionado sobre este lobby.
        </p>
        <div className="mt-3">
          <Link href="/combates/liga-rush" className="font-bold text-[#FFCB05] hover:underline">← Voltar aos Combates</Link>
        </div>
      </section>
    </main>
  );
}
