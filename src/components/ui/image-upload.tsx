"use client";

import { useRef, useState } from "react";
import { ImagePlus, X, AlertCircle, Loader2 } from "lucide-react";

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  maxMb?: number;
  hint?: string;
  accept?: string;
  /** Largura máxima após redimensionamento (px). Default: 1200 */
  maxWidth?: number;
  /** Altura máxima após redimensionamento (px). Default: 1200 */
  maxHeight?: number;
  /** Qualidade JPEG 0.0–1.0. Default: 0.85. PNGs com transparência ignoram isso. */
  quality?: number;
  /** Se true, preserva PNG (para molduras com transparência). Default: false */
  preservePng?: boolean;
}

/**
 * Redimensiona e comprime a imagem via Canvas antes de converter para base64.
 * - Preserva proporção original
 * - PNGs com transparência mantêm formato PNG
 * - JPEGs/outros são convertidos para JPEG com qualidade configurável
 */
async function compressImage(
  file: File,
  maxW: number,
  maxH: number,
  quality: number,
  forcePng: boolean
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      // Redimensiona proporcionalmente se necessário
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas não disponível")); return; }

      // Fundo branco para JPEGs (evita fundo preto em imagens com transparência convertidas)
      if (!forcePng && file.type !== "image/png") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(img, 0, 0, w, h);

      const mimeType = forcePng || file.type === "image/png" ? "image/png" : "image/jpeg";
      resolve(canvas.toDataURL(mimeType, mimeType === "image/jpeg" ? quality : undefined));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Erro ao carregar imagem"));
    };

    img.src = url;
  });
}

export function ImageUpload({
  value,
  onChange,
  label = "Imagem",
  maxMb = 12,
  hint,
  accept = "image/*",
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.85,
  preservePng = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [warning, setWarning]     = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [info, setInfo]           = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setWarning(null);
    setInfo(null);
    e.target.value = "";

    const originalMb = file.size / 1024 / 1024;

    // Arquivos muito grandes antes da compressão — avisa mas continua
    if (originalMb > 50) {
      setWarning(`Arquivo muito grande (${originalMb.toFixed(1)}MB). Máximo recomendado: 50MB.`);
      return;
    }

    setCompressing(true);

    try {
      const compressed = await compressImage(file, maxWidth, maxHeight, quality, preservePng);
      const compressedMb = (compressed.length * 0.75) / 1024 / 1024; // estimativa base64 → bytes

      onChange(compressed);

      if (originalMb > 0.5) {
        setInfo(`✓ Imagem processada: ${originalMb.toFixed(1)}MB → ~${compressedMb.toFixed(1)}MB (${maxWidth}×${maxHeight}px máx)`);
      }
    } catch (err) {
      setWarning(`Erro ao processar imagem: ${err instanceof Error ? err.message : "tente novamente"}`);
    } finally {
      setCompressing(false);
    }
  };

  const isBase64 = value.startsWith("data:");
  const isUrl    = value.startsWith("http");

  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs text-slate-400">{label}</p>}

      {hint && (
        <p className="text-[11px] text-slate-500 flex items-start gap-1">
          <AlertCircle size={10} className="mt-0.5 shrink-0" /> {hint}
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
            onClick={() => { onChange(""); setWarning(null); setInfo(null); }}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
          >
            <X size={10} />
          </button>
          <p className="mt-1 text-[10px] text-slate-500">
            {isBase64 ? "Upload local" : isUrl ? "URL externa" : "Imagem definida"}
            {" · "}
            <button type="button" className="text-[#FFCB05] hover:underline"
              onClick={() => inputRef.current?.click()}>
              trocar
            </button>
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={compressing}
          onClick={() => inputRef.current?.click()}
          className="flex h-20 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs text-slate-500 hover:border-[#FFCB05]/40 hover:text-[#FFCB05] transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {compressing
            ? <><Loader2 size={16} className="animate-spin" /> Processando…</>
            : <><ImagePlus size={16} /><span>Clique para fazer upload — qualquer resolução</span></>
          }
        </button>
      )}

      {/* Indicador de compressão sobre o preview */}
      {compressing && value && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Loader2 size={11} className="animate-spin" /> Redimensionando…
        </div>
      )}

      {/* URL manual */}
      <input
        type="text"
        value={isBase64 ? "" : value}
        onChange={(e) => { onChange(e.target.value); setWarning(null); setInfo(null); }}
        placeholder="Ou cole uma URL de imagem (https://...)"
        className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
      />

      {/* Info de compressão */}
      {info && (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
          {info}
        </p>
      )}

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
