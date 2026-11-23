import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/card";
import { getAbilityInfo } from "@/lib/abilities";
import { ABILITY_VERDICTS, ABILITY_VERDICT_KEYS, type AbilityVerdict } from "@/lib/abilities/feedback";

/** Feeling dos jogadores sobre as habilidades: votos por habilidade e comentários recentes. */
export async function AbilityFeedbackPanel() {
  const rows = await prisma.abilityFeedback.findMany({
    orderBy: { updatedAt: "desc" },
    select: { abilitySlug: true, verdict: true, comment: true, updatedAt: true, player: { select: { displayName: true } } },
  });

  const bySlug = new Map<string, { counts: Record<AbilityVerdict, number>; total: number }>();
  for (const r of rows) {
    const e = bySlug.get(r.abilitySlug) ?? { counts: { TOO_STRONG: 0, TOO_WEAK: 0, BALANCED: 0, CHANGE_EFFECT: 0 }, total: 0 };
    if (r.verdict in e.counts) e.counts[r.verdict as AbilityVerdict]++;
    e.total++;
    bySlug.set(r.abilitySlug, e);
  }
  // Mais votadas primeiro; entre as menos equilibradas (maior parcela fora de "Equilibrada") no topo.
  const list = [...bySlug.entries()].sort((a, b) => b[1].total - a[1].total);
  const comments = rows.filter((r) => r.comment).slice(0, 30);

  return (
    <Card>
      <CardTitle>✨ Feedback das habilidades</CardTitle>
      <p className="mt-1 text-sm text-slate-400">{rows.length} voto(s) em {list.length} habilidade(s). Um voto por jogador e habilidade.</p>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Ainda sem votos.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-1 pr-3">Habilidade</th>
                <th className="px-2 text-center">Votos</th>
                {ABILITY_VERDICT_KEYS.map((k) => <th key={k} className="px-2 text-center">{ABILITY_VERDICTS[k].emoji} {ABILITY_VERDICTS[k].label}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map(([slug, e]) => (
                <tr key={slug} className="border-t border-border/60">
                  <td className="py-1.5 pr-3 font-bold text-slate-200">{getAbilityInfo(slug)?.name ?? slug}</td>
                  <td className="px-2 text-center tabular-nums text-slate-300">{e.total}</td>
                  {ABILITY_VERDICT_KEYS.map((k) => (
                    <td key={k} className="px-2 text-center tabular-nums">
                      {e.counts[k] > 0
                        ? <span className={ABILITY_VERDICTS[k].cls.split(" ").pop()}>{e.counts[k]} <span className="text-slate-500">({Math.round((e.counts[k] / e.total) * 100)}%)</span></span>
                        : <span className="text-slate-700">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {comments.length > 0 && (
        <div className="mt-4 border-t border-border/60 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Comentários recentes</p>
          <ul className="space-y-1.5 text-xs">
            {comments.map((r, i) => (
              <li key={i} className="rounded-lg bg-white/[.03] p-2">
                <span className="font-bold text-fuchsia-200">{getAbilityInfo(r.abilitySlug)?.name ?? r.abilitySlug}</span>
                <span className="text-slate-500"> · {ABILITY_VERDICTS[r.verdict as AbilityVerdict]?.label ?? r.verdict} · {r.player.displayName} · {r.updatedAt.toLocaleDateString("pt-BR")}</span>
                <p className="mt-0.5 text-slate-300">{r.comment}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
