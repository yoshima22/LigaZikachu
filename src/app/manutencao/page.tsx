export const dynamic = "force-dynamic";

export default function ManutencaoPage() {
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
        </div>
        <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-4 py-3">
          <p className="text-xs text-[#FFCB05]/80">
            Acompanhe as novidades pelo Discord da Liga.
          </p>
        </div>
      </div>
    </div>
  );
}
