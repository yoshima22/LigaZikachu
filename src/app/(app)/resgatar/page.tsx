import { Gift } from "lucide-react";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { RedeemForm } from "./redeem-form";

export const dynamic = "force-dynamic";

export default async function ResgatarPage() {
  const session = await getAppSession();
  if (!session?.user) return null;
  const player = await prisma.player.findUnique({ where: { userId: session.user.id }, select: { id: true } });
  const history = player
    ? await prisma.redeemCodeRedemption.findMany({
        where: { playerId: player.id },
        orderBy: { redeemedAt: "desc" },
        take: 100,
        select: { id: true, redeemedAt: true, rewardsJson: true, code: { select: { code: true } } },
      })
    : [];

  return (
    <div className="mx-auto max-w-lg space-y-4 py-6">
      <div className="flex items-center gap-3">
        <Gift className="text-primary" size={28} />
        <div>
          <h1 className="text-xl font-bold text-white">Resgatar código</h1>
          <p className="text-sm text-slate-400">Digite um código promocional para receber o prêmio.</p>
        </div>
      </div>
      <RedeemForm />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Meus códigos resgatados ({history.length})</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Você ainda não resgatou nenhum código.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-xl border border-border bg-slate-950/60 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-white">{h.code.code}</span>
                  <time className="text-xs text-slate-500">
                    {h.redeemedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
                  </time>
                </div>
                {Array.isArray(h.rewardsJson) && h.rewardsJson.length > 0 && (
                  <p className="mt-1 text-xs text-slate-400">{(h.rewardsJson as string[]).join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
