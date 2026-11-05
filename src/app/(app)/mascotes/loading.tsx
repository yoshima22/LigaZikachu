// Esqueleto da página de mascotes: cabeçalho + grade de cards, no formato da tela final.
export default function Loading() {
  return (
    <div className="space-y-8" role="status" aria-busy="true" aria-label="Carregando mascotes">
      <div className="h-28 rounded-2xl border border-[#FFCB05]/20 bg-[#1A1A2E] motion-safe:animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 motion-safe:animate-pulse">
            <div className="mx-auto h-24 w-24 rounded-full bg-slate-800" />
            <div className="h-4 w-2/3 rounded bg-slate-800" />
            <div className="h-3 w-1/2 rounded bg-slate-800" />
            <div className="h-8 rounded-lg bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
