// Esqueleto exibido na hora enquanto a página do servidor monta (o layout com menu continua visível).
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Carregando">
      <div className="h-24 rounded-2xl border border-slate-800 bg-slate-900/60 motion-safe:animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-40 rounded-2xl border border-slate-800 bg-slate-900/60 motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
