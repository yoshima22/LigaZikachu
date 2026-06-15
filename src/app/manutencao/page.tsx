export const dynamic = "force-dynamic";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatUntil(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export default async function ManutencaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const until = formatUntil(getParam(params.until));
  const message = getParam(params.message);

  return (
    <div className="min-h-screen bg-[#0D0D1A] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-6xl">⚙️</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Em Manutenção</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            A Liga Zikachu está temporariamente fora do ar para manutenção.
            Voltamos em breve!
          </p>
          {message && (
            <p className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
              {message}
            </p>
          )}
          {until && (
            <p className="text-sm font-semibold text-[#FFCB05]">
              Previsão de retorno: {until}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-4 py-3">
          <p className="text-xs text-[#FFCB05]/80">
            Acompanhe as novidades pelo grupo da Liga.
          </p>
        </div>
      </div>
    </div>
  );
}
