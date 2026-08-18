import Link from "next/link";
import { getAppSession } from "@/lib/session";
import { isStaff } from "@/lib/auth/permissions";
import { getSpecConfig } from "@/lib/spec/config";
import { getSpecMonthlyUsage } from "@/lib/spec/usage";
import { SPEC_MONTHLY_GB_LIMIT } from "@/lib/spec/constants";
import { enrichSpecStreams } from "@/lib/spec/data";
import { listActiveSpecStreamsAction } from "./actions";
import { SpecAdminToggle } from "@/components/spec/spec-admin-toggle";
import { ZikaTvTabs } from "@/components/spec/zika-tv-tabs";

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
      <ZikaTvTabs active="zikatv" liveNow={views.length > 0} />
      <header className="rounded-2xl border border-[#FFCB05]/25 bg-gradient-to-r from-[#1a1a2e] via-slate-950 to-purple-950/20 p-5">
        <h1 className="text-2xl font-black text-white">📺 Zika TV</h1>
        <p className="mt-1 text-sm text-slate-400">Assista às partidas dos torneios da Liga ao vivo. As transmissões partem dos próprios participantes.</p>
      </header>

      {admin && <SpecAdminToggle enabled={config.enabled} providerConfigured={config.providerConfigured} estimatedGb={usage?.estimatedGb} gbLimit={SPEC_MONTHLY_GB_LIMIT} resolution={config.resolution} />}

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
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-red-400">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" /></span>
            Ao vivo agora
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {views.map((s) => (
              <Link key={s.id} href={`/spec/${s.id}`} className="group overflow-hidden rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-950/20 via-slate-950 to-slate-950 transition-colors hover:border-red-400/50">
                <div className="relative flex aspect-video items-center justify-center bg-black/40">
                  <span className="text-4xl opacity-30 transition-transform group-hover:scale-110">📺</span>
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" /> Ao vivo
                  </span>
                  <span className="absolute bottom-2 right-2 rounded-lg bg-[#FFCB05] px-3 py-1 text-[11px] font-black text-[#1A1A2E] shadow-lg">▶ Assistir</span>
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-black text-white">{s.matchLabel}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">{s.tournamentName} · {s.weekTitle}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">por {s.broadcasterName}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
