import Link from "next/link";

// Identificador anti-impersonação: mostra o nome + o nick do PTCG Live (único por
// conta) entre parênteses, opcionalmente clicável para o perfil do jogador.

export function formatPlayerLabel(displayName: string, ptcglNick?: string | null): string {
  const nick = (ptcglNick ?? "").trim();
  return nick ? `${displayName} (${nick})` : displayName;
}

export function PlayerTag({
  id,
  displayName,
  ptcglNick,
  className,
  nickClassName,
}: {
  id?: string | null;
  displayName: string;
  ptcglNick?: string | null;
  className?: string;
  nickClassName?: string;
}) {
  const nick = (ptcglNick ?? "").trim();
  const inner = (
    <>
      <span>{displayName}</span>
      {nick && <span className={nickClassName ?? "ml-1 text-[0.85em] font-normal opacity-60"}>({nick})</span>}
    </>
  );
  if (id) {
    return (
      <Link href={`/jogadores/${id}`} className={`hover:underline ${className ?? ""}`} title={`Ver perfil de ${formatPlayerLabel(displayName, nick)}`}>
        {inner}
      </Link>
    );
  }
  return <span className={className}>{inner}</span>;
}
