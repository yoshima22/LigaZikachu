import type { Metadata } from "next";
import Link from "next/link";
import { QuickRoomClient } from "@/components/quick-room/quick-room-client";
import { getSessionUser } from "@/lib/auth/permissions";
import { getActiveRoom, roomLabel } from "@/lib/quick-room";

export const dynamic = "force-dynamic";

// O link é o segredo da sala: não indexar.
export const metadata: Metadata = {
  title: "ZikaChat",
  robots: { index: false, follow: false },
};

export default async function QuickRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await getActiveRoom(code);

  if (!room) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
        <div className="w-full space-y-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-6 text-center">
          <h1 className="text-xl font-bold text-white">Sala encerrada</h1>
          <p className="text-sm text-slate-400">Este link não existe mais. Salas rápidas somem quando todo mundo sai.</p>
          <Link href="/salas" className="inline-block rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-900">Criar nova sala</Link>
        </div>
      </main>
    );
  }

  const user = await getSessionUser().catch(() => null);
  return <QuickRoomClient code={room.code} label={roomLabel(room.code)} hasPassword={Boolean(room.passwordHash)} isMember={Boolean(user)} />;
}
