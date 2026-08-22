import Link from "next/link";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSpecConfig } from "@/lib/spec/config";
import { enrichSpecStreams } from "@/lib/spec/data";
import { SPEC_RESOLUTION_PROFILES, SPEC_P2P_PROFILE, specScaledBitrate } from "@/lib/spec/constants";
import { SpecBroadcaster } from "@/components/spec/spec-broadcaster";
import { SpecBroadcasterP2P } from "@/components/spec/spec-broadcaster-p2p";
import { SpecBroadcasterYouTube } from "@/components/spec/spec-broadcaster-youtube";
import { SpecStands } from "@/components/spec/spec-stands";

export const dynamic = "force-dynamic";

export default async function SpecBroadcastPage({ params }: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await params;
  const session = await getAppSession();
  if (!session?.user) {
    return <main className="mx-auto max-w-3xl px-1 py-10 text-center text-sm text-slate-400">Faça login para transmitir.</main>;
  }

  const config = await getSpecConfig();
  const stream = config.enabled ? await prisma.specStream.findUnique({
    where: { id: streamId },
    select: { id: true, matchId: true, tournamentId: true, title: true, broadcasterUserId: true, status: true, youtubeVideoId: true },
  }).catch(() => null) : null;

  if (!config.enabled || !stream || stream.broadcasterUserId !== session.user.id || (stream.status !== "PREPARING" && stream.status !== "LIVE")) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-1 py-10 text-center">
        <p className="text-sm text-slate-400">Esta transmissão não está disponível para você.</p>
        <Link href="/spec" className="text-xs text-[#FFCB05] underline">← Voltar ao Modo SPEC</Link>
      </main>
    );
  }

  const [view] = await enrichSpecStreams([stream]);
  const profile = SPEC_RESOLUTION_PROFILES[config.resolution];

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-black text-white">Transmitir na Zika TV</h1>
        <Link href="/spec" className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">← Zika TV</Link>
      </div>
      {config.mode === "youtube" ? (
        <SpecBroadcasterYouTube
          streamId={stream.id}
          matchLabel={view?.title ?? view?.matchLabel ?? "Partida"}
          live={stream.status === "LIVE"}
          currentVideoId={stream.youtubeVideoId}
        />
      ) : config.mode === "p2p-mesh" ? (
        <SpecBroadcasterP2P
          streamId={stream.id}
          matchLabel={view?.title ?? view?.matchLabel ?? "Partida"}
          maxVideoBitrate={specScaledBitrate(SPEC_P2P_PROFILE.maxVideoBitrate, config.fps)}
          width={SPEC_P2P_PROFILE.width}
          height={SPEC_P2P_PROFILE.height}
          fps={config.fps}
          qualityPriority={config.qualityPriority}
          resolutionLabel={SPEC_P2P_PROFILE.label}
        />
      ) : (
        <SpecBroadcaster
          streamId={stream.id}
          matchLabel={view?.title ?? view?.matchLabel ?? "Partida"}
          maxVideoBitrate={specScaledBitrate(profile.maxVideoBitrate, config.fps)}
          width={profile.width}
          height={profile.height}
          fps={config.fps}
          qualityPriority={config.qualityPriority}
          resolutionLabel={profile.label}
        />
      )}
      {config.mode !== "youtube" && stream.status === "PREPARING" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500"><span className="h-px flex-1 bg-border" />ou use um link do YouTube<span className="h-px flex-1 bg-border" /></div>
          <SpecBroadcasterYouTube
            streamId={stream.id}
            matchLabel={view?.title ?? view?.matchLabel ?? "Partida"}
            live={false}
            currentVideoId={stream.youtubeVideoId}
          />
        </div>
      )}
      {stream.status === "LIVE" && <SpecStands streamId={stream.id} sendPresence={false} />}
    </main>
  );
}
