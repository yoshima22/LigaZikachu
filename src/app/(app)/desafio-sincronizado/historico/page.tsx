import Link from "next/link";
import { ArrowLeft, Swords } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { buildSyncRoomRanking, SYNC_ROOM_STATUS_LABELS } from "@/lib/sync-challenge";
import { toBrtDateString } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export default async function DesafioSincronizadoHistoricoPage() {
  const session = await getAppSession();
  if (!session?.user) return null;

  const player = await getSessionPlayer(session.user.id);
  if (!player) {
    return <div className="py-20 text-center text-sm text-slate-500">Crie um jogador para acessar o evento.</div>;
  }

  const todayDate = toBrtDateString(new Date());

  const [pastRooms, oldEntries] = await Promise.all([
    prisma.syncEventRoom.findMany({
      where: { date: { lt: todayDate }, status: { not: "CANCELLED" } },
      orderBy: [{ date: "desc" }, { roomIndex: "asc" }],
      take: 60,
      include: {
        teams: {
          include: {
            playerA: { select: { id: true, displayName: true } },
            playerB: { select: { id: true, displayName: true } },
          },
        },
        scores: {
          orderBy: [{ wins: "desc" }, { damageDone: "desc" }, { damageTaken: "asc" }],
          include: { player: { select: { id: true, displayName: true } } },
        },
      },
    }),
    prisma.syncChallengeEntry.findMany({
      where: { playerId: player.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, status: true, bansJson: true, consumedAt: true },
    }),
  ]);

  const roomsByDate = new Map<string, typeof pastRooms>();
  for (const room of pastRooms) {
    if (!roomsByDate.has(room.date)) roomsByDate.set(room.date, []);
    roomsByDate.get(room.date)!.push(room);
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/desafio-sincronizado" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200">
          <ArrowLeft size={14} /> Voltar para o evento atual
        </Link>
        <h1 className="mt-2 font-pixel text-lg text-[#FFCB05]">Eventos anteriores</h1>
        <p className="mt-1 text-sm text-slate-400">Rankings e registros de edições passadas do Desafio Sincronizado.</p>
      </div>

      {roomsByDate.size === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-slate-500">Nenhum evento anterior registrado ainda.</p>
      ) : (
        [...roomsByDate.entries()].map(([date, rooms]) => (
          <section key={date} className="rounded-2xl border border-border bg-card p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Swords size={18} className="text-[#FFCB05]" />
              <h2 className="font-semibold text-slate-100">{date}</h2>
            </div>
            <div className="space-y-6">
              {rooms.map((room) => {
                const ranking = buildSyncRoomRanking(room);
                const medals = ["🥇", "🥈", "🥉", "4️⃣"];
                return (
                  <div key={room.id}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-200">Sala {room.roomIndex}</h3>
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-slate-400">
                        {SYNC_ROOM_STATUS_LABELS[room.status] ?? room.status}
                      </span>
                    </div>
                    {ranking.length === 0 ? (
                      <p className="text-xs text-slate-500">Sem combates registrados.</p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-slate-950/60 text-slate-400">
                              <th className="p-2 text-left">#</th>
                              <th className="p-2 text-left">Dupla</th>
                              <th className="p-2 text-right">Vitórias</th>
                              <th className="p-2 text-right">Dano</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ranking.map((row, idx) => (
                              <tr key={row.name} className="border-b border-border/50 last:border-0">
                                <td className="p-2 text-base">{medals[idx] ?? idx + 1}</td>
                                <td className="p-2 font-medium text-slate-200">{row.name}</td>
                                <td className="p-2 text-right text-slate-300">{row.wins}</td>
                                <td className="p-2 text-right text-slate-400">{row.damageDone}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold text-slate-100">Entradas consumidas antigas</h2>
        <p className="mt-1 text-xs text-slate-500">Mantido apenas para compatibilidade com registros criados antes da regra completa do PDF.</p>
        <div className="mt-4 space-y-2">
          {oldEntries.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma entrada antiga.</p>
          ) : oldEntries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-slate-950/60 p-3 text-xs text-slate-400">
              {new Date(entry.consumedAt).toLocaleString("pt-BR")} - {entry.status}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
