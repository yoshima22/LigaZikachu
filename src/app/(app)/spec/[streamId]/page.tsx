import Link from "next/link";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSpecConfig } from "@/lib/spec/config";
import { enrichSpecStreams } from "@/lib/spec/data";
import { SpecPlayer } from "@/components/spec/spec-player";
import { SpecPlayerP2P } from "@/components/spec/spec-player-p2p";
import { SpecStands } from "@/components/spec/spec-stands";
import { youtubeEmbedUrl } from "@/lib/spec/constants";

export const dynamic = "force-dynamic";

export default async function SpecWatchPage({ params }: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await params;
  const session = await getAppSession();

  if (!session?.user) {
    return <main className="mx-auto max-w-3xl px-1 py-10 text-center text-sm text-slate-400">Faça login para assistir às transmissões.</main>;
  }

  const config = await getSpecConfig();
  const stream = config.enabled ? await prisma.specStream.findUnique({
    where: { id: streamId },
    select: { id: true, matchId: true, tournamentId: true, title: true, broadcasterUserId: true, status: true, startedAt: true, youtubeVideoId: true },
  }).catch(() => null) : null;

  if (!config.enabled || !stream) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-1 py-10 text-center">
        <p className="text-sm text-slate-400">Transmissão indisponível.</p>
        <Link href="/spec" className="text-xs text-[#FFCB05] underline">← Voltar ao Modo SPEC</Link>
      </main>
    );
  }

  const [view] = await enrichSpecStreams([stream]);
  const isLive = stream.status === "LIVE";

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-red-400">{isLive ? "🔴 Ao vivo · Zika TV" : "Zika TV"}</p>
          <h1 className="truncate text-xl font-black text-white">{view?.matchLabel ?? "Partida"}</h1>
          <p className="text-xs text-slate-400">{view?.tournamentName} · {view?.weekTitle} · Transmitido por {view?.broadcasterName}</p>
        </div>
        <Link href="/spec" className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">← Zika TV</Link>
      </div>

      {isLive ? (
        <>
          {stream.youtubeVideoId ? (
            <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-black" style={{ aspectRatio: "16 / 9" }}>
              <iframe
                src={youtubeEmbedUrl(stream.youtubeVideoId)}
                title="Zika TV"
                className="absolute inset-0 h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          ) : config.mode === "p2p-mesh"
            ? <SpecPlayerP2P streamId={stream.id} broadcasterUserId={stream.broadcasterUserId} />
            : <SpecPlayer streamId={stream.id} />}
          <SpecStands streamId={stream.id} sendPresence />
        </>
      ) : (
        <div className="rounded-2xl border border-border bg-slate-950/60 p-8 text-center text-sm text-slate-500">
          Esta transmissão não está mais ao vivo.
        </div>
      )}
    </main>
  );
}
