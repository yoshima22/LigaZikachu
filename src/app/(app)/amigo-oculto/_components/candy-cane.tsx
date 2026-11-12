// Bengala de açúcar em SVG (não existe emoji de bengala).
export function Cane({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 32" width={size * 0.75} height={size} className={`inline-block align-[-0.15em] ${className}`} aria-label="bengala de açúcar" role="img">
      <path d="M7 30V12a5 5 0 0 1 10 0" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M7 29V12a5 5 0 0 1 10 0" fill="none" stroke="#e11d48" strokeWidth="5.5" strokeDasharray="3.2 3.2" />
    </svg>
  );
}
