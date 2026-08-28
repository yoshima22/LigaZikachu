import React from "react";

// Renderiza formatação simples de texto (compartilhada por patch notes e afins):
// **negrito**, *itálico*, __sublinhado__, quebras de linha e listas com "- ".

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|`[^`\n]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const tok = match[0];
    if (tok.startsWith("**")) nodes.push(<strong key={`${keyPrefix}-${i}`}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("__")) nodes.push(<u key={`${keyPrefix}-${i}`}>{tok.slice(2, -2)}</u>);
    else if (tok.startsWith("`")) nodes.push(<code key={`${keyPrefix}-${i}`} className="rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-[0.9em] text-rose-300 ring-1 ring-white/10">{tok.slice(1, -1)}</code>);
    else nodes.push(<em key={`${keyPrefix}-${i}`}>{tok.slice(1, -1)}</em>);
    last = match.index + tok.length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function SimpleFormattedText({ text, className, comfortable = false }: { text: string; className?: string; comfortable?: boolean }) {
  const lines = (text ?? "").split(/\r?\n/);
  return (
    <div className={className}>
      {lines.map((line, idx) => {
        if (line.trim() === "") return <div key={idx} className={comfortable ? "h-3" : "h-1.5"} />;
        const bullet = /^\s*[-•]\s+/.test(line);
        const heading = !bullet && /^(?:#{1,3}\s+|\d+[.)]\s+)/.test(line.trim());
        const content = bullet
          ? line.replace(/^\s*[-•]\s+/, "")
          : line.replace(/^#{1,3}\s+/, "");
        return bullet ? (
          <div key={idx} className={`flex ${comfortable ? "gap-3 pl-1" : "gap-1.5"}`}>
            <span className={`shrink-0 font-black text-cyan-300 ${comfortable ? "text-base" : "opacity-70"}`}>•</span>
            <span>{renderInline(content, `l${idx}`)}</span>
          </div>
        ) : heading ? (
          <h4 key={idx} className={comfortable ? "pt-1 text-base font-black leading-snug text-white sm:text-lg" : "font-bold text-white"}>
            {renderInline(content, `l${idx}`)}
          </h4>
        ) : (
          <p key={idx}>{renderInline(content, `l${idx}`)}</p>
        );
      })}
    </div>
  );
}
