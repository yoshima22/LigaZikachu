import Link from "next/link";
import { getAppSession } from "@/lib/session";
import { isStaff } from "@/lib/auth/permissions";
import { getSpecConfig } from "@/lib/spec/config";
import { getSpecMonthlyUsage } from "@/lib/spec/usage";
import { SPEC_MONTHLY_GB_LIMIT } from "@/lib/spec/constants";
import { enrichSpecStreams } from "@/lib/spec/data";
import { listActiveSpecStreamsAction } from "./actions";
import { SpecAdminToggle } from "@/components/spec/spec-admin-toggle";

export const dynamic = "force-dynamic";

export default async function SpecPage() {
  const session = await getAppSession();
  const admin = Boolean(session?.user && isStaff(session.user.role));
  const config = await getSpecConfig();

  const { streams } = config.enabled ? await listActiveSpecStreamsAction() : { streams: [] };
  const views = await enrichSpecStreams(streams);
  const usage = admin ? await getSpecMonthlyUsage() : null;

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-1 py-2">
      <header className="rounded-2xl border border-[#FFCB05]/25 bg-gradient-to-r from-[#1a1a2e] via-slate-950 to-purple-950/20 p-5">
        <h1 className="text-2xl font-black text-white">📺 Modo SPEC</h1>
        <p className="mt-1 text-sm text-slate-400">Assista às partidas dos torneios da Liga ao vivo. As transmissões partem dos próprios participantes.</p>
      </header>

      {admin && <SpecAdminToggle enabled={config.enabled} providerConfigured={config.providerConfigured} estimatedGb={usage?.estimatedGb} gbLimit={SPEC_MONTHLY_GB_LIMIT} />}

      {!config.enabled ? (
        <section className="rounded-2xl border border-border bg-slate-950/60 p-8 text-center text-sm text-slate-400">
          O Modo SPEC está indisponível no momento.
        </section>
      ) : views.length === 0 ? (
        <section className="rounded-2xl border border-border bg-slate-950/60 p-8 text-center text-sm text-slate-500">
          Nenhuma transmissão ao vivo agora. Quando um participante abrir uma live na página de resultados do torneio, ela aparece aqui.
        </section>
      ) : (
        <section className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-400">🔴 Ao vivo</p>
          {views.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
              <div className="min-w-0">
                <p className="truncate text-base font-black text-white">{s.matchLabel}</p>
                <p className="text-xs text-slate-400">{s.tournamentName} · Transmitido por {s.broadcasterName}</p>
              </div>
              <Link href={`/spec/${s.id}`} className="shrink-0 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-black text-[#1A1A2E] hover:bg-[#FFD700]">
                ▶ Assistir
              </Link>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
