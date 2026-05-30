"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, AlertCircle } from "lucide-react";

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  maxMb?: number;
  hint?: string;
  accept?: string;
}

export function ImageUpload({ value, onChange, label = "Imagem", maxMb = 6, hint, accept = "image/*" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setWarning(null);

    if (file.size > maxMb * 1024 * 1024) {
      // Avisa mas tenta carregar mesmo assim (Prisma Text field aceita qualquer tamanho)
      setWarning(`Imagem grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Recomendamos até ${maxMb}MB para melhor desempenho.`);
    }

    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
    };
    reader.onerror = () => {
      setWarning("Erro ao ler o arquivo. Tente novamente.");
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const isBase64 = value.startsWith("data:");
  const isUrl = value.startsWith("http");

  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs text-slate-400">{label}</p>}

      {hint && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <AlertCircle size={10} /> {hint}
        </p>
      )}

      {/* Preview */}
      {value ? (
        <div className="relative inline-block max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="preview"
            className="max-h-32 w-full rounded-lg border border-border object-cover bg-slate-900"
            style={{ objectPosition: "center" }}
          />
          <button
            type="button"
            onClick={() => { onChange(""); setWarning(null); }}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
          >
            <X size={10} />
          </button>
          <p className="mt-1 text-[10px] text-slate-500">
            {isBase64 ? "Upload local" : isUrl ? "URL externa" : "Imagem definida"}
            {" · "}<button type="button" className="text-[#FFCB05] hover:underline" onClick={() => inputRef.current?.click()}>trocar</button>
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs text-slate-500 hover:border-[#FFCB05]/40 hover:text-[#FFCB05] transition-colors"
        >
          <ImagePlus size={16} />
          <span>Clique para fazer upload (até {maxMb}MB)</span>
        </button>
      )}

      {/* URL manual */}
      <input
        type="text"
        value={isBase64 ? "" : value}
        onChange={(e) => { onChange(e.target.value); setWarning(null); }}
        placeholder="Ou cole uma URL de imagem (https://...)"
        className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
      />

      {warning && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-400">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          {warning}
        </p>
      )}

      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
    </div>
  );
}
