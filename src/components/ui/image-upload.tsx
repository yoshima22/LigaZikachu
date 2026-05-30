"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  maxMb?: number;
  hint?: string;
}

export function ImageUpload({ value, onChange, label = "Imagem", maxMb = 2, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxMb * 1024 * 1024) {
      alert(`Imagem muito grande. Máximo: ${maxMb}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-1">
      <span className="text-xs text-slate-400">{label}</span>
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" className="max-h-24 rounded-lg border border-border object-contain bg-slate-900" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
          >
            <X size={10} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs text-slate-500 hover:border-[#FFCB05]/40 hover:text-[#FFCB05]"
        >
          <ImagePlus size={16} /> Upload (máx {maxMb}MB)
        </button>
      )}
      {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {/* Campo de URL manual como alternativa */}
      <input
        type="text"
        value={value.startsWith("data:") ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ou cole uma URL de imagem"
        className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05]"
      />
    </div>
  );
}
