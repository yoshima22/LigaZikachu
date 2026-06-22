import { redirect } from "next/navigation";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { getLeaguePageData } from "./data";
import { LeagueClient } from "./_components/league-client";

export const dynamic = "force-dynamic";

export default async function LigaSemanalPage() {
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

  let data;
  try {
    data = await getLeaguePageData(player.id, player.displayName);
  } catch (err) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 space-y-2">
          <p className="font-bold">Erro ao carregar Liga Semanal (admin debug):</p>
          <pre className="whitespace-pre-wrap break-all">{String(err)}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <LeagueClient initialData={data as any} />
    </div>
  );
}
