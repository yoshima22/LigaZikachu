// Componente compartilhado entre Liga Rush e Liga Semanal: mostra os 3 jogos do
// dia do jogador (uma linha por rodada), com o mesmo visual nas duas ligas.

export type PlayerDayGame = {
  slot: number;
  time: string;                 // ex.: "19:00"
  opponentName: string | null;  // null = BYE / sem adversário
  status: "SCHEDULED" | "RESOLVED" | "WO" | "BYE" | string;
  myResult: "WIN" | "LOSS" | "DRAW" | null; // do ponto de vista do jogador
};

function resultBadge(game: PlayerDayGame) {
  if (game.status === "BYE") return <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[10px] font-black text-amber-300">Folga (BYE)</span>;
  if (game.status === "SCHEDULED") return <span className="rounded-md bg-yellow-500/15 px-2 py-0.5 text-[10px] font-black text-yellow-300">⏳ Agendado</span>;
  if (game.myResult === "WIN") return <span className="rounded-md bg-green-500/15 px-2 py-0.5 text-[10px] font-black text-green-300">Vitória</span>;
  if (game.myResult === "LOSS") return <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-[10px] font-black text-red-300">Derrota</span>;
  if (game.myResult === "DRAW") return <span className="rounded-md bg-slate-500/15 px-2 py-0.5 text-[10px] font-black text-slate-300">Empate</span>;
  return <span className="rounded-md bg-slate-500/15 px-2 py-0.5 text-[10px] font-black text-slate-300">—</span>;
}

export function PlayerDayGames({ games, title = "Seus jogos de hoje", accent = "orange" }: {
  games: PlayerDayGame[];
  title?: string;
  accent?: "orange" | "yellow";
}) {
  if (!games.length) return null;
  const accentText = accent === "orange" ? "text-orange-300" : "text-yellow-300";
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="flex items-center gap-2 font-black text-white">🎯 {title}</h3>
      <div className="mt-3 space-y-2">
        {games.map((game) => (
          <div key={game.slot} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
            <div className="min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-wide ${accentText}`}>Rodada {game.slot} · {game.time}</p>
              <p className="mt-0.5 truncate text-xs text-slate-200">
                {game.opponentName ? <>vs <strong className="text-white">{game.opponentName}</strong></> : <span className="text-slate-500">Sem adversário</span>}
              </p>
            </div>
            {resultBadge(game)}
          </div>
        ))}
      </div>
    </section>
  );
}
