import React from "react";

// Renderiza formatação simples de texto (compartilhada por patch notes e afins):
// **negrito**, *itálico*, __sublinhado__, quebras de linha e listas com "- ".

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const tok = match[0];
    if (tok.startsWith("**")) nodes.push(<strong key={`${keyPrefix}-${i}`}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("__")) nodes.push(<u key={`${keyPrefix}-${i}`}>{tok.slice(2, -2)}</u>);
    else nodes.push(<em key={`${keyPrefix}-${i}`}>{tok.slice(1, -1)}</em>);
    last = match.index + tok.length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function SimpleFormattedText({ text, className }: { text: string; className?: string }) {
  const lines = (text ?? "").split(/\r?\n/);
  return (
    <div className={className}>
      {lines.map((line, idx) => {
        if (line.trim() === "") return <div key={idx} className="h-1.5" />;
        const bullet = /^\s*[-•]\s+/.test(line);
        const content = bullet ? line.replace(/^\s*[-•]\s+/, "") : line;
        return bullet ? (
          <div key={idx} className="flex gap-1.5">
            <span className="shrink-0 opacity-70">•</span>
            <span>{renderInline(content, `l${idx}`)}</span>
          </div>
        ) : (
          <p key={idx}>{renderInline(content, `l${idx}`)}</p>
        );
      })}
    </div>
  );
}
