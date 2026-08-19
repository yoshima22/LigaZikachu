import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { getTowerOverviewAction } from "./actions";

export const dynamic = "force-dynamic";

// Torre dos Rebeldes — Fase 1: shell admin-only.
// Guard server-side com requirePlatformAdmin (ADMIN/SUPER_ADMIN). GM e USER são
// redirecionados — a segurança NÃO depende de esconder o link no frontend.
export default async function TorreDosRebeldesPage() {
  await requirePlatformAdmin();
  const overview = await getTowerOverviewAction();

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

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">Fase 1 · Fundação</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          <li>✅ Gate <strong className="text-white">admin-only</strong> — página, navegação e actions atrás de verificação de role no servidor.</li>
          <li>✅ <strong className="text-white">GM negado</strong> — usa <code className="text-slate-400">requirePlatformAdmin</code>/<code className="text-slate-400">isAdmin</code>, nunca <code className="text-slate-400">isStaff</code>.</li>
          <li>⏳ Próximo — <strong className="text-white">Fase 2</strong>: extrair o motor tático da Arena Z num núcleo reutilizável com grid parametrizável.</li>
        </ul>
        {"ok" in overview && (
          <p className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200">
            Verificação de acesso e action guardada funcionando: <span className="text-emerald-100">{overview.message}</span>
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400">
        <p>
          O plano de implementação faseado (auditoria do código real, modelo de dados,
          mapa de arquivos e riscos) orienta as próximas fases. Nada de gameplay está
          disponível ainda — o objetivo desta entrega é estabelecer o acesso restrito e
          o esqueleto do modo.
        </p>
        <div className="mt-4">
          <Link href="/combates/liga-rush" className="text-xs font-bold text-[#FFCB05] hover:underline">
            ← Voltar aos Combates
          </Link>
        </div>
      </section>
    </main>
  );
}
