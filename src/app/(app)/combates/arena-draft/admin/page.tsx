import Link from "next/link";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { ArenaDraftAdminControls } from "./admin-controls";
export const dynamic = "force-dynamic";
export default async function ArenaDraftAdminPage() {
  await requireAdmin();
  const [active, finished, cancelled, timeOuts, replays] = await Promise.all([
    prisma.arenaDraftMatch.findMany({
      where: { state: { notIn: ["FINISHED", "CANCELLED"] } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        playerA: { select: { displayName: true } },
        playerB: { select: { displayName: true } },
      },
    }),
    prisma.arenaDraftMatch.count({ where: { state: "FINISHED" } }),
    prisma.arenaDraftMatch.count({ where: { state: "CANCELLED" } }),
    prisma.arenaDraftAction.count({ where: { actionType: "TIMEOUT_AUTO" } }),
    prisma.arenaDraftMatch.findMany({
      where: { state: "FINISHED" },
      orderBy: { finishedAt: "desc" },
      take: 100,
      select: { battleJson: true },
    }),
  ]);
  const bytes = replays.map((r) =>
    Buffer.byteLength(JSON.stringify(r.battleJson), "utf8"),
  );
  const average = bytes.length
    ? Math.round(bytes.reduce((a, b) => a + b, 0) / bytes.length)
    : 0;
  return (
    <div className="space-y-5">
      <Link
        href="/combates/arena-draft"
        className="text-xs font-bold text-cyan-300"
      >
        ← Arena Draft
      </Link>
      <header className="rounded-3xl bg-[#050916] p-7">
        <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">
          Controle administrativo
        </p>
        <h1 className="mt-2 text-3xl font-black text-white">
          Operação e consumo da Arena Draft
        </h1>
      </header>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Ativas", active.length],
          ["Finalizadas", finished],
          ["Canceladas", cancelled],
          ["Escolhas por timeout", timeOuts],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"
          >
            <small className="text-slate-500">{label}</small>
            <b className="mt-1 block text-2xl text-white">{value}</b>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.03] p-5">
        <b className="text-cyan-200">Peso dos replays</b>
        <p className="mt-1 text-sm text-slate-400">
          Média dos últimos {bytes.length}: {(average / 1024).toFixed(1)} KB ·
          maior: {(Math.max(0, ...bytes) / 1024).toFixed(1)} KB. O replay só é
          carregado quando alguém abre sua página.
        </p>
      </section>
      <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <h2 className="font-black text-white">Salas em andamento</h2>
        <div className="mt-4 space-y-2">
          {active.length ? (
            active.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"
              >
                <span>
                  <b className="block text-sm text-white">
                    {m.playerA.displayName} ×{" "}
                    {m.playerB?.displayName ?? "Aguardando"}
                  </b>
                  <small className="text-slate-500">
                    {m.state} · v{m.stateVersion} ·{" "}
                    {m.deadlineAt
                      ? new Date(m.deadlineAt).toLocaleString("pt-BR")
                      : "sem prazo"}
                  </small>
                </span>
                <ArenaDraftAdminControls matchId={m.id} />
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Nenhuma sala ativa.</p>
          )}
        </div>
      </section>
    </div>
  );
}
