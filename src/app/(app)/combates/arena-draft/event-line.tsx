// Linha de log detalhada do combate: quem fez o quê, quanto de dano/cura e por quê.
export type LogEvent = {
  turn: number;
  actorName: string;
  targetName: string;
  action: string;
  damage: number;
  targetHpAfter?: number;
  multiplier?: number;
  advantageApplied?: boolean;
  actorRole?: string;
  targetRole?: string;
  effect?: string;
};

export function EventLine({
  event,
  roleLabel,
  targetMaxHp,
}: {
  event: LogEvent;
  roleLabel?: (role?: string) => string | null;
  targetMaxHp?: number;
}) {
  const heal = event.action === "HEAL";
  const defend = event.action === "DEFEND";
  const actor = roleLabel?.(event.actorRole);
  const target = roleLabel?.(event.targetRole);
  const mult = event.multiplier && event.multiplier !== 1 ? event.multiplier : null;
  const hpLeft =
    event.targetHpAfter !== undefined
      ? `${event.targetHpAfter}${targetMaxHp ? `/${targetMaxHp}` : ""}`
      : null;
  return (
    <div className="space-y-1 text-xs text-slate-200">
      <p>
        <b>{event.actorName}</b>
        {actor && <span className="text-[#FFCB05]"> ({actor})</span>}{" "}
        {heal ? "curou" : defend ? "se preparou contra" : "atacou"}{" "}
        <b>{event.targetName}</b>
        {target && <span className="text-slate-400"> ({target})</span>}
      </p>
      <p className="flex flex-wrap items-center gap-1.5 text-[10px]">
        {!defend && (
          <span className={`rounded px-1.5 py-0.5 font-black ${heal ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>
            {heal ? "+" : "−"}{event.damage} {heal ? "HP" : "de dano"}
          </span>
        )}
        {mult && !heal && (
          <span className={`rounded px-1.5 py-0.5 font-bold ${mult > 1 ? "bg-yellow-300/10 text-yellow-200" : "bg-slate-500/15 text-slate-300"}`}>
            {mult > 1 ? "⚡" : "🛡️"} ×{mult.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {mult > 1 ? "vantagem de tipo" : "resistência de tipo"}
          </span>
        )}
        {!mult && event.advantageApplied && !heal && (
          <span className="rounded bg-yellow-300/10 px-1.5 py-0.5 font-bold text-yellow-200">⚡ super efetivo</span>
        )}
        {hpLeft && !defend && (
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-slate-300">
            HP restante de {event.targetName}: <b>{hpLeft}</b>
          </span>
        )}
        {event.targetHpAfter === 0 && !heal && (
          <span className="rounded bg-rose-500/20 px-1.5 py-0.5 font-black text-rose-300">KO</span>
        )}
      </p>
      {event.effect && <p className="text-[10px] text-fuchsia-200">{event.effect}</p>}
    </div>
  );
}
