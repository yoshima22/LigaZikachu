// Selo de estrelas de mascote de Laboratório. Só aparece com origem LAB e 1+ estrelas.
export function LabStarsBadge({ origin, stars }: { origin?: string | null; stars?: number | null }) {
  if (origin !== "LAB" || !stars || stars < 1) return null;
  return (
    <span className="inline-flex items-center gap-0.5 rounded border border-fuchsia-400/50 bg-fuchsia-500/15 px-1 py-px text-[9px] font-black leading-none text-amber-300" title={`Laboratório: ${stars} de 5 estrelas`}>
      ★{stars}
    </span>
  );
}
