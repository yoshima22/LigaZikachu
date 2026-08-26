import Link from "next/link";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSpecConfig } from "@/lib/spec/config";
import { enrichSpecStreams } from "@/lib/spec/data";
import { SpecPlayer } from "@/components/spec/spec-player";
import { SpecPlayerP2P } from "@/components/spec/spec-player-p2p";
import { SpecStands } from "@/components/spec/spec-stands";
import { SpecMiniPlayerActivator } from "@/components/spec/spec-mini-player";
import { SpecYoutubePlayer } from "@/components/spec/spec-youtube-player";

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
    select: { id: true, matchId: true, tournamentId: true, title: true, broadcasterUserId: true, status: true, provider: true, startedAt: true, youtubeVideoId: true },
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
  const bettingPool = stream.matchId ? await prisma.zikaBet.groupBy({
    by: ["betOnPlayerId"],
    where: {
      matchId: stream.matchId,
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    },
    _sum: { amount: true },
  }).catch(() => []) : [];
  const matchPlayers = stream.matchId ? await prisma.match.findUnique({
    where: { id: stream.matchId },
    select: {
      playerA: { select: { id: true, displayName: true } },
      playerB: { select: { id: true, displayName: true } },
    },
  }).catch(() => null) : null;
  const poolByPlayer = new Map(bettingPool.map((entry) => [entry.betOnPlayerId, entry._sum.amount ?? 0]));

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
          {matchPlayers?.playerB && (
            <section className="overflow-hidden rounded-2xl border border-[#FFCB05]/25 bg-gradient-to-r from-slate-950 via-[#FFCB05]/5 to-slate-950">
              <div className="border-b border-[#FFCB05]/15 px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#FFCB05]">
                ZikaBet ao vivo · total apostado
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
                <div className="min-w-0 text-center">
                  <p className="truncate text-sm font-black text-white">{matchPlayers.playerA.displayName}</p>
                  <p className="mt-1 text-lg font-black text-emerald-300">{(poolByPlayer.get(matchPlayers.playerA.id) ?? 0).toLocaleString("pt-BR")} ZC</p>
                </div>
                <span className="text-xs font-black text-slate-600">VS</span>
                <div className="min-w-0 text-center">
                  <p className="truncate text-sm font-black text-white">{matchPlayers.playerB.displayName}</p>
                  <p className="mt-1 text-lg font-black text-emerald-300">{(poolByPlayer.get(matchPlayers.playerB.id) ?? 0).toLocaleString("pt-BR")} ZC</p>
                </div>
              </div>
            </section>
          )}
          <SpecMiniPlayerActivator data={{ streamId: stream.id, title: view?.matchLabel ?? "Zika TV", provider: stream.provider, broadcasterUserId: stream.broadcasterUserId, youtubeVideoId: stream.youtubeVideoId }} />
          {stream.youtubeVideoId ? (
            <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-black" style={{ aspectRatio: "16 / 9" }}>
              <SpecYoutubePlayer streamId={stream.id} videoId={stream.youtubeVideoId} />
            </div>
          ) : stream.provider === "p2p-mesh"
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
