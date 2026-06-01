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
  /** Se true, comprime automaticamente via Canvas antes de enviar */
  compress?: boolean;
  /** Largura máxima ao comprimir. Default: 1200 */
  maxWidth?: number;
  /** Altura máxima ao comprimir. Default: 1200 */
  maxHeight?: number;
  /** Qualidade JPEG 0-1. Não afeta PNGs (preserva transparência). Default: 0.88 */
  quality?: number;
}

/** Comprime via Canvas preservando transparência de PNGs */
async function compressImage(
  file: File,
  maxW: number,
  maxH: number,
  quality: number
): Promise<{ dataUrl: string; sizeMb: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      // PNGs mantêm transparência; outros formatos ficam com fundo branco
      const isPng = file.type === "image/png";
      if (!isPng) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      const mime = isPng ? "image/png" : "image/jpeg";
      const dataUrl = canvas.toDataURL(mime, isPng ? undefined : quality);
      const sizeMb = (dataUrl.length * 0.75) / 1024 / 1024;
      resolve({ dataUrl, sizeMb });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Falha ao carregar imagem")); };
    img.src = url;
  });
}

export function ImageUpload({
  value,
  onChange,
  label = "Imagem",
  maxMb = 10,
  hint,
  accept = "image/*",
  compress = false,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.88,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [warning, setWarning]   = useState<string | null>(null);
  const [info, setInfo]         = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWarning(null);
    setInfo(null);
    e.target.value = "";

    const originalMb = file.size / 1024 / 1024;

    // Bloqueia arquivos absurdamente grandes (>50MB)
    if (originalMb > 50) {
      setWarning(`Arquivo muito grande (${originalMb.toFixed(1)}MB). Máximo: 50MB.`);
      return;
    }

    if (compress) {
      setProcessing(true);
      try {
        const { dataUrl, sizeMb } = await compressImage(file, maxWidth, maxHeight, quality);
        onChange(dataUrl);
        if (originalMb > 0.5) {
          setInfo(`✓ ${originalMb.toFixed(1)}MB → ~${sizeMb.toFixed(1)}MB comprimido`);
        }
      } catch {
        setWarning("Erro ao processar a imagem. Tente outro arquivo.");
      } finally {
        setProcessing(false);
      }
      return;
    }

    // Sem compressão — lê diretamente
    if (originalMb > maxMb) {
      setWarning(
        `Arquivo grande (${originalMb.toFixed(1)}MB) — pode falhar ao salvar. ` +
        `Recomendado: até ${maxMb}MB. Tente comprimir a imagem antes.`
      );
    }

    setProcessing(true);
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result as string);
      setProcessing(false);
    };
    reader.onerror = () => {
      setWarning("Erro ao ler o arquivo. Tente novamente.");
      setProcessing(false);
    };
    reader.readAsDataURL(file);
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
            className="max-h-40 max-w-full rounded-lg border border-border object-contain bg-slate-900/80"
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
          disabled={processing}
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-xs text-slate-500 hover:border-[#FFCB05]/40 hover:text-[#FFCB05] transition-colors disabled:cursor-wait disabled:opacity-60"
        >
          {processing
            ? <><Loader2 size={18} className="animate-spin" /><span>Processando…</span></>
            : <><ImagePlus size={18} /><span>Clique para upload</span><span className="text-[10px] text-slate-600">PNG, JPG, WEBP — até {maxMb}MB</span></>
          }
        </button>
      )}

      {processing && value && (
        <p className="flex items-center gap-1 text-[11px] text-slate-400">
          <Loader2 size={11} className="animate-spin" /> Processando…
        </p>
      )}

      {/* URL manual */}
      <input
        type="text"
        value={isBase64 ? "" : value}
        onChange={(e) => { onChange(e.target.value); setWarning(null); setInfo(null); }}
        placeholder="Ou cole uma URL de imagem (https://...)"
        className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
      />

      {info && <p className="text-[11px] text-emerald-400">{info}</p>}

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
