import Link from "next/link";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSpecConfig } from "@/lib/spec/config";
import { enrichSpecStreams } from "@/lib/spec/data";
import { SPEC_VIDEO_MAX_BITRATE } from "@/lib/spec/constants";
import { SpecBroadcaster } from "@/components/spec/spec-broadcaster";

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
    select: { id: true, matchId: true, tournamentId: true, broadcasterUserId: true, status: true },
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

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-1 py-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-black text-white">Transmitir partida</h1>
        <Link href="/spec" className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200">← Modo SPEC</Link>
      </div>
      <SpecBroadcaster streamId={stream.id} matchLabel={view?.matchLabel ?? "Partida"} maxVideoBitrate={SPEC_VIDEO_MAX_BITRATE} />
    </main>
  );
}
