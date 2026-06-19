import { redirect } from "next/navigation";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { getTracePageData } from "./data";
import { TraceClient } from "./_components/trace-client";

export const dynamic = "force-dynamic";

export default async function CacadaDeRastrosPage() {
  const session = await getAppSession();
  if (!session?.user || !isAdmin(session.user.role)) {
    redirect("/dashboard");
  }

  const player = await getSessionPlayer(session.user.id);
  if (!player) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        Crie um jogador para acessar esta página.
      </div>
    );
  }

  const data = await getTracePageData(player.id, player.displayName);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <TraceClient initialData={data as any} />
    </div>
  );
}
